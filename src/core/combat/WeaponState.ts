/** Lo que el estado del arma necesita saber de su definición. */
export interface WeaponRules {
  magazineSize: number;
  reserveStart: number;
  reserveMax: number;
  fireIntervalMs: number;
  reloadMs: number;
}

export type FireResult = 'fired' | 'empty' | 'cooldown' | 'reloading';
export type ReloadResult = 'started' | 'full' | 'no-reserve' | 'already';

/**
 * Estado de un arma: cargador, reserva, cadencia y recarga con duración.
 * No sabe nada de sprites ni de balas; solo decide si se puede disparar.
 */
export class WeaponState<Def extends WeaponRules = WeaponRules> {
  private magazineRounds: number;
  private reserveRounds: number;
  private nextShotAt = -Infinity;
  private reloadStartedAt: number | null = null;
  private firedRounds = 0;

  constructor(readonly def: Def) {
    this.magazineRounds = def.magazineSize;
    this.reserveRounds = def.reserveStart;
  }

  get magazine(): number {
    return this.magazineRounds;
  }

  get reserve(): number {
    return this.reserveRounds;
  }

  /** Balas disparadas desde que existe el arma (para comprobar que no se crean ni se pierden). */
  get fired(): number {
    return this.firedRounds;
  }

  get reloading(): boolean {
    return this.reloadStartedAt !== null;
  }

  /** Intenta disparar. Solo `fired` descuenta una bala. */
  tryFire(now: number): FireResult {
    if (this.reloading) return 'reloading';
    if (now < this.nextShotAt) return 'cooldown';
    if (this.magazineRounds <= 0) return 'empty';
    this.magazineRounds -= 1;
    this.firedRounds += 1;
    this.nextShotAt = now + this.def.fireIntervalMs;
    return 'fired';
  }

  startReload(now: number): ReloadResult {
    if (this.reloading) return 'already';
    if (this.magazineRounds >= this.def.magazineSize) return 'full';
    if (this.reserveRounds <= 0) return 'no-reserve';
    this.reloadStartedAt = now;
    return 'started';
  }

  /** Interrumpe la recarga sin mover balas (cambio de arma, golpe fuerte). */
  cancelReload(): void {
    this.reloadStartedAt = null;
  }

  /** Progreso 0–1 de la recarga en curso, o `null` si no hay. */
  reloadProgress(now: number): number | null {
    if (this.reloadStartedAt === null) return null;
    return Math.min(1, Math.max(0, (now - this.reloadStartedAt) / this.def.reloadMs));
  }

  /** Avanza el tiempo. Devuelve `true` en el instante en que termina la recarga. */
  update(now: number): boolean {
    if (this.reloadStartedAt === null || now - this.reloadStartedAt < this.def.reloadMs) return false;
    const moved = Math.min(this.def.magazineSize - this.magazineRounds, this.reserveRounds);
    this.magazineRounds += moved;
    this.reserveRounds -= moved;
    this.reloadStartedAt = null;
    return true;
  }

  /** Fija cargador y reserva dentro de sus límites (solo pruebas). */
  debugSetAmmo(magazine: number, reserve: number): void {
    this.cancelReload();
    this.magazineRounds = Math.max(0, Math.min(this.def.magazineSize, Math.floor(magazine)));
    this.reserveRounds = Math.max(0, Math.min(this.def.reserveMax, Math.floor(reserve)));
  }

  /** Añade munición a la reserva. Devuelve cuánta cupo. */
  addReserve(rounds: number): number {
    const added = Math.max(0, Math.min(rounds, this.def.reserveMax - this.reserveRounds));
    this.reserveRounds += added;
    return added;
  }
}
