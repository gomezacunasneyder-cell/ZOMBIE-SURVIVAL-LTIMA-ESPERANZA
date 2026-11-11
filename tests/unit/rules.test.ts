import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../../src/content/chapters/chapter1';
import { WALKER } from '../../src/content/enemies';
import { SOLIDS, zoneAt } from '../../src/content/level';
import { PLAYER_TUNING, GRAVITY } from '../../src/content/player';
import { PISTOL, STARTING_LOADOUT, WEAPON_SLOTS } from '../../src/content/weapons';
import { buildArtCatalog } from '../../src/art/catalog';
import { WalkerBrain, type WalkerPerception } from '../../src/core/ai/WalkerBrain';
import { shotDirection, spreadFrom } from '../../src/core/combat/ballistics';
import { Health } from '../../src/core/combat/Health';
import { WeaponState } from '../../src/core/combat/WeaponState';
import { EventBus } from '../../src/core/events/EventBus';
import { JumpController, approach, stepHorizontalVelocity, targetSpeed } from '../../src/core/player/motion';

describe('vida', () => {
  it('pierde vida sin bajar de cero y muere', () => {
    const health = new Health(100);
    expect(health.damage(30, 0)).toBe(true);
    expect(health.current).toBe(70);
    health.damage(500, 1);
    expect(health.current).toBe(0);
    expect(health.dead).toBe(true);
    expect(health.damage(10, 2)).toBe(false);
  });

  it('ignora los golpes durante la invulnerabilidad', () => {
    const health = new Health(100, 750);
    expect(health.damage(15, 1000)).toBe(true);
    expect(health.damage(15, 1500)).toBe(false);
    expect(health.isInvulnerable(1749)).toBe(true);
    expect(health.damage(15, 1750)).toBe(true);
    expect(health.current).toBe(70);
  });

  it('cura sin superar el máximo y no resucita', () => {
    const health = new Health(100);
    health.damage(20, 0);
    expect(health.heal(50)).toBe(20);
    expect(health.current).toBe(100);
    health.damage(100, 1);
    expect(health.heal(10)).toBe(0);
    expect(() => new Health(0)).toThrow();
  });
});

describe('arma', () => {
  const fresh = (): WeaponState => new WeaponState(PISTOL);

  it('cada disparo descuenta una bala y respeta la cadencia', () => {
    const weapon = fresh();
    expect(weapon.tryFire(0)).toBe('fired');
    expect(weapon.magazine).toBe(PISTOL.magazineSize - 1);
    expect(weapon.tryFire(PISTOL.fireIntervalMs - 1)).toBe('cooldown');
    expect(weapon.magazine).toBe(PISTOL.magazineSize - 1);
    expect(weapon.tryFire(PISTOL.fireIntervalMs)).toBe('fired');
  });

  it('no dispara con el cargador vacío', () => {
    const weapon = fresh();
    let now = 0;
    for (let i = 0; i < PISTOL.magazineSize; i++) {
      expect(weapon.tryFire(now)).toBe('fired');
      now += PISTOL.fireIntervalMs;
    }
    expect(weapon.magazine).toBe(0);
    expect(weapon.tryFire(now)).toBe('empty');
    expect(weapon.reserve).toBe(PISTOL.reserveStart);
  });

  it('la recarga dura lo indicado, bloquea el disparo y mueve balas de la reserva', () => {
    const weapon = fresh();
    for (let i = 0; i < 5; i++) weapon.tryFire(i * 1000);
    expect(weapon.startReload(10_000)).toBe('started');
    expect(weapon.startReload(10_001)).toBe('already');
    expect(weapon.tryFire(10_100)).toBe('reloading');
    expect(weapon.update(10_000 + PISTOL.reloadMs - 1)).toBe(false);
    expect(weapon.reloadProgress(10_000 + PISTOL.reloadMs / 2)).toBeCloseTo(0.5, 5);
    expect(weapon.update(10_000 + PISTOL.reloadMs)).toBe(true);
    expect(weapon.magazine).toBe(PISTOL.magazineSize);
    expect(weapon.reserve).toBe(PISTOL.reserveStart - 5);
    expect(weapon.reloadProgress(20_000)).toBeNull();
  });

  it('no recarga si está lleno o sin reserva, y la reserva escasa llena solo en parte', () => {
    expect(fresh().startReload(0)).toBe('full');
    const weapon = new WeaponState({ ...PISTOL, reserveStart: 3 });
    for (let i = 0; i < PISTOL.magazineSize; i++) weapon.tryFire(i * 1000);
    weapon.startReload(50_000);
    weapon.update(50_000 + PISTOL.reloadMs);
    expect(weapon.magazine).toBe(3);
    expect(weapon.reserve).toBe(0);
    weapon.tryFire(60_000);
    expect(weapon.startReload(61_000)).toBe('no-reserve');
  });

  it('cancelar la recarga no mueve balas; la reserva tiene tope', () => {
    const weapon = fresh();
    weapon.tryFire(0);
    weapon.startReload(1000);
    weapon.cancelReload();
    expect(weapon.update(99_000)).toBe(false);
    expect(weapon.magazine).toBe(PISTOL.magazineSize - 1);
    expect(weapon.addReserve(1000)).toBe(PISTOL.reserveMax - PISTOL.reserveStart);
    expect(weapon.addReserve(5)).toBe(0);
  });
});

