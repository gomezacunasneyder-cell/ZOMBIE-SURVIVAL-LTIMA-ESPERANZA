/**
 * Máscaras de luz. No son arte indexado: son mapas de transparencia que la
 * capa de iluminación usa para «recortar» la oscuridad. Para que la luz
 * también parezca pixel art, la intensidad se cuantiza en pocos niveles
 * con tramado ordenado en lugar de un degradado suave.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
const LEVELS = 4;

export interface Mask {
  width: number;
  height: number;
  /** Bytes RGBA: blanco con la intensidad en el canal alfa. */
  rgba: Uint8ClampedArray;
}

/** Construye una máscara evaluando una intensidad 0–1 en cada píxel. */
export function buildMask(width: number, height: number, intensity: (x: number, y: number) => number): Mask {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.min(1, Math.max(0, intensity(x, y)));
      const bias = (BAYER4[(y & 3) * 4 + (x & 3)] as number) / 16;
      const level = Math.min(LEVELS, Math.floor(v * LEVELS + bias));
      const o = (y * width + x) * 4;
      rgba[o] = 255;
      rgba[o + 1] = 255;
      rgba[o + 2] = 255;
      rgba[o + 3] = Math.round((level / LEVELS) * 255);
    }
  }
  return { width, height, rgba };
}

/** Luz redonda: máxima en el centro, nula en el borde. */
export function radialMask(radius: number): Mask {
  const size = radius * 2;
  return buildMask(size, size, (x, y) => {
    const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius;
    return 1 - d * d;
  });
}

/** Cono de luz hacia abajo desde el centro del borde superior (farolas, focos). */
export function coneDownMask(width: number, height: number, topWidth: number): Mask {
  return buildMask(width, height, (x, y) => {
    const t = (y + 0.5) / height;
    const half = (topWidth + (width - topWidth) * t) / 2;
    const side = Math.abs(x + 0.5 - width / 2) / half;
    if (side >= 1) return 0;
    return (1 - side * side) * (1 - t * 0.55);
  });
}

/** Haz horizontal hacia la derecha desde el centro del borde izquierdo (faros). */
export function beamRightMask(width: number, height: number, nearHeight: number): Mask {
  return buildMask(width, height, (x, y) => {
    const t = (x + 0.5) / width;
    const half = (nearHeight + (height - nearHeight) * t) / 2;
    const side = Math.abs(y + 0.5 - height / 2) / half;
    if (side >= 1) return 0;
    return (1 - side * side) * (1 - t);
  });
}

/**
 * Oscuridad ambiente: nula arriba (el cielo conserva su color) y completa
 * a partir de `fullAt`. Así el atardecer oscurece la calle, no el cielo.
 */
export function ambientMask(width: number, height: number, startAt: number, fullAt: number): Mask {
  return buildMask(width, height, (_x, y) => (y - startAt) / (fullAt - startAt));
}
