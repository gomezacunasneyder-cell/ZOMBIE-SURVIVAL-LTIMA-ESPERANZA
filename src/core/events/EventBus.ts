/**
 * Bus de eventos tipado. Desacopla el mundo del juego del HUD: la escena
 * de juego emite y la interfaz escucha, sin conocerse entre sí.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Suscribe un manejador; devuelve la función para darlo de baja. */
  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const stored = handler as (payload: never) => void;
    set.add(stored);
    return () => {
      set.delete(stored);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as (payload: Events[K]) => void)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** Eventos que el mundo del juego comunica a la interfaz. */
export interface GameEvents extends Record<string, unknown> {
  health: { current: number; max: number };
  ammo: { magazine: number; magazineSize: number; reserve: number };
  /** Progreso de recarga 0–1, o `null` si no se está recargando. */
  reload: { progress: number | null };
  weapon: { name: string; icon: string; slot: number };
  kills: { total: number };
  /** Aviso breve en pantalla (cargador vacío, ranura vacía, munición recogida). */
  notice: { text: string };
  zone: { name: string };
  /** Cambio de momento del día (atardecer, anochecer, noche). */
  daytime: { phase: string; night: number };
  playerDied: { kills: number };
}
