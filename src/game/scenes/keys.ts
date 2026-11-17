/** Claves de escena en un solo sitio para evitar cadenas sueltas. */
export const SCENE = {
  preload: 'Preload',
  game: 'Game',
  hud: 'Hud',
  gallery: 'Gallery',
  compare: 'Compare',
  arsenal: 'Arsenal',
  bestiary: 'Bestiary',
  options: 'Options',
  inventory: 'Inventory',
} as const;

/** Clave del registro donde la escena de juego publica su bus de eventos. */
export const BUS_KEY = 'game.bus';

/**
 * Momento (reloj del navegador) en que se cerró la pausa o el inventario.
 * La tecla que los cierra llega también al juego al reanudarse: así no
 * vuelve a abrirlos en el acto.
 */
export const OVERLAY_CLOSED_KEY = 'overlay.closedAt';

/** Clave del registro con el resultado de importar sprites externos. */
export const IMPORT_REPORTS_KEY = 'art.importReports';
