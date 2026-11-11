export interface Vector {
  x: number;
  y: number;
}

/**
 * Dirección unitaria de un disparo. `aim` en grados (positivo = arriba),
 * `facing` 1 o -1, `spreadDeg` desviación en grados. Y crece hacia abajo.
 */
export function shotDirection(aim: number, facing: 1 | -1, spreadDeg = 0): Vector {
  const radians = ((aim + spreadDeg) * Math.PI) / 180;
  return { x: Math.cos(radians) * facing, y: -Math.sin(radians) };
}

/** Desviación uniforme en ±maxDeg a partir de un valor aleatorio 0–1. */
export function spreadFrom(random01: number, maxDeg: number): number {
  return (random01 * 2 - 1) * maxDeg;
}

/**
 * Desviaciones de cada proyectil de un disparo. Con un solo proyectil es
 * una desviación aleatoria en ±spread. Con varios (perdigones) se reparten
 * en abanico por todo el ancho y cada uno se mueve un poco al azar, para
 * que el patrón sea siempre ancho pero nunca idéntico.
 */
export function pelletSpreads(count: number, spreadDeg: number, random: () => number): number[] {
  if (count <= 1) return [spreadFrom(random(), spreadDeg)];
  const step = (spreadDeg * 2) / (count - 1);
  return Array.from({ length: count }, (_, i) => -spreadDeg + i * step + spreadFrom(random(), step * 0.35));
}

/** Tiempo que tarda un proyectil en recorrer su alcance. */
export function travelTimeMs(rangePx: number, speed: number): number {
  return (rangePx / speed) * 1000;
}

export interface FalloffRules {
  damage: number;
  falloffStartPx: number;
  rangePx: number;
  minDamageFactor: number;
}

/**
 * Daño de un proyectil según la distancia recorrida: completo hasta
 * `falloffStartPx` y cae en línea recta hasta `minDamageFactor` al final
 * del alcance. La escopeta destroza de cerca y apenas hace nada de lejos.
 */
export function damageAtDistance(rules: FalloffRules, distance: number): number {
  if (distance <= rules.falloffStartPx || rules.rangePx <= rules.falloffStartPx) return rules.damage;
  const t = Math.min(1, (distance - rules.falloffStartPx) / (rules.rangePx - rules.falloffStartPx));
  return rules.damage * (1 - (1 - rules.minDamageFactor) * t);
}
