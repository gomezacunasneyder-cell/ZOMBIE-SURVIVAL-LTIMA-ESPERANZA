import { Rng } from '../../core/math/Rng';
import { drawText } from '../font';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Fachadas de edificios abandonados que se levantan en la acera, delante
 * del muro. Sus huecos (escaparate, puerta, ventanas) son negros: el
 * sistema de iluminación añade ahí oscuridad adicional.
 */

export interface FacadeOpening {
  /** Centro del hueco dentro del dibujo y su radio aproximado. */
  x: number;
  y: number;
  radius: number;
}

export const SHOP_OPENINGS: FacadeOpening[] = [
  { x: 37, y: 58, radius: 24 },
  { x: 84, y: 68, radius: 24 },
];

export const APARTMENT_OPENINGS: FacadeOpening[] = [
  { x: 40, y: 72, radius: 24 },
  { x: 18, y: 30, radius: 12 },
  { x: 60, y: 30, radius: 12 },
];

function bricks(buf: PixelBuffer, x: number, y: number, w: number, h: number, wall: number, mortar: number): void {
  buf.rect(x, y, w, h, wall);
  for (let row = 0; row < h; row += 4) {
    buf.hline(x, y + row, w, mortar);
    const shift = (row / 4) % 2 === 0 ? 0 : 5;
    for (let col = shift; col < w; col += 10) buf.vline(x + col, y + row, 4, mortar);
  }
}

/** Farmacia saqueada: escaparate roto y tapiado, toldo rasgado, puerta entornada. No voltear: lleva texto. */
export function paintShopFacade(): PixelBuffer {
  const buf = new PixelBuffer(106, 98);
  const rng = new Rng(3131);

  bricks(buf, 1, 7, 104, 90, P.brown2, P.brown3);
  buf.dither(1, 7, 104, 90, P.brown1, 0.08, P.brown2);
  // Cornisa.
  buf.rect(0, 2, 106, 6, P.conc3);
  buf.hline(0, 2, 106, P.conc1);
  buf.hline(0, 7, 106, P.conc4);
  for (let x = 4; x < 106; x += 9) buf.rect(x, 4, 4, 2, P.conc4);

  // Rótulo apagado con una letra descolgada y cruz verde.
  buf.rect(10, 12, 86, 13, P.grey3);
  buf.rect(11, 13, 84, 11, P.shadow);
  buf.rect(14, 15, 7, 7, P.ui2);
  buf.rect(16, 15, 3, 7, P.shadow);
  buf.rect(14, 17, 7, 3, P.shadow);
  buf.rect(16, 16, 3, 5, P.ui1);
  buf.rect(15, 17, 5, 3, P.ui1);
  drawText(buf, 'FARM', 26, 14, P.grey1, 2);
  drawText(buf, 'C', 66, 15, P.grey2, 2);
  drawText(buf, 'IA', 74, 14, P.grey1, 2);

  // Toldo rasgado a rayas.
  for (let x = 6; x < 100; x++) {
    const band = Math.floor((x - 6) / 8);
    const stripe = band % 2 === 0 ? P.blood1 : P.white;
    // Borde inferior en ondas; dos franjas rasgadas.
    const scallop = (x - 6) % 8 === 0 || (x - 6) % 8 === 7 ? 1 : 0;
    const torn = band === 4 || band === 9 ? 3 : 0;
    buf.vline(x, 27, 8 - scallop - torn, stripe);
    buf.set(x, 27, band % 2 === 0 ? P.scarf1 : P.white);
    buf.set(x, 34 - scallop - torn, band % 2 === 0 ? P.blood2 : P.grey1);
  }
  buf.hline(6, 26, 94, P.blood3);

  // Escaparate: marco, interior negro, cristales rotos y tablones.
  buf.rect(8, 36, 58, 44, P.conc3);
  buf.hline(8, 36, 58, P.conc1);
  buf.rect(10, 38, 54, 40, P.outline);
  for (const y of [50, 62]) buf.hline(14, y, 44, P.asph4);
  buf.rect(18, 54, 5, 8, P.asph4);
  buf.rect(40, 44, 7, 6, P.asph4);
  for (let i = 0; i < 9; i++) {
    const sx = rng.int(10, 60);
    const fromTop = rng.chance(0.5);
    const len = rng.int(3, 9);
    for (let k = 0; k < len; k++) {
      buf.set(sx + Math.round(k * 0.4), fromTop ? 38 + k : 77 - k, k < 2 ? P.glass1 : P.glass2);
    }
  }
  buf.line(10, 46, 63, 42, P.brown1, 3);
  buf.line(10, 68, 63, 72, P.brown1, 3);
  buf.line(11, 47, 63, 43, P.brown3, 1);
  buf.line(11, 69, 63, 73, P.brown3, 1);
  buf.set(13, 46, P.grey2).set(60, 43, P.grey2).set(13, 69, P.grey2).set(60, 72, P.grey2);

  // Puerta: hueco negro y hoja entornada.
  buf.rect(71, 38, 28, 59, P.conc3);
  buf.hline(71, 38, 28, P.conc1);
  buf.rect(73, 40, 24, 57, P.outline);
  buf.trapezoid(42, 89, 96, 96, 91, 96, P.brown3);
  buf.vline(89, 42, 55, P.brown2);
  buf.rect(92, 68, 2, 2, P.yel3);
  buf.rect(92, 52, 3, 8, P.glass2);

  // Zócalo, pintada y manchas.
  buf.rect(1, 90, 70, 7, P.conc4);
  buf.hline(1, 90, 70, P.conc3);
  drawText(buf, 'Z', 3, 80, P.blood1, 2);
  buf.vline(5, 90, 4, P.blood2);
  buf.dither(64, 80, 8, 10, P.blood3, 0.4);
  for (let i = 0; i < 5; i++) buf.set(rng.int(2, 100), rng.int(30, 36), P.brown3);
  return buf.outline(P.outline);
}

