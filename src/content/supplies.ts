/**
 * Suministros de Cóndor 7: calendario de lanzamientos, vuelo, caída de
 * las cajas y tabla de botín. Todo el equilibrio del evento está aquí.
 */

import type { AirdropSchedule, DropPointRules, FallRules, FlightRules } from '../core/supply/airdrop';
import type { LootItem, LootTable, Rarity } from '../core/supply/loot';

/**
 * Cuándo hay lanzamiento. En siete de cada diez partidas llegan al azar
 * pasado el primer minuto; además, llegar al campamento militar lo
 * provoca siempre. Nunca más de tres por partida.
 */
export const AIRDROP_SCHEDULE: AirdropSchedule = {
  randomChance: 0.7,
  firstDelayMs: [55_000, 100_000],
  repeatDelayMs: [110_000, 170_000],
  maxPerRun: 3,
  eventZones: ['CAMPAMENTO'],
};

export const FLIGHT: FlightRules = {
  warningMs: 3200,
  // Empieza bien lejos para que se le oiga acercarse antes de verlo.
  entryDistance: 760,
  exitDistance: 620,
  cruiseSpeed: 150,
  exitSpeed: 190,
  response: 1.6,
  brake: 0.9,
  hoverMs: 1400,
};

export const DROP_POINTS: DropPointRules = {
  ahead: [100, 190],
  spacing: [40, 70],
  edge: 60,
};

export const CRATE_FALL: FallRules = {
  freeFallMs: 320,
  gravity: 520,
  deployMs: 420,
  chuteSpeed: 36,
  swayPx: 3,
  swayPeriodMs: 1700,
};

/** Cajas por lanzamiento: dos, a veces tres. */
export const CRATES_PER_DROP = { base: 2, extraChance: 0.35 } as const;

/** Interacción y ruido de las cajas en el suelo. */
export const CRATE = {
  /** Distancia a la que Alex puede abrirla. */
  reach: 16,
  /** Mantener E este tiempo para abrirla. */
  openMs: 750,
  /** El golpe contra el suelo se oye lejos y atrae enemigos. */
  landingNoise: 380,
  /** La bengala de la caja chisporrotea: mantiene a los zombis rondando. */
  flareNoise: 150,
  flareNoiseEveryMs: 1600,
  /** Enemigos que acuden a rodear cada lanzamiento (fuera de la pantalla). */
  ambush: [2, 4] as const,
  /** Rotor: el helicóptero hace ruido mientras sobrevuela. */
  rotorNoise: 320,
  rotorNoiseEveryMs: 900,
} as const;

/**
 * Tabla de botín. Pesos relativos (suman 100): munición y botiquines son
 * lo habitual; las armas, sobre todo las pesadas, escasean.
 *
 * | Rareza      | Contenido                                 | Peso |
 * |-------------|-------------------------------------------|------|
 * | Común       | Munición 46 · Botiquín 24 · Pistola 6     | 76   |
 * | Poco común  | Escopeta 8 · Fusil de asalto 7            | 15   |
 * | Rara        | Ametralladora 4 · Lanzallamas 3,5         | 7,5  |
 * | Épica       | Lanzacohetes 1,5                          | 1,5  |
 */
export const LOOT_TABLE: LootTable = {
  entries: [
    { id: 'ammo', rarity: 'common', weight: 46, item: { kind: 'ammo' } },
    { id: 'medkit', rarity: 'common', weight: 24, item: { kind: 'medkit', count: 1 } },
    { id: 'pistol', rarity: 'common', weight: 6, item: { kind: 'weapon', weaponId: 'pistol' } },
    { id: 'shotgun', rarity: 'uncommon', weight: 8, item: { kind: 'weapon', weaponId: 'shotgun' } },
    { id: 'rifle', rarity: 'uncommon', weight: 7, item: { kind: 'weapon', weaponId: 'rifle' } },
    { id: 'mg', rarity: 'rare', weight: 4, item: { kind: 'weapon', weaponId: 'mg' } },
    { id: 'flamer', rarity: 'rare', weight: 3.5, item: { kind: 'weapon', weaponId: 'flamer' } },
    { id: 'rocket', rarity: 'epic', weight: 1.5, item: { kind: 'weapon', weaponId: 'rocket' } },
  ],
  extraItemChance: 0.4,
  ownedWeaponFactor: 0.35,
  maxEpicPerRun: 1,
  pityAfterDrops: 2,
};

/** Rareza de una pieza según la tabla (munición y botiquines son comunes). */
export function rarityOf(item: LootItem): Rarity {
  const entry = LOOT_TABLE.entries.find((e) =>
    item.kind === 'weapon' ? e.item.kind === 'weapon' && e.item.weaponId === item.weaponId : e.item.kind === item.kind,
  );
  return entry?.rarity ?? 'common';
}

/** Nombre de cada rareza en pantalla (la tipografía de píxel no tiene tildes). */
export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  common: 'COMUN',
  uncommon: 'POCO COMUN',
  rare: 'RARA',
  epic: 'EPICA',
};

/** Color de paleta de cada rareza: baliza de la caja y textos del botín. */
export const RARITY_COLOR = {
  common: 'grey1',
  uncommon: 'ui1',
  rare: 'yel1',
  epic: 'org1',
} as const satisfies Readonly<Record<Rarity, string>>;

/** Mensajes de radio de Cóndor 7. */
export const RADIO = {
  warning: '¡SUMINISTROS DETECTADOS!',
  inbound: 'CONDOR 7: VOY HACIA TU POSICION. ATENTO AL CIELO.',
  dropping: 'CONDOR 7: SUELTO LA CARGA. ¡CORRE, VAN A POR ELLA!',
  leaving: 'CONDOR 7: SIN COMBUSTIBLE PARA MAS. SUERTE, ALEX.',
} as const;
