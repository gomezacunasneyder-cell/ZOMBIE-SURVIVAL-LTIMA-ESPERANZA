import { RARITY_COLOR, rarityOf } from '../../content/supplies';
import { weaponById } from '../../content/weapons';
import type { LootItem } from '../../core/supply/loot';
import type { Player } from '../entities/Player';

export interface LootLine {
  text: string;
  /** Color de paleta de la rareza. */
  color: string;
}

export interface LootResult {
  lines: LootLine[];
  /** Lo que no le cabe a Alex: se queda en la caja. */
  leftovers: LootItem[];
  /** Armas nuevas recibidas. */
  newWeapons: string[];
}

/** Arma que más necesita munición: la de reserva más vacía en proporción y con hueco. */
function neediestWeapon(player: Player): string | null {
  const arsenal = player.weapons.arsenal;
  let best: { id: string; ratio: number } | null = null;
  for (const id of arsenal.ownedIds()) {
    const weapon = arsenal.weaponAt(arsenal.slotOf(id));
    if (!weapon || weapon.reserve >= weapon.def.reserveMax) continue;
    const ratio = weapon.reserve / weapon.def.reserveMax;
    if (!best || ratio < best.ratio) best = { id, ratio };
  }
  return best?.id ?? null;
}

/**
 * Entrega a Alex lo que hay en una caja. La munición es siempre una
 * cantidad fija (la de una caja de su arma) y nunca supera la reserva
 * máxima: lo que no cabe se queda dentro de la caja.
 */
export function applyLoot(player: Player, items: readonly LootItem[], now: number): LootResult {
  const lines: LootLine[] = [];
  const leftovers: LootItem[] = [];
  const newWeapons: string[] = [];
  for (const item of items) {
    const color = RARITY_COLOR[rarityOf(item)];
    if (item.kind === 'weapon') {
      const def = weaponById(item.weaponId);
      if (!def) continue;
      const result = player.weapons.grant(def, now);
      if (result.kind === 'new') {
        newWeapons.push(def.id);
        lines.push({ text: `NUEVA ARMA: ${def.name}`, color });
      } else if (result.added > 0) {
        lines.push({ text: `${def.ammoName} +${result.added}`, color });
      } else leftovers.push(item);
    } else if (item.kind === 'ammo') {
      const id = neediestWeapon(player);
      const def = id ? weaponById(id) : undefined;
      const added = def ? player.weapons.addAmmo(def.id, def.pickupRounds) : 0;
      if (def && added > 0) lines.push({ text: `${def.ammoName} +${added}`, color });
      else leftovers.push(item);
    } else {
      const added = player.addMedkits(item.count);
      if (added > 0) lines.push({ text: `BOTIQUIN +${added}`, color });
      else leftovers.push(item);
    }
  }
  if (leftovers.length > 0) lines.push({ text: 'NO CABE MAS: LA CAJA GUARDA EL RESTO', color: 'grey2' });
  return { lines, leftovers, newWeapons };
}
