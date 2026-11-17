import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Proyectiles e iconos de las armas pesadas y del botiquín: bocanadas de
 * fuego del lanzallamas, cohete en vuelo (un dibujo cada 5°, sin rotar
 * sprites) e iconos del HUD.
 */

export const FLAME_FRAMES = 4;

/**
 * Bocanada del lanzallamas según su edad: sale como un núcleo blanco
 * pequeño, crece amarilla y naranja y acaba en una nube rojiza.
 */
export function paintFlame(frame: number): PixelBuffer {
  const size = 11;
  const buf = new PixelBuffer(size, size);
  const c = (size - 1) / 2;
  const radius = [1.5, 2.5, 3.5, 4.2][frame] ?? 4;
  const layers: [number, number][] =
    frame === 0
      ? [[1, P.org1], [0.6, P.light2], [0.3, P.light1]]
      : frame === 1
        ? [[1, P.org2], [0.7, P.org1], [0.4, P.yel1]]
        : frame === 2
          ? [[1, P.org3], [0.75, P.org2], [0.4, P.org1]]
          : [[1, P.blood3], [0.7, P.org3]];
  for (const [k, color] of layers) buf.ellipse(c, c + (frame >= 2 ? -0.5 : 0), radius * k, radius * k * 0.85, color);
  // Lenguas sueltas en los bordes.
  if (frame >= 1) {
    buf.set(c + radius, c - 1, P.org1);
    buf.set(c - radius + 1, c - radius + 1, frame === 3 ? P.org3 : P.yel1);
  }
  return buf;
}

/** Cohete en vuelo para un ángulo: cuerpo verde, cabeza gris, aletas y llama de cola. */
export function paintRocket(angleDeg: number): PixelBuffer {
  const size = 15;
  const buf = new PixelBuffer(size, size);
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const c = (size - 1) / 2;
  const at = (d: number, side = 0): [number, number] => [c + dx * d + Math.sin(a) * side, c + dy * d + Math.cos(a) * side];
  const [tx, ty] = at(-6);
  const [fx, fy] = at(-3.5);
  buf.line(tx, ty, fx, fy, P.org1);
  buf.set(...at(-6.5), P.yel1);
  buf.set(...at(-5), P.light2);
  const [bx, by] = at(-3);
  const [hx, hy] = at(3);
  buf.line(bx, by, hx, hy, P.mil3, 2);
  buf.line(...at(-3, -1.5), ...at(-2, -1.5), P.mil4);
  buf.line(...at(-3, 1.5), ...at(-2, 1.5), P.mil4);
  buf.line(...at(3.5), ...at(5), P.grey1, 2);
  return buf.outline(P.outline);
}

/** Icono del lanzallamas para el panel de arma. */
export function paintFlamerIcon(): PixelBuffer {
  const buf = new PixelBuffer(30, 13);
  buf.rect(0, 3, 5, 3, P.grey3);
  buf.rect(5, 2, 9, 4, P.grey3);
  buf.hline(5, 2, 9, P.grey1);
  buf.rect(7, 6, 2, 4, P.shadow);
  // Depósito.
  buf.rect(10, 6, 7, 5, P.org2);
  buf.hline(10, 6, 7, P.org1);
  buf.hline(10, 10, 7, P.org3);
  // Lanza con protector perforado y llama piloto.
  buf.rect(14, 2, 8, 4, P.grey3);
  for (const x of [15, 17, 19]) buf.set(x, 3, P.shadow);
  buf.rect(22, 3, 5, 2, P.grey2);
  buf.set(27, 3, P.org1);
  buf.set(28, 3, P.yel1);
  buf.set(27, 5, P.light2);
  return buf.outline(P.outline);
}

/** Icono del lanzacohetes: tubo largo con mira y cabeza del cohete. */
export function paintRocketIcon(): PixelBuffer {
  const buf = new PixelBuffer(30, 13);
  buf.rect(0, 3, 26, 5, P.mil3);
  buf.hline(0, 3, 26, P.mil2);
  buf.hline(0, 7, 26, P.mil4);
  buf.vline(0, 3, 5, P.shadow);
  buf.vline(8, 3, 5, P.mil4);
  buf.vline(21, 3, 5, P.mil4);
  buf.rect(11, 1, 4, 2, P.grey3);
  buf.rect(9, 8, 2, 4, P.shadow);
  buf.rect(16, 8, 2, 3, P.shadow);
  buf.rect(26, 4, 2, 3, P.mil1);
  buf.set(28, 5, P.grey1);
  return buf.outline(P.outline);
}

/** Botiquín del HUD: maletín blanco con la cruz roja. */
export function paintMedkitIcon(): PixelBuffer {
  const buf = new PixelBuffer(11, 9);
  buf.rect(3, 0, 5, 2, P.grey2);
  buf.rect(4, 1, 3, 1, 0);
  buf.rect(0, 2, 11, 7, P.white);
  buf.hline(0, 8, 11, P.grey1);
  buf.rect(4, 3, 3, 5, P.blood1);
  buf.rect(2, 4, 7, 3, P.blood1);
  return buf.outline(P.outline);
}
