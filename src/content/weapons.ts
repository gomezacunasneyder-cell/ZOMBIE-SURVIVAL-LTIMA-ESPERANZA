/**
 * Arsenal definido por datos. Añadir un arma es añadir una entrada aquí,
 * su dibujo en `art/painters/guns.ts` y su voz en `audio/synth/gunshot.ts`
 * (las pruebas avisan si falta alguna de las tres piezas).
 */

/** Retroceso: lo que se ve y se siente al disparar. */
export interface RecoilDef {
  /** Píxeles que el arma retrocede a lo largo del cañón. */
  kickPx: number;
  /** Lo que tarda en volver a su sitio. */
  durationMs: number;
  /** Trauma de cámara que suma cada disparo (0–1). */
  cameraTrauma: number;
  /** Empuje hacia atrás que recibe Alex, en px/s. */
  pushBack: number;
}

export interface WeaponDef {
  id: string;
  /** Nombre mostrado en el HUD (la tipografía de píxel no tiene tildes). */
  name: string;
  /** Nombre de su munición en los avisos. */
  ammoName: string;
  /** Icono del HUD dentro del atlas. */
  icon: string;
  magazineSize: number;
  reserveStart: number;
  reserveMax: number;
  /** Munición que da una caja de suministros a esta arma. */
  pickupRounds: number;
  /** Tiempo mínimo entre disparos. */
  fireIntervalMs: number;
  reloadMs: number;
  /** Daño de cada proyectil a corta distancia. */
  damage: number;
  /** Proyectiles por disparo (perdigones de la escopeta). Cada disparo gasta una sola bala. */
  pellets: number;
  /** Dispersión máxima a cada lado, en grados. */
  spreadDeg: number;
  /** Distancia máxima que recorre un proyectil, en px. */
  rangePx: number;
  /** A partir de esta distancia el daño empieza a caer. */
  falloffStartPx: number;
  /** Fracción del daño que queda al final del alcance. */
  minDamageFactor: number;
  bulletSpeed: number;
  /** Proyectil: las llamas atraviesan y prenden fuego; el cohete estalla al impactar. */
  projectile: 'bullet' | 'pellet' | 'flame' | 'rocket';
  /** Casquillo que expulsa (`none`: ninguno). */
  casing: 'casing' | 'shell' | 'none';
  /** Si es verdadero, dispara mientras se mantiene el botón. */
  automatic: boolean;
  /** Empuje al enemigo alcanzado, en px/s (por proyectil). */
  knockback: number;
  /** Radio en el que el disparo alerta a los enemigos. */
  noiseRadius: number;
  recoil: RecoilDef;
  /** Llamas: el enemigo alcanzado sigue ardiendo un tiempo. */
  burn?: BurnDef;
  /** Cohete: explosión al impactar o al agotar su alcance. */
  blast?: BlastDef;
}

export interface BurnDef {
  /** Daño por segundo mientras arde. */
  dps: number;
  durationMs: number;
}

export interface BlastDef {
  radius: number;
  /** Daño en el centro; decae hacia el borde. */
  enemyDamage: number;
  playerDamage: number;
  knockback: number;
}

export const PISTOL: WeaponDef = {
  id: 'pistol',
  name: 'PISTOLA',
  ammoName: '9MM',
  icon: 'ui/pistol',
  magazineSize: 12,
  reserveStart: 36,
  reserveMax: 96,
  pickupRounds: 24,
  fireIntervalMs: 230,
  reloadMs: 1300,
  damage: 34,
  pellets: 1,
  spreadDeg: 1.5,
  rangePx: 300,
  falloffStartPx: 300,
  minDamageFactor: 1,
  bulletSpeed: 520,
  projectile: 'bullet',
  casing: 'casing',
  automatic: false,
  knockback: 70,
  noiseRadius: 260,
  recoil: { kickPx: 2, durationMs: 70, cameraTrauma: 0.16, pushBack: 0 },
};

export const SHOTGUN: WeaponDef = {
  id: 'shotgun',
  name: 'ESCOPETA',
  ammoName: 'CARTUCHOS',
  icon: 'ui/shotgun',
  magazineSize: 6,
  reserveStart: 12,
  reserveMax: 36,
  pickupRounds: 6,
  fireIntervalMs: 800,
  reloadMs: 2400,
  damage: 15,
  pellets: 7,
  spreadDeg: 10,
  rangePx: 150,
  falloffStartPx: 60,
  minDamageFactor: 0.35,
  bulletSpeed: 460,
  projectile: 'pellet',
  casing: 'shell',
  automatic: false,
  knockback: 150,
  noiseRadius: 420,
  recoil: { kickPx: 4, durationMs: 140, cameraTrauma: 0.38, pushBack: 70 },
};

export const ASSAULT_RIFLE: WeaponDef = {
  id: 'rifle',
  name: 'FUSIL DE ASALTO',
  ammoName: '5.56',
  icon: 'ui/rifle',
  magazineSize: 30,
  reserveStart: 60,
  reserveMax: 180,
  pickupRounds: 30,
  fireIntervalMs: 110,
  reloadMs: 1900,
  damage: 24,
  pellets: 1,
  spreadDeg: 2.5,
  rangePx: 400,
  falloffStartPx: 260,
  minDamageFactor: 0.7,
  bulletSpeed: 570,
  projectile: 'bullet',
  casing: 'casing',
  automatic: true,
  knockback: 50,
  noiseRadius: 360,
  recoil: { kickPx: 2, durationMs: 55, cameraTrauma: 0.12, pushBack: 0 },
};

