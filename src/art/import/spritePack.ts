import type { AnimationDef, ArtCatalog } from '../catalog';
import { PixelBuffer } from '../PixelBuffer';
import { PALETTE_RGBA, PALETTE_SIZE, TRANSPARENT } from '../palette';

/**
 * Importación de sprites externos (PNG transparentes sueltos o atlas con
 * metadatos). Permite sustituir cualquier fotograma generado por código
 * por uno dibujado a mano sin tocar el juego.
 *
 * Reglas que garantizan que el cambio sea solo visual:
 *  - Un fotograma que sustituye a otro debe medir exactamente lo mismo,
 *    así conserva punto de apoyo, hombro, posición del arma y colisión.
 *  - Los colores se ajustan a la paleta del juego, para mantener la
 *    identidad visual, y la transparencia es total o nula (sin bordes
 *    suavizados).
 *
 * Este módulo es puro: recibe los píxeles ya decodificados.
 */

export interface PackPoint {
  x: number;
  y: number;
}

export interface PackFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hombro del personaje dentro del fotograma, donde se ancla el brazo. */
  shoulder?: PackPoint;
}

export interface PackAnimation {
  frames: string[];
  frameRate: number;
  /** -1 = bucle (por defecto). */
  repeat?: number;
}

/** Metadatos de un atlas: dónde está cada fotograma dentro de la imagen. */
export interface PackMeta {
  frames: Record<string, PackFrame>;
  animations?: Record<string, PackAnimation>;
}

/** Entrada del manifiesto: un atlas (`data`) o un PNG suelto (`frame`). */
export interface ManifestPack {
  image: string;
  /** Archivo JSON con los metadatos del atlas. */
  data?: string;
  /** Para un PNG suelto: nombre del fotograma al que sustituye. */
  frame?: string;
  shoulder?: PackPoint;
}

export interface SpriteManifest {
  version: 1;
  packs: ManifestPack[];
}

export interface DecodedImage {
  width: number;
  height: number;
  /** Bytes RGBA, fila a fila. */
  rgba: Uint8ClampedArray | Uint8Array;
}

