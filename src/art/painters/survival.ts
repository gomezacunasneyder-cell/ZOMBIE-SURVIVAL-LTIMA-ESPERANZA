import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { Rng } from '../../core/math/Rng';

/**
 * Arte del modo supervivencia: la barricada reforzada que hay que
 * defender, sus estados de deterioro y la silueta de EL DEVORADOR que
 * asoma tras el muro al terminar la horda.
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

export const DEVOURER_WIDTH = 150;
export const DEVOURER_HEIGHT = 112;

/**
 * Silueta de EL DEVORADOR: una mole encorvada del tamaño de un edificio,
 * con espinas de hueso, brazos que acaban en garras, fauces abiertas y
 * ojos que brillan. Casi negra: solo se adivina contra el cielo.
 * `eyesOpen` controla el brillo de los ojos (parpadeo de la aparición).
 */
export function paintDevourer(eyesOpen: boolean): PixelBuffer {
  const buf = new PixelBuffer(DEVOURER_WIDTH, DEVOURER_HEIGHT);
  const body = P.outline;
  const rim = P.shadow;
  // Joroba y tronco.
  buf.ellipse(78, 74, 52, 40, body);
  buf.ellipse(64, 56, 38, 30, body);
  // Cabeza adelantada y baja.
  buf.ellipse(38, 52, 20, 16, body);
  // Mandíbula colgante.
  buf.trapezoid(58, 22, 54, 72, 28, 50, body);
  // Brazos larguísimos apoyados en el suelo.
  buf.line(46, 64, 20, 104, body, 7);
  buf.line(104, 70, 128, 106, body, 8);
  for (const [x, y, dir] of [
    [16, 106, -1],
    [130, 108, 1],
  ] as const) {
    for (let i = 0; i < 3; i++) buf.line(x + i * 4 * dir, y, x + i * 4 * dir + dir * 5, y + 4, P.grey3, 1);
  }
  // Espinas de hueso en el lomo.
  const spines: [number, number, number][] = [
    [56, 28, 12],
    [68, 24, 16],
    [82, 30, 14],
    [96, 38, 12],
    [108, 48, 10],
  ];
  for (const [x, y, h] of spines) {
    buf.line(x, y + h, x + 3, y, P.grey3, 2);
    buf.set(x + 3, y, P.grey2);
  }
  // Contorno iluminado por la ciudad: dos píxeles en el lomo para recortarse contra el cielo.
  for (let x = 0; x < DEVOURER_WIDTH; x++) {
    for (let y = 1; y < DEVOURER_HEIGHT; y++) {
      if (buf.get(x, y) !== body || buf.get(x, y - 1) !== 0) continue;
      buf.set(x, y, P.grey3);
      if (buf.get(x, y + 1) === body) buf.set(x, y + 1, rim);
    }
  }
  // Fauces: dientes y garganta encendida.
  buf.trapezoid(62, 26, 50, 70, 30, 46, P.blood3);
  for (let x = 28; x < 50; x += 3) {
    buf.vline(x, 61, 3, P.white);
    buf.vline(x + 1, 67, 3, P.grey1);
  }
  buf.ellipse(38, 66, 5, 2, P.blood2);
  // Ojos: varios, en racimo, como heridas que brillan.
  const eyes: [number, number][] = [
    [30, 46],
    [38, 44],
    [46, 47],
    [35, 50],
  ];
  for (const [x, y] of eyes) {
    if (eyesOpen) {
      buf.rect(x, y, 3, 2, P.blood1);
      buf.set(x + 1, y, P.org1);
    } else buf.hline(x, y + 1, 3, P.blood3);
  }
  return buf;
}
