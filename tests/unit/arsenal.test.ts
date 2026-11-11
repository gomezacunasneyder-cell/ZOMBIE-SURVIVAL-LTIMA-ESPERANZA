import { describe, expect, it } from 'vitest';
import { buildArtCatalog, gunFlashFrame } from '../../src/art/catalog';
import { AIM_ANGLES } from '../../src/art/painters/alex';
import { ARM_PIVOT, BULLET_ANGLES, GUNS, bulletAngle, gunArt } from '../../src/art/painters/guns';
import { SKINS, skinArmFrame, skinReloadFrame } from '../../src/art/skins';
import { GUN_VOICES, synthGunshot } from '../../src/audio/synth/gunshot';
import { WALKER } from '../../src/content/enemies';
import {
  ASSAULT_RIFLE,
  MACHINE_GUN,
  PISTOL,
  SHOTGUN,
  STARTING_LOADOUT,
  WEAPONS,
  WEAPON_SLOTS,
  WEAPON_SWITCH_MS,
  type WeaponDef,
} from '../../src/content/weapons';
import { aimAngleTowards, aimDegreesTowards, snapAimAngle } from '../../src/core/combat/aim';
import { Arsenal } from '../../src/core/combat/Arsenal';
import { damageAtDistance, pelletSpreads, shotDirection, travelTimeMs } from '../../src/core/combat/ballistics';
import { WeaponState } from '../../src/core/combat/WeaponState';
import { Rng } from '../../src/core/math/Rng';

const catalog = buildArtCatalog();
const arsenal = (): Arsenal<WeaponDef> => new Arsenal(STARTING_LOADOUT, WEAPON_SWITCH_MS);

describe('definición de las cuatro armas', () => {
  it('las ranuras 1–4 son pistola, escopeta, fusil y ametralladora', () => {
    expect(STARTING_LOADOUT).toHaveLength(WEAPON_SLOTS);
    expect(STARTING_LOADOUT).toEqual([PISTOL, SHOTGUN, ASSAULT_RIFLE, MACHINE_GUN]);
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
  });

  it('cada arma tiene valores propios y coherentes', () => {
    for (const w of WEAPONS) {
      expect(w.magazineSize, w.id).toBeGreaterThan(0);
      expect(w.reserveStart, w.id).toBeLessThanOrEqual(w.reserveMax);
      expect(w.pickupRounds, w.id).toBeGreaterThan(0);
      expect(w.falloffStartPx, w.id).toBeLessThanOrEqual(w.rangePx);
      expect(w.minDamageFactor, w.id).toBeGreaterThan(0);
      expect(w.pellets, w.id).toBeGreaterThanOrEqual(1);
      // Menos de 10 px por fotograma a 60 fps: la bala no atraviesa a un zombi sin tocarlo.
      expect(w.bulletSpeed / 60, w.id).toBeLessThan(10);
      expect(w.recoil.kickPx, w.id).toBeGreaterThan(0);
    }
    // Ninguna pareja de armas comparte daño, cadencia, alcance, cargador y recarga a la vez.
    const signature = (w: WeaponDef): string => [w.damage, w.fireIntervalMs, w.rangePx, w.magazineSize, w.reloadMs].join();
    expect(new Set(WEAPONS.map(signature)).size).toBe(WEAPONS.length);
  });

  it('la escopeta dispara perdigones; fusil y ametralladora son automáticos', () => {
    expect(SHOTGUN.pellets).toBeGreaterThan(1);
    expect(SHOTGUN.automatic).toBe(false);
    expect(PISTOL.automatic).toBe(false);
    expect(ASSAULT_RIFLE.automatic).toBe(true);
    expect(MACHINE_GUN.automatic).toBe(true);
    // Papeles distintos: la ametralladora es la más rápida, la escopeta la de menos alcance.
    expect(MACHINE_GUN.fireIntervalMs).toBeLessThan(ASSAULT_RIFLE.fireIntervalMs);
    expect(Math.min(...WEAPONS.map((w) => w.rangePx))).toBe(SHOTGUN.rangePx);
  });

  it('equilibrio frente al caminante', () => {
    expect(Math.ceil(WALKER.maxHealth / PISTOL.damage)).toBe(3);
    // A quemarropa la escopeta lo tumba de un disparo si entran todos los perdigones…
    expect(SHOTGUN.damage * SHOTGUN.pellets).toBeGreaterThanOrEqual(WALKER.maxHealth);
    // …pero al final de su alcance ni siquiera todos juntos bastan.
    expect(damageAtDistance(SHOTGUN, SHOTGUN.rangePx) * SHOTGUN.pellets).toBeLessThan(WALKER.maxHealth);
  });
});

