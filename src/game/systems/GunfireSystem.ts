import type Phaser from 'phaser';
import { NOISE_RADIUS } from '../../core/ai/noise';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { ShotRequest } from '../entities/WeaponHandler';
import type { Zombie } from '../entities/Zombie';
import type { ExplosiveHandle } from '../world/LevelBuilder';
import { BulletSystem, type BulletData } from './BulletSystem';
import type { BurnSystem } from './BurnSystem';
import type { CameraRig } from './CameraRig';
import type { ExplosionSystem } from './ExplosionSystem';
import type { FxSystem } from './FxSystem';
import type { Light } from './LightingSystem';
import type { NoiseSystem } from './NoiseSystem';
import type { ZombieDirector } from './ZombieDirector';

export interface GunfireDeps {
  bullets: BulletSystem;
  fx: FxSystem;
  cameraRig: CameraRig;
  director: ZombieDirector;
  explosions: ExplosionSystem;
  muzzleLight: Light;
  noise: NoiseSystem;
  burns: BurnSystem;
  /** Aplica daño a un zombi (la escena cuenta las bajas). */
  damageZombie(zombie: Zombie, damage: number, pushX: number, now: number, fire?: boolean): void;
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
    const { bullets, fx, cameraRig, noise, muzzleLight } = this.deps;
    const weapon = shot.weapon;
    // A quemarropa la boca del cañón queda por delante del enemigo: esos
    // proyectiles impactan ya, en lugar de salir detrás de él.
    const flying = shot.directions.filter((direction) => !this.pointBlank(shot, direction, now));
    if (flying.length > 0) bullets.fire({ ...shot, directions: flying }, now);

    const first = shot.directions[0] ?? { x: shot.facing, y: 0 };
    const ejectX = shot.x - first.x * 6;
    if (weapon.casing === 'none') {
      // Lanzallamas y lanzacohetes no expulsan casquillos.
    } else if (weapon.casing === 'shell') {
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
    // El ruido del disparo atrae a los enemigos que lo oigan.
    noise.emit(shot.x, weapon.noiseRadius, 'shot', now, true);
  }

  /** Busca un enemigo entre el hombro y la boca del cañón. Si lo hay, le aplica el impacto. */
  private pointBlank(shot: ShotRequest, direction: { x: number; y: number }, now: number): boolean {
    const reach = Math.hypot(shot.x - shot.fromX, shot.y - shot.fromY);
    for (const zombie of this.deps.director.zombies) {
      if (!zombie.alive) continue;
      const body = zombie.body as Phaser.Physics.Arcade.Body;
      for (let d = 0; d <= reach; d += 2) {
        const px = shot.fromX + direction.x * d;
        const py = shot.fromY + direction.y * d;
        if (px < body.left || px > body.right || py < body.top || py > body.bottom) continue;
        const weapon = shot.weapon;
        if (weapon.projectile === 'rocket' && weapon.blast) {
          // Cohete a quemarropa: estalla en la cara del enemigo… y cerca de Alex.
          this.deps.explosions.blastAt(px, py, weapon.blast);
          return true;
        }
        if (weapon.projectile === 'flame') {
          // Las llamas atraviesan: queman al que está pegado y siguen.
          this.burn(zombie, weapon.damage, weapon.burn, Math.sign(direction.x || 1) * weapon.knockback, now);
          return false;
        }
        this.deps.fx.fleshImpact(px, py, weapon.damage);
        if (now - this.lastFleshSound >= IMPACT_SOUND_GAP_MS) {
          this.lastFleshSound = now;
          playSfxAt(this.scene, SFX.fleshHit, zombie.x, 0.4);
        }
        this.deps.damageZombie(zombie, weapon.damage, Math.sign(direction.x || 1) * weapon.knockback, now);
        return true;
      }
    }
    return false;
  }

