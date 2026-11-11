import { Rng } from '../../core/math/Rng';
import { drawText } from '../font';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/** Sustituye un color por otro dentro de un rectángulo (sombreado por zonas). */
function shade(buf: PixelBuffer, x: number, y: number, w: number, h: number, from: number, to: number): void {
  buf.dither(x, y, w, h, to, 1, from);
}

function wheel(buf: PixelBuffer, cx: number, cy: number, r: number, flat = false): void {
  buf.ellipse(cx, cy + (flat ? 1 : 0), r + (flat ? 1 : 0), flat ? r - 1.5 : r, P.outline);
  buf.ellipse(cx, cy + (flat ? 1 : 0), r - 1.2, flat ? r - 2.6 : r - 1.2, P.shadow);
  buf.ellipse(cx, cy + (flat ? 1 : 0), r - 2.8, flat ? 0.6 : r - 2.8, P.grey3);
  if (!flat) buf.set(cx, cy, P.grey2);
}

/** Turismo abandonado: lunas rotas, rueda pinchada, óxido. Mira a la derecha. */
export function paintWreckedCar(): PixelBuffer {
  const buf = new PixelBuffer(64, 26);
  const rng = new Rng(7013);

  // Carrocería baja.
  buf.rect(3, 12, 57, 8, P.grey2);
  buf.rect(4, 11, 54, 1, P.grey1);
  buf.rect(3, 12, 57, 1, P.grey1);
  buf.rect(3, 18, 57, 2, P.grey3);
  // Morro inclinado y maletero.
  buf.trapezoid(9, 46, 52, 12, 46, 59, P.grey2);
  buf.rect(46, 9, 6, 1, P.grey1);
  // Habitáculo.
  buf.trapezoid(3, 18, 37, 10, 13, 45, P.grey2);
  buf.rect(18, 3, 20, 1, P.grey1);
  // Lunas: huecos oscuros con restos de cristal.
  buf.trapezoid(5, 19, 26, 10, 15, 27, P.shadow);
  buf.trapezoid(5, 30, 36, 10, 30, 43, P.shadow);
  buf.line(16, 10, 20, 6, P.glass2);
  buf.line(40, 10, 37, 7, P.glass1);
  buf.set(31, 9, P.glass2).set(32, 10, P.glass2).set(25, 6, P.glass1);
  // Puerta, tirador y moldura.
  buf.vline(28, 11, 7, P.grey3);
  buf.rect(30, 13, 3, 1, P.grey3);
  buf.hline(4, 15, 55, P.grey3);
  // Faro roto, piloto y parachoques.
  buf.rect(58, 13, 2, 2, P.grey1);
  buf.set(59, 14, P.shadow);
  buf.rect(3, 13, 2, 2, P.blood1);
  buf.rect(57, 17, 5, 2, P.grey3);
  buf.rect(1, 17, 4, 2, P.grey3);
  // Óxido y suciedad.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(4, 58);
    const y = rng.int(12, 19);
    if (buf.get(x, y) === P.grey2) buf.set(x, y, rng.chance(0.5) ? P.org3 : P.grey3);
  }
  buf.dither(40, 12, 14, 5, P.org3, 0.3, P.grey2);
  // Mano ensangrentada en la puerta.
  buf.rect(21, 13, 2, 2, P.blood2);
  buf.set(22, 15, P.blood3).set(21, 16, P.blood2);

  wheel(buf, 14, 20, 4.5);
  wheel(buf, 48, 20, 4.5, true);
  return buf.outline(P.outline);
}

/** Camión militar con lona. Mira a la derecha. */
export function paintMilitaryTruck(): PixelBuffer {
  const buf = new PixelBuffer(92, 44);

  // Caja con lona.
  buf.rect(3, 6, 52, 24, P.mil3);
  buf.rect(4, 5, 50, 1, P.mil2);
  buf.rect(3, 6, 52, 2, P.mil2);
  buf.rect(3, 8, 52, 1, P.mil1);
  shade(buf, 3, 24, 52, 6, P.mil3, P.mil4);
  for (let x = 12; x < 54; x += 10) {
    buf.vline(x, 9, 15, P.mil4);
    buf.vline(x + 1, 9, 15, P.mil2);
  }
  buf.dither(3, 20, 52, 4, P.mil4, 0.35, P.mil3);
  // Cuerdas de la lona.
  for (let x = 6; x < 54; x += 5) buf.set(x, 25, P.mil1);
  // Trasera abierta, oscura.
  buf.rect(3, 10, 4, 14, P.shadow);
  // Marca de unidad.
  drawText(buf, 'C-7', 28, 13, P.mil1);

  // Cabina.
  buf.rect(57, 11, 19, 19, P.mil3);
  buf.rect(58, 10, 17, 1, P.mil2);
  buf.rect(57, 11, 19, 1, P.mil2);
  buf.trapezoid(13, 60, 73, 19, 60, 75, P.glass2);
  buf.line(62, 18, 66, 14, P.glass1);
  buf.line(65, 18, 68, 15, P.glass1);
  buf.vline(67, 13, 7, P.mil4);
  buf.rect(60, 22, 8, 1, P.mil4);
  buf.rect(63, 24, 2, 1, P.mil1);
  shade(buf, 57, 26, 19, 4, P.mil3, P.mil4);
  // Capó, rejilla y faro encendido.
  buf.rect(76, 18, 12, 12, P.mil3);
  buf.rect(76, 18, 12, 1, P.mil1);
  buf.rect(76, 19, 12, 1, P.mil2);
  for (let y = 21; y < 27; y += 2) buf.hline(84, y, 4, P.mil4);
  buf.rect(86, 21, 2, 3, P.light1);
  buf.rect(85, 21, 1, 3, P.light2);
  // Parachoques y bastidor.
  buf.rect(2, 30, 86, 3, P.mil4);
  buf.rect(82, 29, 9, 4, P.grey3);
  buf.hline(82, 29, 9, P.grey2);
  // Guardabarros.
  buf.rect(70, 28, 14, 2, P.mil4);

  wheel(buf, 14, 36, 6);
  wheel(buf, 30, 36, 6);
  wheel(buf, 76, 36, 6);
  return buf.outline(P.outline);
}

