/** Ajustes de las explosiones de bidones de combustible. */
export interface ExplosionTuning {
  /** Disparos que aguanta un bidón antes de estallar. */
  hitsToExplode: number;
  /** Radio de daño, en px. */
  radius: number;
  /** Daño en el centro; decae hasta cero en el borde del radio. */
  enemyDamage: number;
  playerDamage: number;
  /** Radio en el que el estruendo alerta a los enemigos. */
  noiseRadius: number;
  /** Tiempo que el charco de combustible sigue ardiendo. */
  fireMs: number;
  /** Retardo antes de que estalle un bidón alcanzado por otra explosión. */
  chainDelayMs: number;
  knockback: number;
}

export const EXPLOSION: ExplosionTuning = {
  hitsToExplode: 2,
  radius: 56,
  enemyDamage: 180,
  playerDamage: 45,
  noiseRadius: 520,
  fireMs: 7000,
  chainDelayMs: 160,
  knockback: 150,
};

/** Daño que recibe algo situado a `distance` del centro de la explosión. */
export function explosionDamage(distance: number, maxDamage: number, tuning: ExplosionTuning = EXPLOSION): number {
  if (distance >= tuning.radius) return 0;
  const k = 1 - distance / tuning.radius;
  return Math.round(maxDamage * (0.35 + 0.65 * k));
}
