import type { HeardNoise, Hearing } from './noise';

/** Lo que el cerebro necesita saber de su enemigo (subconjunto de `EnemyDef`). */
export interface BrainRules {
  wanderSpeed: number;
  wanderRange: number;
  chaseSpeed: number;
  investigateSpeed: number;
  sight: { range: number; height: number } | null;
  hearing: Hearing;
  onHear: 'chase' | 'investigate';
  loseTrackMs: number;
  attack: { range: number; windupMs: number; recoverMs: number; hits: number; followUpMs: number };
  staggerMs: number;
  poise: number;
  flank: { range: number; chance: number; cooldownMs: number; leapX: number; leapY: number } | null;
  echo: { listenMs: number; touchRange: number; chargeStrength: number } | null;
  breaker: { intervalMs: number } | null;
}

export type EnemyState =
  | 'wander'
  | 'investigate'
  | 'listen'
  | 'chase'
  | 'flank'
  | 'windup'
  | 'recover'
  | 'stagger'
  | 'smash'
  | 'dead';

export interface EnemyPerception {
  now: number;
  selfX: number;
  /** Posición de Alex relativa al enemigo: positivo = a su derecha / por debajo. */
  dx: number;
  dy: number;
  playerAlive: boolean;
  /** El ruido más fuerte que oye este fotograma. */
  noise?: HeardNoise | null;
  /** Lo que le cierra el paso en la dirección en que avanza. */
  blocked?: 'breakable' | 'solid' | null;
  onGround?: boolean;
}

export interface EnemyIntent {
  move: -1 | 0 | 1;
  speed: number;
  facing: 1 | -1;
  /** Verdadero solo en el instante en que descarga un golpe. */
  strike: boolean;
  /** Impulso de salto para rodear a Alex, solo en el instante del salto. */
  leap: { vx: number; vy: number } | null;
  /** Golpea la barricada que tiene delante en este instante. */
  smash: boolean;
  /** Chasquea (animación y sonido de ecolocalización) en este instante. */
  click: boolean;
}

/** Diferencia de altura máxima para iniciar un ataque. */
const ATTACK_HEIGHT = 26;
/** Al perseguir ve algo más lejos que al deambular: ya sabe dónde mirar. */
const CHASE_SIGHT_BONUS = 1.4;
/** Pausa al llegar al sitio de un ruido (los que no chasquean). */
const LOOK_AROUND_MS = 900;
/** Chasquidos durante la escucha. */
const CLICK_EVERY_MS = 420;
/** Tiempo mínimo en el aire antes de dar por terminado un salto. */
const MIN_LEAP_MS = 140;

/**
 * Cerebro común de todos los enemigos: una máquina de estados hecha de
 * comportamientos reutilizables (deambular, detectar, investigar, escuchar,
 * perseguir, rodear, atacar, romper, aturdirse, morir). Cada enemigo los
 * activa con sus datos. Solo decide; el sprite ejecuta. Sin Phaser.
 */
export class EnemyBrain {
  state: EnemyState = 'wander';
  private facing: 1 | -1 = -1;
  private stateEndsAt = 0;
  private homeX: number;
  private wanderTarget: number;
  private nextWanderAt = 0;
  /** Dónde cree que está Alex y cuándo lo percibió por última vez. */
  private lastKnownX: number | null = null;
  private lastAwareAt = -Infinity;
  private investigateX = 0;
  private hitsLeft = 0;
  private nextFlankAt = 0;
  private leapStartedAt = 0;
  private nextClickAt = 0;
  private nextSmashAt = 0;

  constructor(
    private readonly rules: BrainRules,
    homeX: number,
    /** Fuente de azar 0–1 inyectada, para pruebas reproducibles. */
    private readonly random: () => number,
  ) {
    this.homeX = homeX;
    this.wanderTarget = homeX;
  }

  /** Posición que persigue o investiga (pruebas y depuración). */
  get target(): number | null {
    return this.state === 'investigate' || this.state === 'listen' ? this.investigateX : this.lastKnownX;
  }

  get blind(): boolean {
    return this.rules.sight === null;
  }

  /** Un aviso externo (disparo, explosión) lo pone en marcha hacia `x`, o en persecución si no se indica. */
  alert(x?: number, now = 0): void {
    if (this.state === 'dead') return;
    if (x === undefined) {
      if (this.state === 'wander' || this.state === 'investigate' || this.state === 'listen') this.state = 'chase';
      return;
    }
    this.react(x, true, 1, now);
  }

