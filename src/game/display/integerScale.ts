import type Phaser from 'phaser';

/**
 * Calcula el zoom CSS que hace que cada píxel del juego ocupe un número
 * ENTERO de píxeles físicos de pantalla. Con un zoom fraccionario, unas
 * columnas de píxeles salen más anchas que otras y el pixel art se deforma.
 *
 * Función pura para poder probarla sin navegador.
 */
export function computeIntegerZoom(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
  gameWidth: number,
  gameHeight: number,
): { cssZoom: number; deviceZoom: number } {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const fitX = Math.floor((viewportWidth * dpr) / gameWidth);
  const fitY = Math.floor((viewportHeight * dpr) / gameHeight);
  const deviceZoom = Math.max(1, Math.min(fitX, fitY));
  return { cssZoom: deviceZoom / dpr, deviceZoom };
}

/**
 * Aplica el zoom entero al arrancar y cada vez que cambia el espacio
 * disponible. Mide el contenedor del juego (no la ventana), de modo que
 * el lienzo nunca queda más grande que la zona visible ni se recorta.
 */
export function installIntegerScale(game: Phaser.Game): void {
  const root = game.canvas?.parentElement ?? document.getElementById('game-root') ?? document.body;

  const apply = (): void => {
    const box = root.getBoundingClientRect();
    const visual = window.visualViewport;
    const width = Math.min(box.width, visual?.width ?? box.width, document.documentElement.clientWidth);
    const height = Math.min(box.height, visual?.height ?? box.height, document.documentElement.clientHeight);
    const { cssZoom } = computeIntegerZoom(width, height, window.devicePixelRatio, game.scale.width, game.scale.height);
    if (game.scale.zoom !== cssZoom) game.scale.setZoom(cssZoom);
  };

  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(root);
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  game.events.once('destroy', () => {
    observer.disconnect();
    window.removeEventListener('resize', apply);
    window.visualViewport?.removeEventListener('resize', apply);
  });
}
