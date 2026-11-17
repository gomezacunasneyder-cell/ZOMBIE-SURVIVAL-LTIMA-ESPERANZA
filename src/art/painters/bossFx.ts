import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Efectos de los ataques de EL DEVORADOR: bilis en vuelo y su charco, la
 * grieta que avisa de una espina, la espina de hueso al brotar y la onda
 * de polvo y escombros del golpe contra el suelo.
 */

function framed(buf: PixelBuffer): PixelBuffer {
  return new PixelBuffer(buf.width + 2, buf.height + 2).blit(buf, 1, 1).outline(P.outline);
}

/** Gota de bilis: verde amarillenta con un brillo. `frame` 0–1 para que palpite. */
export function paintBile(frame: number): PixelBuffer {
  const buf = new PixelBuffer(6, 6);
  buf.ellipse(2.5, 2.5, 2.4 - frame * 0.4, 2.4, P.zom1);
  buf.ellipse(2.5, 3, 1.5, 1.2, P.yel3);
  buf.set(1, 1, P.light1);
  return framed(buf);
}

/** Charco de bilis que humea en el asfalto. */
export function paintBilePuddle(): PixelBuffer {
  const buf = new PixelBuffer(20, 4);
  buf.ellipse(10, 2, 9.5, 1.6, P.zom2);
  buf.hline(4, 1, 12, P.zom1);
  buf.set(6, 2, P.yel3);
  buf.set(13, 2, P.yel3);
  buf.set(9, 1, P.light1);
  return buf;
}

/** Grieta encendida en el suelo: avisa de dónde va a brotar una espina. `on` alterna el brillo. */
export function paintSpikeWarning(on: boolean): PixelBuffer {
  const buf = new PixelBuffer(16, 4);
  const hot = on ? P.org1 : P.blood1;
  const core = on ? P.yel1 : P.org2;
  buf.line(0, 2, 5, 1, hot);
  buf.line(5, 1, 10, 3, hot);
  buf.line(10, 3, 15, 1, hot);
  buf.set(5, 1, core);
  buf.set(10, 3, core);
  buf.hline(3, 3, 4, P.blood3);
  return buf;
}

export const SPIKE_FRAMES = 3;

/** Espina de hueso que revienta el asfalto. `stage` 0 asoma, 1 media, 2 entera. */
export function paintSpike(stage: number): PixelBuffer {
  const height = [10, 20, 30][stage] ?? 30;
  const buf = new PixelBuffer(14, 32);
  const base = 31;
  // Escombros del asfalto a los lados.
  buf.rect(0, base - 2, 3, 2, P.asph2);
  buf.rect(11, base - 2, 3, 2, P.asph2);
  buf.set(1, base - 3, P.asph1);
  buf.set(12, base - 3, P.asph1);
  // Espina: ancha abajo y afilada arriba, con la cara iluminada.
  buf.trapezoid(base - height, 7, 7, base, 3, 10, P.white);
  buf.trapezoid(base - height + 3, 7, 8, base, 7, 10, P.grey1);
  buf.vline(5, base - Math.floor(height * 0.6), Math.floor(height * 0.6), P.light1);
  buf.set(7, base - height, P.blood1);
  // Vetas de carne en la base.
  buf.hline(4, base - 2, 6, P.blood2);
  buf.set(6, base - 3, P.blood1);
  return framed(buf);
}

export const SHOCKWAVE_FRAMES = 2;

/** Onda del golpe: polvo y piedras que avanzan a ras de suelo. */
export function paintShockwave(frame: number): PixelBuffer {
  const buf = new PixelBuffer(18, 14);
  const lift = frame === 0 ? 0 : 2;
  buf.ellipse(9, 10, 8, 3, P.grey2);
  buf.ellipse(9, 8 - lift, 6, 4, P.grey1);
  buf.ellipse(7, 6 - lift, 3, 3, P.white);
  for (const [x, y] of [
    [2, 3],
    [15, 2],
    [12, 0],
    [4, 1],
  ] as const) buf.rect(x, y + lift, 2, 2, P.asph1);
  buf.hline(1, 13, 16, P.asph3);
  return buf;
}