  /**
   * Recibe un impacto desde `fromX`: se gira hacia el tirador y, si el
   * golpe supera su aplomo, queda aturdido un instante.
   */
  onHit(now: number, damage = Infinity, fromX?: number): void {
    if (this.state === 'dead') return;
    if (fromX !== undefined) {
      this.lastKnownX = fromX;
      this.lastAwareAt = now;
    }
    if (damage < this.rules.poise) {
      if (this.state === 'wander' || this.state === 'investigate' || this.state === 'listen') this.state = 'chase';
      return;
    }
    this.state = 'stagger';
    this.stateEndsAt = now + this.rules.staggerMs;
  }

  kill(): void {
    this.state = 'dead';
  }

  update(p: EnemyPerception): EnemyIntent {
    if (this.state === 'dead') return this.idle();
    if (!p.playerAlive && this.state !== 'stagger') {
      this.state = 'wander';
      this.lastKnownX = null;
    }
    const playerX = p.selfX + p.dx;
    const distance = Math.abs(p.dx);

    // ── Percepción ──
    const sight = this.rules.sight;
    const sightRange = sight ? sight.range * (this.isHunting() ? CHASE_SIGHT_BONUS : 1) : 0;
    const sees = p.playerAlive && sight !== null && distance <= sightRange && Math.abs(p.dy) <= sight.height;
    const echo = this.rules.echo;
    const touches = p.playerAlive && echo !== null && distance <= echo.touchRange && Math.abs(p.dy) <= ATTACK_HEIGHT;
    if (sees || touches) {
      this.lastKnownX = playerX;
      this.lastAwareAt = p.now;
      if (this.isCalm()) this.state = 'chase';
    }
    const noise = p.noise;
    if (noise && p.playerAlive && this.isInterruptible()) this.react(noise.x, noise.fromPlayer, noise.strength, p.now);

    // ── Comportamientos por estado ──
    switch (this.state) {
      case 'wander':
        return this.wander(p);
      case 'investigate':
        return this.investigate(p);
      case 'listen':
        return this.listen(p);
      case 'chase':
        return this.chase(p, sees || touches);
      case 'flank':
        return this.flankFlight(p);
      case 'windup':
        return this.windup(p);
      case 'smash':
        return this.smash(p);
      default:
        // 'recover' o 'stagger': quieto hasta que pase el tiempo.
        if (p.now >= this.stateEndsAt) this.state = 'chase';
        return this.idle();
    }
  }

  // ───────────────────────── Reacción al ruido ─────────────────────────

  private react(x: number, fromPlayer: boolean, strength: number, now: number): void {
    const echo = this.rules.echo;
    const chases = this.rules.onHear === 'chase' || (echo !== null && fromPlayer && strength >= echo.chargeStrength);
    if (chases && fromPlayer) {
      this.lastKnownX = x;
      this.lastAwareAt = now;
      if (this.isCalm() || this.state === 'chase') this.state = 'chase';
      return;
    }
    // Ruido de otra criatura, o débil para un Chasqueador: va a ver qué es.
    if (this.isCalm()) {
      this.investigateX = x;
      this.state = 'investigate';
    }
  }

  /** Deambula, investiga o escucha: aún no va a por Alex. */
  private isCalm(): boolean {
    return this.state === 'wander' || this.state === 'investigate' || this.state === 'listen';
  }

  private isHunting(): boolean {
    return !this.isCalm();
  }

  /** Puede cambiar de idea por un ruido (no en mitad de un golpe o un salto). */
  private isInterruptible(): boolean {
    return this.isCalm() || this.state === 'chase';
  }

  // ───────────────────────── Comportamientos ─────────────────────────

  private wander(p: EnemyPerception): EnemyIntent {
    if (p.now >= this.nextWanderAt) {
      this.wanderTarget = this.homeX + (this.random() * 2 - 1) * this.rules.wanderRange;
      this.nextWanderAt = p.now + 1500 + this.random() * 2500;
    }
    return this.walkTo(p.selfX, this.wanderTarget, this.rules.wanderSpeed);
  }

  private investigate(p: EnemyPerception): EnemyIntent {
    if (Math.abs(this.investigateX - p.selfX) < 4) {
      // Ha llegado: escucha (y chasquea si sabe ecolocalizar).
      this.state = 'listen';
      this.stateEndsAt = p.now + (this.rules.echo?.listenMs ?? LOOK_AROUND_MS);
      this.nextClickAt = p.now;
      return this.idle();
    }
    return this.walkTo(p.selfX, this.investigateX, this.rules.investigateSpeed);
  }

