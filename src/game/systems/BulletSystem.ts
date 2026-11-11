import Phaser from 'phaser';
import { bulletFrame } from '../../art/catalog';
import { bulletAngle } from '../../art/painters/guns';
import { damageAtDistance, travelTimeMs, type FalloffRules } from '../../core/combat/ballistics';
import { ATLAS_KEY } from '../boot/registerArt';
import { GAME_WIDTH } from '../config';
import type { ShotRequest } from '../entities/Player';
import { DEPTH } from '../world/depths';

export interface BulletData {
  /** Daño, alcance y caída de daño del arma que la disparó. */
  falloff: FalloffRules;
  knockback: number;
  /** Sentido horizontal del disparo, para empujar al enemigo. */
  dirX: number;
  originX: number;
  originY: number;
  diesAt: number;
  weaponId: string;
}

/** Suficiente para una ráfaga de ametralladora y dos disparos de escopeta a la vez. */
const MAX_BULLETS = 96;

/**
 * Balas como proyectiles reales: salen de la boca del cañón, viajan en
 * línea recta a la velocidad del arma y desaparecen al impactar, al
 * agotar su alcance o al salir de la pantalla. Se reutilizan desde una
 * reserva fija para no crear objetos durante el combate.
 */
export class BulletSystem {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(private readonly scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: MAX_BULLETS,
      allowGravity: false,
    });
  }

  /** Número de balas en vuelo. */
  get activeCount(): number {
    return this.group.countActive(true);
  }

  /** Posición y velocidad de cada bala en vuelo (para pruebas). */
  snapshot(): { x: number; y: number; vx: number; vy: number; weapon: string }[] {
    return (this.group.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter((bullet) => bullet.active)
      .map((bullet) => {
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        const weapon = BulletSystem.dataOf(bullet).weaponId;
        return { x: bullet.x, y: bullet.y, vx: body.velocity.x, vy: body.velocity.y, weapon };
      });
  }

  /**
   * Lanza todos los proyectiles de un disparo (uno, o varios perdigones).
   * Devuelve cuántos han salido.
   */
  fire(shot: ShotRequest, now: number): number {
    let launched = 0;
    for (const direction of shot.directions) {
      if (this.launch(shot, direction.x, direction.y, now)) launched += 1;
    }
    return launched;
  }

  private launch(shot: ShotRequest, dirX: number, dirY: number, now: number): boolean {
    const weapon = shot.weapon;
    const angle = (Math.atan2(-dirY, Math.abs(dirX)) * 180) / Math.PI;
    const frame = weapon.projectile === 'pellet' ? 'fx/pellet' : bulletFrame(bulletAngle(angle));
    const bullet = this.group.get(shot.x, shot.y, ATLAS_KEY, frame) as Phaser.Physics.Arcade.Image | null;
    if (!bullet) return false;

    bullet.setTexture(ATLAS_KEY, frame);
    bullet.enableBody(true, shot.x, shot.y, true, true);
    bullet.setFlipX(dirX < 0).setDepth(DEPTH.bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(3, 3);
    bullet.setVelocity(dirX * weapon.bulletSpeed, dirY * weapon.bulletSpeed);

    const data: BulletData = {
      falloff: weapon,
      knockback: weapon.knockback,
      dirX: dirX >= 0 ? 1 : -1,
      originX: shot.x,
      originY: shot.y,
      diesAt: now + travelTimeMs(weapon.rangePx, weapon.bulletSpeed),
      weaponId: weapon.id,
    };
    bullet.setData('bullet', data);
    return true;
  }

  /** Daño que hace una bala al impactar donde está ahora (cae con la distancia). */
  static damageOf(bullet: Phaser.GameObjects.GameObject): number {
    const data = BulletSystem.dataOf(bullet);
    const image = bullet as Phaser.Physics.Arcade.Image;
    return damageAtDistance(data.falloff, Math.hypot(image.x - data.originX, image.y - data.originY));
  }

  /** Indica si un objeto de una colisión es una bala de este sistema. */
  static isBullet(object: Phaser.GameObjects.GameObject): boolean {
    return object.data?.has('bullet') ?? false;
  }

  static dataOf(bullet: Phaser.GameObjects.GameObject): BulletData {
    return bullet.getData('bullet') as BulletData;
  }

  remove(bullet: Phaser.GameObjects.GameObject): void {
    (bullet as Phaser.Physics.Arcade.Image).disableBody(true, true);
  }

  /** Retira las balas que han agotado su alcance o han salido de la vista. */
  update(now: number): void {
    const camera = this.scene.cameras.main;
    const left = camera.scrollX - 40;
    const right = camera.scrollX + GAME_WIDTH + 40;
    for (const child of this.group.getChildren()) {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) continue;
      const data = BulletSystem.dataOf(bullet);
      if (now >= data.diesAt || bullet.x < left || bullet.x > right || bullet.y < -20) this.remove(bullet);
    }
  }
}
