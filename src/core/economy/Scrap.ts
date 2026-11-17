import type { Rng } from '../math/Rng';

/**
 * Piezas: la moneda de las mejoras del banco de trabajo (GDD §6). Las
 * sueltan los enemigos al morir y las traen los contenedores. Aquí solo
 * se cuentan; gastarlas llegará con el banco de trabajo.
 */
export class ScrapWallet {
  private amount: number;

  constructor(initial = 0) {
    this.amount = Math.max(0, Math.floor(initial));
  }

  get total(): number {
    return this.amount;
  }

  add(amount: number): number {
    const added = Math.max(0, Math.floor(amount));
    this.amount += added;
    return added;
  }

  /** Gasta piezas si hay bastantes. Devuelve si se pudo. */
  spend(amount: number): boolean {
    if (amount < 0 || amount > this.amount) return false;
    this.amount -= amount;
    return true;
  }
}

/** Probabilidad de soltar piezas al morir y cuántas, de mínimo a máximo. */
export interface ScrapDropRule {
  chance: number;
  amount: readonly [number, number];
}

/** Piezas que suelta un enemigo al morir (0 si no suelta nada). */
export function rollScrap(rng: Rng, rule: ScrapDropRule | undefined): number {
  if (!rule || !rng.chance(rule.chance)) return 0;
  return rng.int(rule.amount[0], rule.amount[1]);
}

/**
 * Reparte una cantidad en montoncitos que se ven en el suelo: como mucho
 * `maxPiles`, y ninguno vacío.
 */
export function splitScrap(amount: number, maxPiles: number): number[] {
  if (amount <= 0) return [];
  const piles = Math.max(1, Math.min(maxPiles, amount));
  const base = Math.floor(amount / piles);
  return Array.from({ length: piles }, (_, i) => base + (i < amount % piles ? 1 : 0));
}
