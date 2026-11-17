import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { heliTiltShift } from '../../src/art/painters/airdrop';
import { heliBodyFrame } from '../../src/art/supplyArt';
import { synthChute, synthCrateLand, synthCrateOpen, synthFlare, synthMedkit, synthRadioAlarm, synthRadioChatter } from '../../src/audio/synth/supplies';
import { CHAPTER_1 } from '../../src/content/chapters/chapter1';
import { SOLIDS } from '../../src/content/level';
import { MEDKIT } from '../../src/content/player';
import {
  AIRDROP_SCHEDULE,
  CRATE_FALL,
  DROP_POINTS,
  FLIGHT,
  LOOT_TABLE,
  RARITY_COLOR,
} from '../../src/content/supplies';
import { BASIC_LOADOUT, FLAMETHROWER, PISTOL, ROCKET_LAUNCHER, SHOTGUN, STARTING_LOADOUT, WEAPONS, WEAPON_SWITCH_MS, slotOf, type WeaponDef } from '../../src/content/weapons';
import { Arsenal } from '../../src/core/combat/Arsenal';
import { Medkits } from '../../src/core/combat/Medkits';
import { Rng } from '../../src/core/math/Rng';
import {
  AirdropFlight,
  AirdropScheduler,
  chooseDropPoints,
  crateFall,
  type FlightEvent,
} from '../../src/core/supply/airdrop';
import { nextContext, rollDrop, type DropContext, type LootItem } from '../../src/core/supply/loot';
import { colorNames } from '../../src/art/palette';

const fresh = (owned: string[] = ['pistol']): DropContext => ({ ownedWeapons: new Set(owned), epicGiven: 0, dropsWithoutWeapon: 0 });
const weaponsIn = (items: LootItem[]): string[] => items.flatMap((i) => (i.kind === 'weapon' ? [i.weaponId] : []));