describe('balística', () => {
  it('convierte ángulo y orientación en una dirección unitaria', () => {
    expect(shotDirection(0, 1)).toEqual({ x: 1, y: -0 });
    const up = shotDirection(90, 1);
    expect(up.x).toBeCloseTo(0, 9);
    expect(up.y).toBeCloseTo(-1, 9);
    const diagonalLeft = shotDirection(30, -1);
    expect(diagonalLeft.x).toBeCloseTo(-Math.cos(Math.PI / 6), 9);
    expect(diagonalLeft.y).toBeCloseTo(-0.5, 9);
    const down = shotDirection(-90, 1);
    expect(down.y).toBeCloseTo(1, 9);
    for (const aim of [90, 60, 30, 0, -30, -60, -90] as const) {
      const d = shotDirection(aim, 1, 1.2);
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 9);
    }
  });

  it('la dispersión queda dentro del máximo', () => {
    expect(spreadFrom(0, 2)).toBe(-2);
    expect(spreadFrom(0.5, 2)).toBe(0);
    expect(spreadFrom(1, 2)).toBe(2);
  });
});

describe('movimiento', () => {
  const t = PLAYER_TUNING;
  const walk = { direction: 1 as const, running: false, facing: 1 as const, onGround: true };

  it('`approach` no se pasa del objetivo', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(0, -10, 3)).toBe(-3);
  });

  it('camina, corre y retrocede a velocidades distintas', () => {
    expect(targetSpeed(walk, t)).toBe(t.walkSpeed);
    expect(targetSpeed({ ...walk, running: true }, t)).toBe(t.runSpeed);
    expect(t.runSpeed).toBeGreaterThan(t.walkSpeed * 1.5);
    // De espaldas a donde apunta: más lento y sin correr.
    const backwards = targetSpeed({ ...walk, direction: -1, running: true }, t);
    expect(backwards).toBe(-t.walkSpeed * t.backwardFactor);
    expect(targetSpeed({ ...walk, direction: 0 }, t)).toBe(0);
  });

  it('acelera de forma gradual hasta la velocidad máxima y frena hasta parar', () => {
    let v = 0;
    const dt = 1 / 60;
    v = stepHorizontalVelocity(v, walk, dt, t);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(t.walkSpeed);
    for (let i = 0; i < 60; i++) v = stepHorizontalVelocity(v, walk, dt, t);
    expect(v).toBe(t.walkSpeed);
    const coasting = stepHorizontalVelocity(v, { ...walk, direction: 0 }, dt, t);
    expect(coasting).toBeLessThan(v);
    expect(coasting).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) v = stepHorizontalVelocity(v, { ...walk, direction: 0 }, dt, t);
    expect(v).toBe(0);
  });

  it('en el aire se controla menos que en el suelo', () => {
    const ground = stepHorizontalVelocity(0, walk, 0.05, t);
    const air = stepHorizontalVelocity(0, { ...walk, onGround: false }, 0.05, t);
    expect(air).toBeLessThan(ground);
    expect(air).toBeGreaterThan(0);
  });

  it('el salto alcanza para subirse a un coche pero no es desmesurado', () => {
    const apex = t.jumpSpeed ** 2 / (2 * GRAVITY);
    expect(apex).toBeGreaterThan(SOLIDS.car.height + 8);
    expect(apex).toBeLessThan(60);
  });
});