/** Helicóptero Cóndor 7 sin rotor principal (va en fotogramas aparte). Morro a la izquierda. */
export function paintHelicopterBody(): PixelBuffer {
  const buf = new PixelBuffer(86, 30);

  // Cola y deriva.
  buf.line(46, 12, 78, 9, P.mil3, 3);
  buf.line(46, 14, 78, 11, P.mil4, 1);
  buf.trapezoid(2, 77, 80, 11, 74, 82, P.mil3);
  buf.vline(77, 2, 9, P.mil2);
  buf.rect(74, 12, 9, 2, P.mil4);
  buf.set(82, 3, P.blood1);

  // Fuselaje.
  buf.ellipse(30, 15, 18, 8, P.mil3);
  shade(buf, 10, 6, 42, 5, P.mil3, P.mil2);
  buf.hline(22, 7, 18, P.mil1);
  shade(buf, 10, 19, 42, 6, P.mil3, P.mil4);
  // Cabina acristalada.
  buf.ellipse(18, 15, 7, 6, P.glass2);
  buf.line(13, 13, 17, 10, P.glass1);
  buf.line(15, 15, 20, 10, P.glass1);
  buf.vline(22, 9, 12, P.mil4);
  buf.hline(12, 17, 10, P.mil4);
  buf.rect(17, 13, 3, 4, P.shadow);
  buf.rect(17, 12, 3, 1, P.mil4);
  // Puerta lateral abierta.
  buf.rect(28, 10, 11, 10, P.shadow);
  buf.rect(28, 10, 11, 1, P.mil4);
  buf.rect(31, 12, 3, 3, P.mil2);
  buf.rect(31, 15, 4, 5, P.mil4);
  // Turbina y mástil.
  buf.rect(26, 3, 16, 4, P.mil4);
  buf.rect(27, 3, 14, 1, P.mil3);
  buf.rect(33, 0, 2, 3, P.grey3);
  buf.rect(42, 5, 3, 2, P.shadow);
  // Matrícula.
  drawText(buf, 'C7', 42, 13, P.mil1);
  // Patines.
  buf.vline(20, 22, 5, P.grey3);
  buf.vline(40, 22, 5, P.grey3);
  buf.hline(12, 27, 34, P.grey3);
  buf.set(11, 26, P.grey3);
  // Foco de búsqueda bajo el morro.
  buf.rect(14, 22, 3, 2, P.grey2);
  buf.rect(14, 24, 3, 1, P.light1);

  return buf.outline(P.outline);
}

export const ROTOR_FRAMES = 4;

/** Rotor principal: el ancho visible cambia para sugerir el giro. */
export function paintRotor(frame: number): PixelBuffer {
  const width = 84;
  const buf = new PixelBuffer(width, 3);
  const spans = [42, 30, 12, 30];
  const half = spans[frame % ROTOR_FRAMES] as number;
  const cx = width / 2;
  buf.hline(cx - half, 1, half * 2, P.grey3);
  buf.hline(cx - half, 0, half * 2, P.outline);
  if (frame % 2 === 1) {
    // Fotogramas intermedios: estela tramada hasta la envergadura completa.
    buf.dither(0, 1, width, 1, P.grey2, 0.5);
    buf.hline(cx - half, 1, half * 2, P.grey3);
  }
  buf.rect(cx - 2, 0, 4, 3, P.shadow);
  return buf;
}

/** Rotor de cola: disco pequeño en dos fases. */
export function paintTailRotor(frame: number): PixelBuffer {
  const buf = new PixelBuffer(9, 9);
  if (frame % 2 === 0) {
    buf.line(4, 0, 4, 8, P.grey3);
    buf.line(0, 4, 8, 4, P.grey2);
  } else {
    buf.line(1, 1, 7, 7, P.grey3);
    buf.line(7, 1, 1, 7, P.grey2);
  }
  buf.set(4, 4, P.outline);
  return buf;
}