describe('tabla de botín', () => {
  it('cubre todas las armas, munición y botiquines, con rarezas', () => {
    const ids = LOOT_TABLE.entries.map((e) => e.id);
    for (const w of WEAPONS) expect(ids, w.id).toContain(w.id);
    expect(ids).toContain('ammo');
    expect(ids).toContain('medkit');
    const total = LOOT_TABLE.entries.reduce((sum, e) => sum + e.weight, 0);
    expect(total).toBeCloseTo(100, 6);
    // Las armas pesadas son las más raras.
    const rarity = Object.fromEntries(LOOT_TABLE.entries.map((e) => [e.id, e.rarity]));
    expect(rarity.rocket).toBe('epic');
    expect(rarity.flamer).toBe('rare');
    expect(rarity.mg).toBe('rare');
    expect(rarity.ammo).toBe('common');
    for (const color of Object.values(RARITY_COLOR)) expect(colorNames()).toContain(color);
  });

  it('las frecuencias siguen los pesos (10 000 cajas)', () => {
    const rng = new Rng(77);
    const counts = new Map<string, number>();
    const rolls = 10_000;
    for (let i = 0; i < rolls; i++) {
      // Sin armas en propiedad y sin topes: mide la tabla tal cual.
      const [crate] = rollDrop(rng, { ...LOOT_TABLE, extraItemChance: 0, maxEpicPerRun: 99, pityAfterDrops: 99 }, 1, fresh([]));
      const item = crate!.items[0]!;
      const id = item.kind === 'weapon' ? item.weaponId : item.kind;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const entry of LOOT_TABLE.entries) {
      const share = (counts.get(entry.id) ?? 0) / rolls;
      expect(share, entry.id).toBeGreaterThan((entry.weight / 100) * 0.8);
      expect(share, entry.id).toBeLessThan((entry.weight / 100) * 1.2 + 0.004);
    }
  });

  it('como mucho un arma por lanzamiento y las piezas extra nunca son armas', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 2000; i++) {
      const drop = rollDrop(rng, LOOT_TABLE, 3, fresh());
      expect(weaponsIn(drop.flatMap((c) => c.items)).length).toBeLessThanOrEqual(1);
      for (const crate of drop) {
        expect(crate.items.length).toBeGreaterThanOrEqual(1);
        expect(crate.items.length).toBeLessThanOrEqual(2);
        expect(crate.items.slice(1).every((item) => item.kind !== 'weapon')).toBe(true);
      }
    }
  });

  it('el lanzacohetes no sale más de una vez por partida', () => {
    const rng = new Rng(9);
    let ctx = fresh();
    let rockets = 0;
    for (let i = 0; i < 400; i++) {
      const drop = rollDrop(rng, LOOT_TABLE, 3, ctx);
      rockets += weaponsIn(drop.flatMap((c) => c.items)).filter((id) => id === 'rocket').length;
      ctx = nextContext(ctx, drop, LOOT_TABLE);
    }
    expect(rockets).toBeLessThanOrEqual(LOOT_TABLE.maxEpicPerRun);
    expect(ctx.epicGiven).toBe(rockets);
  });

  it('las armas que ya se tienen salen menos', () => {
    const share = (owned: string[]): number => {
      const rng = new Rng(3);
      let shotguns = 0;
      for (let i = 0; i < 6000; i++) {
        const [crate] = rollDrop(rng, { ...LOOT_TABLE, extraItemChance: 0 }, 1, fresh(owned));
        if (weaponsIn(crate!.items).includes('shotgun')) shotguns += 1;
      }
      return shotguns / 6000;
    };
    expect(share(['pistol', 'shotgun'])).toBeLessThan(share(['pistol']) * 0.5);
  });

  it('tras dos lanzamientos sin arma, el siguiente trae un arma nueva', () => {
    const ctx: DropContext = { ownedWeapons: new Set(['pistol']), epicGiven: 0, dropsWithoutWeapon: LOOT_TABLE.pityAfterDrops };
    const rng = new Rng(11);
    for (let i = 0; i < 300; i++) {
      const [first] = rollDrop(rng, LOOT_TABLE, 2, ctx);
      const [item] = first!.items;
      expect(item!.kind).toBe('weapon');
      expect(item!.kind === 'weapon' && item!.weaponId !== 'pistol').toBe(true);
    }
    const after = nextContext(ctx, rollDrop(new Rng(1), LOOT_TABLE, 2, ctx), LOOT_TABLE);
    expect(after.dropsWithoutWeapon).toBe(0);
  });

  it('la rareza de la caja es la de su mejor pieza', () => {
    const rng = new Rng(21);
    const rank = ['common', 'uncommon', 'rare', 'epic'];
    for (let i = 0; i < 500; i++) {
      for (const crate of rollDrop(rng, LOOT_TABLE, 3, fresh())) {
        const best = Math.max(
          ...crate.items.map((item) => {
            const entry = LOOT_TABLE.entries.find((e) =>
              item.kind === 'weapon' ? e.item.kind === 'weapon' && e.item.weaponId === item.weaponId : e.item.kind === item.kind,
            );
            return rank.indexOf(entry!.rarity);
          }),
        );
        expect(rank.indexOf(crate.rarity)).toBe(best);
      }
    }
  });
});