  private listen(p: EnemyPerception): EnemyIntent {
    if (p.now >= this.stateEndsAt) {
      // No ha encontrado nada: se queda por esta zona.
      this.state = 'wander';
      this.homeX = p.selfX;
      this.nextWanderAt = p.now;
      return this.idle();
    }
    const intent = this.idle();
    if (this.rules.echo && p.now >= this.nextClickAt) {
      this.nextClickAt = p.now + CLICK_EVERY_MS;
      intent.click = true;
    }
    return intent;
  }

  private chase(p: EnemyPerception, aware: boolean): EnemyIntent {
    const distance = Math.abs(p.dx);
    const towardsPlayer: 1 | -1 = p.dx >= 0 ? 1 : -1;

    // Golpe: a su alcance y a su altura. Un ciego solo ataca lo que nota.
    if (distance <= this.rules.attack.range && Math.abs(p.dy) <= ATTACK_HEIGHT && (aware || !this.blind)) {
      this.facing = towardsPlayer;
      this.hitsLeft = this.rules.attack.hits;
      this.startWindup(p.now, this.rules.attack.windupMs);
      return this.idle();
    }

    // Ha perdido el rastro: va a la última posición conocida.
    if (!aware && p.now - this.lastAwareAt > this.rules.loseTrackMs) {
      this.investigateX = this.lastKnownX ?? p.selfX;
      this.state = 'investigate';
      return this.idle();
    }

    // Rodear: salta por encima de Alex para caer a su espalda.
    const flank = this.rules.flank;
    if (flank && aware && p.onGround !== false && distance <= flank.range && distance > this.rules.attack.range + 6) {
      if (p.now >= this.nextFlankAt) {
        this.nextFlankAt = p.now + flank.cooldownMs;
        if (this.random() < flank.chance) {
          this.state = 'flank';
          this.facing = towardsPlayer;
          this.leapStartedAt = p.now;
          const intent = this.idle();
          intent.leap = { vx: towardsPlayer * flank.leapX, vy: -flank.leapY };
          return intent;
        }
      }
    }

    // Barricada delante: el que puede, la derriba.
    if (p.blocked === 'breakable' && this.rules.breaker) {
      this.state = 'smash';
      this.nextSmashAt = p.now + this.rules.breaker.intervalMs * 0.5;
      return this.idle();
    }

    const targetX = aware || this.lastKnownX === null ? p.selfX + p.dx : this.lastKnownX;
    if (!aware && this.blind && Math.abs(targetX - p.selfX) < 4) {
      // El ciego llega a donde sonó el ruido y no encuentra nada: escucha.
      this.investigateX = targetX;
      this.state = 'investigate';
      return this.idle();
    }
    // Si Alex está justo encima o debajo, espera en lugar de temblar.
    if (Math.abs(targetX - p.selfX) < 3) return this.idle();
    return this.walkTo(p.selfX, targetX, this.rules.chaseSpeed);
  }

  private flankFlight(p: EnemyPerception): EnemyIntent {
    // En el aire mantiene el impulso; al tocar suelo se gira y ataca.
    if (p.now - this.leapStartedAt >= MIN_LEAP_MS && p.onGround !== false) {
      this.state = 'chase';
      this.facing = p.dx >= 0 ? 1 : -1;
      return this.idle();
    }
    return { ...this.idle(), move: this.facing, speed: this.rules.flank?.leapX ?? 0 };
  }

  private startWindup(now: number, ms: number): void {
    this.state = 'windup';
    this.stateEndsAt = now + ms;
  }

  private windup(p: EnemyPerception): EnemyIntent {
    if (p.now < this.stateEndsAt) return this.idle();
    this.hitsLeft -= 1;
    if (this.hitsLeft > 0) this.startWindup(p.now, this.rules.attack.followUpMs);
    else {
      this.state = 'recover';
      this.stateEndsAt = p.now + this.rules.attack.recoverMs;
    }
    return { ...this.idle(), strike: true };
  }

  private smash(p: EnemyPerception): EnemyIntent {
    if (p.blocked !== 'breakable') {
      this.state = 'chase';
      return this.idle();
    }
    const intent = this.idle();
    if (p.now >= this.nextSmashAt) {
      this.nextSmashAt = p.now + (this.rules.breaker?.intervalMs ?? 1000);
      intent.smash = true;
    }
    return intent;
  }

  private walkTo(selfX: number, targetX: number, speed: number): EnemyIntent {
    const gap = targetX - selfX;
    if (Math.abs(gap) < 2) return this.idle();
    this.facing = gap > 0 ? 1 : -1;
    return { ...this.idle(), move: this.facing, speed };
  }

  private idle(): EnemyIntent {
    return { move: 0, speed: 0, facing: this.facing, strike: false, leap: null, smash: false, click: false };
  }
}
