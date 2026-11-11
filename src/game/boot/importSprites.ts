import type Phaser from 'phaser';
import type { ArtCatalog } from '../../art/catalog';
import {
  applyPack,
  applySingle,
  parseManifest,
  parsePackMeta,
  type DecodedImage,
  type ImportReport,
  type SpriteManifest,
} from '../../art/import/spritePack';

/** Carpeta pública donde se dejan los sprites externos. */
const BASE = 'sprites/';
const MANIFEST_KEY = 'sprite-manifest';
const imageKey = (i: number): string => `sprite-pack-image-${i}`;
const dataKey = (i: number): string => `sprite-pack-data-${i}`;

/** Pone en cola la carga del manifiesto. Llamar desde `preload`. */
export function queueManifest(scene: Phaser.Scene): void {
  scene.load.json(MANIFEST_KEY, `${BASE}manifest.json`);
}

/** Lee el manifiesto ya cargado. */
export function readManifest(scene: Phaser.Scene): { manifest: SpriteManifest; errors: string[] } {
  if (!scene.cache.json.exists(MANIFEST_KEY)) return { manifest: { version: 1, packs: [] }, errors: [] };
  return parseManifest(scene.cache.json.get(MANIFEST_KEY));
}

/** Pone en cola las imágenes y metadatos de cada paquete del manifiesto. */
export function queuePacks(scene: Phaser.Scene, manifest: SpriteManifest): void {
  manifest.packs.forEach((pack, i) => {
    scene.load.image(imageKey(i), BASE + pack.image);
    if (pack.data) scene.load.json(dataKey(i), BASE + pack.data);
  });
}

function decode(scene: Phaser.Scene, key: string): DecodedImage | null {
  if (!scene.textures.exists(key)) return null;
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, rgba: data };
}

/**
 * Aplica al catálogo los paquetes cargados, antes de construir el atlas.
 * Un paquete defectuoso no detiene el juego: se informa y se conserva el
 * arte generado por código.
 */
export function applyLoadedPacks(scene: Phaser.Scene, manifest: SpriteManifest, catalog: ArtCatalog): ImportReport[] {
  return manifest.packs.map((pack, i) => {
    const failed = (message: string): ImportReport => ({
      source: pack.image,
      applied: [],
      errors: [message],
      warnings: [],
    });
    const image = decode(scene, imageKey(i));
    if (!image) return failed(`No se pudo cargar la imagen «${BASE}${pack.image}».`);
    scene.textures.remove(imageKey(i));

    if (pack.frame) return applySingle(catalog, pack.frame, image, pack.image, pack.shoulder);

    if (!scene.cache.json.exists(dataKey(i))) return failed(`No se pudieron cargar los metadatos «${BASE}${pack.data}».`);
    const { meta, errors } = parsePackMeta(scene.cache.json.get(dataKey(i)));
    const report = applyPack(catalog, meta, image, pack.image);
    report.errors.unshift(...errors);
    return report;
  });
}
