/**
 * Viento con rachas. Una sola función alimenta todo lo que el viento
 * mueve o hace sonar (papeles, humo, niebla, silbido), para que las
 * rachas se vean y se oigan a la vez.
 */

/** Fuerza del viento en el instante dado, de 0 (calma) a 1 (racha fuerte). */
export function gustAt(timeMs: number): number {
  const t = timeMs / 1000;
  const slow = Math.sin(t * 0.31) * 0.5 + 0.5;
  const fast = Math.sin(t * 1.27 + 1.3) * 0.5 + 0.5;
  const value = slow * 0.7 + fast * slow * 0.3;
  return Math.min(1, Math.max(0, value));
}

/** Velocidad horizontal del viento en px/s (negativa: sopla hacia la izquierda). */
export function windSpeed(timeMs: number): number {
  return -(10 + gustAt(timeMs) * 46);
}
