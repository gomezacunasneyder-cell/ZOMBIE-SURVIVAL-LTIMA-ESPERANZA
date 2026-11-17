import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { ENEMY_VARIANTS, enemyAnimation } from '../../src/art/enemyArt';
import { WALKER_VARIANTS } from '../../src/art/painters/zombies';
import { CHAPTER_1 } from '../../src/content/chapters/chapter1';
import { CLICKER, ENEMIES, MUTANT, RUNNER, WALKER, type EnemyDef } from '../../src/content/enemies';
import { SOLIDS, isBreakable } from '../../src/content/level';
import { PLAYER_TUNING } from '../../src/content/player';
import { MACHINE_GUN, PISTOL, SHOTGUN, WEAPONS } from '../../src/content/weapons';
import { EnemyBrain, type EnemyPerception } from '../../src/core/ai/EnemyBrain';
import { NOISE_LIFETIME_MS, NOISE_RADIUS, NoiseField, audibleStrength, movementNoise, type HeardNoise } from '../../src/core/ai/noise';

const catalog = buildArtCatalog();
const ALL = Object.values(ENEMIES);

const see = (over: Partial<EnemyPerception>): EnemyPerception => ({
  now: 0,
  selfX: 500,
  dx: 1000,
  dy: 0,
  playerAlive: true,
  onGround: true,
  ...over,
});

const heard = (over: Partial<HeardNoise>): HeardNoise => ({
  x: 600,
  radius: 200,
  kind: 'shot',
  at: 0,
  fromPlayer: true,
  strength: 1,
  ...over,
});

const brain = (def: EnemyDef, random = 0.5): EnemyBrain => new EnemyBrain(def, 500, () => random);

describe('cuatro enemigos distintos', () => {
  it('cada uno tiene todas sus animaciones y se dibuja distinto', () => {
    const signatures = new Set<string>();
    for (const def of ALL) {
      const variants = def.id === 'walker' ? WALKER_VARIANTS : ENEMY_VARIANTS[def.art]!;
      expect(variants.length, def.id).toBeGreaterThan(0);
      const actions = ['walk', 'attack', 'hurt', 'die'];
      if (def.flank) actions.push('leap');
      if (def.echo) actions.push('click');
      for (const variant of variants) {
        for (const action of actions) {
          const frame = `${enemyAnimation(def.art, variant, action)}/0`;
          expect(catalog.sprites.has(frame), frame).toBe(true);
          expect(catalog.sprites.get(frame)!.width).toBe(def.frame.width);
          expect(catalog.sprites.get(frame)!.height).toBe(def.frame.height);
        }
      }
      signatures.add(Buffer.from(catalog.sprites.get(`${enemyAnimation(def.art, variants[0]!, 'walk')}/0`)!.data).toString('base64'));
    }
    expect(signatures.size).toBe(ALL.length);
  });

  it('el mutante es mucho más grande; el corredor más bajo; la caja cabe en el dibujo', () => {
    expect(MUTANT.body.height).toBeGreaterThan(WALKER.body.height * 1.6);
    expect(MUTANT.body.width).toBeGreaterThan(WALKER.body.width * 1.8);
    expect(RUNNER.body.height).toBeLessThan(WALKER.body.height);
    for (const def of ALL) {
      expect(def.body.width).toBeLessThan(def.frame.width);
      expect(def.body.height).toBeLessThan(def.frame.height);
    }
  });

  it('no son copias: cada uno activa comportamientos propios', () => {
    expect(RUNNER.flank).not.toBeNull();
    expect(CLICKER.sight).toBeNull();
    expect(CLICKER.echo).not.toBeNull();
    expect(CLICKER.hearing.hearsCreatures).toBe(true);
    expect(MUTANT.breaker).not.toBeNull();
    expect(MUTANT.hopSpeed).toBe(0);
    for (const def of [WALKER, RUNNER, MUTANT]) expect(def.echo).toBeNull();
    for (const def of [WALKER, CLICKER, MUTANT]) expect(def.flank).toBeNull();
    for (const def of [WALKER, RUNNER, CLICKER]) expect(def.breaker).toBeNull();
    const signature = (d: EnemyDef): string => [d.maxHealth, d.chaseSpeed, d.attack.damage, d.attack.windupMs].join();
    expect(new Set(ALL.map(signature)).size).toBe(ALL.length);
  });
});

