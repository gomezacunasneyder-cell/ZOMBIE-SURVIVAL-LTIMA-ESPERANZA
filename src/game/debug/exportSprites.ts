import type Phaser from 'phaser';
import type { PackMeta } from '../../art/import/spritePack';
import { ATLAS_KEY, SHOULDERS_KEY } from '../boot/registerArt';

export interface SpriteExport {
  /** Hoja de sprites como URL de datos PNG. */
  png: string;
  /** Metadatos en el mismo formato que admite el importador. */
  json: string;
  frameCount: number;
}

const SHEET_WIDTH = 512;
const GAP = 1;

function atlasCanvas(scene: Phaser.Scene): { texture: Phaser.Textures.Texture; canvas: HTMLCanvasElement } {
  const texture = scene.textures.get(ATLAS_KEY);
  return { texture, canvas: texture.getSourceImage() as HTMLCanvasElement };
}

/**
 * Exporta los fotogramas cuyo nombre empieza por `prefix` como una hoja
 * PNG transparente más sus metadatos. Sirve de plantilla exacta para
 * editar los sprites en un programa de dibujo y volver a importarlos:
 * tamaños, posiciones y hombros ya son los correctos.
 */
export function buildSpriteExport(scene: Phaser.Scene, prefix: string): SpriteExport {
  const { texture, canvas } = atlasCanvas(scene);
  const shoulders = scene.registry.get(SHOULDERS_KEY) as Map<string, { x: number; y: number }>;
  const names = texture
    .getFrameNames()
    .filter((name) => name.startsWith(`${prefix}/`))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const meta: PackMeta = { frames: {}, animations: {} };
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const placements: { name: string; x: number; y: number; frame: Phaser.Textures.Frame }[] = [];
  for (const name of names) {
    const frame = texture.get(name);
    if (x + frame.width > SHEET_WIDTH) {
      x = 0;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    placements.push({ name, x, y, frame });
    const shoulder = shoulders.get(name);
    meta.frames[name] = { x, y, w: frame.width, h: frame.height, ...(shoulder ? { shoulder } : {}) };
    x += frame.width + GAP;
    rowHeight = Math.max(rowHeight, frame.height);
  }

  const sheet = document.createElement('canvas');
  sheet.width = SHEET_WIDTH;
  sheet.height = Math.max(1, y + rowHeight);
  const context = sheet.getContext('2d');
  if (!context) throw new Error('No se pudo crear la hoja de exportación');
  for (const { x: dx, y: dy, frame } of placements) {
    context.drawImage(canvas, frame.cutX, frame.cutY, frame.width, frame.height, dx, dy, frame.width, frame.height);
  }

  for (const animation of scene.anims.toJSON().anims) {
    if (!animation.key.startsWith(`${prefix}/`)) continue;
    meta.animations![animation.key] = {
      frames: animation.frames.map((f) => String(f.frame)),
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    };
  }

  return { png: sheet.toDataURL('image/png'), json: JSON.stringify(meta, null, 2), frameCount: names.length };
}

function download(name: string, href: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Descarga la hoja y sus metadatos como `<nombre>.png` y `<nombre>.json`. */
export function downloadSpriteExport(scene: Phaser.Scene, prefix: string, baseName: string): number {
  const result = buildSpriteExport(scene, prefix);
  download(`${baseName}.png`, result.png);
  download(`${baseName}.json`, `data:application/json;charset=utf-8,${encodeURIComponent(result.json)}`);
  return result.frameCount;
}

/** Huella de los píxeles de un fotograma del atlas (para pruebas). */
export function frameSignature(scene: Phaser.Scene, name: string): string {
  const { texture, canvas } = atlasCanvas(scene);
  if (!texture.has(name)) return '';
  const frame = texture.get(name);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';
  const { data } = context.getImageData(frame.cutX, frame.cutY, frame.width, frame.height);
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i] as number;
    hash = Math.imul(hash, 16777619);
  }
  return `${frame.width}x${frame.height}:${(hash >>> 0).toString(16)}`;
}
