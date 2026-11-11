import type Phaser from 'phaser';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { ShotRequest } from '../entities/WeaponHandler';
import type { Zombie } from '../entities/Zombie';
import type { ExplosiveHandle } from '../world/LevelBuilder';
import { BulletSystem } from './BulletSystem';
import type { CameraRig } from './CameraRig';
import type { ExplosionSystem } from './ExplosionSystem';
import type { FxSystem } from './FxSystem';
import type { Light } from './LightingSystem';
import type { ZombieDirector } from './ZombieDirector';

export interface GunfireDeps {
  bullets: BulletSystem;
  fx: FxSystem;
  cameraRig: CameraRig;
  director: ZombieDirector;
  explosions: ExplosionSystem;
  muzzleLight: Light;
  /** Aplica daño a un zombi (la escena cuenta las bajas). */
  damageZombie(zombie: Zombie, damage: number, pushX: number, now: number): void;
}

/** Retardo hasta que la escopeta expulsa el cartucho (al bombear). */
const SHELL_EJECT_MS = 200;
/** Separación mínima entre sonidos de impacto iguales: siete perdigones no suenan siete veces. */
const IMPACT_SOUND_GAP_MS = 45;

/**
 * Disparos en el mundo: convierte cada `ShotRequest` en proyectiles,
 * fogonazo de luz, casquillo, sacudida y ruido, y resuelve los impactos
 * de las balas contra zombis y contra el escenario.
 */
export class GunfireSystem {
  private muzzleLightUntil = 0;
  private lastFleshSound = -Infinity;
  private lastHardSound = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: GunfireDeps,
  ) {
    deps.muzzleLight.enabled = false;
  }

  fire(shot: ShotRequest, now: number): void {
    const { bullets, fx, cameraRig, director, muzzleLight } = this.deps;
    const weapon = shot.weapon;
    bullets.fire(shot, now);

    const first = shot.directions[0] ?? { x: shot.facing, y: 0 };
    const ejectX = shot.x - first.x * 6;
    if (weapon.casing === 'shell') {
      this.scene.time.delayedCall(SHELL_EJECT_MS, () => fx.casing(ejectX, shot.y, shot.facing, 'shell'));
    } else {
      fx.casing(ejectX, shot.y, shot.facing);
    }
    cameraRig.addTrauma(weapon.recoil.cameraTrauma);
    // El fogonazo ilumina un instante lo que hay alrededor.
    muzzleLight.x = shot.x;
    muzzleLight.y = shot.y;
    muzzleLight.enabled = true;
    this.muzzleLightUntil = now + (weapon.pellets > 1 ? 110 : 70);
    // El ruido del disparo atrae a los caminantes cercanos.
    director.alertNear(shot.x, weapon.noiseRadius);
  }

  update(now: number): void {
    const light = this.deps.muzzleLight;
    if (light.enabled && now >= this.muzzleLightUntil) light.enabled = false;
  }

  /**
   * Registra las colisiones de las balas. Phaser no garantiza el orden de
   * los dos objetos en estas llamadas: se identifica cuál es la bala.
   */
  wire(solids: Phaser.GameObjects.Zone[]): void {
    const { bullets, director, fx, explosions } = this.deps;
    const physics = this.scene.physics;

    physics.add.overlap(bullets.group, director.group, (first, second) => {
      const firstIsBullet = BulletSystem.isBullet(first as Phaser.GameObjects.GameObject);
      const bullet = (firstIsBullet ? first : second) as Phaser.Physics.Arcade.Image;
      const zombie = (firstIsBullet ? second : first) as Zombie;
      if (!bullet.active || !zombie.alive) return;
      const data = BulletSystem.dataOf(bullet);
      const damage = BulletSystem.damageOf(bullet);
      const now = this.scene.time.now;
      fx.fleshImpact(bullet.x, bullet.y, damage);
      if (now - this.lastFleshSound >= IMPACT_SOUND_GAP_MS) {
        this.lastFleshSound = now;
        playSfxAt(this.scene, SFX.fleshHit, zombie.x, 0.4);
      }
      bullets.remove(bullet);
      this.deps.damageZombie(zombie, damage, data.dirX * data.knockback, now);
    });

    physics.add.overlap(bullets.group, solids, (first, second) => {
      const firstIsBullet = BulletSystem.isBullet(first as Phaser.GameObjects.GameObject);
      const bullet = (firstIsBullet ? first : second) as Phaser.Physics.Arcade.Image;
      const solid = (firstIsBullet ? second : first) as Phaser.GameObjects.Zone;
      if (!bullet.active) return;
      fx.hardImpact(bullet.x, bullet.y);
      bullets.remove(bullet);
      const explosive = solid.data?.get('explosive') as ExplosiveHandle | undefined;
      if (explosive) explosions.hit(explosive);
      const now = this.scene.time.now;
      if (now - this.lastHardSound >= IMPACT_SOUND_GAP_MS) {
        this.lastHardSound = now;
        playSfxAt(this.scene, SFX.ricochet, bullet.x, 0.25);
      }
    });
  }
}
