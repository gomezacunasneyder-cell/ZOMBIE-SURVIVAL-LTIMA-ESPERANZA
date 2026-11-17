import type { Rng } from '../math/Rng';
import { planEruption, type EruptionRules } from './eruption';

/**
 * Cerebro de EL DEVORADOR. Decide qué hace el jefe en cada instante:
 *
 *   emerging ─► stalk ─► (slam | charge | spit | summon | smash) ─► stalk …
 *        al 50 % de vida ─► enrage (fase 2: más rápido, más agresivo)
 *        al 25 % ─► enrage ─► fase 3: eruption ─► exhausted ─► stalk ─► … eruption
 *        sin vida ─► dying ─► dead
 *
 * Cada ataque tiene preparación (se ve venir), un instante activo y una
 * recuperación en la que es vulnerable. No sabe nada de sprites ni de
 * física: devuelve cuánto moverse y los sucesos que la escena resuelve.
 */

export type BossPhase = 1 | 2 | 3;
export type BossAttack = 'slam' | 'charge' | 'spit' | 'summon' | 'smash';
export type BossState = 'emerging' | 'stalk' | 'flinch' | BossAttack | 'enrage' | 'eruption' | 'exhausted' | 'dying' | 'dead';
/** Tramo del ataque en curso. */
export type AttackStep = 'windup' | 'active' | 'recover';

export interface AttackRules {
  windupMs: number;
  activeMs: number;
  recoverMs: number;
  /** Tiempo mínimo entre dos ataques iguales. */
  cooldownMs: number;
  /** Distancia a Alex a la que lo elige. */
  range: readonly [number, number];
  /** Probabilidad relativa frente a los demás que estén listos. */
  weight: number;
}

export interface DevourerRules {
  maxHealth: number;
  /** Fracción de vida a la que empieza cada fase. */
  phase2At: number;
  phase3At: number;
  walkSpeed: number;
  /** Multiplicador de velocidad y de rapidez de los ataques en las fases 2 y 3. */
  enragedSpeed: number;
  enragedTempo: number;
  chargeSpeed: number;
  /** Distancia que intenta mantener con Alex al acecho. */
  stalkRange: number;
  /** Pausa mínima entre el final de un ataque y el siguiente, por fase. */
  attackGapMs: readonly [number, number, number];
  emergeMs: number;
  enrageMs: number;
  /** Encaja un respingo cada vez que pierde esta fracción de vida. */
  flinchEvery: number;
  flinchMs: number;
  attacks: Readonly<Record<BossAttack, AttackRules>>;
  /** Proyectiles por escupitajo en cada fase. */
  spitCount: readonly [number, number, number];
  /** Enemigos por invocación y tope de vivos. */
  summonCount: readonly [number, number, number];
  summonCap: number;
  eruption: EruptionRules;
  exhaustedMs: number;
  /** Daño que recibe agotado, tras la erupción: la oportunidad de disparo. */
  exhaustedDamage: number;
  dyingMs: number;
}

/** Lo que el jefe percibe en un fotograma. */
export interface BossSense {
  now: number;
  x: number;
  playerX: number;
  playerAlive: boolean;
  /** Enemigos invocados que siguen en pie. */
  minions: number;
  /** Barricada en pie entre el jefe y Alex, pegada a él, o `null`. */
  barricadeAhead: number | null;
  /** Límites de la arena para la erupción. */
  arena: readonly [number, number];
}

export type BossEvent =
  | { type: 'emerged' }
  | { type: 'windup'; attack: BossAttack }
  | { type: 'slam'; x: number; facing: 1 | -1; phase: BossPhase }
  | { type: 'chargeHit'; x: number; facing: 1 | -1 }
  | { type: 'spit'; count: number; facing: 1 | -1 }
  | { type: 'summon'; count: number }
  | { type: 'smash'; barricadeX: number }
  | { type: 'enrage'; phase: BossPhase }
  | { type: 'eruption'; spikes: { x: number; delayMs: number }[] }
  | { type: 'exhausted' }
  | { type: 'recovered' }
  | { type: 'flinch' }
  | { type: 'died' }
  | { type: 'dead' };

export interface BossIntent {
  /** Velocidad horizontal deseada, en px/s (con signo). */
  vx: number;
  facing: 1 | -1;
  events: BossEvent[];
}

export class DevourerBrain {
  state: BossState = 'emerging';
  phase: BossPhase = 1;
  step: AttackStep = 'windup';
  facing: 1 | -1 = -1;
  health: number;
  private stateAt: number;
  private readonly readyAt = new Map<BossAttack, number>();
  private nextAttackAt: number;
  private nextEruptionAt = Infinity;
  private flinchMark: number;
  private flinchPending = false;
  private chargeHit = false;
  private stepFired = false;
  private pendingPhase: BossPhase | null = null;

