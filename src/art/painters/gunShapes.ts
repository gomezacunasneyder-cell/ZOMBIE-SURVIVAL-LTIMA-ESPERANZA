import type { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Herramientas comunes para dibujar armas en «coordenadas de cañón».
 * Las usan `guns.ts` y `heavyGuns.ts`.
 */

/** Lienzo de las capas de brazo; el hombro queda en su centro. */
export const ARM_CANVAS = 48;
export const ARM_PIVOT = ARM_CANVAS / 2;

export type Shade = (side: number, along: number) => number;

/** Rellena una franja orientada: `along` a lo largo del brazo, `side` hacia abajo del arma. */
export function band(
  buf: PixelBuffer,
  angle: number,
  from: number,
  to: number,
  sideFrom: number,
  sideTo: number,
  color: Shade,
): void {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const px = Math.sin(a);
  const py = Math.cos(a);
  for (let along = from; along <= to; along += 0.5) {
    for (let side = sideFrom; side <= sideTo; side += 0.5) {
      buf.set(ARM_PIVOT + dx * along + px * side, ARM_PIVOT + dy * along + py * side, color(side, along));
    }
  }
}

export const solid =
  (c: number): Shade =>
  () =>
    c;

/** Metal con luz arriba y sombra abajo. */
export const metal =
  (top: number, bottom: number): Shade =>
  (side) =>
    side <= top ? P.grey1 : side < bottom ? P.grey2 : P.grey3;