describe('salto', () => {
  const make = (): JumpController => new JumpController(PLAYER_TUNING);

  it('salta al pulsar en el suelo y no vuelve a saltar en el aire', () => {
    const jump = make();
    expect(jump.update(0, true, true, true, 0).jump).toBe(true);
    expect(jump.update(16, false, false, true, -200).jump).toBe(false);
    expect(jump.update(200, false, true, true, -50).jump).toBe(false);
  });

  it('recorta la subida al soltar el botón, una sola vez', () => {
    const jump = make();
    jump.update(0, true, true, true, 0);
    expect(jump.update(50, false, false, true, -200).cut).toBe(false);
    expect(jump.update(66, false, false, false, -180).cut).toBe(true);
    expect(jump.update(82, false, false, false, -80).cut).toBe(false);
  });

  it('permite saltar un instante después de dejar el suelo (coyote)', () => {
    const jump = make();
    jump.update(0, true, false, false, 0);
    expect(jump.update(PLAYER_TUNING.coyoteMs - 10, false, true, true, 30).jump).toBe(true);
    const late = make();
    late.update(0, true, false, false, 0);
    expect(late.update(PLAYER_TUNING.coyoteMs + 30, false, true, true, 60).jump).toBe(false);
  });

  it('recuerda una pulsación hecha justo antes de aterrizar', () => {
    const jump = make();
    jump.update(0, false, false, false, 200);
    expect(jump.update(100, false, true, true, 220).jump).toBe(false);
    expect(jump.update(100 + PLAYER_TUNING.jumpBufferMs - 20, true, false, true, 0).jump).toBe(true);
    const stale = make();
    stale.update(0, false, true, true, 200);
    expect(stale.update(PLAYER_TUNING.jumpBufferMs + 50, true, false, false, 0).jump).toBe(false);
  });
});

describe('cerebro del caminante', () => {
  const brain = (): WalkerBrain => new WalkerBrain(WALKER, 500, () => 0.5);
  const see = (over: Partial<WalkerPerception>): WalkerPerception => ({
    now: 0,
    selfX: 500,
    dx: 1000,
    dy: 0,
    playerAlive: true,
    ...over,
  });

  it('deambula despacio cerca de su sitio si no ve a Alex', () => {
    const b = new WalkerBrain(WALKER, 500, () => 1);
    const intent = b.update(see({}));
    expect(b.state).toBe('wander');
    expect(intent.speed).toBe(WALKER.wanderSpeed);
    expect(intent.move).toBe(1);
    expect(intent.strike).toBe(false);
  });

  it('detecta a Alex dentro de su alcance de visión y lo persigue', () => {
    const b = brain();
    b.update(see({ dx: WALKER.sightRange + 10 }));
    expect(b.state).toBe('wander');
    const intent = b.update(see({ dx: -(WALKER.sightRange - 10) }));
    expect(b.state).toBe('chase');
    expect(intent).toMatchObject({ move: -1, speed: WALKER.chaseSpeed, facing: -1 });
  });

  it('no lo ve si está muy por encima', () => {
    const b = brain();
    b.update(see({ dx: 40, dy: -(WALKER.sightHeight + 20) }));
    expect(b.state).toBe('wander');
  });

  it('prepara el golpe, lo descarga una vez y se recupera', () => {
    const b = brain();
    b.update(see({ dx: 100 }));
    const stop = b.update(see({ now: 100, dx: WALKER.attackRange - 1 }));
    expect(b.state).toBe('windup');
    expect(stop.move).toBe(0);
    expect(b.update(see({ now: 100 + WALKER.windupMs - 1, dx: 10 })).strike).toBe(false);
    expect(b.update(see({ now: 100 + WALKER.windupMs, dx: 10 })).strike).toBe(true);
    expect(b.state).toBe('recover');
    const after = 100 + WALKER.windupMs;
    expect(b.update(see({ now: after + 10, dx: 10 })).strike).toBe(false);
    b.update(see({ now: after + WALKER.recoverMs, dx: 60 }));
    expect(b.state).toBe('chase');
  });

  it('un impacto lo aturde y después persigue aunque no viera a Alex', () => {
    const b = brain();
    b.update(see({}));
    b.onHit(1000);
    expect(b.state).toBe('stagger');
    expect(b.update(see({ now: 1050 })).move).toBe(0);
    b.update(see({ now: 1000 + WALKER.staggerMs }));
    expect(b.state).toBe('chase');
  });

  it('el ruido lo alerta; muerto no hace nada; sin Alex vuelve a deambular', () => {
    const b = brain();
    b.update(see({}));
    b.alert();
    expect(b.state).toBe('chase');
    b.update(see({ playerAlive: false }));
    expect(b.state).toBe('wander');
    b.kill();
    const intent = b.update(see({ dx: 5 }));
    expect(intent).toMatchObject({ move: 0, strike: false });
    b.onHit(5);
    expect(b.state).toBe('dead');
  });
});