describe('arte y sonido de cada arma', () => {
  it('toda arma tiene dibujo, icono, voz y fotogramas en los dos aspectos', () => {
    for (const w of WEAPONS) {
      expect(GUNS[w.id], w.id).toBeDefined();
      expect(GUN_VOICES[w.id], w.id).toBeDefined();
      expect(catalog.sprites.has(w.icon), w.icon).toBe(true);
      const gun = gunArt(w.id);
      for (const angle of AIM_ANGLES) {
        for (const skin of Object.values(SKINS)) {
          expect(catalog.sprites.has(skinArmFrame(skin, angle, w.id)), `${skin.id} ${w.id} ${angle}`).toBe(true);
          if (gun.pump) expect(catalog.sprites.has(skinArmFrame(skin, angle, w.id, 'pump'))).toBe(true);
        }
        expect(catalog.sprites.has(gunFlashFrame(gun.flash, 0, angle))).toBe(true);
        expect(catalog.sprites.has(gunFlashFrame(gun.flash, 1, angle))).toBe(true);
      }
      for (let i = 0; i < SKINS.detallado.reloadFrames; i++) {
        expect(catalog.sprites.has(skinReloadFrame(SKINS.detallado, i, w.id)), `${w.id} recarga ${i}`).toBe(true);
      }
    }
  });

  it('la pistola conserva los nombres de fotograma anteriores', () => {
    expect(skinArmFrame(SKINS.detallado, 0)).toBe('alex2/arm/0');
    expect(skinArmFrame(SKINS.detallado, 0, 'pistol')).toBe('alex2/arm/0');
    expect(skinReloadFrame(SKINS.detallado, 2, 'pistol')).toBe('alex2/reload/2');
    expect(skinArmFrame(SKINS.detallado, 30, 'shotgun', 'pump')).toBe('alex2/arm/shotgun-pump/30');
  });

  it('cada arma se dibuja distinta y su cañón llega hasta la boca', () => {
    const signatures = new Set<string>();
    for (const w of WEAPONS) {
      const arm = catalog.sprites.get(skinArmFrame(SKINS.detallado, 0, w.id))!;
      signatures.add(Buffer.from(arm.data).toString('base64'));
      const muzzle = gunArt(w.id).muzzle;
      // A 0° el último píxel del cañón queda justo antes de la boca, a la altura del hombro.
      let reach = 0;
      for (let x = ARM_PIVOT; x < arm.width; x++) {
        for (let y = ARM_PIVOT - 3; y <= ARM_PIVOT; y++) if (arm.get(x, y) !== 0) reach = Math.max(reach, x - ARM_PIVOT);
      }
      expect(reach, w.id).toBeGreaterThanOrEqual(muzzle - 1);
      expect(reach, w.id).toBeLessThanOrEqual(muzzle + 1);
      expect(muzzle, w.id).toBeLessThan(ARM_PIVOT - 1);
    }
    expect(signatures.size).toBe(WEAPONS.length);
  });

  it('el bombeo de la escopeta cambia el dibujo', () => {
    const aim = catalog.sprites.get(skinArmFrame(SKINS.detallado, 0, 'shotgun'))!;
    const pump = catalog.sprites.get(skinArmFrame(SKINS.detallado, 0, 'shotgun', 'pump'))!;
    expect(Buffer.from(aim.data).equals(Buffer.from(pump.data))).toBe(false);
  });

  it('hay bala dibujada cada 5° y el ángulo libre se ajusta a la más cercana', () => {
    for (const angle of BULLET_ANGLES) expect(catalog.sprites.has(`fx/bullet/${angle}`)).toBe(true);
    expect(bulletAngle(12)).toBe(10);
    expect(bulletAngle(13)).toBe(15);
    expect(bulletAngle(-200)).toBe(-90);
  });

  it('cada arma suena distinta', () => {
    const sounds = WEAPONS.map((w, i) => synthGunshot(44100, i + 1, GUN_VOICES[w.id]));
    const lengths = new Set(sounds.map((s) => s.samples.length));
    expect(lengths.size).toBe(WEAPONS.length);
    for (const sound of sounds) {
      const peak = sound.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.3);
      expect(peak).toBeLessThanOrEqual(1);
    }
    // La escopeta es la más larga y la ametralladora la más corta, para que la ráfaga no emborrone.
    const byId = Object.fromEntries(WEAPONS.map((w, i) => [w.id, sounds[i]!.samples.length]));
    expect(byId.shotgun).toBe(Math.max(...lengths));
    expect(byId.mg).toBe(Math.min(...lengths));
  });
});