describe('las cajas no dan munición infinita', () => {
  it('un arma nueva llega con su reserva inicial; repetida, se convierte en munición con tope', () => {
    const a = new Arsenal<WeaponDef>(STARTING_LOADOUT, WEAPON_SWITCH_MS);
    const first = a.grant(SHOTGUN, slotOf('shotgun'));
    expect(first).toEqual({ kind: 'new', slot: 1, added: 0 });
    expect(a.weaponAt(1)!.reserve).toBe(SHOTGUN.reserveStart);
    expect(a.weaponAt(1)!.magazine).toBe(SHOTGUN.magazineSize);
    // Repetirla da la munición de una caja, nunca más que la reserva máxima.
    let total = 0;
    for (let i = 0; i < 50; i++) total += a.grant(SHOTGUN, slotOf('shotgun')).added;
    expect(a.weaponAt(1)!.reserve).toBe(SHOTGUN.reserveMax);
    expect(total).toBe(SHOTGUN.reserveMax - SHOTGUN.reserveStart);
    expect(a.grant(SHOTGUN, slotOf('shotgun'))).toEqual({ kind: 'ammo', slot: 1, added: 0 });
  });

  it('la munición va a un arma que se tiene, en cantidad fija', () => {
    const a = new Arsenal<WeaponDef>(BASIC_LOADOUT, WEAPON_SWITCH_MS);
    expect(a.addAmmo('flamer', 100)).toBe(0);
    a.weaponAt(0)!.debugSetAmmo(12, 0);
    expect(a.addAmmo('pistol', PISTOL.pickupRounds)).toBe(PISTOL.pickupRounds);
    expect(a.ownedIds()).toEqual(['pistol', 'shotgun', 'rifle', 'mg']);
  });

  it('no se puede dar un arma en una ranura ocupada ni fuera de rango', () => {
    const a = new Arsenal<WeaponDef>(STARTING_LOADOUT, WEAPON_SWITCH_MS);
    expect(() => a.grant(SHOTGUN, 0)).toThrow();
    expect(() => a.grant(SHOTGUN, 9)).toThrow();
  });

  it('el lanzacohetes y el lanzallamas llegan con poca munición', () => {
    expect(ROCKET_LAUNCHER.magazineSize + ROCKET_LAUNCHER.reserveStart).toBeLessThanOrEqual(3);
    expect(ROCKET_LAUNCHER.blast!.radius).toBeGreaterThan(40);
    expect(FLAMETHROWER.burn!.dps).toBeGreaterThan(0);
    // El combustible del cargador dura pocos segundos de chorro.
    expect((FLAMETHROWER.magazineSize * FLAMETHROWER.fireIntervalMs) / 1000).toBeLessThan(7);
  });
});

describe('botiquines', () => {
  it('curan al terminar, se interrumpen sin gastarse y tienen tope', () => {
    const kits = new Medkits(MEDKIT, 1);
    expect(kits.start(0, 0)).toBe('full-health');
    expect(kits.start(0, 40)).toBe('started');
    expect(kits.start(10, 40)).toBe('already');
    expect(kits.progress(MEDKIT.useMs / 2)).toBeCloseTo(0.5, 5);
    expect(kits.update(MEDKIT.useMs - 1)).toBe(0);
    expect(kits.cancel()).toBe(true);
    expect(kits.count).toBe(1);
    expect(kits.start(5000, 40)).toBe('started');
    expect(kits.update(5000 + MEDKIT.useMs)).toBe(MEDKIT.heal);
    expect(kits.count).toBe(0);
    expect(kits.start(9000, 40)).toBe('none');
    expect(kits.add(10)).toBe(MEDKIT.max);
    expect(kits.add(1)).toBe(0);
  });
});

describe('calendario de lanzamientos', () => {
  it('unas partidas tienen lanzamientos al azar y otras no', () => {
    let enabled = 0;
    for (let seed = 0; seed < 1000; seed++) if (new AirdropScheduler(AIRDROP_SCHEDULE, new Rng(seed), 0).randomEnabled) enabled += 1;
    expect(enabled / 1000).toBeGreaterThan(AIRDROP_SCHEDULE.randomChance - 0.06);
    expect(enabled / 1000).toBeLessThan(AIRDROP_SCHEDULE.randomChance + 0.06);
  });

  it('el primero llega dentro de su ventana y nunca se solapan', () => {
    let seed = 0;
    let s: AirdropScheduler;
    do s = new AirdropScheduler(AIRDROP_SCHEDULE, new Rng(seed++), 0);
    while (!s.randomEnabled);
    const [min, max] = AIRDROP_SCHEDULE.firstDelayMs;
    expect(s.nextRandom).toBeGreaterThanOrEqual(min);
    expect(s.nextRandom).toBeLessThanOrEqual(max);
    expect(s.update(min - 1, false)).toBeNull();
    expect(s.update(max + 1, true)).toBeNull();
    expect(s.update(max + 1, false)).toBe('random');
    expect(s.update(max + 2, false)).toBeNull();
  });

  it('entrar en el campamento provoca un lanzamiento una sola vez, y hay tope por partida', () => {
    const s = new AirdropScheduler({ ...AIRDROP_SCHEDULE, randomChance: 0 }, new Rng(1), 0);
    s.enterZone('AVENIDA CENTRAL');
    expect(s.update(10, false)).toBeNull();
    s.enterZone('CAMPAMENTO');
    expect(s.update(20, true)).toBeNull();
    expect(s.update(30, false)).toBe('event');
    s.enterZone('BARRICADA');
    s.enterZone('CAMPAMENTO');
    expect(s.update(40, false)).toBeNull();
    expect(s.force(50)).toBe(true);
    expect(s.force(60)).toBe(true);
    expect(s.force(70)).toBe(false);
    expect(s.count).toBe(AIRDROP_SCHEDULE.maxPerRun);
  });
});

