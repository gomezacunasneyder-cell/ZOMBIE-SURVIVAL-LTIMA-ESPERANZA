import type Phaser from 'phaser';
import { ENEMY_VARIANTS } from '../../art/enemyArt';
import { WALKER_VARIANTS } from '../../art/painters/zombies';
import { ENEMIES, type EnemyDef, type EnemyKind } from '../../content/enemies';
import { SIEGE_SMASH_MS, SPAWN_INSET } from '../../content/waves';
import type { NoiseField } from '../../core/ai/noise';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import { SFX, playSfxAt, type SfxKey } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import { Zombie, type StepResult, type ZombieTarget } from '../entities/Zombie';
import type { BarricadeHandle } from '../world/LevelBuilder';

/** Cada cuánto llega un enemigo nuevo desde fuera de la pantalla. */
const TRICKLE_MS = 7000;
/**
 * Separación mínima entre dos voces iguales: en una horda, decenas de
 * gruñidos a la vez saturan el audio y no se distinguen.
 */
const VOICE_GAP_MS = 110;

/** Enemigos que se crean de antemano en cada fotograma. */
const PREWARM_PER_FRAME = 4;

/** Con este número de enemigos vivos no llegan más. */
const TRICKLE_LIMIT = 6;

export interface DirectorEvents {
  /** Un golpe alcanza a Alex. */
  strike(zombie: Zombie): void;
  /** Descarga un golpe, alcance o no. */
  swing(zombie: Zombie): void;
  /** Un mutante golpea una barricada. */
  smash(zombie: Zombie, barricade: BarricadeHandle): void;
}

/** Sonido de quien descubre a Alex y de quien lanza el golpe, por tipo. */
const VOICES: Record<EnemyKind, { alert: SfxKey; attack: SfxKey }> = {
  walker: { alert: SFX.groan, attack: SFX.snarl },
  runner: { alert: SFX.screech, attack: SFX.snarl },
  clicker: { alert: SFX.clicks, attack: SFX.screech },
  mutant: { alert: SFX.roar, attack: SFX.roar },
};

/**
 * Gestiona los enemigos del nivel: los crea por tipo, les cuenta lo que
 * oyen y qué barricada tienen delante, convierte sus gruñidos en ruido
 * (que oyen los Chasqueadores), cuenta las bajas y mantiene un goteo de
 * llegadas cuyo tipo depende de la zona.
 */
