import type Phaser from 'phaser';
import { BOSS_HAZARDS, BOSS_SUPPLIES, BOSS_TEXT, DEVOURER } from '../../content/boss';
import type { EnemyKind } from '../../content/enemies';
import { DevourerBrain, type BossEvent, type BossPhase } from '../../core/boss/DevourerBrain';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import { SFX, playSfx, playSfxAt } from '../boot/registerAudio';
import { Devourer } from '../entities/Devourer';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import type { AirdropSystem } from '../systems/AirdropSystem';
import type { BarricadeSystem } from '../systems/BarricadeSystem';
import type { CombatSystem } from '../systems/CombatSystem';
import type { GunfireSystem } from '../systems/GunfireSystem';
import type { ThrowableSystem } from '../systems/ThrowableSystem';
import { BossHazards } from '../systems/BossHazards';
import type { CameraRig } from '../systems/CameraRig';
import type { FxSystem } from '../systems/FxSystem';
import type { LightingSystem } from '../systems/LightingSystem';
import type { NoiseSystem } from '../systems/NoiseSystem';
import type { ZombieDirector } from '../systems/ZombieDirector';
import type { BarricadeHandle } from '../world/LevelBuilder';

export interface BossFightDeps {
  bus: EventBus<GameEvents>;
  director: ZombieDirector;
  player: Player;
  airdrop: AirdropSystem;
  barricades: BarricadeSystem;
  lighting: LightingSystem;
  fx: FxSystem;
  cameraRig: CameraRig;
  noise: NoiseSystem;
  rng: Rng;
  groundY: number;
  worldWidth: number;
  refugeX: number;
  hurtPlayer: (damage: number, fromX: number, now: number, shove: number) => void;
}

export type DamageSource = 'bullet' | 'blast' | 'fire';

const BURN_TICK_MS = 250;
const BURN_MS = 2000;
const HURT_VOICE_GAP_MS = 650;
const BAR_EVERY_MS = 120;
/** Distancia a la que se detiene ante una barricada en pie para derribarla. */
const SMASH_REACH = 26;

/**
 * Combate contra EL DEVORADOR: el cerebro decide, `Devourer` se ve y se
 * mueve, `BossHazards` resuelve lo que hace daño. Aquí se reparten los
 * sucesos: barricadas derribadas, infectados invocados, cambios de fase
 * con su aviso y los suministros de Cóndor 7, y el daño que recibe.
 */
