import { WeaponState, type FireResult, type WeaponRules } from './WeaponState';

/** Lo que el arsenal necesita saber de cada arma. */
export interface ArsenalWeapon extends WeaponRules {
  id: string;
  /** Munición que da una caja de suministros. */
  pickupRounds: number;
}

export type SelectResult = 'switched' | 'same' | 'empty-slot' | 'invalid';
export type ArsenalFireResult = FireResult | 'switching';

export interface Resupply<Def> {
  def: Def;
  slot: number;
  added: number;
}

/**
 * Ranuras de arma de Alex. Cada arma conserva su propio cargador y su
 * reserva al cambiar; cambiar interrumpe la recarga (sin perder balas) y
 * obliga a esperar a que el arma nueva esté lista. No sabe nada de sprites
 * ni de teclas: la capa de juego le pide acciones y él decide.
 */
export class Arsenal<Def extends ArsenalWeapon = ArsenalWeapon> {
  private readonly slots: (WeaponState<Def> | null)[];
  private index: number;
  private readyAt = -Infinity;

  constructor(
    loadout: readonly (Def | null)[],
    private readonly switchMs: number,
  ) {
    this.slots = loadout.map((def) => (def ? new WeaponState(def) : null));
    this.index = this.slots.findIndex((slot) => slot !== null);
    if (this.index < 0) throw new Error('Arsenal: hace falta al menos un arma');
  }

  get slot(): number {
    return this.index;
  }

  get slotCount(): number {
    return this.slots.length;
  }

  get current(): WeaponState<Def> {
    return this.slots[this.index] as WeaponState<Def>;
  }

  weaponAt(slot: number): WeaponState<Def> | null {
    return this.slots[slot] ?? null;
  }

  /** El arma equipada ya está desenfundada. */
  isReady(now: number): boolean {
    return now >= this.readyAt;
  }

  /** Progreso 0–1 del cambio de arma, o `null` si ya está lista. */
  switchProgress(now: number): number | null {
    if (this.isReady(now) || this.switchMs <= 0) return null;
    return 1 - (this.readyAt - now) / this.switchMs;
  }

  select(slot: number, now: number): SelectResult {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.slots.length) return 'invalid';
    if (slot === this.index) return 'same';
    if (!this.slots[slot]) return 'empty-slot';
    this.current.cancelReload();
    this.index = slot;
    this.readyAt = now + this.switchMs;
    return 'switched';
  }

  /** Pasa a la siguiente (1) o anterior (-1) ranura ocupada. */
  cycle(direction: 1 | -1, now: number): SelectResult {
    const count = this.slots.length;
    for (let step = 1; step < count; step++) {
      const slot = (((this.index + direction * step) % count) + count) % count;
      if (this.slots[slot]) return this.select(slot, now);
    }
    return 'same';
  }

  tryFire(now: number): ArsenalFireResult {
    if (!this.isReady(now)) return 'switching';
    return this.current.tryFire(now);
  }

  /** Avanza el tiempo del arma equipada. Devuelve `true` al terminar una recarga. */
  update(now: number): boolean {
    return this.current.update(now);
  }

  /**
   * Munición de una caja: va al arma equipada; si su reserva está llena,
   * al arma con la reserva más vacía en proporción. Devuelve `null` si no
   * cabe en ninguna (la caja se queda en el suelo).
   */
  resupply(): Resupply<Def> | null {
    const order = this.slots
      .map((weapon, slot) => ({ weapon, slot }))
      .filter((entry): entry is { weapon: WeaponState<Def>; slot: number } => entry.weapon !== null)
      .sort((a, b) => {
        if (a.slot === this.index) return -1;
        if (b.slot === this.index) return 1;
        return a.weapon.reserve / a.weapon.def.reserveMax - b.weapon.reserve / b.weapon.def.reserveMax;
      });
    for (const { weapon, slot } of order) {
      const added = weapon.addReserve(weapon.def.pickupRounds);
      if (added > 0) return { def: weapon.def, slot, added };
    }
    return null;
  }
}