export const MACHINE_GUN: WeaponDef = {
  id: 'mg',
  name: 'AMETRALLADORA',
  ammoName: 'CINTA 7.62',
  icon: 'ui/mg',
  magazineSize: 60,
  reserveStart: 120,
  reserveMax: 300,
  pickupRounds: 60,
  fireIntervalMs: 75,
  reloadMs: 3400,
  damage: 20,
  pellets: 1,
  spreadDeg: 5,
  rangePx: 340,
  falloffStartPx: 200,
  minDamageFactor: 0.6,
  bulletSpeed: 560,
  projectile: 'bullet',
  casing: 'casing',
  automatic: true,
  knockback: 45,
  noiseRadius: 440,
  recoil: { kickPx: 3, durationMs: 60, cameraTrauma: 0.14, pushBack: 14 },
};

/**
 * Lanzallamas: chorro corto que atraviesa a los enemigos y los deja
 * ardiendo. Gasta el combustible muy deprisa. Solo sale en suministros.
 */
export const FLAMETHROWER: WeaponDef = {
  id: 'flamer',
  name: 'LANZALLAMAS',
  ammoName: 'COMBUSTIBLE',
  icon: 'ui/flamer',
  magazineSize: 80,
  reserveStart: 40,
  reserveMax: 160,
  pickupRounds: 40,
  fireIntervalMs: 70,
  reloadMs: 2600,
  damage: 3,
  pellets: 2,
  spreadDeg: 7,
  rangePx: 96,
  falloffStartPx: 50,
  minDamageFactor: 0.5,
  bulletSpeed: 230,
  projectile: 'flame',
  casing: 'none',
  automatic: true,
  knockback: 6,
  noiseRadius: 220,
  recoil: { kickPx: 1, durationMs: 50, cameraTrauma: 0.04, pushBack: 0 },
  burn: { dps: 14, durationMs: 2600 },
};

/**
 * Lanzacohetes: un cohete por carga que estalla al impactar. Daña también
 * a Alex si está cerca de la explosión. Solo sale en suministros.
 */
export const ROCKET_LAUNCHER: WeaponDef = {
  id: 'rocket',
  name: 'LANZACOHETES',
  ammoName: 'COHETES',
  icon: 'ui/rocket',
  magazineSize: 1,
  reserveStart: 2,
  reserveMax: 6,
  pickupRounds: 2,
  fireIntervalMs: 900,
  reloadMs: 2200,
  damage: 60,
  pellets: 1,
  spreadDeg: 0.5,
  rangePx: 420,
  falloffStartPx: 420,
  minDamageFactor: 1,
  bulletSpeed: 330,
  projectile: 'rocket',
  casing: 'none',
  automatic: false,
  knockback: 120,
  noiseRadius: 560,
  recoil: { kickPx: 3, durationMs: 160, cameraTrauma: 0.45, pushBack: 40 },
  blast: { radius: 60, enemyDamage: 260, playerDamage: 40, knockback: 170 },
};

/** Todas las armas del juego, en el orden de sus ranuras. */
export const WEAPONS: readonly WeaponDef[] = [PISTOL, SHOTGUN, ASSAULT_RIFLE, MACHINE_GUN, FLAMETHROWER, ROCKET_LAUNCHER];

/** Número de ranuras de arma (teclas 1–6): una por arma. */
export const WEAPON_SLOTS = WEAPONS.length;

/** Ranura fija de cada arma. */
export function slotOf(weaponId: string): number {
  return WEAPONS.findIndex((weapon) => weapon.id === weaponId);
}

export function weaponById(weaponId: string): WeaponDef | undefined {
  return WEAPONS.find((weapon) => weapon.id === weaponId);
}

/** Construye un equipo: cada arma en su ranura y el resto vacías. */
function loadout(...owned: WeaponDef[]): readonly (WeaponDef | null)[] {
  return WEAPONS.map((weapon) => (owned.includes(weapon) ? weapon : null));
}

/**
 * Armas con las que empieza Alex: solo la pistola. El resto hay que
 * ganárselo en las cajas de suministros de Cóndor 7.
 */
export const STARTING_LOADOUT = loadout(PISTOL);
/** Las cuatro armas de la Fase 3 (`?arsenal=basico`, para pruebas y capturas). */
export const BASIC_LOADOUT = loadout(PISTOL, SHOTGUN, ASSAULT_RIFLE, MACHINE_GUN);
/** Todo el arsenal (`?arsenal=completo`). */
export const FULL_LOADOUT = loadout(...WEAPONS);

export type LoadoutId = 'inicial' | 'basico' | 'completo';
export const LOADOUTS: Readonly<Record<LoadoutId, readonly (WeaponDef | null)[]>> = {
  inicial: STARTING_LOADOUT,
  basico: BASIC_LOADOUT,
  completo: FULL_LOADOUT,
};

/** Tiempo para desenfundar un arma tras cambiarla; mientras, no dispara. */
export const WEAPON_SWITCH_MS = 260;
