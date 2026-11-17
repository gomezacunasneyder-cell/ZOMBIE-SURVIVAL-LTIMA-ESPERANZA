import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Arrojadizos y piezas: la granada de piña, el cóctel molotov con su
 * trapo, los montoncitos de piezas que sueltan los enemigos y sus
 * iconos del HUD y del inventario.
 */

/** Deja un píxel libre alrededor para que el contorno no se corte en los bordes. */
function framed(buf: PixelBuffer): PixelBuffer {
  return new PixelBuffer(buf.width + 2, buf.height + 2).blit(buf, 1, 1).outline(P.outline);
}

/** Granada de piña: cuerpo verde oliva con cuadrícula, cuchara y anilla. */
export function paintGrenade(): PixelBuffer {
  const buf = new PixelBuffer(7, 8);
  buf.ellipse(3, 5, 2.6, 2.6, P.mil2);
  buf.hline(1, 5, 5, P.mil3);
  buf.vline(3, 3, 5, P.mil3);
  buf.set(2, 4, P.mil1);
  buf.set(1, 4, P.mil1);
  buf.set(4, 6, P.mil4);
  // Cuchara y anilla.
  buf.rect(2, 1, 3, 2, P.grey1);
  buf.set(4, 2, P.grey2);
  buf.set(5, 0, P.yel1);
  buf.set(6, 1, P.yel1);
  return framed(buf);
}

/** Cóctel molotov: botella de cristal con combustible y el trapo prendido. */
export function paintMolotov(): PixelBuffer {
  const buf = new PixelBuffer(6, 11);
  // Trapo encendido.
  buf.set(2, 0, P.yel1);
  buf.set(3, 1, P.org1);
  buf.set(2, 1, P.light2);
  buf.rect(2, 2, 2, 2, P.white);
  buf.set(3, 3, P.grey1);
  // Cuello y cuerpo de la botella.
  buf.rect(2, 4, 2, 2, P.glass2);
  buf.rect(1, 6, 4, 5, P.glass2);
  buf.rect(1, 8, 4, 3, P.org2);
  buf.vline(1, 6, 4, P.glass1);
  buf.hline(1, 8, 4, P.org1);
  return framed(buf);
}

/** Cuatro giros de 90° del objeto en vuelo (el pixel art no se rota en otros ángulos). */
export function spinFrames(base: PixelBuffer): PixelBuffer[] {
  const frames = [base];
  for (let i = 1; i < 4; i++) frames.push((frames[i - 1] as PixelBuffer).rotatedCCW());
  return frames;
}

/** Montoncito de piezas: engranaje, tuerca de latón o chapa con remache. `variant` 0–2. */
export function paintScrap(variant: number): PixelBuffer {
  const buf = new PixelBuffer(8, 6);
  if (variant === 0) {
    // Engranaje con brillo.
    buf.rect(1, 1, 6, 4, P.grey1);
    buf.set(3, 0, P.grey1);
    buf.set(4, 0, P.grey1);
    buf.set(0, 2, P.grey1);
    buf.set(7, 3, P.grey1);
    buf.rect(3, 2, 2, 2, P.shadow);
    buf.hline(1, 4, 6, P.grey2);
    buf.set(2, 1, P.white);
  } else if (variant === 1) {
    // Tuerca de latón y tornillo.
    buf.rect(0, 2, 4, 4, P.yel2);
    buf.rect(1, 3, 2, 2, P.shadow);
    buf.hline(0, 2, 4, P.yel1);
    buf.set(0, 2, P.light1);
    buf.hline(4, 4, 4, P.grey1);
    buf.set(7, 3, P.grey2);
    buf.set(7, 5, P.grey2);
  } else {
    // Chapa doblada con remache de cobre.
    buf.rect(1, 1, 6, 4, P.grey2);
    buf.hline(1, 1, 6, P.white);
    buf.vline(6, 2, 3, P.grey3);
    buf.set(3, 3, P.org1);
  }
  return framed(buf);
}

/** Icono de la granada en el HUD. */
export function paintGrenadeIcon(): PixelBuffer {
  return paintGrenade();
}

/** Icono del molotov en el HUD. */
export function paintMolotovIcon(): PixelBuffer {
  return paintMolotov();
}

/** Icono de las piezas en el HUD: engranaje grande. */
export function paintScrapIcon(): PixelBuffer {
  const buf = new PixelBuffer(9, 9);
  buf.ellipse(4, 4, 3.2, 3.2, P.grey2);
  for (const [x, y] of [
    [4, 0],
    [4, 8],
    [0, 4],
    [8, 4],
    [1, 1],
    [7, 1],
    [1, 7],
    [7, 7],
  ] as const) buf.set(x, y, P.grey2);
  buf.ellipse(4, 4, 1.2, 1.2, P.shadow);
  buf.set(3, 2, P.grey1);
  buf.set(2, 3, P.grey1);
  return framed(buf);
}
