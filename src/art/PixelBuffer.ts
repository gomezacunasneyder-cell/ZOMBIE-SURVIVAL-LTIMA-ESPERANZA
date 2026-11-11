import { PALETTE_RGBA, TRANSPARENT } from './palette';

/** Matriz de Bayer 4×4 para tramado ordenado (valores 0–15). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

export interface BlitOptions {
  flipX?: boolean;
  /** Sustituye cada índice de origen por otro antes de pintar. */
  remap?: Readonly<Record<number, number>>;
}

/**
 * Lienzo de pixel art indexado: cada celda guarda un índice de la paleta.
 * No depende del navegador ni de Phaser, así que los pintores que lo usan
 * son funciones puras y se prueban en Node.
 */
export class PixelBuffer {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error(`PixelBuffer: tamaño no válido ${width}×${height}`);
    }
    this.data = new Uint8Array(width * height);
  }

  /** Crea un lienzo a partir de filas de texto y una leyenda carácter → color. */
  static fromRows(rows: readonly string[], legend: Readonly<Record<string, number>>): PixelBuffer {
    const height = rows.length;
    const width = rows[0]?.length ?? 0;
    const buf = new PixelBuffer(width, height);
    rows.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(`PixelBuffer.fromRows: la fila ${y} mide ${row.length}, se esperaba ${width}`);
      }
      for (let x = 0; x < width; x++) {
        const ch = row[x] as string;
        if (ch === '.' || ch === ' ') continue;
        const color = legend[ch];
        if (color === undefined) throw new Error(`PixelBuffer.fromRows: carácter sin leyenda «${ch}»`);
        buf.set(x, y, color);
      }
    });
    return buf;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): number {
    return this.inBounds(x, y) ? (this.data[y * this.width + x] as number) : TRANSPARENT;
  }

  set(x: number, y: number, color: number): this {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (this.inBounds(xi, yi)) this.data[yi * this.width + xi] = color;
    return this;
  }

  fill(color: number): this {
    this.data.fill(color);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x) + Math.round(w));
    const y1 = Math.min(this.height, Math.round(y) + Math.round(h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.data[yy * this.width + xx] = color;
    }
    return this;
  }

  hline(x: number, y: number, length: number, color: number): this {
    return this.rect(x, y, length, 1, color);
  }

  vline(x: number, y: number, length: number, color: number): this {
    return this.rect(x, y, 1, length, color);
  }

  /** Línea de Bresenham. `thickness` estampa un cuadrado en cada punto. */
  line(x0: number, y0: number, x1: number, y1: number, color: number, thickness = 1): this {
    forEachLinePoint(x0, y0, x1, y1, (x, y) => {
      if (thickness === 1) this.set(x, y, color);
      else this.rect(x, y, thickness, thickness, color);
    });
    return this;
  }

  /**
   * Línea gruesa con un color por columna del pincel. Sirve para
   * extremidades: `[sombra, medio, luz]` da volumen sin esfuerzo.
   */
  brushLine(x0: number, y0: number, x1: number, y1: number, brush: readonly number[]): this {
    const half = Math.floor(brush.length / 2);
    forEachLinePoint(x0, y0, x1, y1, (x, y) => {
      for (let i = 0; i < brush.length; i++) this.set(x - half + i, y, brush[i] as number);
    });
    return this;
  }

  /** Elipse rellena centrada en (cx, cy). */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35);
        const dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
    return this;
  }

  /** Trapecio relleno: interpola los bordes izquierdo y derecho entre dos filas. */
  trapezoid(
    y0: number,
    left0: number,
    right0: number,
    y1: number,
    left1: number,
    right1: number,
    color: number,
  ): this {
    const rows = Math.max(1, y1 - y0);
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / rows;
      const l = Math.round(left0 + (left1 - left0) * t);
      const r = Math.round(right0 + (right1 - right0) * t);
      this.rect(l, y, r - l + 1, 1, color);
    }
    return this;
  }

  /**
   * Tramado ordenado: pinta `color` en la fracción `density` (0–1) de los
   * píxeles del rectángulo. Con `over`, solo sobre píxeles de ese color.
   */
  dither(x: number, y: number, w: number, h: number, color: number, density: number, over?: number): this {
    const threshold = density * 16;
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
        if ((BAYER4[(yy & 3) * 4 + (xx & 3)] as number) >= threshold) continue;
        if (over !== undefined && this.data[yy * this.width + xx] !== over) continue;
        this.data[yy * this.width + xx] = color;
      }
    }
    return this;
  }

  /** Copia otro lienzo encima; los píxeles transparentes no se copian. */
  blit(src: PixelBuffer, dx: number, dy: number, options: BlitOptions = {}): this {
    const ox = Math.round(dx);
    const oy = Math.round(dy);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const sx = options.flipX ? src.width - 1 - x : x;
        let color = src.data[y * src.width + sx] as number;
        if (color === TRANSPARENT) continue;
        if (options.remap) color = options.remap[color] ?? color;
        this.set(ox + x, oy + y, color);
      }
    }
    return this;
  }

  /** Rodea la figura con un contorno de 1 px (vecindad de 4). */
  outline(color: number): this {
    const src = this.data.slice();
    const w = this.width;
    const h = this.height;
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== TRANSPARENT;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== TRANSPARENT) continue;
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
          this.data[y * w + x] = color;
        }
      }
    }
    return this;
  }

  replace(from: number, to: number): this {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
    return this;
  }

  clone(): PixelBuffer {
    const copy = new PixelBuffer(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  flippedX(): PixelBuffer {
    return new PixelBuffer(this.width, this.height).blit(this, 0, 0, { flipX: true });
  }

  /** Copia girada 90° en sentido antihorario (giro exacto, sin deformar). */
  rotatedCCW(): PixelBuffer {
    const out = new PixelBuffer(this.height, this.width);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out.data[(this.width - 1 - x) * out.width + y] = this.data[y * this.width + x] as number;
      }
    }
    return out;
  }

  /** Rectángulo mínimo que contiene los píxeles no transparentes. */
  bounds(): { left: number; top: number; right: number; bottom: number } {
    let left = this.width;
    let top = this.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.data[y * this.width + x] === TRANSPARENT) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    return { left, top, right, bottom };
  }

  /** Número de píxeles no transparentes. */
  countOpaque(): number {
    let n = 0;
    for (const v of this.data) if (v !== TRANSPARENT) n++;
    return n;
  }

  /** Convierte a bytes RGBA usando la paleta. */
  toRgba(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    writeRgba(this, out, this.width, 0, 0);
    return out;
  }
}

/** Vuelca un lienzo indexado dentro de un mapa RGBA mayor. */
export function writeRgba(
  src: PixelBuffer,
  target: Uint8ClampedArray,
  targetWidth: number,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const color = src.data[y * src.width + x] as number;
      if (color === TRANSPARENT) continue;
      const o = ((dy + y) * targetWidth + dx + x) * 4;
      const p = color * 4;
      target[o] = PALETTE_RGBA[p] as number;
      target[o + 1] = PALETTE_RGBA[p + 1] as number;
      target[o + 2] = PALETTE_RGBA[p + 2] as number;
      target[o + 3] = 255;
    }
  }
}

function forEachLinePoint(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  visit: (x: number, y: number) => void,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    visit(x, y);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
