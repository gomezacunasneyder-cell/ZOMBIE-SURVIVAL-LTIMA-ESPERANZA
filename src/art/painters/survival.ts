import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { Rng } from '../../core/math/Rng';

/**
 * Arte del modo supervivencia: la barricada reforzada que hay que
 * defender y sus estados de deterioro. EL DEVORADOR está en `devourer.ts`.
 */

export const FORTIFICATION_STAGES = 3;

/**
 * Barricada reforzada: sacos terreros apilados, chapa remachada y
 * alambre de espino encima. `stage` 0 entera, 1 dañada, 2 a punto de caer.
 */
export function paintFortification(stage = 0): PixelBuffer {
  const buf = new PixelBuffer(30, 24);
  const rng = new Rng(611 + stage * 13);
  // Chapa de fondo con remaches.
  buf.rect(3, 5, 24, 13, P.grey3);
  buf.hline(3, 5, 24, P.grey2);
  for (let x = 5; x < 26; x += 5) buf.vline(x, 6, 11, P.asph4);
  for (let x = 4; x < 27; x += 5) {
    buf.set(x, 7, P.grey1);
    buf.set(x, 15, P.grey1);
  }
  // Sacos terreros en dos hileras.
  const bag = (cx: number, cy: number): void => {
    buf.ellipse(cx, cy, 4.2, 2.3, P.mil2);
    buf.hline(cx - 3, cy - 2, 6, P.mil1);
    buf.hline(cx - 3, cy + 2, 6, P.mil4);
    buf.set(cx, cy, P.mil3);
  };
  for (let x = 4; x <= 26; x += 7) bag(x, 21);
  for (let x = 7; x <= 24; x += 7) bag(x, 17);
  // Alambre de espino.
  for (let x = 1; x < 29; x++) buf.set(x, 3 + (x % 4 === 0 ? -1 : 0), P.grey2);
  for (let x = 2; x < 29; x += 4) {
    buf.set(x, 1, P.grey1);
    buf.set(x + 1, 4, P.grey1);
  }
  buf.vline(1, 2, 16, P.brown3);
  buf.vline(28, 2, 16, P.brown3);
  // Deterioro: abolladuras, agujeros y sacos reventados.
  for (let i = 0; i < stage * 7; i++) {
    const x = rng.int(4, 25);
    const y = rng.int(6, 16);
    buf.rect(x, y, rng.int(1, 2), rng.int(1, 2), P.shadow);
  }
  if (stage >= 2) {
    buf.rect(12, 5, 6, 4, 0);
    buf.dither(4, 18, 22, 5, P.brown1, 0.3);
  }
  return buf.outline(P.outline);
}