describe('puntos de caída', () => {
  const blocked = [[290, 310], [440, 500]] as const;
  it('por delante de Alex, separadas, dentro del nivel y fuera de los obstáculos', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = new Rng(seed);
      const playerX = 100 + rng.int(0, 2200);
      const points = chooseDropPoints(rng, 3, { playerX, levelWidth: 2400, blocked }, DROP_POINTS);
      expect(points).toHaveLength(3);
      for (const x of points) {
        expect(x).toBeGreaterThanOrEqual(DROP_POINTS.edge);
        expect(x).toBeLessThanOrEqual(2400 - DROP_POINTS.edge);
        for (const [from, to] of blocked) expect(x <= from - 14 || x >= to + 14, `${x}`).toBe(true);
        // Hay que ir a por ellas: ninguna cae encima de Alex.
        expect(Math.abs(x - playerX)).toBeGreaterThan(80);
      }
      for (let i = 1; i < points.length; i++) expect(points[i]! - points[i - 1]!).toBeGreaterThanOrEqual(DROP_POINTS.spacing[0] - 2);
    }
  });

  it('en la calle real del capítulo 1 nunca caen dos cajas juntas ni sobre un obstáculo', () => {
    const real = CHAPTER_1.solids.map((s) => [s.x - SOLIDS[s.kind].width / 2, s.x + SOLIDS[s.kind].width / 2] as const);
    for (let seed = 0; seed < 400; seed++) {
      const rng = new Rng(seed);
      const playerX = 80 + rng.int(0, 2240);
      const points = chooseDropPoints(rng, 3, { playerX, levelWidth: CHAPTER_1.width, blocked: real }, DROP_POINTS);
      for (let i = 1; i < points.length; i++) {
        expect(points[i]! - points[i - 1]!, `semilla ${seed}: ${points.join(',')}`).toBeGreaterThanOrEqual(DROP_POINTS.spacing[0]);
      }
      for (const x of points) for (const [from, to] of real) expect(x <= from - 14 || x >= to + 14, `${seed}: ${x}`).toBe(true);
    }
  });

  it('al final del nivel caen por detrás', () => {
    const points = chooseDropPoints(new Rng(1), 2, { playerX: 2300, levelWidth: 2400, blocked: [] }, DROP_POINTS);
    for (const x of points) expect(x).toBeLessThan(2300);
  });
});

