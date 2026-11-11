/** Claves de escena en un solo sitio para evitar cadenas sueltas. */
export const SCENE = {
  preload: 'Preload',
  game: 'Game',
  hud: 'Hud',
  gallery: 'Gallery',
  compare: 'Compare',
  arsenal: 'Arsenal',
  options: 'Options',
} as const;

/** Clave del registro donde la escena de juego publica su bus de eventos. */
export const BUS_KEY = 'game.bus';

/** Clave del registro con el resultado de importar sprites externos. */
export const IMPORT_REPORTS_KEY = 'art.importReports';
