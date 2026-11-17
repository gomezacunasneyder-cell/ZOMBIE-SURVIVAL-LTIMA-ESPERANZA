import { THROWABLES } from '../../content/throwables';
import { WEAPONS } from '../../content/weapons';
import type { Player } from '../entities/Player';

/** Lo que muestra el inventario: una foto del equipo de Alex al abrirlo. */
export interface InventoryView {
  health: { current: number; max: number };
  weapons: ({
    slot: number;
    name: string;
    icon: string;
    ammoName: string;
    magazine: number;
    magazineSize: number;
    reserve: number;
    reserveMax: number;
    active: boolean;
  } | null)[];
  /** Nombre del arma que falta en cada ranura vacía: el jugador sabe qué buscar. */
  missing: string[];
  medkits: { count: number; max: number };
  throwables: { id: string; name: string; icon: string; key: string; count: number; max: number }[];
  scrap: number;
  /** Objetos de misión (llegarán con los capítulos de la campaña). */
  mission: string[];
  /** Equipa el arma de una ranura al volver al juego. */
  equip: (slot: number) => void;
}

const THROW_KEYS: Readonly<Record<string, string>> = { grenade: 'G', molotov: 'F' };

export function inventoryView(player: Player, now: () => number): InventoryView {
  const arsenal = player.weapons.arsenal;
  return {
    health: { current: player.health.current, max: player.health.max },
    weapons: Array.from({ length: arsenal.slotCount }, (_, slot) => {
      const weapon = arsenal.weaponAt(slot);
      if (!weapon) return null;
      const def = weapon.def;
      return {
        slot,
        name: def.name,
        icon: def.icon,
        ammoName: def.ammoName,
        magazine: weapon.magazine,
        magazineSize: def.magazineSize,
        reserve: weapon.reserve,
        reserveMax: def.reserveMax,
        active: slot === arsenal.slot,
      };
    }),
    missing: WEAPONS.map((def) => def.name),
    medkits: { count: player.medkits.count, max: player.medkits.rules.max },
    throwables: THROWABLES.map((def) => ({
      id: def.id,
      name: def.name,
      icon: def.icon,
      key: THROW_KEYS[def.id] ?? '',
      count: player.throwables.count(def.id),
      max: def.max,
    })),
    scrap: player.scrap.total,
    mission: [],
    equip: (slot) => player.weapons.select(slot, now()),
  };
}