  constructor(
    readonly rules: DevourerRules,
    private readonly rng: Rng,
    now: number,
  ) {
    this.health = rules.maxHealth;
    this.stateAt = now;
    this.nextAttackAt = now + rules.emergeMs + 1200;
    this.flinchMark = rules.maxHealth;
  }

  get ratio(): number {
    return this.health / this.rules.maxHealth;
  }

  get alive(): boolean {
    return this.state !== 'dying' && this.state !== 'dead';
  }

  /** Mientras aparece, se enfurece o muere no se le puede herir. */
  get invulnerable(): boolean {
    return this.state === 'emerging' || this.state === 'enrage' || !this.alive;
  }

  /** Factor de daño que recibe ahora mismo. */
  get damageFactor(): number {
    return this.invulnerable ? 0 : this.state === 'exhausted' ? this.rules.exhaustedDamage : 1;
  }

  private tempo(): number {
    return this.phase === 1 ? 1 : this.rules.enragedTempo;
  }

  private enter(state: BossState, now: number): void {
    this.state = state;
    this.stateAt = now;
    this.step = 'windup';
    this.stepFired = false;
  }

  /**
   * Recibe daño (ya multiplicado por el arma). Devuelve el que de verdad
   * le ha hecho. Cruzar un umbral de vida programa el cambio de fase.
   */
  damage(amount: number, now: number): number {
    const applied = Math.min(this.health, Math.max(0, amount) * this.damageFactor);
    if (applied <= 0) return 0;
    this.health -= applied;
    const { phase2At, phase3At, maxHealth } = this.rules;
    if (this.health <= 0) {
      this.health = 0;
      this.enter('dying', now);
      return applied;
    }
    if (this.phase === 1 && this.ratio <= phase2At) this.pendingPhase = 2;
    if (this.phase <= 2 && this.ratio <= phase3At) this.pendingPhase = 3;
    if (this.flinchMark - this.health >= maxHealth * this.rules.flinchEvery) {
      this.flinchMark = this.health;
      this.flinchPending = true;
    }
    return applied;
  }

  /** Avanza el tiempo. */
  update(sense: BossSense): BossIntent {
    const { now } = sense;
    const events: BossEvent[] = [];
    const elapsed = now - this.stateAt;
    const dx = sense.playerX - sense.x;
    let vx = 0;

    switch (this.state) {
      case 'emerging':
        if (elapsed >= this.rules.emergeMs) {
          this.enter('stalk', now);
          events.push({ type: 'emerged' });
        }
        break;
      case 'dying':
        if (elapsed >= this.rules.dyingMs) {
          this.state = 'dead';
          events.push({ type: 'dead' });
        } else if (!this.stepFired) {
          this.stepFired = true;
          events.push({ type: 'died' });
        }
        break;
      case 'dead':
        break;
      case 'enrage':
        if (elapsed >= this.rules.enrageMs) {
          this.enter('stalk', now);
          this.nextAttackAt = now + 600;
          if (this.phase === 3) this.nextEruptionAt = now + 400;
        }
        break;
      case 'eruption':
        if (!this.stepFired) {
          this.stepFired = true;
          events.push({ type: 'eruption', spikes: planEruption(this.rules.eruption, sense.arena, sense.x, this.rng) });
        }
        if (elapsed >= this.rules.eruption.durationMs) {
          this.enter('exhausted', now);
          events.push({ type: 'exhausted' });
        }
        break;
      case 'exhausted':
        if (elapsed >= this.rules.exhaustedMs) {
          this.enter('stalk', now);
          this.nextAttackAt = now + 700;
          this.nextEruptionAt = now + this.rules.eruption.everyMs;
          events.push({ type: 'recovered' });
        }
        break;
      case 'flinch':
        if (elapsed >= this.rules.flinchMs) this.enter('stalk', now);
        break;
      case 'stalk':
        vx = this.stalk(sense, dx, events);
        break;
      default:
        vx = this.attack(this.state, sense, dx, elapsed, events);
        break;
    }

    // Cambio de fase pendiente: se enfurece en cuanto termina lo que está haciendo.
    if (this.pendingPhase && (this.state === 'stalk' || this.state === 'flinch')) {
      this.phase = this.pendingPhase;
      this.pendingPhase = null;
      this.enter('enrage', now);
      events.push({ type: 'enrage', phase: this.phase });
      vx = 0;
    }
    return { vx, facing: this.facing, events };
  }

