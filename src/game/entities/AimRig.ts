import type Phaser from 'phaser';
import { gunFlashFrame } from '../../art/catalog';
import { FLASH_CANVAS, gunArt, type GunArt } from '../../art/painters/guns';
import { reloadFrameIndex, skinArmFrame, skinReloadFrame, type PlayerSkin } from '../../art/skins';
import type { AimAngle } from '../../core/combat/aim';
import { ATLAS_KEY, SHOULDERS_KEY } from '../boot/registerArt';

export interface Point {
  x: number;
  y: number;
}

/** Retroceso visual de un disparo. */
export interface RigRecoil {
  kickPx: number;
  durationMs: number;
}

const DEFAULT_RECOIL: RigRecoil = { kickPx: 2, durationMs: 70 };
/** Ángulo al que baja el arma mientras se desenfunda otra. */
const HOLSTER_ANGLE = -60;
/** Bombeo de la escopeta: empieza tras el disparo y dura este tiempo. */
const PUMP_DELAY_MS = 170;
const PUMP_MS = 240;

/**
 * Capa de brazo y fogonazo que acompaña al cuerpo de Alex. Usa un dibujo
 * por cada uno de los 7 ángulos y cada arma (el pixel art no se rota
 * libremente) y se ancla al hombro del fotograma que esté mostrando el
 * cuerpo, sea cual sea el aspecto y el tamaño de su fotograma.
 */
export class AimRig {
  private readonly arm: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly shoulders: Map<string, Point>;
  private weaponId = 'pistol';
  private gun: GunArt = gunArt('pistol');
  private recoil: RigRecoil = DEFAULT_RECOIL;
  private recoilFrom = -Infinity;
  private flashStage: 0 | 1 | 2 = 2;
  private flashUntil = 0;
  private pumpFrom = -Infinity;

  constructor(
    scene: Phaser.Scene,
    private readonly body: Phaser.GameObjects.Sprite,
    depth: number,
    private readonly skin: PlayerSkin,
  ) {
    this.shoulders = scene.registry.get(SHOULDERS_KEY) as Map<string, Point>;
    this.arm = scene.add.image(body.x, body.y, ATLAS_KEY, skinArmFrame(skin, 0)).setDepth(depth + 0.1);
    this.flash = scene.add
      .image(body.x, body.y, ATLAS_KEY, gunFlashFrame('small', 0, 0))
      // El píxel central (la boca del cañón) cae justo en la posición, también volteado.
      .setOrigin(((FLASH_CANVAS - 1) / 2) / FLASH_CANVAS)
      .setDepth(depth + 0.2)
      .setVisible(false);
  }

  /** Nombre del fotograma que muestra ahora el brazo (para pruebas). */
  get armFrame(): string {
    return this.arm.frame.name;
  }

  /** Nombre del fotograma del fogonazo, o `null` si no se ve (para pruebas). */
  get flashFrame(): string | null {
    return this.flash.visible ? this.flash.frame.name : null;
  }

  /** Cambia el arma dibujada. Corta fogonazo, retroceso y bombeo pendientes. */
  setWeapon(id: string): void {
    if (id === this.weaponId) return;
    this.weaponId = id;
    this.gun = gunArt(id);
    this.flashStage = 2;
    this.recoilFrom = -Infinity;
    this.pumpFrom = -Infinity;
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

  /** Punto del mundo por el que sale la bala del arma actual. */
  muzzle(facing: 1 | -1, aim: AimAngle): Point {
    const pivot = this.shoulder(facing);
    const radians = (aim * Math.PI) / 180;
    return {
      x: pivot.x + Math.cos(radians) * this.gun.muzzle * facing,
      y: pivot.y - Math.sin(radians) * this.gun.muzzle,
    };
  }

  /** Inicia el fogonazo, el retroceso y, si el arma lo tiene, el bombeo. */
  fire(now: number, recoil: RigRecoil = DEFAULT_RECOIL): void {
    this.recoil = recoil;
    this.recoilFrom = now;
    this.flashStage = 0;
    this.flashUntil = now + 45;
    if (this.gun.pump) this.pumpFrom = now + PUMP_DELAY_MS;
  }

  setVisible(visible: boolean): void {
    this.arm.setVisible(visible);
    if (!visible) this.flash.setVisible(false);
  }

  /** Retroceso en píxeles: máximo al disparar y vuelve a su sitio escalón a escalón. */
  private kick(now: number): number {
    const elapsed = now - this.recoilFrom;
    if (elapsed < 0 || elapsed >= this.recoil.durationMs) return 0;
    return Math.ceil(this.recoil.kickPx * (1 - elapsed / this.recoil.durationMs));
  }

  /**
   * Coloca brazo y fogonazo. Debe llamarse después de que la física mueva
   * el cuerpo. `reloadProgress` (0–1) muestra la animación de recarga si
   * el aspecto la tiene; `switching` baja el arma mientras se desenfunda.
   */
  sync(facing: 1 | -1, aim: AimAngle, now: number, reloadProgress: number | null = null, switching = false): void {
    if (this.flashStage < 2 && now >= this.flashUntil) {
      this.flashStage = this.flashStage === 0 ? 1 : 2;
      this.flashUntil = now + 50;
    }
    const flip = facing === -1;
    const pivot = this.shoulder(facing);
    // Retroceso: el arma se desplaza hacia atrás a lo largo del cañón.
    const kick = this.kick(now);
    const radians = (aim * Math.PI) / 180;
    const kickX = Math.round(-Math.cos(radians) * kick) * facing;
    const kickY = Math.round(Math.sin(radians) * kick);

    const reloading = reloadProgress !== null && this.skin.reloadFrames > 0;
    const pumping = this.gun.pump && now >= this.pumpFrom && now < this.pumpFrom + PUMP_MS;
    let frame: string;
    if (reloading) frame = skinReloadFrame(this.skin, reloadFrameIndex(this.skin, reloadProgress), this.weaponId);
    else if (switching) frame = skinArmFrame(this.skin, HOLSTER_ANGLE, this.weaponId);
    else frame = skinArmFrame(this.skin, aim, this.weaponId, pumping ? 'pump' : 'aim');
    this.arm
      .setFrame(frame)
      .setFlipX(flip)
      .setPosition(Math.round(pivot.x) + kickX, Math.round(pivot.y) + kickY);

    const showFlash = this.flashStage < 2 && this.arm.visible && !switching;
    this.flash.setVisible(showFlash);
    if (showFlash) {
      const muzzle = this.muzzle(facing, aim);
      this.flash
        .setFrame(gunFlashFrame(this.gun.flash, this.flashStage === 0 ? 0 : 1, aim))
        .setFlipX(flip)
        .setPosition(Math.round(muzzle.x), Math.round(muzzle.y));
    }
  }

  destroy(): void {
    this.arm.destroy();
    this.flash.destroy();
  }
}
