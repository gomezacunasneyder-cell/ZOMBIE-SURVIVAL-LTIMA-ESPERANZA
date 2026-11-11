import Phaser from 'phaser';
import { packAtlas } from '../../art/atlas';
import type { ArtCatalog } from '../../art/catalog';
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  FONT_CHARS,
  FONT_CHARS_PER_ROW,
  paintFontSheet,
} from '../../art/font';
import {
  ambientMask,
  beamRightMask,
  coneDownMask,
  radialMask,
  type Mask,
} from '../../art/lightMasks';
import { P } from '../../art/palette';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/** Textura única con todos los sprites. */
export const ATLAS_KEY = 'atlas';
/** Fuente de mapa de bits de 3×5. */
export const FONT_KEY = 'font-tiny';
/** Clave del registro con la posición del hombro por fotograma. */
export const SHOULDERS_KEY = 'art.shoulders';

export const MASK = {
  radialTiny: 'mask/radial-12',
  radialSmall: 'mask/radial-24',
  radialMedium: 'mask/radial-48',
  radialLarge: 'mask/radial-80',
  radialHuge: 'mask/radial-130',
  lampCone: 'mask/cone-lamp',
  searchlight: 'mask/cone-heli',
  beam: 'mask/beam',
  ambient: 'mask/ambient',
} as const;

function addCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
): Phaser.Textures.CanvasTexture {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`No se pudo crear la textura «${key}»`);
  const image = texture.context.createImageData(width, height);
  image.data.set(rgba);
  texture.context.putImageData(image, 0, 0);
  texture.refresh();
  return texture;
}

function addMask(scene: Phaser.Scene, key: string, mask: Mask): void {
  addCanvasTexture(scene, key, mask.width, mask.height, mask.rgba);
}

/**
 * Adaptador entre el arte puro (`src/art`) y Phaser: crea las texturas,
 * registra los fotogramas del atlas, las animaciones, la fuente y las
 * máscaras de luz. Es el único punto donde el arte toca el motor.
 */
export function registerArt(scene: Phaser.Scene, catalog: ArtCatalog): void {
  // Atlas de sprites.
  const packed = packAtlas(catalog.sprites);
  const atlas = addCanvasTexture(scene, ATLAS_KEY, packed.width, packed.height, packed.rgba);
  for (const frame of packed.frames) {
    atlas.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
  }

  // Capas de fondo, cada una en su textura para poder repetirlas.
  for (const [key, layer] of catalog.layers) {
    addCanvasTexture(scene, key, layer.width, layer.height, layer.toRgba());
  }

  // Animaciones.
  for (const def of catalog.animations) {
    scene.anims.create({
      key: def.key,
      frames: def.frames.map((frame) => ({ key: ATLAS_KEY, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
  scene.registry.set(SHOULDERS_KEY, catalog.shoulders);

  // Tipografía de píxel.
  const sheetKey = `${FONT_KEY}-sheet`;
  const sheet = paintFontSheet(P.white);
  addCanvasTexture(scene, sheetKey, sheet.width, sheet.height, sheet.toRgba());
  scene.cache.bitmapFont.add(
    FONT_KEY,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: sheetKey,
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      chars: FONT_CHARS,
      charsPerRow: FONT_CHARS_PER_ROW,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 0,
    }),
  );

  // Máscaras de luz.
  addMask(scene, MASK.radialTiny, radialMask(12));
  addMask(scene, MASK.radialSmall, radialMask(24));
  addMask(scene, MASK.radialMedium, radialMask(48));
  addMask(scene, MASK.radialLarge, radialMask(80));
  addMask(scene, MASK.radialHuge, radialMask(130));
  addMask(scene, MASK.lampCone, coneDownMask(120, 112, 8));
  addMask(scene, MASK.searchlight, coneDownMask(96, 176, 4));
  addMask(scene, MASK.beam, beamRightMask(150, 64, 6));
  addMask(scene, MASK.ambient, ambientMask(GAME_WIDTH, GAME_HEIGHT, 70, 168));
}