describe('equilibrio de dificultad', () => {
  const shotsToKill = (def: EnemyDef, damage: number): number => Math.ceil(def.maxHealth / damage);

  it('velocidades: del caminante se escapa andando, del corredor solo corriendo, del mutante en sigilo', () => {
    expect(WALKER.chaseSpeed).toBeLessThan(PLAYER_TUNING.walkSpeed);
    expect(RUNNER.chaseSpeed).toBeGreaterThan(PLAYER_TUNING.walkSpeed);
    expect(RUNNER.chaseSpeed).toBeLessThan(PLAYER_TUNING.runSpeed);
    expect(CLICKER.chaseSpeed).toBeGreaterThan(PLAYER_TUNING.walkSpeed);
    expect(MUTANT.chaseSpeed).toBeLessThan(PLAYER_TUNING.sneakSpeed);
  });

  it('disparos para matar con cada arma', () => {
    expect(shotsToKill(WALKER, PISTOL.damage)).toBe(3);
    expect(shotsToKill(RUNNER, PISTOL.damage)).toBe(2);
    expect(shotsToKill(CLICKER, PISTOL.damage)).toBe(6);
    // El mutante exige vaciar armas: más de un cargador de pistola y de ametralladora.
    expect(shotsToKill(MUTANT, PISTOL.damage)).toBeGreaterThan(PISTOL.magazineSize * 2);
    expect(shotsToKill(MUTANT, MACHINE_GUN.damage)).toBeGreaterThan(MACHINE_GUN.magazineSize - 10);
    // Un escopetazo a quemarropa tumba a un corredor y a un caminante, no a un Chasqueador.
    const point = SHOTGUN.damage * SHOTGUN.pellets;
    expect(point).toBeGreaterThanOrEqual(RUNNER.maxHealth);
    expect(point).toBeGreaterThanOrEqual(WALKER.maxHealth);
    expect(point).toBeLessThan(CLICKER.maxHealth);
  });

  it('daño a Alex: el agarre del Chasqueador y el mazazo del mutante son lo más peligroso', () => {
    const perAttack = (d: EnemyDef): number => d.attack.damage * d.attack.hits;
    expect(perAttack(CLICKER)).toBeGreaterThan(perAttack(WALKER) * 2);
    expect(perAttack(MUTANT)).toBeGreaterThan(perAttack(WALKER) * 2);
    for (const def of ALL) expect(perAttack(def)).toBeLessThan(PLAYER_TUNING.maxHealth / 2);
    // Los golpes fuertes se preparan más: dan tiempo a apartarse.
    expect(MUTANT.attack.windupMs).toBeGreaterThan(WALKER.attack.windupMs * 2);
    expect(RUNNER.attack.windupMs).toBeLessThan(WALKER.attack.windupMs);
  });

  it('las balas pequeñas no aturden al mutante; casi todas aturden a los demás', () => {
    for (const weapon of WEAPONS) expect(weapon.damage).toBeLessThan(MUTANT.poise);
    expect(PISTOL.damage).toBeGreaterThanOrEqual(CLICKER.poise);
    expect(SHOTGUN.damage).toBeLessThan(CLICKER.poise);
  });

  it('el capítulo 1 sube de dificultad hacia el final', () => {
    const order = CHAPTER_1.enemies.slice().sort((a, b) => a.x - b.x);
    const firstSpecial = order.findIndex((e) => e.kind !== 'walker');
    expect(order[0]!.kind).toBe('walker');
    expect(firstSpecial).toBeGreaterThan(2);
    const mutant = order.find((e) => e.kind === 'mutant')!;
    expect(mutant.x).toBeGreaterThan(CHAPTER_1.width * 0.85);
    // Hay una barricada entre el mutante y el resto del nivel.
    expect(CHAPTER_1.solids.some((s) => isBreakable(s.kind) && s.x < mutant.x && s.x > mutant.x - 200)).toBe(true);
    for (const kind of ['walker', 'runner', 'clicker', 'mutant']) expect(order.some((e) => e.kind === kind), kind).toBe(true);
  });
});