export class ZombieDirector {
  readonly group: Phaser.GameObjects.Group;
  private killCount = 0;
  /** Enemigos en juego (vivos y cadáveres aún visibles). */
  private readonly live: Zombie[] = [];
  /** Enemigos retirados, listos para reutilizarse, por definición. */
  private readonly pool = new Map<EnemyDef, Zombie[]>();
  private readonly siegeDefs = new Map<EnemyKind, EnemyDef>();
  private readonly lastVoice = new Map<SfxKey, number>();
  private createdCount = 0;
  /** Enemigos por crear de antemano, poco a poco, antes de una horda. */
  private readonly prewarmQueue: EnemyKind[] = [];
  private spawnedCount = 0;
  private nextTrickleAt: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly groundY: number,
    private readonly worldWidth: number,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
    private readonly trickle: boolean,
    private readonly noise: NoiseField,
    private readonly barricades: BarricadeHandle[],
    /** Pesos de los tipos que llegan en la zona actual. */
    private readonly reinforcements: () => Partial<Record<EnemyKind, number>>,
    /** Modo asedio (supervivencia): todos derriban las barricadas en vez de trepar. */
    private readonly siege = false,
  ) {
    this.group = scene.add.group();
    this.nextTrickleAt = scene.time.now + TRICKLE_MS;
  }

  get kills(): number {
    return this.killCount;
  }

  get zombies(): Zombie[] {
    return this.live;
  }

  /** Objetos Zombie creados de verdad, enemigos aparecidos y retirados en reserva (pruebas de rendimiento). */
  get poolStats(): { created: number; spawned: number; pooled: number } {
    let pooled = 0;
    for (const list of this.pool.values()) pooled += list.length;
    return { created: this.createdCount, spawned: this.spawnedCount, pooled };
  }

  /** Definición con la que juega cada tipo: en asedio golpea las barricadas en vez de saltarlas. */
  private defFor(kind: EnemyKind): EnemyDef {
    const def = ENEMIES[kind];
    if (!this.siege) return def;
    let siege = this.siegeDefs.get(kind);
    if (!siege) {
      siege = { ...def, breaker: def.breaker ?? { intervalMs: SIEGE_SMASH_MS } };
      this.siegeDefs.set(kind, siege);
    }
    return siege;
  }

  /** Enemigos que van a por Alex ahora mismo: marca la intensidad de la música. */
  get chasingCount(): number {
    const hunting = new Set(['chase', 'flank', 'windup', 'recover', 'smash']);
    return this.zombies.filter((z) => z.alive && hunting.has(z.brain.state)).length;
  }

  get aliveCount(): number {
    return this.zombies.filter((z) => z.alive).length;
  }

  spawn(x: number, kind: EnemyKind = 'walker'): Zombie {
    const def = this.defFor(kind);
    const variants = kind === 'walker' ? WALKER_VARIANTS : (ENEMY_VARIANTS[def.art] ?? []);
    const variant = this.rng.pick(variants);
    const random = (): number => this.rng.next();
    let zombie = this.pool.get(def)?.pop();
    if (zombie) zombie.revive(x, this.groundY, variant, random);
    else {
      zombie = new Zombie(this.scene, x, this.groundY, def, variant, random);
      zombie.setRecycler((z) => this.recycle(z));
      this.group.add(zombie);
      this.createdCount += 1;
    }
    this.spawnedCount += 1;
    // Con muchos enemigos en juego, los cadáveres duran menos.
    zombie.corpseMs = this.live.length > 40 ? 2500 : this.live.length > 20 ? 4000 : 6000;
    this.live.push(zombie);
    return zombie;
  }

  /**
   * Crea de antemano, unos pocos por fotograma, los enemigos que va a
   * necesitar una horda y los deja en el depósito: cuando llegue no hay
   * que crear decenas de objetos de golpe y la imagen no se resiente.
   */
  prewarm(plan: Partial<Record<EnemyKind, number>>): void {
    for (const [kind, count] of Object.entries(plan) as [EnemyKind, number][]) {
      const def = this.defFor(kind);
      const ready = (this.pool.get(def)?.length ?? 0) + this.prewarmQueue.filter((k) => k === kind).length;
      for (let i = ready; i < count; i++) this.prewarmQueue.push(kind);
    }
  }

  private prewarmStep(): void {
    for (let i = 0; i < PREWARM_PER_FRAME && this.prewarmQueue.length > 0; i++) {
      const kind = this.prewarmQueue.shift() as EnemyKind;
      const def = this.defFor(kind);
      const variants = kind === 'walker' ? WALKER_VARIANTS : (ENEMY_VARIANTS[def.art] ?? []);
      const zombie = new Zombie(this.scene, -200, this.groundY, def, this.rng.pick(variants), () => this.rng.next());
      zombie.setRecycler((z) => this.recycle(z));
      this.group.add(zombie);
      this.createdCount += 1;
      this.live.push(zombie);
      zombie.stash();
    }
  }

  private recycle(zombie: Zombie): void {
    const index = this.live.indexOf(zombie);
    if (index >= 0) {
      this.live[index] = this.live[this.live.length - 1] as Zombie;
      this.live.pop();
    }
    let list = this.pool.get(zombie.def);
    if (!list) {
      list = [];
      this.pool.set(zombie.def, list);
    }
    list.push(zombie);
  }

  /**
   * Llegada de una oleada por un lado (-1 izquierdo, 1 derecho), justo fuera de la pantalla,
   * con un poco de dispersión. Van a por Alex; el Chasqueador, ciego,
   * avanza hacia el refugio hasta que oiga algo.
   */
  spawnAtEdge(kind: EnemyKind, side: -1 | 1, refugeX: number): Zombie {
    // Entran justo fuera de la vista por ese lado (o por el borde del nivel si está más cerca).
    const jitter = this.rng.next() * 40;
    const camera = this.scene.cameras.main;
    const x =
      side < 0
        ? Math.max(SPAWN_INSET, camera.scrollX - 28 - jitter)
        : Math.min(this.worldWidth - SPAWN_INSET, camera.scrollX + GAME_WIDTH + 28 + jitter);
    const zombie = this.spawn(x, kind);
    if (zombie.brain.blind) zombie.brain.alert(refugeX, this.scene.time.now);
    else zombie.brain.alert();
    return zombie;
  }

  /** Registra una baja y avisa a la interfaz. */
  registerKill(): void {
    this.killCount += 1;
    this.bus.emit('kills', { total: this.killCount });
  }

  /** Barricada en pie que toca a alguien situado en `x` y mirando hacia `facing`. */
  private barricadeAhead(x: number, facing: 1 | -1, reach: number): BarricadeHandle | null {
    for (const barricade of this.barricades) {
      if (barricade.broken) continue;
      const gap = (barricade.x - x) * facing - barricade.width / 2;
      if (gap >= -2 && gap <= reach) return barricade;
    }
    return null;
  }

  update(now: number, target: ZombieTarget, events: DirectorEvents): void {
    this.prewarmStep();
    const senses = { barricadeAhead: (x: number, f: 1 | -1, r: number) => this.barricadeAhead(x, f, r) };
    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      const before = zombie.brain.state;
      const heard = this.noise.loudestFor(zombie.x, zombie.def.hearing, now, zombie.x);
      const result = zombie.step(now, target, { ...senses, noise: heard });
      this.react(zombie, before, result, now, events);
    }

    this.dropFled();
    if (this.trickle && target.alive && now >= this.nextTrickleAt) {
      this.nextTrickleAt = now + TRICKLE_MS;
      if (this.aliveCount < TRICKLE_LIMIT) this.spawnOffscreen();
    }
  }

  /** Sonidos, ruido de criatura y sucesos que resuelve la escena. */
  private react(zombie: Zombie, before: string, result: StepResult, now: number, events: DirectorEvents): void {
    const after = zombie.brain.state;
    const voice = VOICES[zombie.def.id];
    const shout = (key: SfxKey, volume: number): void => {
      this.voice(key, zombie.x, volume, now);
      // Los demás enemigos oyen sus gritos: así se llaman entre ellos.
      this.noise.emit({ x: zombie.x, radius: zombie.def.voice, kind: 'creature', at: now, fromPlayer: false });
    };
    const calm = before === 'wander' || before === 'investigate' || before === 'listen';
    if (calm && after === 'chase' && (zombie.def.id !== 'walker' || this.rng.chance(0.6))) shout(voice.alert, 0.35);
    if (before !== 'windup' && after === 'windup') shout(voice.attack, 0.4);
    if (result.clicked) this.voice(SFX.clicks, zombie.x, 0.45, now);
    if (result.leaped) this.voice(SFX.screech, zombie.x, 0.35, now);
    if (result.swung) events.swing(zombie);
    if (result.hit) events.strike(zombie);
    if (result.smashed) events.smash(zombie, result.smashed);
  }

  private voice(key: SfxKey, x: number, volume: number, now: number): void {
    if (now - (this.lastVoice.get(key) ?? -Infinity) < VOICE_GAP_MS) return;
    this.lastVoice.set(key, now);
    playSfxAt(this.scene, key, x, volume);
  }

  /** Hace llegar un enemigo por un borde que la cámara no esté mostrando. */
  private spawnOffscreen(): void {
    const camera = this.scene.cameras.main;
    const right = camera.scrollX + GAME_WIDTH + 30;
    const left = camera.scrollX - 30;
    const canRight = right < this.worldWidth - 10;
    const canLeft = left > 10;
    if (!canRight && !canLeft) return;
    const useRight = canRight && (!canLeft || this.rng.chance(0.7));
    const zombie = this.spawn(useRight ? right : left, this.pickReinforcement());
    // Llegan atraídos por el jaleo; el Chasqueador, ciego, solo acude a lo que oiga.
    if (!zombie.brain.blind) zombie.brain.alert();
  }

  /**
   * Enemigos que acuden a un punto (las cajas de suministros): llegan por
   * el borde de la pantalla más cercano a él, sin saber aún dónde está
   * Alex; el ruido de la caja hace el resto. Devuelve cuántos han llegado.
   */
  spawnAmbush(targetX: number, count: number, cap: number): number {
    if (!this.trickle) return 0;
    const camera = this.scene.cameras.main;
    const centre = camera.scrollX + GAME_WIDTH / 2;
    let spawned = 0;
    for (let i = 0; i < count && this.aliveCount < cap; i++) {
      // La mayoría por el lado de la caja; alguno por el contrario, para rodearla.
      const towards = i % 3 === 2 ? targetX < centre : targetX >= centre;
      const x = towards ? camera.scrollX + GAME_WIDTH + 24 + i * 14 : camera.scrollX - 24 - i * 14;
      if (x < 10 || x > this.worldWidth - 10) continue;
      this.spawn(x, this.pickReinforcement());
      spawned += 1;
    }
    return spawned;
  }

  private pickReinforcement(): EnemyKind {
    const weights = Object.entries(this.reinforcements()) as [EnemyKind, number][];
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.rng.next() * total;
    for (const [kind, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return 'walker';
  }

  /**
   * Todos huyen, alejándose de `fromX` (llega EL DEVORADOR). Los que salen
   * de la pantalla vuelven al depósito sin contar como bajas.
   */
  scatter(fromX: number): void {
    for (const zombie of this.zombies) {
      if (zombie.alive) zombie.fleeing = zombie.x < fromX ? -1 : 1;
    }
  }

  /** Retira a los que huían y ya no se ven. */
  private dropFled(): void {
    const camera = this.scene.cameras.main;
    for (const zombie of [...this.zombies]) {
      if (!zombie.alive || zombie.fleeing === 0) continue;
      const out = zombie.x < camera.scrollX - 40 || zombie.x > camera.scrollX + GAME_WIDTH + 40 || zombie.x <= 12 || zombie.x >= this.worldWidth - 12;
      if (out) zombie.stash();
    }
  }

  syncShadows(): void {
    for (const zombie of this.zombies) zombie.syncShadow(this.groundY);
  }

  clear(): void {
    this.group.clear(true, true);
    this.live.length = 0;
    this.pool.clear();
    this.prewarmQueue.length = 0;
  }
}
