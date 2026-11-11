/**
 * Paleta única del juego. Todo el arte usa índices de esta tabla;
 * una prueba automática rechaza cualquier color fuera de ella.
 * El índice 0 es transparente.
 */
const COLORS = {
  // Contorno y sombra profunda
  outline: '#1d1a22',
  shadow: '#2b2636',

  // Cielo nocturno
  night1: '#141829',
  night2: '#1e2742',
  night3: '#2f3b5e',

  // Cielo de atardecer contaminado
  skyTop: '#5f5a5e',
  sky1: '#86707a',
  sky2: '#a67a88',
  sky3: '#c9929a',
  sky4: '#e0b0a4',
  sun: '#f2d2b0',

  // Ciudad en capas (más lejos = más cerca del color del cielo)
  cityFar: '#8d8573',
  cityMid: '#6b6f57',
  cityNear: '#4a5142',
  cityDark: '#333a34',

  // Hormigón y lona
  conc1: '#8796a3',
  conc2: '#6c7c8c',
  conc3: '#4f5d70',
  conc4: '#3a4456',

  // Asfalto
  asph1: '#726c7d',
  asph2: '#625c6e',
  asph3: '#4c475a',
  asph4: '#3b3748',
  lane: '#9a96a3',

  // Verde militar
  mil1: '#a8a26e',
  mil2: '#8d8758',
  mil3: '#63663a',
  mil4: '#3d402b',

  // Piel infectada
  zom1: '#a9bb7c',
  zom2: '#8ea069',
  zom3: '#6b7a55',
  zom4: '#4a5540',

  // Piel humana
  skin1: '#e8b48c',
  skin2: '#c98e6a',
  skin3: '#94604c',

  // Sangre
  scarf1: '#e2604e',
  blood1: '#c23b2c',
  blood2: '#8a1f1f',
  blood3: '#5a1620',

  // Naranja (bidones, chalecos, óxido)
  org1: '#f0a03c',
  org2: '#d9772b',
  org3: '#9c4a22',

  // Amarillo (trajes de protección, señales)
  yel1: '#f4dc6a',
  yel2: '#e2c13a',
  yel3: '#a8862c',

  // Luz
  light1: '#fff4c8',
  light2: '#ffe27a',

  // Neutros
  white: '#e8e4dc',
  grey1: '#b9b5b8',
  grey2: '#8a8792',
  grey3: '#5e5b68',

  // Azul de Alex (acento exclusivo del protagonista)
  blue1: '#6db4e0',
  blue2: '#3f7fba',
  blue3: '#2a5286',
  blue4: '#1c3559',

  // Marrones (pelo, cuero, madera, ropa)
  brown1: '#9a7654',
  brown2: '#6e4f3c',
  brown3: '#47332d',

  // Cristal
  glass1: '#a6cbd4',
  glass2: '#5f8c9e',

  // Interfaz
  ui1: '#6fbf3a',
  ui2: '#3f8a2c',
} as const;

export type ColorName = keyof typeof COLORS;

const NAMES = Object.keys(COLORS) as ColorName[];

/** Índice de paleta por nombre. Ejemplo: `P.outline`. */
export const P: Readonly<Record<ColorName, number>> = Object.freeze(
  Object.fromEntries(NAMES.map((name, i) => [name, i + 1])) as Record<ColorName, number>,
);

/** Índice reservado para «sin píxel». */
export const TRANSPARENT = 0;

/** Número de entradas, contando la transparente. */
export const PALETTE_SIZE = NAMES.length + 1;

/** Colores en hexadecimal por índice (`null` en el 0). */
export const PALETTE_HEX: readonly (string | null)[] = [null, ...NAMES.map((n) => COLORS[n])];

/** Paleta como bytes RGBA consecutivos, lista para volcar a un canvas. */
export const PALETTE_RGBA: Uint8Array = (() => {
  const out = new Uint8Array(PALETTE_SIZE * 4);
  NAMES.forEach((name, i) => {
    const hex = COLORS[name];
    const o = (i + 1) * 4;
    out[o] = parseInt(hex.slice(1, 3), 16);
    out[o + 1] = parseInt(hex.slice(3, 5), 16);
    out[o + 2] = parseInt(hex.slice(5, 7), 16);
    out[o + 3] = 255;
  });
  return out;
})();

/** Color como número 0xRRGGBB, para tintes y rellenos de Phaser. */
export function colorNumber(name: ColorName): number {
  return parseInt(COLORS[name].slice(1), 16);
}

export function colorNames(): readonly ColorName[] {
  return NAMES;
}
