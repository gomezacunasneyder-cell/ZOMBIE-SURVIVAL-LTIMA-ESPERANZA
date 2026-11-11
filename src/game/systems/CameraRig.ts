import type Phaser from 'phaser';
import { ShakeModel } from '../../core/fx/shake';
import { GAME_WIDTH } from '../config';

/** Píxeles que la cámara se adelanta hacia donde mira el jugador. */
const LOOK_AHEAD = 20;
/** Adelanto adicional proporcional a la velocidad, con tope. */
const SPEED_LOOK = 0.2;
const SPEED_LOOK_MAX = 26;
/** Rapidez del seguimiento; mayor = más pegada al jugador. */
const STIFFNESS = 6;

/**
 * Cámara que sigue al jugador con suavidad y lo mantiene cerca del centro.
 *  - Se adelanta hacia donde mira y un poco más cuando corre, para ver
 *    antes lo que viene.
 *  - La posición final es siempre un número entero de píxeles: una cámara
 *    en posiciones fraccionarias haría temblar el pixel art.
 *  - Las sacudidas (impactos, explosiones) son una oscilación breve y
 *    acotada que se aplica al encuadre, sin alterar el seguimiento.
 */
export class CameraRig {
  private position = 0;
  private readonly maxScroll: number;
  private readonly shake = new ShakeModel();

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    worldWidth: number,
  ) {
    this.maxScroll = Math.max(0, worldWidth - GAME_WIDTH);
  }

  private desired(targetX: number, facing: 1 | -1, velocityX: number): number {
    const speedLook = Math.max(-SPEED_LOOK_MAX, Math.min(SPEED_LOOK_MAX, velocityX * SPEED_LOOK));
    const raw = targetX - GAME_WIDTH / 2 + facing * LOOK_AHEAD + speedLook;
    return Math.min(this.maxScroll, Math.max(0, raw));
  }

  /** Coloca la cámara de golpe (al empezar o al reaparecer). */
  snap(targetX: number, facing: 1 | -1): void {
    this.position = this.desired(targetX, facing, 0);
    this.camera.scrollX = Math.round(this.position);
  }

  /** Suma una sacudida; ver `TRAUMA` para los valores habituales. */
  addTrauma(amount: number): void {
    this.shake.add(amount);
  }

  get shakeLevel(): number {
    return this.shake.level;
  }

  update(targetX: number, facing: 1 | -1, velocityX: number, deltaMs: number, timeMs: number): void {
    const blend = 1 - Math.exp((-deltaMs / 1000) * STIFFNESS);
    this.position += (this.desired(targetX, facing, velocityX) - this.position) * blend;
    this.camera.scrollX = Math.round(this.position);
    // La sacudida mueve el encuadre entero; el HUD, en otra escena, queda fijo.
    const offset = this.shake.update(deltaMs, timeMs);
    this.camera.setPosition(offset.x, offset.y);
  }
}
