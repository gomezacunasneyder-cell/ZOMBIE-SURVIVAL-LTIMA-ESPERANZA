import type Phaser from 'phaser';
import { WALKER_VARIANTS } from '../../art/painters/zombies';
import type { WalkerDef } from '../../content/enemies';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import { SFX, playSfxAt } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import { Zombie, type ZombieTarget } from '../entities/Zombie';

/** Cada cuánto llega un caminante nuevo desde fuera de la pantalla. */
const TRICKLE_MS = 7000;
/** Con este número de zombis vivos no llegan más. */
const TRICKLE_LIMIT = 6;

export interface StrikeHandler {
  (zombie: Zombie): void;
}

/**
 * Gestiona los caminantes del nivel: los crea, los actualiza, cuenta las
 * bajas y mantiene un goteo de llegadas para que la zona no quede vacía.
 * El director de oleadas completo llegará en la Fase 4.
 */
export class ZombieDirector {
  readonly group: Phaser.GameObjects.Group;
  private killCount = 0;
  private nextTrickleAt: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: WalkerDef,
    private readonly groundY: number,
    private readonly worldWidth: number,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
    private readonly trickle: boolean,
  ) {
    this.group = scene.add.group();
    this.nextTrickleAt = scene.time.now + TRICKLE_MS;
  }

  get kills(): number {
    return this.killCount;
  }

  get zombies(): Zombie[] {
    return this.group.getChildren() as Zombie[];
  }

  /** Zombis que van a por Alex ahora mismo: marca la intensidad de la música. */
  get chasingCount(): number {
    return this.zombies.filter((z) => z.alive && z.brain.state !== 'wander').length;
  }

  get aliveCount(): number {
    return this.zombies.filter((z) => z.alive).length;
  }

  spawn(x: number): Zombie {
    const variant = this.rng.pick(WALKER_VARIANTS);
    const zombie = new Zombie(this.scene, x, this.groundY, variant, this.def, () => this.rng.next());
    this.group.add(zombie);
    return zombie;
  }

  /** Un ruido en `x` pone en persecución a los caminantes dentro del radio. */
  alertNear(x: number, radius: number): void {
    for (const zombie of this.zombies) {
      if (!zombie.alive || Math.abs(zombie.x - x) > radius) continue;
      if (zombie.brain.state === 'wander') {
        zombie.brain.alert();
        if (this.rng.chance(0.5)) playSfxAt(this.scene, SFX.groan, zombie.x, 0.3);
      }
    }
  }

  /** Registra una baja y avisa a la interfaz. */
  registerKill(): void {
    this.killCount += 1;
    this.bus.emit('kills', { total: this.killCount });
  }

  update(now: number, target: ZombieTarget, onStrike: StrikeHandler): void {
    for (const zombie of this.zombies) {
      const before = zombie.brain.state;
      if (zombie.step(now, target)) onStrike(zombie);
      const after = zombie.brain.state;
      // Gemido al descubrir a Alex y gruñido al lanzar el golpe.
      if (before === 'wander' && after === 'chase' && this.rng.chance(0.6)) playSfxAt(this.scene, SFX.groan, zombie.x, 0.3);
      if (before !== 'windup' && after === 'windup') playSfxAt(this.scene, SFX.snarl, zombie.x, 0.4);
    }

    if (this.trickle && target.alive && now >= this.nextTrickleAt) {
      this.nextTrickleAt = now + TRICKLE_MS;
      if (this.aliveCount < TRICKLE_LIMIT) this.spawnOffscreen();
    }
  }

  /** Hace llegar un caminante por un borde que la cámara no esté mostrando. */
  private spawnOffscreen(): void {
    const camera = this.scene.cameras.main;
    const right = camera.scrollX + GAME_WIDTH + 30;
    const left = camera.scrollX - 30;
    const canRight = right < this.worldWidth - 10;
    const canLeft = left > 10;
    if (!canRight && !canLeft) return;
    const useRight = canRight && (!canLeft || this.rng.chance(0.7));
    this.spawn(useRight ? right : left).brain.alert();
  }

  syncShadows(): void {
    for (const zombie of this.zombies) zombie.syncShadow(this.groundY);
  }

  clear(): void {
    this.group.clear(true, true);
  }
}
