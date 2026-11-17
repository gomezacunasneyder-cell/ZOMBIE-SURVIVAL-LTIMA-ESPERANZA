import type { Rng } from '../math/Rng';

/**
 * Botín de las cajas de suministros. Las cajas no llevan de todo: cada
 * entrada de la tabla tiene un peso (probabilidad relativa) y una rareza.
 * Reglas que limitan lo que entrega un lanzamiento:
 *
 * - Como mucho un arma por lanzamiento, en una sola caja.
 * - Un arma que Alex ya tiene sale menos (su peso se reduce) y, si sale,
 *   se convierte en munición para ella.
 * - Las armas épicas tienen un tope por partida.
 * - Si varios lanzamientos seguidos no han traído ningún arma, el
 *   siguiente la garantiza («seguro de mala suerte»).
 * - Las piezas extra de una caja nunca son armas (munición, botiquines o arrojadizos).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic'];

export type LootItem =
  | { kind: 'weapon'; weaponId: string }
  /** Munición para un arma que Alex tenga; cuál se decide al abrir la caja. */
  | { kind: 'ammo' }
  | { kind: 'medkit'; count: number }
  /** Granadas o cócteles molotov. */
  | { kind: 'throwable'; throwableId: string; count: number };

/** Identificador de una pieza: el arma o el arrojadizo concretos, o su clase. */
export function lootId(item: LootItem): string {
  if (item.kind === 'weapon') return item.weaponId;
  if (item.kind === 'throwable') return item.throwableId;
  return item.kind;
}

export interface LootEntry {
  id: string;
  rarity: Rarity;
  /** Probabilidad relativa. */
  weight: number;
  item: LootItem;
}

export interface LootTable {
  entries: readonly LootEntry[];
  /** Probabilidad de que una caja traiga una segunda pieza (munición o botiquín). */
  extraItemChance: number;
  /** El peso de un arma que ya se tiene se multiplica por esto. */
  ownedWeaponFactor: number;
  /** Armas épicas como máximo por partida. */
  maxEpicPerRun: number;
  /** Tras tantos lanzamientos sin arma, el siguiente trae una seguro. */
  pityAfterDrops: number;
}

/** Lo que se sabe de la partida al preparar un lanzamiento. */
export interface DropContext {
  ownedWeapons: ReadonlySet<string>;
  /** Armas épicas entregadas ya en esta partida. */
  epicGiven: number;
  /** Lanzamientos seguidos sin ningún arma. */
  dropsWithoutWeapon: number;
}

export interface CrateLoot {
  items: LootItem[];
  /** La rareza más alta de la caja: decide el color de su baliza. */
  rarity: Rarity;
}

function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/** Elige una entrada al azar según su peso. `null` si no queda ninguna con peso. */
export function pickWeighted<T extends { weight: number }>(rng: Rng, entries: readonly T[]): T | null {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1] ?? null;
}

/** Peso efectivo de una entrada para esta partida (0 = no puede salir). */
function effectiveWeight(entry: LootEntry, table: LootTable, ctx: DropContext, epicGiven: number): number {
  if (entry.item.kind !== 'weapon') return entry.weight;
  if (entry.rarity === 'epic' && epicGiven >= table.maxEpicPerRun) return 0;
  return ctx.ownedWeapons.has(entry.item.weaponId) ? entry.weight * table.ownedWeaponFactor : entry.weight;
}

/**
 * Prepara el contenido de las cajas de un lanzamiento. Función pura:
 * con la misma semilla y el mismo contexto devuelve lo mismo.
 */
export function rollDrop(rng: Rng, table: LootTable, crates: number, ctx: DropContext): CrateLoot[] {
  let weaponGiven = false;
  let epicGiven = ctx.epicGiven;
  const pity = ctx.dropsWithoutWeapon >= table.pityAfterDrops;
  const supplies = table.entries.filter((entry) => entry.item.kind !== 'weapon');
  const out: CrateLoot[] = [];

  for (let i = 0; i < crates; i++) {
    const pool = table.entries
      .filter((entry) => !(weaponGiven && entry.item.kind === 'weapon'))
      // Seguro de mala suerte: la primera caja solo puede traer un arma nueva.
      .filter((entry) => !(pity && i === 0) || (entry.item.kind === 'weapon' && !ctx.ownedWeapons.has(entry.item.weaponId)))
      .map((entry) => ({ entry, weight: effectiveWeight(entry, table, ctx, epicGiven) }));
    const main = pickWeighted(rng, pool)?.entry ?? pickWeighted(rng, supplies);
    if (!main) continue;

    const items: LootItem[] = [{ ...main.item }];
    let rarity = main.rarity;
    if (main.item.kind === 'weapon') {
      weaponGiven = true;
      if (main.rarity === 'epic') epicGiven += 1;
    }
    if (rng.chance(table.extraItemChance)) {
      const extra = pickWeighted(rng, supplies);
      if (extra) {
        items.push({ ...extra.item });
        if (rarityRank(extra.rarity) > rarityRank(rarity)) rarity = extra.rarity;
      }
    }
    out.push({ items, rarity });
  }
  return out;
}

/** Contexto del lanzamiento siguiente, una vez entregado este. */
export function nextContext(ctx: DropContext, drop: readonly CrateLoot[], table: LootTable): DropContext {
  const weapons = drop
    .flatMap((crate) => crate.items)
    .filter((item): item is Extract<LootItem, { kind: 'weapon' }> => item.kind === 'weapon');
  const epicIds = new Set(
    table.entries.flatMap((e) => (e.rarity === 'epic' && e.item.kind === 'weapon' ? [e.item.weaponId] : [])),
  );
  const epics = weapons.filter((item) => epicIds.has(item.weaponId));
  return {
    ownedWeapons: ctx.ownedWeapons,
    epicGiven: ctx.epicGiven + epics.length,
    dropsWithoutWeapon: weapons.length > 0 ? 0 : ctx.dropsWithoutWeapon + 1,
  };
}
