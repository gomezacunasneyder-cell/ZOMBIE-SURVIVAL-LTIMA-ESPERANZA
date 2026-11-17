import type { Rng } from '../math/Rng';

/** Erupción de espinas de la fase 3 de EL DEVORADOR. */
export interface EruptionRules {
  /** Cada cuánto, en la fase 3. */
  everyMs: number;
  durationMs: number;
  /** Oleadas de espinas y separación entre ellas. */
  waves: number;
  waveGapMs: number;
  /** Espinas por oleada y ancho del hueco seguro que deja cada una. */
  spikesPerWave: number;
  safeGap: number;
}

export interface PlannedSpike {
  x: number;
  delayMs: number;
}

/**
 * Espinas en toda la arena: varias oleadas que recorren el suelo desde el
 * jefe hacia fuera. Cada oleada deja un hueco seguro en un sitio distinto
 * y las espinas de dos oleadas seguidas se intercalan: hay que moverse
 * para esquivarlas. Función pura y reproducible con la misma semilla.
 */
export function planEruption(rules: EruptionRules, arena: readonly [number, number], bossX: number, rng: Rng): PlannedSpike[] {
  const { waves, waveGapMs, spikesPerWave, safeGap } = rules;
  const [left, right] = arena;
  const width = right - left;
  const spikes: PlannedSpike[] = [];
  for (let w = 0; w < waves; w++) {
    const safeCentre = left + safeGap + rng.next() * (width - safeGap * 2);
    for (let i = 0; i < spikesPerWave; i++) {
      const x = Math.round(left + ((i + (w % 2) * 0.5) / spikesPerWave) * width);
      if (Math.abs(x - safeCentre) < safeGap / 2) continue;
      const fromBoss = Math.abs(x - bossX) / width;
      spikes.push({ x, delayMs: Math.round(w * waveGapMs + fromBoss * 450) });
    }
  }
  return spikes;
}
