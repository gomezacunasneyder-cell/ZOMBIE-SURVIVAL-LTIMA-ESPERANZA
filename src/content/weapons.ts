/** Definición de un arma por datos: añadir un arma es añadir una entrada. */
export interface WeaponDef {
  id: string;
  /** Nombre mostrado en el HUD (la tipografía de píxel no tiene tildes). */
  name: string;
  /** Icono del HUD dentro del atlas. */
  icon: string;
  magazineSize: number;
  reserveStart: number;
  reserveMax: number;
  /** Tiempo mínimo entre disparos. */
  fireIntervalMs: number;
  reloadMs: number;
  damage: number;
  bulletSpeed: number;
  bulletLifeMs: number;
  /** Dispersión máxima a cada lado, en grados. */
  spreadDeg: number;
  /** Si es verdadero, dispara mientras se mantiene el botón. */
  automatic: boolean;
  /** Empuje al enemigo alcanzado, en px/s. */
  knockback: number;
  /** Radio en el que el disparo alerta a los enemigos. */
  noiseRadius: number;
}

export const PISTOL: WeaponDef = {
  id: 'pistol',
  name: 'PISTOLA',
  icon: 'ui/pistol',
  magazineSize: 12,
  reserveStart: 36,
  reserveMax: 96,
  fireIntervalMs: 230,
  reloadMs: 1300,
  damage: 34,
  bulletSpeed: 520,
  bulletLifeMs: 900,
  spreadDeg: 1.5,
  automatic: false,
  knockback: 70,
  noiseRadius: 260,
};

/** Número de ranuras de arma (teclas 1–4). */
export const WEAPON_SLOTS = 4;

/** Armas con las que empieza Alex; las ranuras vacías se llenan en la Fase 3. */
export const STARTING_LOADOUT: readonly (WeaponDef | null)[] = [PISTOL, null, null, null];

/** Munición que da una caja de suministros. */
export const AMMO_PICKUP_AMOUNT = 24;
