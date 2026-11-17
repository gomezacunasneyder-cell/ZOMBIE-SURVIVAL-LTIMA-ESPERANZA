/**
 * Modo supervivencia: las cinco oleadas, sus recompensas, los tiempos y
 * la horda final. Todo el equilibrio del modo está aquí.
 */

import { RARITY_ORDER, type CrateLoot, type LootItem } from '../core/supply/loot';
import type { WaveDef, WaveTiming } from '../core/waves/WaveRun';
import type { EnemyKind } from './enemies';
import { rarityOf } from './supplies';

export interface WaveReward {
  /** Lo que trae siempre la caja de recompensa. */
  items: readonly LootItem[];
  /** Armas candidatas: llega la primera que Alex no tenga (si las tiene todas, munición). */
  weapons: readonly string[];
}

/** Contenido de la caja de recompensa: lo fijo más la primera arma que Alex no tenga. */
export function rewardLoot(reward: WaveReward, owned: readonly string[]): CrateLoot {
  const items: LootItem[] = reward.items.map((item) => ({ ...item }));
  const weapon = reward.weapons.find((id) => !owned.includes(id));
  items.unshift(weapon ? { kind: 'weapon', weaponId: weapon } : { kind: 'ammo' });
  const best = Math.max(...items.map((item) => RARITY_ORDER.indexOf(rarityOf(item))));
  return { items, rarity: RARITY_ORDER[best] ?? 'common' };
}

export interface SurvivalWave extends WaveDef<EnemyKind> {
  reward: WaveReward | null;
}

/**
 * | Oleada | Enemigos                                        | Total | A la vez |
 * |--------|-------------------------------------------------|-------|----------|
 * | 1      | 10 caminantes                                   | 10    | 8        |
 * | 2      | 14 caminantes · 6 corredores                    | 20    | 12       |
 * | 3      | 14 caminantes · 6 corredores · 5 Chasqueadores  | 25    | 14       |
 * | 4      | 22 caminantes · 8 corredores · 4 Ch. · 2 mutantes, en grupos de 4 | 36 | 20 |
 * | Horda  | 100 caminantes · 36 corredores · 14 Ch. · 4 mutantes, por los dos lados | 154 | 70 |
 */
export const SURVIVAL_WAVES: readonly SurvivalWave[] = [
  {
    title: 'OLEADA 1',
    subtitle: 'CAMINANTES',
    groups: [{ kind: 'walker', count: 10 }],
    spawnEveryMs: 1500,
    burst: 1,
    maxAlive: 8,
    sides: 'random',
    restMs: 12_000,
    reward: { items: [{ kind: 'ammo' }], weapons: ['shotgun'] },
  },
  {
    title: 'OLEADA 2',
    subtitle: '¡LLEGAN LOS CORREDORES!',
    groups: [
      { kind: 'walker', count: 14 },
      { kind: 'runner', count: 6 },
    ],
    spawnEveryMs: 1200,
    burst: 2,
    maxAlive: 12,
    sides: 'both',
    restMs: 12_000,
    reward: { items: [{ kind: 'medkit', count: 1 }, { kind: 'ammo' }], weapons: ['rifle', 'shotgun'] },
  },
  {
    title: 'OLEADA 3',
    subtitle: '¡CHASQUEADORES! NO HAGAS RUIDO',
    groups: [
      { kind: 'walker', count: 14 },
      { kind: 'runner', count: 6 },
      { kind: 'clicker', count: 5 },
    ],
    spawnEveryMs: 1100,
    burst: 2,
    maxAlive: 14,
    sides: 'both',
    restMs: 12_000,
    reward: { items: [{ kind: 'ammo' }, { kind: 'ammo' }, { kind: 'throwable', throwableId: 'grenade', count: 2 }], weapons: ['mg', 'rifle'] },
  },
  {
    title: 'OLEADA 4',
    subtitle: '¡MUTANTES Y GRANDES GRUPOS!',
    groups: [
      { kind: 'walker', count: 22 },
      { kind: 'runner', count: 8 },
      { kind: 'clicker', count: 4 },
      { kind: 'mutant', count: 2 },
    ],
    spawnEveryMs: 1600,
    burst: 4,
    maxAlive: 20,
    sides: 'both',
    restMs: 15_000,
    lastKinds: ['mutant'],
    // Antes de la horda: con qué defender la barricada.
    reward: {
      items: [{ kind: 'medkit', count: 1 }, { kind: 'ammo' }, { kind: 'ammo' }, { kind: 'throwable', throwableId: 'molotov', count: 2 }, { kind: 'throwable', throwableId: 'grenade', count: 1 }],
      weapons: ['flamer', 'rocket', 'mg'],
    },
  },
  {
    title: 'HORDA FINAL',
    subtitle: '¡DEFIENDE LA BARRICADA!',
    groups: [
      { kind: 'walker', count: 100 },
      { kind: 'runner', count: 36 },
      { kind: 'clicker', count: 14 },
      { kind: 'mutant', count: 4 },
    ],
    spawnEveryMs: 550,
    burst: 5,
    maxAlive: 70,
    sides: 'both',
    restMs: 0,
    final: true,
    lastKinds: ['mutant'],
    reward: null,
  },
];

export const WAVE_TIMING: WaveTiming = {
  introMs: 3500,
  alarmMs: 7000,
  bossMs: 14_000,
};

/** En el modo supervivencia todos derriban las barricadas en vez de saltarlas: cada cuánto golpean. */
export const SIEGE_SMASH_MS = 1700;

/** Distancia al borde del nivel a la que aparecen los enemigos de las oleadas. */
export const SPAWN_INSET = 18;
