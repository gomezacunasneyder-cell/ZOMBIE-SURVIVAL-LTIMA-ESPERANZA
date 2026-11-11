import Phaser from 'phaser';

/** Resolución interna del juego. ×4 = 1920 × 1080 exactos. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d1a22',
    // pixelArt: sin suavizado, filtrado «nearest» y posiciones redondeadas a píxel.
    pixelArt: true,
    roundPixels: true,
    scale: {
      // El zoom lo gestiona integerScale.ts para garantizar múltiplos enteros.
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 900 }, fixedStep: true, fps: 60 },
    },
    scene: scenes,
  };
}
