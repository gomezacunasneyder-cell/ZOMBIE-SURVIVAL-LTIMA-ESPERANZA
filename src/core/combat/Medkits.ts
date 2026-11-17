/** Reglas de los botiquines. */
export interface MedkitRules {
  /** Botiquines que caben en la mochila. */
  max: number;
  /** Vida que devuelve cada uno. */
  heal: number;
  /** Lo que tarda en aplicarse; recibir un golpe lo interrumpe. */
  useMs: number;
}

export type MedkitStart = 'started' | 'none' | 'full-health' | 'already';

/**
 * Botiquines de Alex: cuántos lleva y el uso en curso. Usar uno lleva
 * tiempo y se interrumpe al recibir daño (sin gastarlo). No sabe nada
 * de vida ni de teclas: la capa de juego aplica la curación.
 */
export class Medkits {
  private amount: number;
  private startedAt: number | null = null;

  constructor(
    readonly rules: MedkitRules,
    initial: number,
  ) {
    this.amount = Math.max(0, Math.min(rules.max, Math.floor(initial)));
  }

  get count(): number {
    return this.amount;
  }

  get using(): boolean {
    return this.startedAt !== null;
  }

  /** Empieza a usar uno. `missingHealth` es la vida que le falta a Alex. */
  start(now: number, missingHealth: number): MedkitStart {
    if (this.using) return 'already';
    if (this.amount <= 0) return 'none';
    if (missingHealth <= 0) return 'full-health';
    this.startedAt = now;
    return 'started';
  }

  /** Interrumpe el uso sin gastar el botiquín. */
  cancel(): boolean {
    const was = this.using;
    this.startedAt = null;
    return was;
  }

  /** Progreso 0–1 del uso en curso, o `null`. */
  progress(now: number): number | null {
    if (this.startedAt === null) return null;
    return Math.min(1, Math.max(0, (now - this.startedAt) / this.rules.useMs));
  }

  /** Avanza el tiempo. Devuelve la vida a curar en el instante en que termina, o 0. */
  update(now: number): number {
    if (this.startedAt === null || now - this.startedAt < this.rules.useMs) return 0;
    this.startedAt = null;
    this.amount -= 1;
    return this.rules.heal;
  }

  /** Añade botiquines. Devuelve cuántos cupieron. */
  add(count: number): number {
    const added = Math.max(0, Math.min(Math.floor(count), this.rules.max - this.amount));
    this.amount += added;
    return added;
  }
}