export interface ImportReport {
  source: string;
  applied: string[];
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is PackPoint {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

/** Valida el manifiesto. Las entradas incorrectas se descartan con un error legible. */
export function parseManifest(json: unknown): { manifest: SpriteManifest; errors: string[] } {
  const errors: string[] = [];
  const manifest: SpriteManifest = { version: 1, packs: [] };
  if (!isRecord(json) || !Array.isArray(json.packs)) {
    errors.push('El manifiesto debe ser un objeto con una lista «packs».');
    return { manifest, errors };
  }
  json.packs.forEach((entry: unknown, i: number) => {
    if (!isRecord(entry) || typeof entry.image !== 'string' || entry.image.length === 0) {
      errors.push(`packs[${i}]: falta «image».`);
      return;
    }
    const hasData = typeof entry.data === 'string';
    const hasFrame = typeof entry.frame === 'string';
    if (hasData === hasFrame) {
      errors.push(`packs[${i}]: indica «data» (atlas) o «frame» (PNG suelto), solo uno.`);
      return;
    }
    if (entry.shoulder !== undefined && !isPoint(entry.shoulder)) {
      errors.push(`packs[${i}]: «shoulder» debe ser { x, y } con enteros.`);
      return;
    }
    manifest.packs.push({
      image: entry.image,
      ...(hasData ? { data: entry.data as string } : { frame: entry.frame as string }),
      ...(isPoint(entry.shoulder) ? { shoulder: entry.shoulder } : {}),
    });
  });
  return { manifest, errors };
}

/** Valida los metadatos de un atlas. */
export function parsePackMeta(json: unknown): { meta: PackMeta; errors: string[] } {
  const errors: string[] = [];
  const meta: PackMeta = { frames: {} };
  if (!isRecord(json) || !isRecord(json.frames)) {
    errors.push('Los metadatos deben tener un objeto «frames».');
    return { meta, errors };
  }
  for (const [name, value] of Object.entries(json.frames)) {
    if (!isRecord(value) || !['x', 'y', 'w', 'h'].every((k) => Number.isInteger(value[k]))) {
      errors.push(`«${name}»: se esperan x, y, w y h enteros.`);
      continue;
    }
    if (value.shoulder !== undefined && !isPoint(value.shoulder)) {
      errors.push(`«${name}»: «shoulder» debe ser { x, y } con enteros.`);
      continue;
    }
    meta.frames[name] = {
      x: value.x as number,
      y: value.y as number,
      w: value.w as number,
      h: value.h as number,
      ...(isPoint(value.shoulder) ? { shoulder: value.shoulder } : {}),
    };
  }
  if (isRecord(json.animations)) {
    meta.animations = {};
    for (const [key, value] of Object.entries(json.animations)) {
      const frames = isRecord(value) ? value.frames : undefined;
      const rate = isRecord(value) ? value.frameRate : undefined;
      if (!Array.isArray(frames) || !frames.every((f) => typeof f === 'string') || typeof rate !== 'number' || rate <= 0) {
        errors.push(`Animación «${key}»: se esperan «frames» (nombres) y «frameRate» positivo.`);
        continue;
      }
      const repeat = isRecord(value) && typeof value.repeat === 'number' ? value.repeat : -1;
      meta.animations[key] = { frames: frames as string[], frameRate: rate, repeat };
    }
  }
  return { meta, errors };
}

/** Índice de la paleta más cercano a un color RGB. */
const nearestCache = new Map<number, number>();
export function nearestPaletteIndex(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  const cached = nearestCache.get(key);
  if (cached !== undefined) return cached;
  let best = 1;
  let bestDistance = Infinity;
  for (let i = 1; i < PALETTE_SIZE; i++) {
    const dr = r - (PALETTE_RGBA[i * 4] as number);
    const dg = g - (PALETTE_RGBA[i * 4 + 1] as number);
    const db = b - (PALETTE_RGBA[i * 4 + 2] as number);
    // Distancia ponderada: el ojo distingue mejor el verde que el azul.
    const distance = dr * dr * 3 + dg * dg * 4 + db * db * 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  nearestCache.set(key, best);
  return best;
}

/**
 * Convierte una región RGBA en un lienzo indexado. Devuelve también
 * cuántos píxeles no eran ya colores exactos de la paleta o tenían una
 * transparencia parcial.
 */
export function indexRegion(
  image: DecodedImage,
  x: number,
  y: number,
  w: number,
  h: number,
): { buffer: PixelBuffer; adjusted: number } {
  const buffer = new PixelBuffer(w, h);
  let adjusted = 0;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const o = ((y + row) * image.width + x + col) * 4;
      const alpha = image.rgba[o + 3] as number;
      if (alpha < 128) {
        if (alpha > 0) adjusted++;
        continue;
      }
      const r = image.rgba[o] as number;
      const g = image.rgba[o + 1] as number;
      const b = image.rgba[o + 2] as number;
      const index = nearestPaletteIndex(r, g, b);
      const exact =
        PALETTE_RGBA[index * 4] === r && PALETTE_RGBA[index * 4 + 1] === g && PALETTE_RGBA[index * 4 + 2] === b;
      if (!exact || alpha < 255) adjusted++;
      buffer.data[row * w + col] = index;
    }
  }
  return { buffer, adjusted };
}

/**
 * Aplica un atlas al catálogo de arte. Nunca deja el catálogo a medias:
 * cada fotograma se valida y solo se sustituyen los correctos.
 */
export function applyPack(catalog: ArtCatalog, meta: PackMeta, image: DecodedImage, source: string): ImportReport {
  const report: ImportReport = { source, applied: [], errors: [], warnings: [] };
  let adjustedTotal = 0;

  for (const [name, frame] of Object.entries(meta.frames)) {
    if (frame.w <= 0 || frame.h <= 0 || frame.x < 0 || frame.y < 0 || frame.x + frame.w > image.width || frame.y + frame.h > image.height) {
      report.errors.push(`«${name}»: el rectángulo se sale de la imagen (${image.width}×${image.height}).`);
      continue;
    }
    const existing = catalog.sprites.get(name);
    if (existing && (existing.width !== frame.w || existing.height !== frame.h)) {
      report.errors.push(
        `«${name}»: mide ${frame.w}×${frame.h} y el fotograma al que sustituye mide ${existing.width}×${existing.height}. ` +
          'Deben coincidir para conservar anclajes y colisiones.',
      );
      continue;
    }
    if (frame.shoulder && (frame.shoulder.x < 0 || frame.shoulder.y < 0 || frame.shoulder.x >= frame.w || frame.shoulder.y >= frame.h)) {
      report.errors.push(`«${name}»: el hombro queda fuera del fotograma.`);
      continue;
    }
    const { buffer, adjusted } = indexRegion(image, frame.x, frame.y, frame.w, frame.h);
    if (buffer.data.every((value) => value === TRANSPARENT)) {
      report.errors.push(`«${name}»: el fotograma está vacío.`);
      continue;
    }
    if (!existing) report.warnings.push(`«${name}» es un fotograma nuevo; nada lo usa todavía.`);
    adjustedTotal += adjusted;
    catalog.sprites.set(name, buffer);
    if (frame.shoulder) catalog.shoulders.set(name, { ...frame.shoulder });
    report.applied.push(name);
  }

  if (adjustedTotal > 0) {
    report.warnings.push(`${adjustedTotal} píxeles se ajustaron a la paleta del juego o a transparencia total.`);
  }

  for (const [key, animation] of Object.entries(meta.animations ?? {})) {
    const missing = animation.frames.filter((frame) => !catalog.sprites.has(frame));
    if (missing.length > 0) {
      report.errors.push(`Animación «${key}»: faltan los fotogramas ${missing.join(', ')}.`);
      continue;
    }
    const def: AnimationDef = {
      key,
      frames: [...animation.frames],
      frameRate: animation.frameRate,
      repeat: animation.repeat ?? -1,
    };
    const at = catalog.animations.findIndex((a) => a.key === key);
    if (at >= 0) catalog.animations[at] = def;
    else catalog.animations.push(def);
  }
  return report;
}

/** Aplica un PNG suelto como un atlas de un solo fotograma. */
export function applySingle(
  catalog: ArtCatalog,
  frameName: string,
  image: DecodedImage,
  source: string,
  shoulder?: PackPoint,
): ImportReport {
  const frame: PackFrame = { x: 0, y: 0, w: image.width, h: image.height, ...(shoulder ? { shoulder } : {}) };
  return applyPack(catalog, { frames: { [frameName]: frame } }, image, source);
}
