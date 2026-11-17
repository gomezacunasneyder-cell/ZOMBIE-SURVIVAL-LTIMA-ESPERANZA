/**
 * Arrojadizos de Alex (granadas y cócteles molotov): cuántos lleva de
 * cada uno y el tiempo entre lanzamientos. No sabe nada de física ni de
 * teclas: la capa de juego crea el objeto que vuela.
 */

export interface ThrowableRules {
  id: string;
  /** Unidades que caben en la mochila. */
  max: number;
}

export type ThrowResult = 'thrown' | 'none' | 'cooldown';

export class Throwables {
  private readonly counts = new Map<string, number>();
  private readyAt = 0;

  constructor(
    readonly kinds: readonly ThrowableRules[],
    /** Tiempo mínimo entre dos lanzamientos. */
    readonly cooldownMs: number,
    initial: Readonly<Record<string, number>> = {},
  ) {
    for (const kind of kinds) this.counts.set(kind.id, 0);
    for (const [id, count] of Object.entries(initial)) this.add(id, count);
  }

  private rules(id: string): ThrowableRules | undefined {
    return this.kinds.find((kind) => kind.id === id);
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  max(id: string): number {
    return this.rules(id)?.max ?? 0;
  }

  /** Añade unidades. Devuelve cuántas cupieron. */
  add(id: string, count: number): number {
    const rules = this.rules(id);
    if (!rules) return 0;
    const current = this.count(id);
    const added = Math.max(0, Math.min(Math.floor(count), rules.max - current));
    this.counts.set(id, current + added);
    return added;
  }

  /** Intenta lanzar uno. Si sale bien, lo gasta. */
  throw(id: string, now: number): ThrowResult {
    if (this.count(id) <= 0) return 'none';
    if (now < this.readyAt) return 'cooldown';
    this.counts.set(id, this.count(id) - 1);
    this.readyAt = now + this.cooldownMs;
    return 'thrown';
  }
}

/** Cómo sale despedido un objeto lanzado a mano. */
export interface ThrowArcRules {
  /** Ángulo de salida sobre la horizontal, en grados. */
  launchDeg: number;
  /** Distancia mínima y máxima a la que puede caer. */
  minRange: number;
  maxRange: number;
}

/**
 * Velocidad de salida para que el objeto caiga en el punto señalado. Con
 * un ángulo fijo θ y un suelo `drop` píxeles por debajo de la mano, la
 * parábola x = v·cosθ·t, y = −v·senθ·t + g·t²/2 pasa por (alcance, drop)
 * cuando v² = g·alcance² / (2·cos²θ·(alcance·tanθ + drop)). Así cae donde
 * apunta el ratón, dentro de su alcance. `dx` es la distancia horizontal
 * con signo hasta el objetivo.
 */
export function throwVelocity(
  dx: number,
  facing: 1 | -1,
  rules: ThrowArcRules,
  gravity: number,
  drop = 0,
): { vx: number; vy: number } {
  const range = Math.max(rules.minRange, Math.min(rules.maxRange, dx * facing));
  const theta = (rules.launchDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const speed = Math.sqrt((gravity * range * range) / (2 * cos * cos * (range * Math.tan(theta) + Math.max(0, drop))));
  return { vx: facing * speed * cos, vy: -speed * Math.sin(theta) };
}

/** Distancia horizontal a la que vuelve a la altura de salida (terreno llano). */
export function landingDistance(vx: number, vy: number, gravity: number): number {
  return Math.abs((2 * vx * -vy) / gravity);
}