/** Portal de viviendas: puerta reventada, ventanas con persianas rotas, escalera de incendios. */
export function paintApartmentFacade(): PixelBuffer {
  const buf = new PixelBuffer(80, 98);
  const rng = new Rng(5252);

  buf.rect(1, 7, 78, 90, P.asph2);
  buf.dither(1, 7, 78, 90, P.asph3, 0.2, P.asph2);
  buf.dither(1, 60, 78, 37, P.asph3, 0.45, P.asph2);
  // Cornisa y canalón.
  buf.rect(0, 2, 80, 6, P.asph1);
  buf.hline(0, 2, 80, P.lane);
  buf.hline(0, 7, 80, P.asph4);
  buf.rect(74, 8, 2, 89, P.grey3);
  buf.vline(74, 8, 89, P.grey2);

  // Ventanas del primer piso: una tapiada, otra con cortina.
  for (const wx of [8, 50]) {
    buf.rect(wx, 18, 22, 26, P.asph4);
    buf.hline(wx, 18, 22, P.asph1);
    buf.rect(wx + 2, 20, 18, 22, P.outline);
    buf.rect(wx - 1, 44, 24, 2, P.asph1);
  }
  for (let y = 22; y < 40; y += 5) buf.rect(10, y, 18, 3, P.brown3);
  buf.line(11, 21, 26, 41, P.brown2, 2);
  buf.rect(52, 20, 6, 14, P.grey1);
  buf.dither(52, 20, 6, 14, P.grey2, 0.4);
  buf.line(58, 34, 53, 39, P.grey1);
  buf.line(63, 20, 68, 30, P.glass2);

  // Escalera de incendios.
  buf.hline(30, 46, 20, P.grey3);
  buf.hline(30, 47, 20, P.shadow);
  for (let x = 31; x < 50; x += 3) buf.vline(x, 40, 6, P.grey3);
  buf.hline(30, 40, 20, P.grey2);
  buf.line(34, 47, 30, 62, P.grey3);
  buf.line(38, 47, 34, 62, P.grey3);
  for (let k = 0; k < 4; k++) buf.hline(31 - k, 50 + k * 3, 5, P.grey3);

  // Portal: escalones, marco y puerta arrancada.
  buf.rect(26, 52, 30, 45, P.asph4);
  buf.hline(26, 52, 30, P.asph1);
  buf.rect(28, 54, 26, 43, P.outline);
  buf.trapezoid(58, 28, 34, 96, 28, 37, P.brown3);
  buf.vline(34, 58, 30, P.brown2);
  buf.rect(22, 93, 38, 4, P.asph1);
  buf.hline(22, 93, 38, P.lane);
  buf.rect(59, 62, 7, 5, P.white);
  drawText(buf, '13', 60, 63, P.shadow);

  // Grietas, humedad y sangre.
  for (let i = 0; i < 5; i++) {
    let x = rng.int(4, 72);
    let y = rng.int(8, 50);
    for (let k = 0; k < rng.int(8, 22); k++) {
      if (buf.get(x, y) === P.asph2 || buf.get(x, y) === P.asph3) buf.set(x, y, P.asph4);
      y += 1;
      x += rng.int(-1, 1);
    }
  }
  buf.dither(4, 76, 16, 14, P.blood3, 0.35, P.asph3);
  buf.ellipse(11, 82, 3, 2, P.blood2);
  return buf.outline(P.outline);
}
