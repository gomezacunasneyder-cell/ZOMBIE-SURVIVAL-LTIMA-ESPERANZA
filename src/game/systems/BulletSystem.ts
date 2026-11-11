import Phaser from 'phaser';
import { bulletFrame } from '../../art/catalog';
import { ATLAS_KEY } from '../boot/registerArt';
import { GAME_WIDTH } from '../config';
import type { ShotRequest } from '../entities/Player';
import { DEPTH } from '../world/depths';

export interface BulletData {
  damage: number;
  knockback: number;
  /** Sentido horizontal del disparo, para empujar al enemigo. */
  dirX: number;
  diesAt: number;
}

const MAX_BULLETS = 48;

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
  snapshot(): { x: number; y: number; vx: number; vy: number }[] {
    return (this.group.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter((bullet) => bullet.active)
      .map((bullet) => {
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        return { x: bullet.x, y: bullet.y, vx: body.velocity.x, vy: body.velocity.y };
      });
  }

  fire(shot: ShotRequest, now: number): boolean {
    const bullet = this.group.get(shot.x, shot.y, ATLAS_KEY, bulletFrame(shot.aim)) as Phaser.Physics.Arcade.Image | null;
    if (!bullet) return false;

    bullet.setTexture(ATLAS_KEY, bulletFrame(shot.aim));
    bullet.enableBody(true, shot.x, shot.y, true, true);
    bullet.setFlipX(shot.facing === -1).setDepth(DEPTH.bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(3, 3);
    bullet.setVelocity(shot.dirX * shot.weapon.bulletSpeed, shot.dirY * shot.weapon.bulletSpeed);

    const data: BulletData = {
      damage: shot.weapon.damage,
      knockback: shot.weapon.knockback,
      dirX: shot.dirX >= 0 ? 1 : -1,
      diesAt: now + shot.weapon.bulletLifeMs,
    };
    bullet.setData('bullet', data);
    return true;
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
