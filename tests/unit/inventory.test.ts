import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { THROW_SPIN_FRAMES, SCRAP_VARIANTS } from '../../src/art/throwArt';
import { synthGlassBreak, synthGrenadeBounce, synthScrapPickup, synthThrowSwish } from '../../src/audio/synth/throwables';
import { ENEMIES, type EnemyKind } from '../../src/content/enemies';
import { GRAVITY } from '../../src/content/player';
import { SCRAP, SCRAP_DROPS } from '../../src/content/scrap';
import { LOOT_TABLE, rarityOf } from '../../src/content/supplies';
import { GRENADE, MOLOTOV, STARTING_THROWABLES, THROWABLES, throwableById } from '../../src/content/throwables';
import { Throwables, landingDistance, throwVelocity } from '../../src/core/combat/Throwables';
import { ScrapWallet, rollScrap, splitScrap } from '../../src/core/economy/Scrap';
import { Rng } from '../../src/core/math/Rng';
import { lootId, rollDrop } from '../../src/core/supply/loot';

/** Simula el vuelo con el mismo paso que la física (60 Hz) hasta bajar `drop` píxeles. */
function simulateLanding(vx: number, vy: number, drop: number): number {
  const dt = 1 / 60;
  let x = 0;
  let y = 0;
  let speedY = vy;
  for (let i = 0; i < 600; i++) {
    speedY += GRAVITY * dt;
    x += vx * dt;
    y += speedY * dt;
    if (speedY > 0 && y >= drop) return x;
  }
  return x;
}

describe('mochila de arrojadizos', () => {
  const pack = (initial = {}): Throwables => new Throwables(THROWABLES, 650, initial);

  it('cuenta por tipo, respeta el máximo y devuelve cuántos cupieron', () => {
    const t = pack({ grenade: 2 });
    expect(t.count('grenade')).toBe(2);
    expect(t.count('molotov')).toBe(0);
    expect(t.add('grenade', 5)).toBe(GRENADE.max - 2);
    expect(t.count('grenade')).toBe(GRENADE.max);
    expect(t.add('grenade', 1)).toBe(0);
    expect(t.add('desconocido', 3)).toBe(0);
    expect(t.add('molotov', -2)).toBe(0);
  });

  it('lanzar gasta uno; sin unidades o antes de tiempo no sale nada', () => {
    const t = pack({ grenade: 2 });
    expect(t.throw('molotov', 0)).toBe('none');
    expect(t.throw('grenade', 1000)).toBe('thrown');
    expect(t.count('grenade')).toBe(1);
    expect(t.throw('grenade', 1200)).toBe('cooldown');
    expect(t.count('grenade')).toBe(1);
    expect(t.throw('grenade', 1650)).toBe('thrown');
    expect(t.throw('grenade', 9999)).toBe('none');
  });

  it('una partida normal empieza sin arrojadizos; los equipos de prueba traen algunos', () => {
    expect(pack(STARTING_THROWABLES.inicial).count('grenade')).toBe(0);
    expect(pack(STARTING_THROWABLES.basico).count('molotov')).toBe(2);
    expect(pack(STARTING_THROWABLES.completo).count('grenade')).toBe(GRENADE.max);
  });
});

describe('trayectoria de lanzamiento', () => {
  it('en llano cae justo a la distancia pedida', () => {
    for (const distance of [50, 120, 200]) {
      const v = throwVelocity(distance, 1, GRENADE.arc, GRAVITY);
      expect(landingDistance(v.vx, v.vy, GRAVITY)).toBeCloseTo(distance, 6);
      expect(v.vy).toBeLessThan(0);
    }
  });

  it('desde la mano cae donde apunta el ratón, también hacia la izquierda', () => {
    for (const facing of [1, -1] as const) {
      for (const distance of [60, 110, 180]) {
        const v = throwVelocity(distance * facing, facing, MOLOTOV.arc, GRAVITY, 18);
        const landed = simulateLanding(v.vx, v.vy, 18);
        expect(Math.sign(landed)).toBe(facing);
        // Error de la integración por pasos de 1/60 s: unos pocos píxeles.
        expect(Math.abs(Math.abs(landed) - distance)).toBeLessThan(6);
      }
    }
  });

  it('respeta el alcance mínimo y el máximo', () => {
    const near = throwVelocity(2, 1, GRENADE.arc, GRAVITY);
    const behind = throwVelocity(-80, 1, GRENADE.arc, GRAVITY);
    const far = throwVelocity(5000, 1, GRENADE.arc, GRAVITY);
    expect(landingDistance(near.vx, near.vy, GRAVITY)).toBeCloseTo(GRENADE.arc.minRange, 6);
    expect(landingDistance(behind.vx, behind.vy, GRAVITY)).toBeCloseTo(GRENADE.arc.minRange, 6);
    expect(landingDistance(far.vx, far.vy, GRAVITY)).toBeCloseTo(GRENADE.arc.maxRange, 6);
  });
});

