import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/** Iconos y piezas del HUD, en el mismo estilo que el resto del arte. */

/** Icono de la pistola para el panel de arma. */
export function paintPistolIcon(): PixelBuffer {
  const buf = new PixelBuffer(20, 13);
  // Corredera y cañón.
  buf.rect(2, 2, 15, 4, P.grey3);
  buf.rect(2, 2, 15, 1, P.grey1);
  buf.rect(2, 3, 15, 1, P.grey2);
  buf.rect(17, 3, 1, 2, P.shadow);
  for (const x of [4, 6, 8]) buf.vline(x, 3, 2, P.shadow);
  buf.set(15, 1, P.grey2);
  // Armazón, guardamonte y gatillo.
  buf.rect(3, 6, 10, 1, P.shadow);
  buf.rect(8, 7, 5, 1, P.grey3);
  buf.set(12, 8, P.grey3);
  buf.rect(8, 9, 5, 1, P.grey3);
  buf.set(10, 8, P.grey1);
  // Empuñadura inclinada.
  buf.trapezoid(6, 3, 7, 11, 1, 5, P.brown2);
  buf.line(3, 7, 1, 11, P.brown1);
  buf.line(7, 7, 5, 11, P.brown3);
  buf.set(4, 9, P.brown3);
  return buf.outline(P.outline);
}

/** Calavera del contador de zombis eliminados. */
export function paintSkullIcon(): PixelBuffer {
  return PixelBuffer.fromRows(
    [
      '..wwwww..',
      '.wwwwwww.',
      'wwwwwwwww',
      'wkkwwwkkw',
      'wkkwwwkkw',
      'wwwwkwwww',
      '.wwwwwww.',
      '..wkwkw..',
      '..wwwww..',
    ],
    { w: P.white, k: P.outline },
  ).outline(P.outline);
}

/** Cruz médica de la barra de vida. */
export function paintHealthIcon(): PixelBuffer {
  return PixelBuffer.fromRows(
    ['.wwwwwww.', 'wwwwrwwww', 'wwwwrwwww', 'wwrrrrrww', 'wwwwrwwww', 'wwwwrwwww', '.wwwwwww.'],
    { w: P.white, r: P.blood1 },
  ).outline(P.outline);
}

/** Bala del cargador: llena o gastada. */
export function paintRound(loaded: boolean): PixelBuffer {
  const buf = new PixelBuffer(3, 7);
  if (loaded) {
    buf.rect(0, 2, 3, 5, P.yel2);
    buf.vline(0, 2, 5, P.yel1);
    buf.vline(2, 2, 5, P.yel3);
    buf.rect(0, 0, 3, 2, P.org2);
    buf.set(1, 0, P.org1);
    buf.hline(0, 6, 3, P.yel3);
  } else {
    buf.rect(0, 2, 3, 5, P.asph4);
    buf.rect(0, 0, 3, 2, P.asph4);
    buf.set(1, 0, P.asph3);
  }
  return buf;
}

/** Marcador que flota sobre los suministros que se pueden recoger. */
export function paintPickupMarker(): PixelBuffer {
  return PixelBuffer.fromRows(
    ['ggggggg', 'gGGGGGg', '.gGGGg.', '..gGg..', '...g...'],
    { g: P.ui2, G: P.ui1 },
  ).outline(P.outline);
}
