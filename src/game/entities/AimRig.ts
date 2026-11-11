import type Phaser from 'phaser';
import { aimFrame } from '../../art/catalog';
import { MUZZLE_DISTANCE } from '../../art/painters/alex';
import { reloadFrameIndex, skinArmFrame, skinReloadFrame, type PlayerSkin } from '../../art/skins';
import type { AimAngle } from '../../core/combat/aim';
import { ATLAS_KEY, SHOULDERS_KEY } from '../boot/registerArt';

export interface Point {
  x: number;
  y: number;
}

/**
 * Capa de brazo y fogonazo que acompaña al cuerpo de Alex. Usa un dibujo
 * por cada uno de los 7 ángulos (el pixel art no se rota libremente) y se
 * ancla al hombro del fotograma que esté mostrando el cuerpo, sea cual
 * sea el aspecto y el tamaño de su fotograma.
 */
export class AimRig {
  private readonly arm: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly shoulders: Map<string, Point>;
  private recoilUntil = 0;
  private flashStage: 0 | 1 | 2 = 2;
  private flashUntil = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly body: Phaser.GameObjects.Sprite,
    depth: number,
    private readonly skin: PlayerSkin,
  ) {
    this.shoulders = scene.registry.get(SHOULDERS_KEY) as Map<string, Point>;
    this.arm = scene.add.image(body.x, body.y, ATLAS_KEY, skinArmFrame(skin, 0)).setDepth(depth + 0.1);
    this.flash = scene.add
      .image(body.x, body.y, ATLAS_KEY, aimFrame('flash0', 0))
      .setDepth(depth + 0.2)
      .setVisible(false);
  }

  /** Nombre del fotograma que muestra ahora el brazo (para pruebas). */
  get armFrame(): string {
    return this.arm.frame.name;
  }

  /** Posición del hombro en el mundo según el fotograma actual del cuerpo. */
  shoulder(facing: 1 | -1): Point {
    const frame = this.body.frame;
    const local = this.shoulders.get(frame.name) ?? { x: 14, y: frame.height - 18 };
    const localX = local.x - 1;
    const left = this.body.x - frame.width / 2;
    const x = facing === 1 ? left + localX : left + frame.width - localX;
    return { x, y: this.body.y - frame.height + local.y };
  }

  /** Punto del mundo por el que sale la bala. */
  muzzle(facing: 1 | -1, aim: AimAngle): Point {
    const pivot = this.shoulder(facing);
    const radians = (aim * Math.PI) / 180;
    return {
      x: pivot.x + Math.cos(radians) * MUZZLE_DISTANCE * facing,
      y: pivot.y - Math.sin(radians) * MUZZLE_DISTANCE,
    };
  }

  /** Inicia el fogonazo y el retroceso del arma. */
  fire(now: number): void {
    this.recoilUntil = now + 70;
    this.flashStage = 0;
    this.flashUntil = now + 45;
  }

  setVisible(visible: boolean): void {
    this.arm.setVisible(visible);
    if (!visible) this.flash.setVisible(false);
  }

  /**
   * Coloca brazo y fogonazo. Debe llamarse después de que la física mueva
   * el cuerpo. `reloadProgress` (0–1) muestra la animación de recarga si
   * el aspecto la tiene.
   */
  sync(facing: 1 | -1, aim: AimAngle, now: number, reloadProgress: number | null = null): void {
    if (this.flashStage < 2 && now >= this.flashUntil) {
      this.flashStage = this.flashStage === 0 ? 1 : 2;
      this.flashUntil = now + 50;
    }
    const flip = facing === -1;
    const pivot = this.shoulder(facing);
    // Retroceso: el arma se desplaza hacia atrás a lo largo del cañón.
    const kick = now < this.recoilUntil ? 2 : 0;
    const radians = (aim * Math.PI) / 180;
    const kickX = Math.round(-Math.cos(radians) * kick) * facing;
    const kickY = Math.round(Math.sin(radians) * kick);

    const reloading = reloadProgress !== null && this.skin.reloadFrames > 0;
    const frame = reloading
      ? skinReloadFrame(this.skin, reloadFrameIndex(this.skin, reloadProgress))
      : skinArmFrame(this.skin, aim);
    this.arm
      .setFrame(frame)
      .setFlipX(flip)
      .setPosition(Math.round(pivot.x) + kickX, Math.round(pivot.y) + kickY);

    const showFlash = this.flashStage < 2 && this.arm.visible;
    this.flash.setVisible(showFlash);
    if (showFlash) {
      this.flash
        .setFrame(aimFrame(this.flashStage === 0 ? 'flash0' : 'flash1', aim))
        .setFlipX(flip)
        .setPosition(Math.round(pivot.x), Math.round(pivot.y));
    }
  }

  destroy(): void {
    this.arm.destroy();
    this.flash.destroy();
  }
}
