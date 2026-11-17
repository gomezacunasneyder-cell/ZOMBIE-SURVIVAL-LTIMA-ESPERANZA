/**
 * Formato de nivel por datos. Un nivel es una calle horizontal más larga
 * que la pantalla, hecha de piezas independientes: obstáculos con colisión,
 * decorado, luces, enemigos y suministros.
 */

import type { EnemyKind } from './enemies';

/** Obstáculos sólidos sobre la línea de juego. La caja de colisión es algo menor que el dibujo. */
export const SOLIDS = {
  crate: { frame: 'prop/crate', width: 14, height: 12, breakable: true },
  barrier: { frame: 'prop/barrier', width: 24, height: 10, breakable: true },
  sandbags: { frame: 'prop/sandbags', width: 28, height: 9, breakable: true },
  car: { frame: 'vehicle/car', width: 54, height: 16, breakable: false },
  barrel: { frame: 'prop/barrel', width: 10, height: 14, breakable: false },
  /** Bidón de combustible: estalla al recibir disparos. */
  fuelBarrel: { frame: 'prop/fuel-barrel', width: 10, height: 21, breakable: false },
  /** Barricada reforzada del modo supervivencia: sacos, chapa y alambre. Aguanta mucho más. */
  fortification: { frame: 'prop/fortification', width: 26, height: 20, breakable: true, hits: 60 },
} as const;

/** Barricadas: el mutante las derriba a golpes; los demás las saltan. */
export function isBreakable(kind: SolidKind): boolean {
  return SOLIDS[kind].breakable;
}

/** Obstáculos que explotan al dispararles. */
export const EXPLOSIVE_SOLIDS: readonly SolidKind[] = ['fuelBarrel'];

export type SolidKind = keyof typeof SOLIDS;

/** Golpes que aguanta una barricada antes de romperse. */
export function hitsToBreak(kind: SolidKind, fallback: number): number {
  const def = SOLIDS[kind];
  return 'hits' in def ? def.hits : fallback;
}

export interface SolidPlacement {
  kind: SolidKind;
  x: number;
  flipX?: boolean;
}

/** Decorado sin colisión; `y` es la base del objeto y decide su profundidad. */
export interface DecorPlacement {
  frame: string;
  x: number;
  y: number;
  flipX?: boolean;
}

/** Elementos con luz propia; el constructor del nivel coloca objeto y luces. */
export type FixtureKind =
  | 'streetLamp'
  /** Farola averiada: no alumbra, pero su cable suelta chispazos. */
  | 'brokenLamp'
  | 'lightTower'
  | 'fireBarrel'
  | 'truck'
  /** Coche ardiendo al fondo de la calzada. */
  | 'burningCar'
  /** Baliza con sirena y luz roja giratoria. */
  | 'alarm'
  /** Fachadas de edificios abandonados, a oscuras por dentro. */
  | 'facadeShop'
  | 'facadeApartment';

export interface FixturePlacement {
  kind: FixtureKind;
  x: number;
  flipX?: boolean;
}

export interface EnemyPlacement {
  kind: EnemyKind;
  x: number;
}

export interface ZoneDef {
  name: string;
  /** La zona empieza en esta coordenada X. */
  from: number;
}

export interface LevelDef {
  id: string;
  width: number;
  /** Altura del suelo: donde apoyan los pies. */
  playLine: number;
  spawnX: number;
  zones: ZoneDef[];
  solids: SolidPlacement[];
  decor: DecorPlacement[];
  fixtures: FixturePlacement[];
  /** Enemigos al empezar el nivel. */
  enemies: EnemyPlacement[];
  /** Tipos que van llegando por los bordes, con su peso relativo, según la zona. */
  reinforcements: Record<string, Partial<Record<EnemyKind, number>>>;
  /** Cajas de suministros con munición. */
  pickups: number[];
  /** Manchas de sangre en el asfalto: [variante, x, y]. */
  decals: [variant: number, x: number, y: number][];
  /** Altura a la que vuela Cóndor 7 cuando trae suministros. */
  helicopter: { y: number };
}

/** Zona a la que pertenece una coordenada X. */
export function zoneAt(level: LevelDef, x: number): ZoneDef {
  let current = level.zones[0] as ZoneDef;
  for (const zone of level.zones) if (x >= zone.from) current = zone;
  return current;
}
