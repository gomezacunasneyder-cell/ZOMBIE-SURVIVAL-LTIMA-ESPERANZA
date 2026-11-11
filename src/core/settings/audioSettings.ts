/** Volúmenes independientes de música y efectos, de 0 a 1. */
export interface AudioSettings {
  music: number;
  sfx: number;
}

export type AudioBus = keyof AudioSettings;

export const DEFAULT_AUDIO: AudioSettings = { music: 0.6, sfx: 0.8 };
export const VOLUME_STEP = 0.1;

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  // Se redondea a décimas para que los pasos sean exactos.
  return Math.round(Math.min(1, Math.max(0, value)) * 10) / 10;
}

/** Sube o baja un volumen un paso, sin salir de 0–1. */
export function stepVolume(settings: AudioSettings, bus: AudioBus, direction: 1 | -1): AudioSettings {
  return { ...settings, [bus]: clampVolume(settings[bus] + direction * VOLUME_STEP, settings[bus]) };
}

export function serializeAudio(settings: AudioSettings): string {
  return JSON.stringify({ music: settings.music, sfx: settings.sfx });
}

/** Lee ajustes guardados; cualquier dato ausente o corrupto vuelve al valor por defecto. */
export function parseAudio(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const data = JSON.parse(raw) as Partial<Record<AudioBus, unknown>> | null;
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_AUDIO };
    return {
      music: clampVolume(data.music, DEFAULT_AUDIO.music),
      sfx: clampVolume(data.sfx, DEFAULT_AUDIO.sfx),
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

/**
 * Volumen de un sonido situado en el mundo: pleno cerca del oyente y nulo
 * a partir de `reach`. Devuelve también el paneo estéreo (-1 a 1).
 */
export function positional(sourceX: number, listenerX: number, reach: number): { gain: number; pan: number } {
  const offset = sourceX - listenerX;
  const k = 1 - Math.min(1, Math.abs(offset) / reach);
  return { gain: k * k, pan: Math.max(-1, Math.min(1, offset / (reach * 0.6))) };
}
