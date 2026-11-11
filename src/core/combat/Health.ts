/**
 * Vida de un personaje, con una ventana de invulnerabilidad tras cada
 * golpe para que un mismo ataque no dañe varias veces.
 */
export class Health {
  private value: number;
  private invulnerableUntil = -Infinity;

  constructor(
    readonly max: number,
    private readonly invulnerableMs = 0,
  ) {
    if (max <= 0) throw new Error('Health: la vida máxima debe ser positiva');
    this.value = max;
  }

  get current(): number {
    return this.value;
  }

  get ratio(): number {
    return this.value / this.max;
  }

  get dead(): boolean {
    return this.value <= 0;
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  /** Aplica daño. Devuelve `false` si no hizo efecto (muerto o invulnerable). */
  damage(amount: number, now: number): boolean {
    if (amount <= 0 || this.dead || this.isInvulnerable(now)) return false;
    this.value = Math.max(0, this.value - amount);
    this.invulnerableUntil = now + this.invulnerableMs;
    return true;
  }

  /** Cura sin superar el máximo. Devuelve los puntos realmente recuperados. */
  heal(amount: number): number {
    if (amount <= 0 || this.dead) return 0;
    const before = this.value;
    this.value = Math.min(this.max, this.value + amount);
    return this.value - before;
  }
}
