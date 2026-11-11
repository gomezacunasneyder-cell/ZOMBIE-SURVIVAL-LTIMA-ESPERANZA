import { Rng } from '../../core/math/Rng';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/** Peligros y efectos de la Fase 2: bidón inflamable, explosión, humo, papeles y sombras. */

/**
 * Bidón de combustible alto (200 l): rojo con dos aros y banda de peligro.
 * Mide 22 px para que una bala disparada en horizontal, que sale a la
 * altura del hombro, lo alcance desde cualquier distancia.
 */
export function paintFuelBarrel(): PixelBuffer {
  const buf = new PixelBuffer(12, 24);
  buf.rect(1, 2, 10, 21, P.blood1);
  buf.rect(2, 1, 8, 1, P.blood2);
  buf.rect(2, 2, 8, 1, P.scarf1);
  buf.set(7, 1, P.grey3);
  buf.vline(2, 3, 19, P.scarf1);
  buf.dither(8, 3, 3, 19, P.blood2, 1, P.blood1);
  // Aros de refuerzo.
  for (const y of [6, 17]) {
    buf.hline(1, y, 10, P.blood3);
    buf.hline(1, y + 1, 10, P.scarf1);
  }
  // Banda de peligro.
  buf.rect(1, 10, 10, 4, P.yel2);
  for (let x = 1; x < 11; x += 3) buf.line(x, 13, x + 2, 10, P.outline);
  buf.rect(1, 22, 10, 1, P.blood3);
  return buf.outline(P.outline);
}

export const EXPLOSION_FRAMES = 8;
export const EXPLOSION_SIZE = 56;

/** Explosión en 8 fotogramas: destello, bola de fuego que crece y humo que sube. */
export function paintExplosion(frame: number): PixelBuffer {
  const size = EXPLOSION_SIZE;
  const buf = new PixelBuffer(size, size);
  const rng = new Rng(8800 + frame * 13);
  const cx = size / 2;
  const cy = size / 2 + 4;

  /** Disco irregular: un círculo con bultos en el contorno. */
  const blob = (radius: number, color: number, rise = 0, density = 1): void => {
    if (radius <= 0) return;
    const draw = (x: number, y: number, r: number): void => {
      if (density >= 1) buf.ellipse(x, y, r, r, color);
      else {
        const temp = new PixelBuffer(size, size).ellipse(x, y, r, r, color);
        for (let py = 0; py < size; py++) {
          for (let px = 0; px < size; px++) {
            if (temp.get(px, py) !== 0) buf.dither(px, py, 1, 1, color, density);
          }
        }
      }
    };
    draw(cx, cy - rise, radius);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng.next();
      draw(cx + Math.cos(a) * radius * 0.75, cy - rise + Math.sin(a) * radius * 0.7, radius * (0.3 + rng.next() * 0.25));
    }
  };

  const stages: [radius: number, color: number, rise?: number, density?: number][][] = [
    [
      [7, P.yel1],
      [5, P.light1],
    ],
    [
      [12, P.org1],
      [9, P.yel1],
      [6, P.light1],
    ],
    [
      [17, P.org2],
      [14, P.org1],
      [10, P.yel1],
      [5, P.light1],
    ],
    [
      [20, P.grey3, 2, 0.6],
      [18, P.blood1],
      [15, P.org2],
      [11, P.org1],
      [6, P.yel1],
    ],
    [
      [21, P.grey3, 4, 0.7],
      [16, P.blood1, 1],
      [12, P.org2],
      [7, P.org1],
    ],
    [
      [21, P.asph3, 7, 0.6],
      [17, P.grey3, 6, 0.55],
      [10, P.blood2, 2],
      [5, P.org2, 1],
    ],
    [
      [19, P.asph3, 11, 0.42],
      [14, P.grey3, 10, 0.4],
    ],
    [
      [16, P.asph3, 15, 0.22],
      [10, P.grey3, 14, 0.2],
    ],
  ];
  for (const [radius, color, rise, density] of stages[Math.min(frame, EXPLOSION_FRAMES - 1)] ?? []) {
    blob(radius, color, rise ?? 0, density ?? 1);
  }
  // Esquirlas incandescentes que salen despedidas.
  if (frame >= 1 && frame <= 4) {
    for (let i = 0; i < 9; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = 8 + frame * 4.5 + rng.next() * 4;
      buf.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, frame < 3 ? P.light2 : P.org1);
    }
  }
  return buf;
}

/** Marca de quemadura que deja una explosión en el asfalto. */
export function paintScorch(): PixelBuffer {
  const buf = new PixelBuffer(44, 12);
  buf.dither(2, 1, 40, 10, P.asph4, 0.4);
  buf.ellipse(22, 6, 17, 4, P.asph4);
  buf.ellipse(22, 6, 12, 2.6, P.shadow);
  buf.dither(8, 3, 28, 6, P.outline, 0.45, P.shadow);
  return buf;
}

/** Bocanada de humo en tres tamaños. */
export function paintSmoke(size: number): PixelBuffer {
  const dim = 3 + size * 2;
  const buf = new PixelBuffer(dim, dim);
  const c = (dim - 1) / 2;
  buf.ellipse(c, c, c, c, P.grey3);
  buf.dither(0, 0, dim, dim, P.asph3, 0.5, P.grey3);
  if (size > 0) buf.set(c - 1, c - 1, P.grey2);
  return buf;
}

/** Papel arrastrado por el viento, en dos posiciones de giro. */
export function paintPaper(frame: number): PixelBuffer {
  const buf = new PixelBuffer(4, 3);
  if (frame % 2 === 0) {
    buf.rect(0, 0, 4, 2, P.white);
    buf.set(3, 1, P.grey1).set(1, 1, P.grey2);
  } else {
    buf.rect(1, 0, 2, 3, P.white);
    buf.set(2, 2, P.grey1).set(1, 1, P.grey2);
  }
  return buf;
}

/** Sombra de contacto de un ancho dado, para objetos y vehículos. */
export function paintGroundShadow(width: number): PixelBuffer {
  const buf = new PixelBuffer(width, 5);
  buf.ellipse((width - 1) / 2, 2, width / 2 - 1, 1.6, P.outline);
  return buf;
}

export const SHADOW_WIDTHS = [14, 30, 62, 96] as const;

/** Nombre de la sombra más ajustada para un objeto de `width` píxeles. */
export function shadowFrameFor(width: number): string {
  const fit = SHADOW_WIDTHS.find((w) => w >= width) ?? SHADOW_WIDTHS[SHADOW_WIDTHS.length - 1];
  return `fx/ground-shadow/${fit}`;
}

/** Baliza de alarma sobre un poste; la lámpara queda en (4, 3). */
export function paintAlarmBeacon(): PixelBuffer {
  const buf = new PixelBuffer(9, 46);
  buf.rect(3, 8, 2, 37, P.grey3);
  buf.vline(3, 8, 37, P.grey2);
  buf.rect(2, 42, 4, 3, P.shadow);
  buf.rect(1, 6, 6, 2, P.grey3);
  buf.rect(2, 1, 4, 5, P.blood1);
  buf.rect(2, 1, 4, 1, P.scarf1);
  buf.set(3, 2, P.light1);
  // Bocina.
  buf.rect(5, 10, 3, 4, P.grey2);
  buf.set(7, 9, P.grey3).set(7, 14, P.grey3);
  return buf.outline(P.outline);
}
