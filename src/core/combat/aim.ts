/**
 * Puntería en 7 direcciones fijas. Los ángulos van en grados:
 * 0 = horizontal hacia delante, positivo = hacia arriba.
 * El arte dibuja un brazo por cada ángulo; no se rota ningún sprite.
 */
export const AIM_ANGLES = [90, 60, 30, 0, -30, -60, -90] as const;
export type AimAngle = (typeof AIM_ANGLES)[number];

/** Ángulo permitido más cercano a un ángulo libre. */
export function snapAimAngle(degrees: number): AimAngle {
  let best: AimAngle = AIM_ANGLES[0];
  for (const angle of AIM_ANGLES) {
    if (Math.abs(angle - degrees) < Math.abs(best - degrees)) best = angle;
  }
  return best;
}

/**
 * Ángulo de puntería desde el hombro hacia un punto, teniendo en cuenta
 * hacia dónde mira el personaje (1 = derecha, -1 = izquierda).
 * La coordenada Y crece hacia abajo, como en pantalla.
 */
export function aimAngleTowards(
  shoulderX: number,
  shoulderY: number,
  targetX: number,
  targetY: number,
  facing: 1 | -1,
): AimAngle {
  const forward = Math.max(1, (targetX - shoulderX) * facing);
  const up = shoulderY - targetY;
  return snapAimAngle((Math.atan2(up, forward) * 180) / Math.PI);
}

/**
 * Ángulo libre (sin ajustar a los 7 dibujos) desde el hombro hacia un
 * punto, entre -90 y 90. Las balas salen hacia aquí: el brazo se dibuja
 * con el ángulo ajustado más cercano, pero el disparo va al cursor.
 */
export function aimDegreesTowards(
  shoulderX: number,
  shoulderY: number,
  targetX: number,
  targetY: number,
  facing: 1 | -1,
): number {
  const forward = Math.max(0, (targetX - shoulderX) * facing);
  const up = shoulderY - targetY;
  if (forward === 0 && up === 0) return 0;
  return (Math.atan2(up, forward) * 180) / Math.PI;
}