describe('balística', () => {
  it('los perdigones salen en abanico, uno por perdigón y dentro de la dispersión', () => {
    const rng = new Rng(4);
    for (let round = 0; round < 50; round++) {
      const spreads = pelletSpreads(SHOTGUN.pellets, SHOTGUN.spreadDeg, () => rng.next());
      expect(spreads).toHaveLength(SHOTGUN.pellets);
      const step = (SHOTGUN.spreadDeg * 2) / (SHOTGUN.pellets - 1);
      for (const s of spreads) expect(Math.abs(s)).toBeLessThanOrEqual(SHOTGUN.spreadDeg + step * 0.35);
      // El patrón es siempre ancho: cubre al menos el 80 % del abanico.
      expect(Math.max(...spreads) - Math.min(...spreads)).toBeGreaterThan(SHOTGUN.spreadDeg * 2 * 0.8);
    }
    expect(pelletSpreads(1, 2, () => 0.5)).toEqual([0]);
  });

  it('el daño cae con la distancia solo a partir de su inicio', () => {
    expect(damageAtDistance(SHOTGUN, 0)).toBe(SHOTGUN.damage);
    expect(damageAtDistance(SHOTGUN, SHOTGUN.falloffStartPx)).toBe(SHOTGUN.damage);
    expect(damageAtDistance(SHOTGUN, SHOTGUN.rangePx)).toBeCloseTo(SHOTGUN.damage * SHOTGUN.minDamageFactor, 6);
    expect(damageAtDistance(SHOTGUN, SHOTGUN.rangePx * 5)).toBeCloseTo(SHOTGUN.damage * SHOTGUN.minDamageFactor, 6);
    let previous = Infinity;
    for (let d = 0; d <= SHOTGUN.rangePx; d += 10) {
      const damage = damageAtDistance(SHOTGUN, d);
      expect(damage).toBeLessThanOrEqual(previous);
      previous = damage;
    }
    expect(damageAtDistance(PISTOL, PISTOL.rangePx)).toBe(PISTOL.damage);
  });

  it('el alcance se convierte en tiempo de vuelo', () => {
    expect(travelTimeMs(300, 600)).toBe(500);
    for (const w of WEAPONS) expect(travelTimeMs(w.rangePx, w.bulletSpeed) * (w.bulletSpeed / 1000)).toBeCloseTo(w.rangePx, 6);
  });

  it('las balas van hacia el cursor, no al ángulo del dibujo', () => {
    const free = aimDegreesTowards(100, 100, 200, 80, 1);
    expect(free).toBeCloseTo(11.31, 1);
    expect(snapAimAngle(free)).toBe(aimAngleTowards(100, 100, 200, 80, 1));
    const direction = shotDirection(free, 1);
    expect(direction.y / direction.x).toBeCloseTo(-20 / 100, 6);
    expect(aimDegreesTowards(100, 100, 100, 0, 1)).toBe(90);
    expect(aimDegreesTowards(100, 100, 100, 100, 1)).toBe(0);
  });
});

