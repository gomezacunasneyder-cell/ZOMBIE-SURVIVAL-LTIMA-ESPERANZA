import { PixelBuffer, writeRgba } from './PixelBuffer';

export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackedAtlas {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  frames: AtlasFrame[];
}

const PADDING = 1;

/**
 * Empaqueta todos los fotogramas en una sola imagen (algoritmo de estantes).
 * Un único atlas permite a Phaser dibujar casi todo en un lote.
 * Función pura: devuelve los bytes y la posición de cada fotograma.
 */
export function packAtlas(sprites: ReadonlyMap<string, PixelBuffer>, atlasWidth = 512): PackedAtlas {
  const entries = [...sprites.entries()].sort(
    (a, b) => b[1].height - a[1].height || a[0].localeCompare(b[0]),
  );

  const frames: AtlasFrame[] = [];
  let cursorX = PADDING;
  let cursorY = PADDING;
  let shelfHeight = 0;

  for (const [name, buf] of entries) {
    if (buf.width + PADDING * 2 > atlasWidth) {
      throw new Error(`packAtlas: «${name}» (${buf.width} px) no cabe en un atlas de ${atlasWidth} px`);
    }
    if (cursorX + buf.width + PADDING > atlasWidth) {
      cursorX = PADDING;
      cursorY += shelfHeight + PADDING;
      shelfHeight = 0;
    }
    frames.push({ name, x: cursorX, y: cursorY, width: buf.width, height: buf.height });
    cursorX += buf.width + PADDING;
    shelfHeight = Math.max(shelfHeight, buf.height);
  }

  const height = cursorY + shelfHeight + PADDING;
  const rgba = new Uint8ClampedArray(atlasWidth * height * 4);
  for (const frame of frames) {
    writeRgba(sprites.get(frame.name) as PixelBuffer, rgba, atlasWidth, frame.x, frame.y);
  }
  return { width: atlasWidth, height, rgba, frames };
}