  /** Al acecho: se acerca, encara a Alex y elige el siguiente ataque. */
  private stalk(sense: BossSense, dx: number, events: BossEvent[]): number {
    const { now } = sense;
    if (Math.abs(dx) > 4) this.facing = dx < 0 ? -1 : 1;
    if (this.flinchPending) {
      // Respingo: acaba de perder otra fracción de vida.
      this.flinchPending = false;
      this.enter('flinch', now);
      events.push({ type: 'flinch' });
      return 0;
    }
    if (sense.barricadeAhead !== null) {
      this.begin('smash', now, events);
      return 0;
    }
    if (this.phase === 3 && now >= this.nextEruptionAt) {
      this.enter('eruption', now);
      events.push({ type: 'windup', attack: 'slam' });
      return 0;
    }
    if (sense.playerAlive && now >= this.nextAttackAt) {
      const choice = this.choose(Math.abs(dx), sense, now);
      if (choice) {
        this.begin(choice, now, events);
        return 0;
      }
    }
    const distance = Math.abs(dx);
    const speed = this.rules.walkSpeed * (this.phase === 1 ? 1 : this.rules.enragedSpeed);
    return distance > this.rules.stalkRange ? this.facing * speed : 0;
  }

  private choose(distance: number, sense: BossSense, now: number): BossAttack | null {
    const options: { attack: BossAttack; weight: number }[] = [];
    for (const attack of ['slam', 'charge', 'spit', 'summon'] as const) {
      const rules = this.rules.attacks[attack];
      if (now < (this.readyAt.get(attack) ?? 0)) continue;
      if (distance < rules.range[0] || distance > rules.range[1]) continue;
      if (attack === 'summon' && sense.minions >= this.rules.summonCap) continue;
      options.push({ attack, weight: rules.weight });
    }
    if (options.length === 0) return null;
    let roll = this.rng.next() * options.reduce((sum, o) => sum + o.weight, 0);
    for (const option of options) {
      roll -= option.weight;
      if (roll < 0) return option.attack;
    }
    return (options[options.length - 1] as { attack: BossAttack }).attack;
  }

  private begin(attack: BossAttack, now: number, events: BossEvent[]): void {
    this.enter(attack, now);
    this.chargeHit = false;
    events.push({ type: 'windup', attack });
  }

  /** Ataque en curso: preparación, golpe y recuperación. */
  private attack(attack: BossAttack, sense: BossSense, dx: number, elapsed: number, events: BossEvent[]): number {
    const rules = this.rules.attacks[attack];
    const tempo = this.tempo();
    const windup = rules.windupMs * tempo;
    const active = rules.activeMs * (attack === 'charge' ? 1 : tempo);
    const recover = rules.recoverMs * tempo;
    // Durante la preparación sigue a Alex con la mirada (salvo al derribar).
    if (elapsed < windup) {
      this.step = 'windup';
      if (attack !== 'smash' && Math.abs(dx) > 4) this.facing = dx < 0 ? -1 : 1;
      if (attack === 'smash' && sense.barricadeAhead !== null) this.facing = sense.barricadeAhead < sense.x ? -1 : 1;
      return 0;
    }
    if (elapsed < windup + active) {
      this.step = 'active';
      return this.activeStep(attack, sense, dx, events);
    }
    if (elapsed < windup + active + recover) {
      this.step = 'recover';
      return 0;
    }
    this.readyAt.set(attack, sense.now + rules.cooldownMs * tempo);
    this.nextAttackAt = sense.now + (this.rules.attackGapMs[this.phase - 1] ?? 0);
    this.enter('stalk', sense.now);
    return 0;
  }

  private activeStep(attack: BossAttack, sense: BossSense, dx: number, events: BossEvent[]): number {
    const first = !this.stepFired;
    this.stepFired = true;
    const index = this.phase - 1;
    switch (attack) {
      case 'slam':
        if (first) events.push({ type: 'slam', x: sense.x + this.facing * 30, facing: this.facing, phase: this.phase });
        return 0;
      case 'spit':
        if (first) events.push({ type: 'spit', count: this.rules.spitCount[index] ?? 3, facing: this.facing });
        return 0;
      case 'summon':
        if (first) events.push({ type: 'summon', count: this.rules.summonCount[index] ?? 3 });
        return 0;
      case 'smash':
        if (first && sense.barricadeAhead !== null) events.push({ type: 'smash', barricadeX: sense.barricadeAhead });
        return 0;
      case 'charge': {
        // Embestida: corre hacia donde estaba Alex y descarga el zarpazo al alcanzarlo.
        const speed = this.rules.chargeSpeed * (this.phase === 1 ? 1 : this.rules.enragedSpeed);
        const reached = Math.abs(dx) < 34 || sense.barricadeAhead !== null;
        if (first) this.chargeHit = false;
        if (reached && !this.chargeHit) {
          this.chargeHit = true;
          events.push({ type: 'chargeHit', x: sense.x + this.facing * 26, facing: this.facing });
        }
        return this.chargeHit ? 0 : this.facing * speed;
      }
    }
  }
}