describe('arrojadizos en los datos', () => {
  it('la granada estalla tras su mecha con una explosión mayor que la de un bidón y menor que el cohete', () => {
    expect(GRENADE.fuseMs).toBeGreaterThan(1000);
    expect(GRENADE.fuseMs).toBeLessThan(3000);
    expect(GRENADE.blast.radius).toBeGreaterThan(56);
    expect(GRENADE.blast.playerDamage).toBeLessThan(100);
  });

  it('el molotov arde unos segundos, prende y hace ruido', () => {
    expect(MOLOTOV.fireMs).toBeGreaterThan(3000);
    expect(MOLOTOV.burn.dps).toBeGreaterThan(0);
    expect(MOLOTOV.fireNoise).toBeGreaterThan(0);
    expect(MOLOTOV.shatterNoise).toBeGreaterThan(MOLOTOV.fireNoise);
  });

  it('se consiguen en las cajas de suministros, como piezas comunes', () => {
    for (const def of THROWABLES) {
      const entry = LOOT_TABLE.entries.find((e) => lootId(e.item) === def.id);
      expect(entry, def.id).toBeDefined();
      expect(rarityOf({ kind: 'throwable', throwableId: def.id, count: 1 })).toBe('common');
      expect(throwableById(def.id)).toBe(def);
    }
    const rng = new Rng(9);
    let seen = 0;
    for (let i = 0; i < 300; i++) {
      for (const crate of rollDrop(rng, LOOT_TABLE, 3, { ownedWeapons: new Set(['pistol']), epicGiven: 0, dropsWithoutWeapon: 0 })) {
        seen += crate.items.filter((item) => item.kind === 'throwable').length;
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
});

describe('piezas', () => {
  it('la cartera suma y solo gasta lo que hay', () => {
    const wallet = new ScrapWallet(3);
    expect(wallet.add(4.7)).toBe(4);
    expect(wallet.total).toBe(7);
    expect(wallet.spend(10)).toBe(false);
    expect(wallet.spend(5)).toBe(true);
    expect(wallet.total).toBe(2);
    expect(wallet.add(-3)).toBe(0);
  });

  it('cada enemigo suelta piezas según su regla; los duros, más', () => {
    const rng = new Rng(3);
    const average = (kind: EnemyKind): number => {
      let total = 0;
      for (let i = 0; i < 4000; i++) total += rollScrap(rng, SCRAP_DROPS[kind]);
      return total / 4000;
    };
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      const rule = SCRAP_DROPS[kind];
      const expected = rule.chance * ((rule.amount[0] + rule.amount[1]) / 2);
      expect(average(kind), kind).toBeCloseTo(expected, 0);
    }
    expect(average('mutant')).toBeGreaterThan(average('clicker'));
    expect(average('clicker')).toBeGreaterThan(average('walker'));
    // El mutante siempre suelta.
    for (let i = 0; i < 50; i++) expect(rollScrap(rng, SCRAP_DROPS.mutant)).toBeGreaterThanOrEqual(SCRAP_DROPS.mutant.amount[0]);
  });

  it('se reparte en montoncitos que suman lo mismo', () => {
    expect(splitScrap(0, 3)).toEqual([]);
    expect(splitScrap(1, 3)).toEqual([1]);
    expect(splitScrap(10, 3)).toEqual([4, 3, 3]);
    for (let amount = 1; amount < 30; amount++) {
      const piles = splitScrap(amount, SCRAP.maxPiles);
      expect(piles.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(piles.length).toBeLessThanOrEqual(SCRAP.maxPiles);
      expect(Math.min(...piles)).toBeGreaterThan(0);
    }
  });
});

describe('arte y sonido de los arrojadizos', () => {
  const catalog = buildArtCatalog();

  it('cada arrojadizo gira con cuatro dibujos exactos (giros de 90°) y tiene icono', () => {
    for (const def of THROWABLES) {
      const frames = Array.from({ length: THROW_SPIN_FRAMES }, (_, i) => catalog.sprites.get(`${def.sprite}/${i}`));
      for (const frame of frames) expect(frame, def.id).toBeDefined();
      const counts = frames.map((f) => f!.countOpaque());
      expect(new Set(counts).size).toBe(1);
      expect(frames[1]!.width).toBe(frames[0]!.height);
      expect(catalog.sprites.has(def.icon)).toBe(true);
    }
  });

  it('hay montoncitos de piezas y su icono', () => {
    for (let i = 0; i < SCRAP_VARIANTS; i++) expect(catalog.sprites.has(`pickup/scrap/${i}`)).toBe(true);
    expect(catalog.sprites.has('ui/scrap')).toBe(true);
  });

  it('los sonidos existen, suenan y no saturan', () => {
    for (const sound of [synthThrowSwish(), synthGrenadeBounce(), synthGlassBreak(), synthScrapPickup()]) {
      const peak = sound.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
});
