/** Almacén clave-valor mínimo. El juego nunca usa `localStorage` directamente. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** Almacén en memoria: para pruebas y como reserva si el navegador bloquea el guardado. */
export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
  };
}

/**
 * Almacén del navegador. Si `localStorage` no está disponible (modo
 * privado, permisos), cae a memoria sin lanzar errores: los ajustes
 * funcionan durante la sesión y simplemente no se conservan.
 */
export function createBrowserStore(prefix = 'zs.'): KeyValueStore {
  const memory = createMemoryStore();
  let storage: Storage | null = null;
  try {
    storage = globalThis.localStorage ?? null;
    storage?.getItem(prefix);
  } catch {
    storage = null;
  }
  return {
    get(key) {
      try {
        return storage ? storage.getItem(prefix + key) : memory.get(key);
      } catch {
        return memory.get(key);
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(prefix + key, value);
      } catch {
        // Cuota llena o acceso denegado: se conserva solo en memoria.
      }
    },
  };
}
