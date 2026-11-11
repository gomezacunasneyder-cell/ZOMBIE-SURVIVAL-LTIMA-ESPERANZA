import {
  parseAudio,
  serializeAudio,
  stepVolume,
  type AudioBus,
  type AudioSettings,
} from '../../core/settings/audioSettings';
import { createBrowserStore } from '../../platform/storage';

const STORAGE_KEY = 'audio';
const store = createBrowserStore();
let settings: AudioSettings = parseAudio(store.get(STORAGE_KEY));
const listeners = new Set<(settings: AudioSettings) => void>();

/**
 * Volúmenes de música y efectos, compartidos por todo el juego y
 * guardados entre sesiones. Es el único estado global de audio.
 */
export const audioState = {
  get settings(): AudioSettings {
    return settings;
  },

  /** Sube o baja un paso el volumen de un canal y lo guarda. */
  step(bus: AudioBus, direction: 1 | -1): AudioSettings {
    settings = stepVolume(settings, bus, direction);
    store.set(STORAGE_KEY, serializeAudio(settings));
    for (const listener of listeners) listener(settings);
    return settings;
  },

  /** Avisa de cada cambio; devuelve la función para darse de baja. */
  onChange(listener: (settings: AudioSettings) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