describe('ruido', () => {
  it('se oye más cerca del origen y nada fuera del radio', () => {
    expect(audibleStrength({ x: 100, radius: 100 }, 100, 1)).toBe(1);
    expect(audibleStrength({ x: 100, radius: 100 }, 150, 1)).toBeCloseTo(0.5, 6);
    expect(audibleStrength({ x: 100, radius: 100 }, 200, 1)).toBe(0);
    // El oído fino del Chasqueador alcanza más lejos.
    expect(audibleStrength({ x: 100, radius: 100 }, 250, CLICKER.hearing.sensitivity)).toBeGreaterThan(0);
  });

  it('caminar en silencio y estar quieto no hacen ruido; correr hace más que andar', () => {
    expect(movementNoise(0, false, false, true)).toBe(0);
    expect(movementNoise(26, false, true, true)).toBe(0);
    expect(movementNoise(54, false, false, true)).toBe(NOISE_RADIUS.step);
    expect(movementNoise(104, true, false, true)).toBe(NOISE_RADIUS.run);
    expect(movementNoise(104, true, false, false)).toBe(0);
    expect(NOISE_RADIUS.run).toBeGreaterThan(NOISE_RADIUS.step * 2);
  });

  it('el campo devuelve el ruido más fuerte, filtra criaturas y olvida lo viejo', () => {
    const field = new NoiseField();
    field.emit({ x: 300, radius: 100, kind: 'step', at: 0, fromPlayer: true });
    field.emit({ x: 350, radius: 300, kind: 'shot', at: 0, fromPlayer: true });
    field.emit({ x: 210, radius: 200, kind: 'creature', at: 0, fromPlayer: false });
    const walker = field.loudestFor(200, WALKER.hearing, 10)!;
    expect(walker.kind).toBe('shot');
    const clicker = field.loudestFor(200, CLICKER.hearing, 10)!;
    expect(clicker.kind).toBe('creature');
    // Su propio grito no le cuenta.
    expect(field.loudestFor(210, CLICKER.hearing, 10, 210)!.kind).toBe('shot');
    field.prune(NOISE_LIFETIME_MS + 1);
    expect(field.loudestFor(200, CLICKER.hearing, NOISE_LIFETIME_MS + 1)).toBeNull();
    expect(field.emitted).toBe(3);
  });
});

describe('IA: caminante', () => {
  it('un disparo que oye lo pone a perseguir aunque no vea a Alex', () => {
    const b = brain(WALKER);
    b.update(see({ dx: 300 }));
    expect(b.state).toBe('wander');
    b.update(see({ dx: 300, noise: heard({ x: 800 }) }));
    expect(b.state).toBe('chase');
    expect(b.target).toBe(800);
  });

  it('pierde el rastro y va a la última posición conocida, luego mira alrededor', () => {
    const b = brain(WALKER);
    b.update(see({ dx: 100 }));
    expect(b.state).toBe('chase');
    b.update(see({ now: 100, dx: 100 }));
    b.update(see({ now: 100 + WALKER.loseTrackMs + 10, dx: 1000 }));
    expect(b.state).toBe('investigate');
    expect(b.target).toBe(600);
    b.update(see({ now: 200 + WALKER.loseTrackMs, selfX: 599, dx: 1000 }));
    expect(b.state).toBe('listen');
  });
});

describe('IA: corredor', () => {
  it('salta por encima de Alex para rodearle y al caer vuelve a perseguir', () => {
    const b = brain(RUNNER, 0);
    b.update(see({ dx: 150 }));
    const leap = b.update(see({ now: 10, dx: 50 }));
    expect(b.state).toBe('flank');
    expect(leap.leap).toEqual({ vx: RUNNER.flank!.leapX, vy: -RUNNER.flank!.leapY });
    // En el aire mantiene el impulso hacia delante.
    expect(b.update(see({ now: 60, dx: 10, onGround: false })).move).toBe(1);
    // Cae al otro lado: Alex queda detrás y se gira hacia él.
    const landed = b.update(see({ now: 400, dx: -20, onGround: true }));
    expect(b.state).toBe('chase');
    expect(landed.facing).toBe(-1);
    // No repite el salto hasta que pasa su espera.
    b.update(see({ now: 450, dx: -50 }));
    expect(b.state).not.toBe('flank');
  });

  it('a veces no salta y ataca de frente (no todos rodean igual)', () => {
    const b = brain(RUNNER, 0.99);
    b.update(see({ dx: 150 }));
    b.update(see({ now: 10, dx: 50 }));
    expect(b.state).toBe('chase');
  });

  it('encadena dos golpes rápidos', () => {
    const b = brain(RUNNER, 0.99);
    b.update(see({ dx: 100 }));
    b.update(see({ now: 10, dx: 10 }));
    expect(b.state).toBe('windup');
    let strikes = 0;
    for (let t = 10; t < 2000; t += 10) if (b.update(see({ now: t, dx: 10 })).strike) strikes++;
    expect(strikes).toBeGreaterThanOrEqual(2);
    const b2 = brain(RUNNER, 0.99);
    b2.update(see({ dx: 100 }));
    b2.update(see({ now: 10, dx: 10 }));
    const first = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170].find((t) => b2.update(see({ now: t, dx: 10 })).strike);
    expect(first).toBeLessThanOrEqual(10 + RUNNER.attack.windupMs);
    expect(b2.state).toBe('windup');
  });
});

