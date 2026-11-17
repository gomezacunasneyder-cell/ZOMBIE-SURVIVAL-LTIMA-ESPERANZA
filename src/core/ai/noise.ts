/**
 * Ruido del mundo. Cada suceso sonoro (disparo, explosión, pasos, gruñido)
 * se anota con su posición y su radio; los enemigos preguntan qué oyen
 * desde donde están. Es la base del sigilo: el Chasqueador no ve, solo oye.
 */

/** `machine`: rotor del helicóptero, cajas que caen y bengalas. */
export type NoiseKind = 'shot' | 'explosion' | 'run' | 'step' | 'impact' | 'creature' | 'machine';

export interface Noise {
  x: number;
  /** Distancia a la que lo oye un oído normal (sensibilidad 1). */
  radius: number;
  kind: NoiseKind;
  at: number;
  /** Lo hace Alex (si no, otra criatura o el escenario). */
  fromPlayer: boolean;
}

export interface Hearing {
  /** Multiplica el radio de cada ruido. 0 = sordo. */
  sensitivity: number;
  /** Oye también a otras criaturas. */
  hearsCreatures: boolean;
}

export interface HeardNoise extends Noise {
  /** 0–1: 1 junto al origen, 0 en el límite de lo audible. */
  strength: number;
}

/** Cuánto «sigue sonando» un ruido para quien lo consulta. */
export const NOISE_LIFETIME_MS = 350;

/** Radios de los ruidos de Alex y del mundo, en px. */
export const NOISE_RADIUS = {
  /** Caminar con normalidad. */
  step: 55,
  /** Correr. */
  run: 150,
  /** Caminar en silencio o quedarse quieto. */
  sneak: 0,
  /** Bala que impacta en el escenario. */
  impact: 70,
  /** Gruñidos y gemidos de otras criaturas. */
  creature: 110,
} as const;

export class NoiseField {
  private noises: Noise[] = [];
  private total = 0;

  /** Número de ruidos emitidos desde el inicio (pruebas). */
  get emitted(): number {
    return this.total;
  }

  emit(noise: Noise): void {
    if (noise.radius <= 0) return;
    this.noises.push(noise);
    this.total += 1;
  }

  /** Olvida los ruidos que ya no suenan. */
  prune(now: number): void {
    this.noises = this.noises.filter((n) => now - n.at <= NOISE_LIFETIME_MS);
  }

  /** El ruido más intenso que oye un oyente en `x`, o `null`. Ignora los que emitió el propio oyente. */
  loudestFor(x: number, hearing: Hearing, now: number, ignoreAt?: number): HeardNoise | null {
    if (hearing.sensitivity <= 0) return null;
    let best: HeardNoise | null = null;
    for (const noise of this.noises) {
      if (now - noise.at > NOISE_LIFETIME_MS || now < noise.at) continue;
      if (noise.kind === 'creature' && !hearing.hearsCreatures) continue;
      if (ignoreAt !== undefined && noise.kind === 'creature' && Math.abs(noise.x - ignoreAt) < 2) continue;
      const strength = audibleStrength(noise, x, hearing.sensitivity);
      if (strength > 0 && (!best || strength > best.strength)) best = { ...noise, strength };
    }
    return best;
  }

  snapshot(): readonly Noise[] {
    return this.noises;
  }
}

/** Intensidad 0–1 con la que se oye un ruido a cierta distancia. */
export function audibleStrength(noise: Pick<Noise, 'x' | 'radius'>, listenerX: number, sensitivity: number): number {
  const reach = noise.radius * sensitivity;
  if (reach <= 0) return 0;
  const distance = Math.abs(noise.x - listenerX);
  return distance >= reach ? 0 : 1 - distance / reach;
}

/** Ruido que hace Alex al moverse, según cómo se mueve. */
export function movementNoise(speed: number, running: boolean, sneaking: boolean, onGround: boolean): number {
  if (!onGround || speed < 6) return 0;
  if (sneaking) return NOISE_RADIUS.sneak;
  return running ? NOISE_RADIUS.run : NOISE_RADIUS.step;
}