describe('bus de eventos', () => {
  it('entrega los eventos y permite darse de baja', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    const seen: number[] = [];
    const off = bus.on('ping', (e) => seen.push(e.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([1]);
  });
});

describe('datos del capítulo 1', () => {
  const level = CHAPTER_1;
  const catalog = buildArtCatalog();

  it('es más largo que la pantalla y todo queda dentro de sus límites', () => {
    expect(level.width).toBeGreaterThanOrEqual(480 * 4);
    const xs = [
      level.spawnX,
      ...level.solids.map((s) => s.x),
      ...level.decor.map((d) => d.x),
      ...level.fixtures.map((f) => f.x),
      ...level.walkers,
      ...level.pickups,
    ];
    for (const x of xs) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(level.width);
    }
  });

  it('solo usa sprites que existen', () => {
    for (const item of level.decor) expect(catalog.sprites.has(item.frame), item.frame).toBe(true);
    for (const solid of Object.values(SOLIDS)) expect(catalog.sprites.has(solid.frame), solid.frame).toBe(true);
    for (const weapon of STARTING_LOADOUT) if (weapon) expect(catalog.sprites.has(weapon.icon)).toBe(true);
  });

  it('no hay enemigos ni obstáculos encima del punto de partida', () => {
    for (const x of level.walkers) expect(Math.abs(x - level.spawnX)).toBeGreaterThan(WALKER.sightRange);
    for (const solid of level.solids) expect(Math.abs(solid.x - level.spawnX)).toBeGreaterThan(60);
  });

  it('las zonas cubren el nivel en orden', () => {
    expect(level.zones[0]!.from).toBe(0);
    const starts = level.zones.map((z) => z.from);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(zoneAt(level, 0).name).toBe('AVENIDA CENTRAL');
    expect(zoneAt(level, level.width - 1).name).toBe('CAMPAMENTO');
  });

  it('las ranuras de arma están preparadas y la pistola es coherente', () => {
    expect(STARTING_LOADOUT).toHaveLength(WEAPON_SLOTS);
    expect(STARTING_LOADOUT[0]).toBe(PISTOL);
    expect(PISTOL.reserveMax).toBeGreaterThanOrEqual(PISTOL.reserveStart);
    // Una bala no puede saltarse a un zombi de 10 px entre dos pasos de física.
    expect(PISTOL.bulletSpeed / 60).toBeLessThan(10);
    expect(Math.ceil(WALKER.maxHealth / PISTOL.damage)).toBe(3);
  });
});