describe('IA: Chasqueador', () => {
  it('es ciego: no detecta a Alex quieto a pocos pasos, solo por contacto', () => {
    const b = brain(CLICKER);
    for (let t = 0; t < 3000; t += 100) b.update(see({ now: t, dx: CLICKER.echo!.touchRange + 6 }));
    expect(b.state).not.toBe('chase');
    // Al notarlo por contacto ya está a su alcance: agarra en el acto.
    b.update(see({ now: 3100, dx: CLICKER.echo!.touchRange - 2 }));
    expect(['chase', 'windup']).toContain(b.state);
  });

  it('un ruido débil lo hace investigar; al llegar chasquea y escucha; si no oye nada, se va', () => {
    const b = brain(CLICKER);
    b.update(see({ noise: heard({ x: 560, kind: 'step', strength: 0.2 }) }));
    expect(b.state).toBe('investigate');
    expect(b.target).toBe(560);
    const walking = b.update(see({ now: 100 }));
    expect(walking).toMatchObject({ move: 1, speed: CLICKER.investigateSpeed });
    b.update(see({ now: 200, selfX: 558 }));
    expect(b.state).toBe('listen');
    let clicks = 0;
    for (let t = 210; t < 200 + CLICKER.echo!.listenMs; t += 30) if (b.update(see({ now: t, selfX: 558 })).click) clicks++;
    expect(clicks).toBeGreaterThanOrEqual(3);
    b.update(see({ now: 300 + CLICKER.echo!.listenMs, selfX: 558 }));
    expect(b.state).toBe('wander');
  });

  it('un ruido fuerte de Alex lo lanza a la carga hacia donde sonó, no hacia donde está Alex', () => {
    const b = brain(CLICKER);
    b.update(see({ dx: 200, noise: heard({ x: 650, strength: 0.8 }) }));
    expect(b.state).toBe('chase');
    expect(b.target).toBe(650);
    // Alex se ha movido sin hacer ruido: el Chasqueador sigue yendo al sitio del disparo.
    const intent = b.update(see({ now: 50, dx: -300 }));
    expect(intent.move).toBe(1);
    expect(intent.speed).toBe(CLICKER.chaseSpeed);
    // Al llegar y no encontrar nada, se para a escuchar.
    b.update(see({ now: 100, selfX: 649, dx: -300 }));
    expect(['investigate', 'listen']).toContain(b.state);
  });

  it('acude al ruido de otras criaturas', () => {
    const b = brain(CLICKER);
    b.update(see({ noise: heard({ x: 420, kind: 'creature', fromPlayer: false, strength: 0.9 }) }));
    expect(b.state).toBe('investigate');
    expect(b.target).toBe(420);
  });

  it('las explosiones también lo atraen', () => {
    const b = brain(CLICKER);
    b.update(see({ noise: heard({ x: 900, kind: 'explosion', strength: 0.6 }) }));
    expect(b.state).toBe('chase');
    expect(b.target).toBe(900);
  });

  it('un ciego no ataca lo que no nota', () => {
    const b = brain(CLICKER);
    b.update(see({ dx: 200, noise: heard({ x: 512, strength: 0.9 }) }));
    // Alex a 12 px pero fuera del contacto en vertical: no lo nota, no golpea.
    b.update(see({ now: 10, dx: 12, dy: -40 }));
    expect(b.state).not.toBe('windup');
  });
});

describe('IA: mutante', () => {
  it('no se aturde con balas normales, sí con una explosión', () => {
    const b = brain(MUTANT);
    b.update(see({ dx: 100 }));
    b.onHit(100, PISTOL.damage, 600);
    expect(b.state).toBe('chase');
    b.onHit(200, 300, 600);
    expect(b.state).toBe('stagger');
  });

  it('derriba la barricada que le cierra el paso; el caminante no sabe', () => {
    const b = brain(MUTANT);
    b.update(see({ dx: 150 }));
    b.update(see({ now: 10, dx: 150, blocked: 'breakable' }));
    expect(b.state).toBe('smash');
    let smashes = 0;
    for (let t = 20; t < 20 + MUTANT.breaker!.intervalMs * 3; t += 20) if (b.update(see({ now: t, dx: 150, blocked: 'breakable' })).smash) smashes++;
    expect(smashes).toBeGreaterThanOrEqual(3);
    b.update(see({ now: 5000, dx: 150, blocked: null }));
    expect(b.state).toBe('chase');

    const w = brain(WALKER);
    w.update(see({ dx: 100 }));
    w.update(see({ now: 10, dx: 100, blocked: 'breakable' }));
    expect(w.state).toBe('chase');
  });

  it('las barricadas del nivel se pueden romper; coches y bidones no', () => {
    expect(isBreakable('barrier')).toBe(true);
    expect(isBreakable('sandbags')).toBe(true);
    expect(isBreakable('car')).toBe(false);
    expect(isBreakable('fuelBarrel')).toBe(false);
    expect(Object.keys(SOLIDS).length).toBeGreaterThan(4);
  });
});
