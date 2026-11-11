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

/** Icono de la escopeta de corredera: culata de madera, cañón largo y corredera. */
export function paintShotgunIcon(): PixelBuffer {
  const buf = new PixelBuffer(30, 11);
  // Culata.
  buf.trapezoid(2, 0, 8, 7, 0, 4, P.brown2);
  buf.hline(0, 2, 8, P.brown1);
  buf.hline(0, 7, 5, P.brown3);
  // Cajón y cañón.
  buf.rect(8, 2, 6, 4, P.grey3);
  buf.hline(8, 2, 6, P.grey1);
  buf.rect(14, 2, 15, 2, P.grey2);
  buf.hline(14, 2, 15, P.grey1);
  buf.rect(14, 4, 11, 1, P.grey3);
  buf.set(28, 2, P.shadow);
  // Corredera.
  buf.rect(16, 4, 6, 2, P.brown2);
  for (const x of [17, 19, 21]) buf.set(x, 5, P.brown3);
  // Gatillo y guardamonte.
  buf.rect(10, 6, 3, 1, P.grey3);
  buf.set(11, 7, P.grey3);
  return buf.outline(P.outline);
}

/** Icono del fusil de asalto: culata, cargador curvo, guardamanos y asa. */
export function paintRifleIcon(): PixelBuffer {
  const buf = new PixelBuffer(30, 12);
  buf.trapezoid(3, 0, 7, 8, 0, 3, P.mil3);
  buf.hline(0, 3, 7, P.mil2);
  buf.rect(7, 3, 9, 3, P.grey3);
  buf.hline(7, 3, 9, P.grey1);
  buf.rect(8, 1, 6, 1, P.grey3);
  buf.set(8, 2, P.grey3);
  buf.set(13, 2, P.grey3);
  // Cargador curvo y empuñadura.
  buf.rect(12, 6, 3, 2, P.shadow);
  buf.rect(13, 8, 3, 2, P.shadow);
  buf.rect(8, 6, 2, 3, P.shadow);
  // Guardamanos, cañón y punto de mira.
  buf.rect(16, 3, 7, 3, P.mil3);
  buf.hline(16, 3, 7, P.mil2);
  buf.rect(23, 4, 6, 1, P.grey2);
  buf.rect(23, 2, 1, 2, P.grey3);
  return buf.outline(P.outline);
}

/** Icono de la ametralladora ligera: caja de munición, camisa perforada y bípode. */
export function paintMachineGunIcon(): PixelBuffer {
  const buf = new PixelBuffer(30, 13);
  buf.trapezoid(2, 0, 5, 7, 0, 3, P.mil3);
  buf.hline(0, 2, 5, P.mil2);
  buf.rect(5, 2, 9, 4, P.grey3);
  buf.hline(5, 2, 9, P.grey1);
  buf.rect(8, 0, 4, 1, P.grey3);
  buf.set(8, 1, P.grey3);
  buf.set(11, 1, P.grey3);
  // Caja de munición y cinta.
  buf.rect(8, 6, 5, 4, P.mil2);
  buf.hline(8, 6, 5, P.mil1);
  buf.hline(8, 9, 5, P.mil4);
  buf.set(13, 6, P.yel2);
  buf.set(14, 7, P.yel3);
  buf.rect(6, 6, 2, 3, P.shadow);
  // Camisa perforada, cañón y bípode.
  buf.rect(14, 2, 9, 3, P.grey2);
  buf.hline(14, 2, 9, P.grey1);
  for (const x of [15, 17, 19, 21]) buf.set(x, 3, P.shadow);
  buf.rect(23, 3, 6, 1, P.grey2);
  buf.line(20, 5, 18, 10, P.grey3);
  buf.line(21, 5, 23, 10, P.grey3);
  return buf.outline(P.outline);
}

/** Bala fina para cargadores grandes (de 13 a 40 balas). */
export function paintThinRound(loaded: boolean): PixelBuffer {
  const buf = new PixelBuffer(1, 6);
  if (loaded) {
    buf.vline(0, 1, 5, P.yel2);
    buf.set(0, 0, P.org1);
  } else {
    buf.vline(0, 0, 6, P.asph4);
  }
  return buf;
}

/** Punto de mira: cuatro trazos con hueco central; se tiñe según el estado del arma. */
export function paintCrosshair(): PixelBuffer {
  const buf = new PixelBuffer(11, 11);
  for (const [x, y, w, h] of [
    [5, 0, 1, 3],
    [5, 8, 1, 3],
    [0, 5, 3, 1],
    [8, 5, 3, 1],
  ] as const) {
    buf.rect(x, y, w, h, P.white);
  }
  buf.set(5, 5, P.white);
  return buf.outline(P.outline);
}
