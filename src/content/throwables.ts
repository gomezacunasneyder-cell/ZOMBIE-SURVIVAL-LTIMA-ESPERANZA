/**
 * Arrojadizos (GDD §5): granada y cóctel molotov. Consumibles que se
 * consiguen en las cajas de suministros. Todo el equilibrio está aquí.
 */

import type { ThrowArcRules, ThrowableRules } from '../core/combat/Throwables';
import type { BlastDef, BurnDef } from './weapons';

export type ThrowableId = 'grenade' | 'molotov';

export interface ThrowableDef extends ThrowableRules {
  id: ThrowableId;
  /** Nombre en pantalla (la tipografía de píxel no tiene tildes). */
  name: string;
  /** Icono del HUD y del inventario. */
  icon: string;
  /** Fotograma del objeto en vuelo. */
  sprite: string;
  arc: ThrowArcRules;
  /** Rebote al tocar el suelo (0 = se queda pegado). */
  bounce: number;
}

export interface GrenadeDef extends ThrowableDef {
  id: 'grenade';
  /** Desde que se lanza hasta que estalla. */
  fuseMs: number;
  blast: BlastDef;
}

export interface MolotovDef extends ThrowableDef {
  id: 'molotov';
  /** Ancho del charco de fuego. */
  fireWidth: number;
  fireMs: number;
  /** Lo que arde un enemigo que pisa el fuego. */
  burn: BurnDef;
  /** Daño a Alex por cada medio segundo dentro del fuego. */
  playerDamage: number;
  /** El cristal al romperse y el fuego mientras arde hacen ruido. */
  shatterNoise: number;
  fireNoise: number;
  fireNoiseEveryMs: number;
}

export const GRENADE: GrenadeDef = {
  id: 'grenade',
  name: 'GRANADA',
  icon: 'ui/grenade',
  sprite: 'throw/grenade',
  max: 3,
  arc: { launchDeg: 38, minRange: 36, maxRange: 230 },
  bounce: 0.35,
  fuseMs: 1700,
  blast: { radius: 64, enemyDamage: 230, playerDamage: 45, knockback: 170 },
};

export const MOLOTOV: MolotovDef = {
  id: 'molotov',
  name: 'MOLOTOV',
  icon: 'ui/molotov',
  sprite: 'throw/molotov',
  max: 3,
  arc: { launchDeg: 42, minRange: 36, maxRange: 200 },
  bounce: 0,
  fireWidth: 60,
  fireMs: 5500,
  burn: { dps: 16, durationMs: 2200 },
  playerDamage: 6,
  shatterNoise: 300,
  fireNoise: 230,
  fireNoiseEveryMs: 1200,
};

export const THROWABLES: readonly (GrenadeDef | MolotovDef)[] = [GRENADE, MOLOTOV];

/** Tiempo mínimo entre dos lanzamientos. */
export const THROW_COOLDOWN_MS = 650;

export function throwableById(id: string): GrenadeDef | MolotovDef | undefined {
  return THROWABLES.find((def) => def.id === id);
}

/** Arrojadizos al empezar según el equipo de la URL (en una partida normal, ninguno). */
export const STARTING_THROWABLES = {
  inicial: {},
  basico: { grenade: 2, molotov: 2 },
  completo: { grenade: 3, molotov: 3 },
} as const satisfies Readonly<Record<string, Readonly<Partial<Record<ThrowableId, number>>>>>;
