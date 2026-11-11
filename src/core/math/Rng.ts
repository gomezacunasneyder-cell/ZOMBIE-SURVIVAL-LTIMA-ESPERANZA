/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Misma semilla, misma secuencia: hace reproducibles el arte generado,
 * las oleadas y las pruebas.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Verdadero con la probabilidad indicada (0–1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Elemento al azar de una lista no vacía. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vacía');
    return items[Math.floor(this.next() * items.length)] as T;
  }
}
