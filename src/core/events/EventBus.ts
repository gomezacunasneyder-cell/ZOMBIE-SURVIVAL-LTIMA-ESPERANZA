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
  weapon: { id: string; name: string; icon: string; slot: number };
  /** Estado de todas las ranuras, para los indicadores 1–4 del HUD. */
  arsenal: { active: number; slots: ({ name: string; magazine: number; reserve: number } | null)[] };
  kills: { total: number };
  /** Ruido que hace Alex (0–1) y si camina en silencio. */
  noise: { level: number; sneaking: boolean };
  /** Aviso breve en pantalla (cargador vacío, ranura vacía, munición recogida). */
  notice: { text: string };
  zone: { name: string };
  /** Cambio de momento del día (atardecer, anochecer, noche). */
  daytime: { phase: string; night: number };
  playerDied: { kills: number };
  /** Botiquines que lleva y progreso del uso en curso (0–1), o `null`. */
  medkit: { count: number; max: number; progress: number | null };
  /**
   * Lanzamiento de Cóndor 7: `warning` (alarma de radio), `inbound`
   * (se acerca), `dropping` (suelta la carga), `leaving` y `done`.
   * `radio` es el mensaje de la capitana Vega, si lo hay.
   */
  airdrop: { phase: 'warning' | 'inbound' | 'dropping' | 'leaving' | 'done'; radio: string | null };
  /**
   * Estado del modo supervivencia: oleada (1…N), fase, enemigos que quedan
   * de la oleada, progreso 0–1, tiempo que queda de la fase (descanso,
   * aviso) e integridad 0–1 de cada barricada.
   */
  wave: {
    wave: number;
    waves: number;
    phase: string;
    remaining: number;
    total: number;
    progress: number;
    timeLeft: number;
    barricades: number[];
  };
  /** Aviso grande en pantalla (nueva oleada, alarma, oleada superada, el jefe). */
  announce: { title: string; subtitle: string; tone: 'info' | 'danger' | 'success' | 'boss' };
  /** Intensidad 0–1 del aviso de peligro (marco rojo que late). */
  danger: { level: number };
  /** Fin del modo supervivencia, con el resumen de la partida. */
  survivalEnd: { waves: number; kills: number; timeMs: number };
}