export class BossFight {
  readonly devourer: Devourer;
  readonly hazards: BossHazards;
  brain: DevourerBrain | null = null;
  private readonly minions: Zombie[] = [];
  private nextBurnTickAt = 0;
  private lastHurtVoice = -Infinity;
  private nextBarAt = 0;
  private frenzyAnnounced = false;
  /** Daño recibido desde el inicio (pruebas). */
  taken = 0;
  /** Se llama una vez, cuando el jefe empieza a morir. */
  onDied: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: BossFightDeps,
    entryX: number,
  ) {
    this.devourer = new Devourer(scene, deps.lighting, entryX, deps.groundY);
    this.devourer.setShade(0, 1);
    this.hazards = new BossHazards(scene, deps.lighting, deps.fx, deps.cameraRig, deps.player, deps.groundY, deps.worldWidth, deps.hurtPlayer);
  }

  get brainMaxHealth(): number {
    return DEVOURER.maxHealth;
  }

  get phase(): BossPhase {
    return this.brain?.phase ?? 1;
  }

  get minionsAlive(): number {
    return this.minions.filter((z) => z.alive && z.active).length;
  }

  /** Las armas de Alex le alcanzan: balas, llamas, cohetes, explosiones y el fuego del molotov. */
  connect(gunfire: GunfireSystem, combat: CombatSystem, throwables: ThrowableSystem): void {
    gunfire.wireTarget(this.devourer.sprite, (damage, now, source) => this.damage(damage, now, source));
    combat.blastTargets.push((blast) => {
      // Se mide hasta el borde del cuerpo, no hasta su centro: es enorme.
      const distance = Math.max(0, Math.hypot(this.devourer.x - blast.x, this.devourer.centerY - blast.y) - 16);
      const damage = blast.enemyDamageAt(distance);
      if (damage > 0) this.damage(damage, this.scene.time.now, 'blast');
    });
    throwables.onFireTick = (x, half, now) => {
      if (Math.abs(this.devourer.x - x) <= half + 14) this.damage(0, now, 'fire');
    };
  }

  /** Empieza el combate (al acabar la presentación). */
  begin(now: number): void {
    this.brain = new DevourerBrain(DEVOURER, this.deps.rng, now);
    this.emitBar(now, true);
  }

  /** Cóndor 7 deja munición y botiquín en el refugio, junto a Alex. */
  dropSupplies(which: 'start' | 'enrage', now: number): void {
    const { player, refugeX, airdrop, bus } = this.deps;
    bus.emit('airdrop', { phase: 'inbound', radio: which === 'start' ? BOSS_TEXT.supplies : BOSS_TEXT.enragedSupplies });
    const side = player.x <= refugeX ? 1 : -1;
    const x = Math.round(Math.max(30, Math.min(this.deps.worldWidth - 30, player.x - side * 28)));
    airdrop.dropCrate(x, { items: BOSS_SUPPLIES[which].map((item) => ({ ...item })), rarity: 'uncommon' }, now);
  }

  /** Daño de un arma. Devuelve el que de verdad le hace. */
  damage(amount: number, now: number, source: DamageSource): number {
    const brain = this.brain;
    if (!brain || !brain.alive) return 0;
    if (source === 'fire') this.devourer.burningUntil = now + BURN_MS;
    const factor = source === 'blast' ? BOSS_HAZARDS.blastFactor : 1;
    const applied = brain.damage(amount * factor, now);
    if (applied <= 0) return 0;
    this.taken += applied;
    this.devourer.flash(now);
    if (now - this.lastHurtVoice >= HURT_VOICE_GAP_MS && amount >= 20) {
      this.lastHurtVoice = now;
      playSfxAt(this.scene, SFX.bossHurt, this.devourer.x, 0.35);
    }
    if (!brain.alive) this.died(now);
    return applied;
  }

  /** Barricada en pie entre el jefe y Alex, pegada a él. */
  private barricadeAhead(x: number, playerX: number): BarricadeHandle | null {
    const dir = Math.sign(playerX - x);
    for (const b of this.deps.barricades.barricades) {
      if (b.broken || Math.sign(b.x - x) !== dir) continue;
      if (Math.abs(b.x - x) - b.width / 2 <= SMASH_REACH + 2) return b;
    }
    return null;
  }

  /** No atraviesa una barricada en pie: se queda delante para derribarla. */
  private clampMove(from: number, to: number): number {
    let x = to;
    for (const b of this.deps.barricades.barricades) {
      if (b.broken) continue;
      const stop = b.width / 2 + SMASH_REACH;
      if (from <= b.x - stop && x > b.x - stop) x = b.x - stop;
      if (from >= b.x + stop && x < b.x + stop) x = b.x + stop;
    }
    return Math.max(40, Math.min(this.deps.worldWidth - 40, x));
  }

  update(now: number, deltaMs: number): void {
    const brain = this.brain;
    const { player } = this.deps;
    if (brain) {
      const ahead = this.barricadeAhead(this.devourer.x, player.x);
      const intent = brain.update({
        now,
        x: this.devourer.x,
        playerX: player.x,
        playerAlive: player.alive,
        minions: this.minionsAlive,
        barricadeAhead: ahead ? ahead.x : null,
        arena: [40, this.deps.worldWidth - 40],
      });
      const from = this.devourer.x;
      if (intent.vx !== 0) this.devourer.setX(this.clampMove(from, from + (intent.vx * deltaMs) / 1000));
      this.devourer.moving = Math.abs(this.devourer.x - from) > 0.01;
      for (const event of intent.events) this.handle(event, now, ahead);
      this.burn(now);
      this.emitBar(now, false);
    }
    this.hazards.update(now, deltaMs, brain ? { x: this.devourer.x, alive: brain.alive, phase: brain.phase } : null);
    this.devourer.update(now, brain);
  }

  private burn(now: number): void {
    if (now >= this.devourer.burningUntil || now < this.nextBurnTickAt) return;
    this.nextBurnTickAt = now + BURN_TICK_MS;
    this.damage((BOSS_HAZARDS.burnDps * BURN_TICK_MS) / 1000, now, 'bullet');
  }

  private handle(event: BossEvent, now: number, ahead: BarricadeHandle | null): void {
    const { bus, cameraRig, noise, player } = this.deps;
    const x = this.devourer.x;
    const phase = this.phase;
    switch (event.type) {
      case 'windup':
        playSfxAt(this.scene, event.attack === 'summon' ? SFX.bossRoar : SFX.bossGrowl, x, 0.6);
        break;
      case 'slam':
        this.hazards.slam(event.x, phase);
        noise.emit(event.x, 400, 'impact', now, false);
        break;
      case 'chargeHit':
        this.hazards.swipe(event.x, event.facing, phase, now);
        break;
      case 'spit':
        this.hazards.spit(this.devourer.mouth(event.facing), player.x, event.count, phase);
        break;
      case 'summon':
        this.summon(event.count);
        break;
      case 'smash':
        if (ahead) this.smash(ahead, now);
        break;
      case 'enrage':
        playSfx(this.scene, SFX.bossRoar, 0.9, 0);
        cameraRig.addTrauma(0.8);
        if (event.phase === 2) {
          bus.emit('announce', { ...BOSS_TEXT.enraged, tone: 'boss' });
          this.dropSupplies('enrage', now);
        } else bus.emit('announce', { ...BOSS_TEXT.frenzy, tone: 'boss' });
        this.emitBar(now, true);
        break;
      case 'eruption':
        this.hazards.erupt(event.spikes, phase, now);
        if (!this.frenzyAnnounced) this.frenzyAnnounced = true;
        break;
      case 'exhausted':
        bus.emit('announce', { ...BOSS_TEXT.exhausted, tone: 'success' });
        break;
      case 'flinch':
        playSfxAt(this.scene, SFX.bossHurt, x, 0.55);
        break;
      default:
        break;
    }
  }

  /** De sus heridas brotan infectados pequeños, a los dos lados. */
  private summon(count: number): void {
    const { director, fx, groundY, worldWidth } = this.deps;
    playSfxAt(this.scene, SFX.bossRoar, this.devourer.x, 0.8);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = Math.max(20, Math.min(worldWidth - 20, this.devourer.x + side * (24 + i * 10)));
      const kind: EnemyKind = i % 3 === 2 ? 'walker' : 'runner';
      const zombie = director.spawn(x, kind);
      zombie.brain.alert();
      fx.bloodBurst(x, groundY - 10, 6);
      this.minions.push(zombie);
    }
    // Solo cuenta a los que siguen en pie.
    for (let i = this.minions.length - 1; i >= 0; i--) if (!(this.minions[i] as Zombie).alive) this.minions.splice(i, 1);
  }

  /** Mazazo contra la barricada reforzada: dos bastan para tirarla. */
  private smash(barricade: BarricadeHandle, now: number): void {
    const step = Math.ceil(barricade.maxHits / BOSS_HAZARDS.smashHits);
    barricade.hits = Math.min(barricade.maxHits - 1, barricade.hits + step - 1);
    barricade.lastHitAt = -Infinity;
    const broke = this.deps.barricades.hit(barricade, now);
    playSfxAt(this.scene, SFX.bossSlam, barricade.x, 0.9);
    this.deps.cameraRig.addTrauma(0.6);
    this.deps.fx.dustPuff(barricade.x, this.deps.groundY, 10);
    if (broke) this.deps.bus.emit('announce', { title: '¡HA DESTROZADO LA BARRICADA!', subtitle: 'YA NO HAY DONDE ESCONDERSE', tone: 'danger' });
  }

  private died(now: number): void {
    this.hazards.clear();
    // Sus engendros huyen despavoridos.
    this.deps.director.scatter(this.devourer.x);
    playSfx(this.scene, SFX.bossDeath, 1, 0);
    this.emitBar(now, true);
    this.onDied?.();
  }

  /** Barra de vida del HUD (con un ritmo máximo para no saturar el bus). */
  emitBar(now: number, force: boolean, visible = true): void {
    if (!force && now < this.nextBarAt) return;
    this.nextBarAt = now + BAR_EVERY_MS;
    const brain = this.brain;
    this.deps.bus.emit('boss', {
      visible: visible && (!brain || brain.alive || brain.state === 'dying'),
      name: BOSS_TEXT.name,
      title: BOSS_TEXT.title,
      health: brain?.health ?? DEVOURER.maxHealth,
      max: DEVOURER.maxHealth,
      phase: brain?.phase ?? 1,
      exposed: brain?.state === 'exhausted',
    });
  }
}