describe('arsenal', () => {
  it('empieza con la pistola y cambia de arma con espera de desenfundado', () => {
    const a = arsenal();
    expect(a.slot).toBe(0);
    expect(a.current.def).toBe(PISTOL);
    expect(a.select(1, 1000)).toBe('switched');
    expect(a.current.def).toBe(SHOTGUN);
    expect(a.tryFire(1000 + WEAPON_SWITCH_MS - 1)).toBe('switching');
    expect(a.current.magazine).toBe(SHOTGUN.magazineSize);
    expect(a.switchProgress(1000 + WEAPON_SWITCH_MS / 2)).toBeCloseTo(0.5, 5);
    expect(a.tryFire(1000 + WEAPON_SWITCH_MS)).toBe('fired');
    expect(a.current.magazine).toBe(SHOTGUN.magazineSize - 1);
    expect(a.select(1, 5000)).toBe('same');
    expect(a.select(7, 5000)).toBe('invalid');
  });

  it('cada arma conserva su cargador y su reserva al cambiar', () => {
    const a = arsenal();
    let now = 0;
    for (let i = 0; i < 3; i++) {
      a.tryFire(now);
      now += 1000;
    }
    a.select(3, now);
    now += 1000;
    for (let i = 0; i < 10; i++) {
      a.tryFire(now);
      now += 100;
    }
    a.select(0, now);
    expect(a.current.magazine).toBe(PISTOL.magazineSize - 3);
    expect(a.weaponAt(3)!.magazine).toBe(MACHINE_GUN.magazineSize - 10);
    expect(a.weaponAt(1)!.magazine).toBe(SHOTGUN.magazineSize);
    expect(a.weaponAt(2)!.reserve).toBe(ASSAULT_RIFLE.reserveStart);
  });

  it('cambiar de arma interrumpe la recarga sin perder balas', () => {
    const a = arsenal();
    for (let i = 0; i < 5; i++) a.tryFire(i * 1000);
    expect(a.current.startReload(10_000)).toBe('started');
    a.select(2, 10_100);
    a.select(0, 10_500);
    a.update(10_000 + PISTOL.reloadMs * 3);
    expect(a.current.magazine).toBe(PISTOL.magazineSize - 5);
    expect(a.current.reserve).toBe(PISTOL.reserveStart);
    expect(a.current.reloading).toBe(false);
  });

  it('las ranuras vacías no se seleccionan y la rueda las salta', () => {
    const a = new Arsenal<WeaponDef>([PISTOL, null, ASSAULT_RIFLE, null], WEAPON_SWITCH_MS);
    expect(a.select(1, 0)).toBe('empty-slot');
    expect(a.slot).toBe(0);
    expect(a.cycle(1, 0)).toBe('switched');
    expect(a.slot).toBe(2);
    expect(a.cycle(1, 1000)).toBe('switched');
    expect(a.slot).toBe(0);
    expect(a.cycle(-1, 2000)).toBe('switched');
    expect(a.slot).toBe(2);
    expect(() => new Arsenal<WeaponDef>([null, null], 0)).toThrow();
  });

  it('las cajas reponen el arma equipada y, si está llena, la más vacía', () => {
    const a = arsenal();
    a.select(1, 0);
    const first = a.resupply()!;
    expect(first).toMatchObject({ slot: 1, added: SHOTGUN.pickupRounds });
    // Llena la escopeta: la siguiente caja va al arma con la reserva más vacía en proporción.
    a.weaponAt(1)!.addReserve(1000);
    a.weaponAt(2)!.debugSetAmmo(30, 0);
    const second = a.resupply()!;
    expect(second.slot).toBe(2);
    expect(second.added).toBe(ASSAULT_RIFLE.pickupRounds);
    for (let i = 0; i < 4; i++) a.weaponAt(i)!.addReserve(10_000);
    expect(a.resupply()).toBeNull();
  });
});

describe('munición: ninguna bala se crea ni se pierde', () => {
  for (const def of WEAPONS) {
    it(`${def.name}: cargador + reserva + disparadas se conserva`, () => {
      const rng = new Rng(def.id.length * 97);
      const weapon = new WeaponState(def);
      const total = def.magazineSize + def.reserveStart;
      let now = 0;
      for (let step = 0; step < 4000; step++) {
        now += Math.floor(rng.next() * def.fireIntervalMs * 2);
        const roll = rng.next();
        if (roll < 0.8) {
          const before = weapon.magazine;
          const result = weapon.tryFire(now);
          expect(weapon.magazine).toBe(result === 'fired' ? before - 1 : before);
          if (before === 0) expect(result === 'empty' || result === 'reloading' || result === 'cooldown').toBe(true);
        } else if (roll < 0.95) {
          const result = weapon.startReload(now);
          if (weapon.reserve === 0 && !weapon.reloading) expect(result).not.toBe('started');
        } else {
          weapon.cancelReload();
        }
        weapon.update(now);
        expect(weapon.magazine).toBeGreaterThanOrEqual(0);
        expect(weapon.magazine).toBeLessThanOrEqual(def.magazineSize);
        expect(weapon.reserve).toBeGreaterThanOrEqual(0);
        expect(weapon.magazine + weapon.reserve + weapon.fired).toBe(total);
      }
      // Al final de una partida tan larga se ha gastado todo.
      expect(weapon.fired).toBe(total);
    });
  }

  it('sin reserva no se puede recargar y el cargador vacío no dispara', () => {
    for (const def of WEAPONS) {
      const weapon = new WeaponState(def);
      weapon.debugSetAmmo(0, 0);
      expect(weapon.tryFire(1e6)).toBe('empty');
      expect(weapon.startReload(1e6)).toBe('no-reserve');
      expect(weapon.fired).toBe(0);
    }
  });
});
