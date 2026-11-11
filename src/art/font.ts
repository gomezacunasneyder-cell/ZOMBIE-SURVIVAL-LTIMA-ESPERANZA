import { PixelBuffer } from './PixelBuffer';

/**
 * Tipografía de píxel propia de 3×5. Cada glifo son 15 bits, fila a fila.
 * Sirve para rótulos del escenario y etiquetas de depuración; el HUD
 * definitivo usará una tipografía mayor (Fase 2).
 */
const GLYPHS: Readonly<Record<string, string>> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '111111101101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '-': '000000111000000',
  '.': '000000000000010',
  ':': '000010000010000',
  '!': '010010010000010',
  '/': '001001010100100',
  x: '000101010101000',
  ' ': '000000000000000',
};

export const GLYPH_WIDTH = 3;
export const GLYPH_HEIGHT = 5;
/** Celda de cada carácter en la hoja de fuente (glifo + 1 px de separación). */
export const CELL_WIDTH = 4;
export const CELL_HEIGHT = 6;

/** Caracteres disponibles, en el orden de la hoja de fuente. */
export const FONT_CHARS = Object.keys(GLYPHS).join('');
export const FONT_CHARS_PER_ROW = 16;

function drawGlyph(buf: PixelBuffer, ch: string, x: number, y: number, color: number, scale: number): void {
  const bits = GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()];
  if (!bits) return;
  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    for (let col = 0; col < GLYPH_WIDTH; col++) {
      if (bits[row * GLYPH_WIDTH + col] === '1') {
        buf.rect(x + col * scale, y + row * scale, scale, scale, color);
      }
    }
  }
}

/** Ancho en píxeles de un texto de una línea. */
export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * CELL_WIDTH - 1) * scale;
}

/** Pinta texto directamente en un lienzo (para carteles, pintadas, matrículas). */
export function drawText(
  buf: PixelBuffer,
  text: string,
  x: number,
  y: number,
  color: number,
  scale = 1,
): void {
  for (let i = 0; i < text.length; i++) {
    drawGlyph(buf, text[i] as string, x + i * CELL_WIDTH * scale, y, color, scale);
  }
}

/** Hoja con todos los glifos, para registrarla como fuente de mapa de bits. */
export function paintFontSheet(color: number): PixelBuffer {
  const rows = Math.ceil(FONT_CHARS.length / FONT_CHARS_PER_ROW);
  const sheet = new PixelBuffer(FONT_CHARS_PER_ROW * CELL_WIDTH, rows * CELL_HEIGHT);
  for (let i = 0; i < FONT_CHARS.length; i++) {
    const cx = (i % FONT_CHARS_PER_ROW) * CELL_WIDTH;
    const cy = Math.floor(i / FONT_CHARS_PER_ROW) * CELL_HEIGHT;
    drawGlyph(sheet, FONT_CHARS[i] as string, cx, cy, color, 1);
  }
  return sheet;
}