describe('vuelo de Cóndor 7', () => {
  const simulate = (direction: 1 | -1): { events: (FlightEvent & { at: number })[]; flight: AirdropFlight; xs: number[] } => {
    const drops = [600, 700, 780];
    const flight = new AirdropFlight(FLIGHT, drops, direction, 0);
    const events: (FlightEvent & { at: number })[] = [];
    const xs: number[] = [];
    for (let t = 0; t < 60_000 && flight.active; t += 16) {
      for (const e of flight.update(t, 16)) events.push({ ...e, at: t });
      xs.push(flight.x);
    }
    return { events, flight, xs };
  };

  for (const direction of [1, -1] as const) {
    it(`entra por ${direction === 1 ? 'la izquierda' : 'la derecha'}, suelta cada caja sobre su punto y sale por el otro lado`, () => {
      const { events, flight, xs } = simulate(direction);
      const types = events.map((e) => e.type);
      expect(types).toEqual(['inbound', 'release', 'release', 'release', 'outbound', 'done']);
      expect(events[0]!.at).toBeGreaterThanOrEqual(FLIGHT.warningMs);
      const releases = events.filter((e): e is { type: 'release'; index: number; x: number; at: number } => e.type === 'release');
      expect(releases.map((r) => r.x)).toEqual(direction === 1 ? [600, 700, 780] : [780, 700, 600]);
      expect(releases.map((r) => r.index)).toEqual([0, 1, 2]);
      // Empieza y acaba fuera de la zona, en lados opuestos, y nunca retrocede.
      expect((xs[0]! - 600) * direction).toBeLessThan(-FLIGHT.entryDistance + 1 + FLIGHT.cruiseSpeed);
      expect((flight.x - 780) * direction).toBeGreaterThanOrEqual(FLIGHT.exitDistance);
      for (let i = 1; i < xs.length; i++) expect((xs[i]! - xs[i - 1]!) * direction).toBeGreaterThanOrEqual(-1e-9);
      expect(flight.releasedCount).toBe(3);
      // Todo el paso dura menos de medio minuto.
      expect(events[events.length - 1]!.at).toBeLessThan(30_000);
    });
  }

  it('se inclina morro abajo al acelerar y morro arriba al frenar', () => {
    const flight = new AirdropFlight(FLIGHT, [900], 1, 0);
    const seen = new Set<number>();
    for (let t = 0; t < 40_000 && flight.active; t += 16) {
      flight.update(t, 16);
      if (flight.phase !== 'warning') seen.add(flight.attitude);
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
  });
});

describe('caída de las cajas', () => {
  it('cae libre, abre el paracaídas, baja despacio balanceándose y aterriza', () => {
    const states: string[] = [];
    let lastY = -Infinity;
    let maxSway = 0;
    let landedAt = 0;
    for (let t = 0; t < 20_000; t += 16) {
      const pose = crateFall(t, 70, 223, CRATE_FALL);
      expect(pose.y).toBeGreaterThanOrEqual(lastY);
      lastY = pose.y;
      maxSway = Math.max(maxSway, Math.abs(pose.sway));
      if (states[states.length - 1] !== pose.chute) states.push(pose.chute);
      if (pose.chute === 'landed') {
        landedAt = t;
        expect(pose.y).toBe(223);
        break;
      }
    }
    expect(states).toEqual(['none', 'deploying', 'open', 'landed']);
    expect(maxSway).toBeGreaterThan(0);
    expect(maxSway).toBeLessThanOrEqual(CRATE_FALL.swayPx);
    // Tiempo de sobra para que los zombis acudan, pero sin hacerse eterno.
    expect(landedAt).toBeGreaterThan(3000);
    expect(landedAt).toBeLessThan(7000);
  });
});

describe('arte y sonido de los suministros', () => {
  const catalog = buildArtCatalog();
  it('el helicóptero tiene sus tres actitudes y el cizallado no deforma en exceso', () => {
    for (const attitude of [-1, 0, 1] as const) expect(catalog.sprites.has(heliBodyFrame(attitude))).toBe(true);
    expect(heliTiltShift(40, 1)).toBe(0);
    expect(heliTiltShift(0, 1)).toBeGreaterThan(0);
    expect(heliTiltShift(0, -1)).toBeLessThan(0);
    expect(Math.abs(heliTiltShift(85, 1))).toBeLessThanOrEqual(3);
    const level = catalog.sprites.get(heliBodyFrame(0))!;
    const tilted = catalog.sprites.get(heliBodyFrame(1))!;
    expect(tilted.countOpaque()).toBe(level.countOpaque());
  });

  it('hay cajas, paracaídas, carga, flecha, llamas, cohetes e iconos', () => {
    for (const name of ['supply/crate', 'supply/crate-open', 'supply/chute-deploy', 'supply/chute/0', 'supply/chute-collapse/3', 'supply/sling/1', 'supply/sling/3', 'ui/crate-arrow', 'ui/medkit', 'fx/flame/0', 'fx/flame/3', 'fx/rocket/0', 'fx/rocket/-90', 'fx/rocket/90']) {
      expect(catalog.sprites.has(name), name).toBe(true);
    }
  });

  it('los sonidos del lanzamiento existen, suenan y no saturan', () => {
    for (const sound of [synthRadioAlarm(), synthRadioChatter(), synthChute(), synthCrateLand(), synthCrateOpen(), synthFlare(), synthMedkit()]) {
      const peak = sound.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
});