  /** Llamas y cohetes contra un enemigo. Devuelve `true` si ya se ha resuelto el impacto. */
  private special(bullet: Phaser.Physics.Arcade.Image, data: BulletData, zombie: Zombie, damage: number, now: number): boolean {
    if (data.projectile === 'flame') {
      // Atraviesa a todos los que toca, pero a cada uno solo le quema una vez.
      if (data.touched.has(zombie)) return true;
      data.touched.add(zombie);
      this.burn(zombie, damage, data.burn, data.dirX * data.knockback, now);
      return true;
    }
    if (data.projectile === 'rocket' && data.blast) {
      this.deps.bullets.remove(bullet);
      this.deps.damageZombie(zombie, damage, data.dirX * data.knockback, now);
      this.deps.explosions.blastAt(bullet.x, bullet.y, data.blast);
      return true;
    }
    return false;
  }

  private burn(zombie: Zombie, damage: number, burn: BulletData['burn'], pushX: number, now: number): void {
    this.deps.damageZombie(zombie, damage, pushX, now, true);
    if (burn && zombie.alive) this.deps.burns.ignite(zombie, burn, now);
  }

  /**
   * Las balas también alcanzan a otro objetivo (EL DEVORADOR). Las llamas
   * le prenden fuego y atraviesan; el cohete estalla contra él.
   */
  wireTarget(sprite: Phaser.Physics.Arcade.Sprite, hit: (damage: number, now: number, source: 'bullet' | 'fire') => number): void {
    const { bullets, fx, explosions } = this.deps;
    this.scene.physics.add.overlap(bullets.group, sprite, (first, second) => {
      const bullet = (BulletSystem.isBullet(first as Phaser.GameObjects.GameObject) ? first : second) as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return;
      const data = BulletSystem.dataOf(bullet);
      const damage = BulletSystem.damageOf(bullet);
      const now = this.scene.time.now;
      if (data.projectile === 'flame') {
        if (data.touched.has(sprite)) return;
        data.touched.add(sprite);
        hit(damage, now, 'fire');
        return;
      }
      bullets.remove(bullet);
      if (hit(damage, now, 'bullet') > 0) fx.fleshImpact(bullet.x, bullet.y, damage);
      else fx.hardImpact(bullet.x, bullet.y);
      if (data.projectile === 'rocket' && data.blast) explosions.blastAt(bullet.x, bullet.y, data.blast);
      else if (now - this.lastFleshSound >= IMPACT_SOUND_GAP_MS) {
        this.lastFleshSound = now;
        playSfxAt(this.scene, SFX.fleshHit, bullet.x, 0.4);
      }
    });
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
      if (this.special(bullet, data, zombie, damage, now)) return;
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
      const data = BulletSystem.dataOf(bullet);
      const hitExplosive = solid.data?.get('explosive') as ExplosiveHandle | undefined;
      if (data.projectile === 'flame') {
        // El fuego se apaga contra el obstáculo; un bidón alcanzado acaba estallando.
        bullets.remove(bullet);
        if (hitExplosive) explosions.hit(hitExplosive);
        return;
      }
      if (data.projectile === 'rocket' && data.blast) {
        bullets.remove(bullet);
        explosions.blastAt(bullet.x, bullet.y, data.blast);
        return;
      }
      fx.hardImpact(bullet.x, bullet.y);
      bullets.remove(bullet);
      const explosive = solid.data?.get('explosive') as ExplosiveHandle | undefined;
      if (explosive) explosions.hit(explosive);
      const now = this.scene.time.now;
      // El impacto también suena: sirve para distraer a un Chasqueador.
      this.deps.noise.emit(bullet.x, NOISE_RADIUS.impact, 'impact', now, false);
      if (now - this.lastHardSound >= IMPACT_SOUND_GAP_MS) {
        this.lastHardSound = now;
        playSfxAt(this.scene, SFX.ricochet, bullet.x, 0.25);
      }
    });
  }
}
