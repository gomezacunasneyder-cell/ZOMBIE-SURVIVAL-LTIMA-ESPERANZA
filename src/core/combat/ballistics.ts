import type { AimAngle } from './aim';

export interface Vector {
  x: number;
  y: number;
}

/**
 * Dirección unitaria de un disparo. `aim` en grados (positivo = arriba),
 * `facing` 1 o -1, `spreadDeg` desviación en grados. Y crece hacia abajo.
 */
export function shotDirection(aim: AimAngle, facing: 1 | -1, spreadDeg = 0): Vector {
  const radians = ((aim + spreadDeg) * Math.PI) / 180;
  return { x: Math.cos(radians) * facing, y: -Math.sin(radians) };
}

/** Desviación uniforme en ±maxDeg a partir de un valor aleatorio 0–1. */
export function spreadFrom(random01: number, maxDeg: number): number {
  return (random01 * 2 - 1) * maxDeg;
}
