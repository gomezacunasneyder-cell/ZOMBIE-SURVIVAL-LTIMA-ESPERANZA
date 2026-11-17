import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { DEVOURER_ANIMS, DEVOURER_LOOKS, DEVOURER_STILLS, devourerKey } from '../../src/art/devourerArt';
import { DEVOURER_FRAME, DEVOURER_FRAME_HEIGHT, DEVOURER_GROUND } from '../../src/art/painters/devourer';
import {
  synthBileSplat,
  synthBossDeath,
  synthBossGrowl,
  synthBossHurt,
  synthBossRoar,
  synthBossSlam,
  synthBossSpit,
  synthSpike,
  synthTape,
} from '../../src/audio/synth/boss';
import { BOSS_HAZARDS, BOSS_SUPPLIES, BOSS_TEXT, DEVOURER, MILITARY_RECORDING } from '../../src/content/boss';
import { PLAYER_TUNING, GRAVITY } from '../../src/content/player';
import { GRENADE } from '../../src/content/throwables';
import { BASIC_LOADOUT } from '../../src/content/weapons';
import { DevourerBrain, type BossEvent, type BossSense } from '../../src/core/boss/DevourerBrain';
import { planEruption } from '../../src/core/boss/eruption';
import { Rng } from '../../src/core/math/Rng';
import { FONT_CHARS } from '../../src/art/font';

const ARENA: readonly [number, number] = [40, 1360];

function sense(now: number, over: Partial<BossSense> = {}): BossSense {
  return { now, x: 900, playerX: 700, playerAlive: true, minions: 0, barricadeAhead: null, arena: ARENA, ...over };
}

/** Avanza el cerebro en pasos de 50 ms, moviéndolo como lo haría la escena, y devuelve todos sus sucesos. */
function run(brain: DevourerBrain, from: number, to: number, over: Partial<BossSense> = {}): BossEvent[] {
  const events: BossEvent[] = [];
  let x = over.x ?? 900;
  for (let t = from; t <= to; t += 50) {
    const intent = brain.update(sense(t, { ...over, x }));
    x = Math.max(ARENA[0], Math.min(ARENA[1], x + intent.vx * 0.05));
    events.push(...intent.events);
  }
  return events;
}

/** Cerebro ya en combate (pasada la aparición). */
function fighting(seed = 1): DevourerBrain {
  const brain = new DevourerBrain(DEVOURER, new Rng(seed), 0);
  run(brain, 0, DEVOURER.emergeMs + 50);
  return brain;
}

describe('EL DEVORADOR: fases', () => {
  it('aparece invulnerable y después se le puede herir', () => {
    const brain = new DevourerBrain(DEVOURER, new Rng(1), 0);
    expect(brain.state).toBe('emerging');
    expect(brain.damage(500, 10)).toBe(0);
    const events = run(brain, 0, DEVOURER.emergeMs + 50);
    expect(events.map((e) => e.type)).toContain('emerged');
    expect(brain.damage(100, DEVOURER.emergeMs + 100)).toBe(100);
  });

  it('al 50 % se enfurece (fase 2) y al 25 % entra en frenesí (fase 3); enfurecido no recibe daño', () => {
    const brain = fighting();
    let t = 1000;
    brain.damage(DEVOURER.maxHealth * 0.49, t);
    run(brain, t, t + 200);
    expect(brain.phase).toBe(1);
    brain.damage(DEVOURER.maxHealth * 0.02, t);
    const events = run(brain, t, t + 3000);
    expect(events).toContainEqual({ type: 'enrage', phase: 2 });
    expect(brain.phase).toBe(2);
    // Mientras ruge no le afecta nada.
    const raging = new DevourerBrain(DEVOURER, new Rng(2), 0);
    run(raging, 0, 700);
    raging.damage(DEVOURER.maxHealth * 0.55, 800);
    raging.update(sense(850));
    expect(raging.state).toBe('enrage');
    expect(raging.damage(100, 900)).toBe(0);

    t = 5000;
    brain.damage(DEVOURER.maxHealth * 0.3, t);
    const third = run(brain, t, t + 6000);
    expect(third).toContainEqual({ type: 'enrage', phase: 3 });
    expect(brain.phase).toBe(3);
  });

  it('en la fase 3 lanza la erupción y queda agotado, recibiendo el doble de daño', () => {
    const brain = fighting();
    brain.damage(DEVOURER.maxHealth * 0.8, 1000);
    const events = run(brain, 1000, 1000 + DEVOURER.enrageMs * 2 + 1200);
    const eruption = events.find((e) => e.type === 'eruption');
    expect(eruption).toBeDefined();
    run(brain, 6000, 6000 + DEVOURER.eruption.durationMs + 600);
    expect(brain.state).toBe('exhausted');
    expect(brain.damage(50, 13_000)).toBe(50 * DEVOURER.exhaustedDamage);
    // Se recupera y la siguiente erupción tarda.
    const after = run(brain, 13_000, 13_000 + DEVOURER.exhaustedMs + 200);
    expect(after.map((e) => e.type)).toContain('recovered');
  });

  it('al morir pasa por la agonía y queda muerto; ya no recibe daño', () => {
    const brain = fighting();
    brain.damage(DEVOURER.maxHealth * 2, 1000);
    expect(brain.state).toBe('dying');
    expect(brain.alive).toBe(false);
    const events = run(brain, 1000, 1000 + DEVOURER.dyingMs + 100);
    expect(events.map((e) => e.type)).toEqual(['died', 'dead']);
    expect(brain.damage(100, 9000)).toBe(0);
  });

  it('encaja un respingo (animación de daño) cada vez que pierde un trozo de vida', () => {
    const brain = fighting();
    brain.damage(DEVOURER.maxHealth * DEVOURER.flinchEvery + 1, 900);
    const events = run(brain, 900, 1000);
    expect(events.map((e) => e.type)).toContain('flinch');
  });
});

describe('EL DEVORADOR: ataques', () => {
  it('usa sus cuatro ataques según la distancia y nunca dos a la vez', () => {
    const seen = new Set<string>();
    for (const distance of [40, 150, 260, 500]) {
      const brain = fighting(distance);
      for (const e of run(brain, 700, 60_000, { playerX: 900 - distance })) if (e.type === 'windup') seen.add(e.attack);
    }
    expect([...seen].sort()).toEqual(['charge', 'slam', 'spit', 'summon']);
  });

  it('cada ataque se ve venir: preparación de al menos medio segundo, también enfurecido', () => {
    for (const [name, attack] of Object.entries(DEVOURER.attacks)) {
      expect(attack.windupMs * DEVOURER.enragedTempo, name).toBeGreaterThanOrEqual(500);
      expect(attack.recoverMs * DEVOURER.enragedTempo, name).toBeGreaterThanOrEqual(500);
    }
  });

  it('el golpe contra el suelo, la embestida y el escupitajo producen su suceso', () => {
    // De cerca embiste y golpea el suelo; de lejos escupe.
    const near = run(fighting(3), 700, 90_000, { playerX: 800 });
    const far = run(fighting(3), 700, 20_000, { playerX: 300 });
    const types = new Set([...near, ...far].map((e) => e.type));
    for (const type of ['slam', 'chargeHit', 'spit'] as const) expect(types, type).toContain(type);
  });

  it('no invoca más infectados de la cuenta', () => {
    const brain = fighting(4);
    const events = run(brain, 700, 120_000, { playerX: 500, minions: DEVOURER.summonCap });
    expect(events.some((e) => e.type === 'summon')).toBe(false);
  });

  it('una barricada en pie entre él y Alex la derriba antes de seguir', () => {
    const brain = fighting(5);
    const events = run(brain, 700, 4000, { playerX: 700, barricadeAhead: 790 });
    expect(events).toContainEqual({ type: 'windup', attack: 'smash' });
    expect(events).toContainEqual({ type: 'smash', barricadeX: 790 });
  });

  it('la misma semilla da el mismo combate', () => {
    const a = run(fighting(9), 700, 30_000);
    const b = run(fighting(9), 700, 30_000);
    expect(a).toEqual(b);
  });
});

describe('erupción de espinas', () => {
  it('cubre la arena con oleadas que dejan siempre un hueco seguro', () => {
    const rules = DEVOURER.eruption;
    for (let seed = 0; seed < 40; seed++) {
      const spikes = planEruption(rules, ARENA, 700, new Rng(seed));
      for (let w = 0; w < rules.waves; w++) {
        const start = w * rules.waveGapMs;
        const wave = spikes.filter((s) => s.delayMs >= start && s.delayMs < start + rules.waveGapMs).map((s) => s.x).sort((a, b) => a - b);
        expect(wave.length).toBeGreaterThan(rules.spikesPerWave / 2);
        // Algún hueco entre espinas más ancho que Alex y el ancho de una espina.
        const gaps = wave.slice(1).map((x, i) => x - (wave[i] as number));
        expect(Math.max(...gaps), `semilla ${seed}, oleada ${w}`).toBeGreaterThanOrEqual(rules.safeGap / 2 + BOSS_HAZARDS.spike.width);
      }
      // Todo cabe en la duración de la erupción.
      expect(Math.max(...spikes.map((s) => s.delayMs))).toBeLessThan(rules.durationMs);
    }
  });
});

describe('difícil pero justo', () => {
  it('ningún golpe mata a Alex con la vida llena, ni enfurecido', () => {
    const worst = Math.max(BOSS_HAZARDS.charge.damage, BOSS_HAZARDS.shockwave.damage, BOSS_HAZARDS.spike.damage, BOSS_HAZARDS.bile.damage * 2);
    expect(worst * BOSS_HAZARDS.enragedDamage).toBeLessThan(PLAYER_TUNING.maxHealth * 0.4);
  });

  it('la onda del golpe contra el suelo se puede saltar', () => {
    const jumpHeight = (PLAYER_TUNING.jumpSpeed * PLAYER_TUNING.jumpSpeed) / (2 * GRAVITY);
    expect(jumpHeight).toBeGreaterThan(BOSS_HAZARDS.shockwave.height * 2);
  });

  it('con las armas básicas y los suministros del combate hay munición de sobra si se apunta bien', () => {
    let potential = 0;
    for (const weapon of BASIC_LOADOUT) {
      if (!weapon) continue;
      potential += (weapon.magazineSize + weapon.reserveStart) * weapon.damage * weapon.pellets;
    }
    const grenades = BOSS_SUPPLIES.enrage.filter((i) => i.kind === 'throwable').reduce((n, i) => n + (i.kind === 'throwable' ? i.count : 0), 0);
    potential += grenades * GRENADE.blast.enemyDamage * BOSS_HAZARDS.blastFactor;
    // Basta con acertar menos de la mitad (sin contar las cajas de munición).
    expect(potential / DEVOURER.maxHealth).toBeGreaterThan(2);
    // Pero no se le derriba en un suspiro: hace falta más de un cargador de cada arma.
    const oneMagazineEach = BASIC_LOADOUT.reduce((n, w) => n + (w ? w.magazineSize * w.damage * w.pellets : 0), 0);
    expect(oneMagazineEach).toBeLessThan(DEVOURER.maxHealth);
    for (const which of ['start', 'enrage'] as const) expect(BOSS_SUPPLIES[which].some((i) => i.kind === 'ammo')).toBe(true);
  });
});

describe('arte, sonido y textos del jefe', () => {
  const catalog = buildArtCatalog();

  it('tiene todas sus animaciones en los dos aspectos, en un lienzo de 96 de ancho apoyado en el suelo', () => {
    for (const look of DEVOURER_LOOKS) {
      for (const action of Object.keys(DEVOURER_ANIMS)) {
        const anim = catalog.animations.find((a) => a.key === devourerKey(look, action));
        expect(anim, `${look}/${action}`).toBeDefined();
        for (const frame of anim!.frames) {
          const buf = catalog.sprites.get(frame)!;
          expect(buf.width).toBe(DEVOURER_FRAME);
          expect(buf.height).toBe(DEVOURER_FRAME_HEIGHT);
          // Nada se sale por arriba: los brazos alzados caben.
          expect(buf.bounds().top, frame).toBeGreaterThan(0);
        }
      }
      for (const still of DEVOURER_STILLS) expect(catalog.sprites.has(`${devourerKey(look, still)}/0`), still).toBe(true);
      // Apoya los pies en la fila del suelo.
      expect(catalog.sprites.get(`${devourerKey(look, 'idle')}/0`)!.bounds().bottom).toBeGreaterThanOrEqual(DEVOURER_GROUND);
    }
  });

  it('enfurecido cambia de aspecto', () => {
    const normal = catalog.sprites.get(`${devourerKey('normal', 'idle')}/0`)!;
    const enraged = catalog.sprites.get(`${devourerKey('enraged', 'idle')}/0`)!;
    expect(Buffer.from(normal.data).equals(Buffer.from(enraged.data))).toBe(false);
  });

  it('hay bilis, charco, aviso, espina y onda', () => {
    for (const name of ['boss/bile/0', 'boss/bile-puddle', 'boss/spike-warning/0', 'boss/spike/2', 'boss/shockwave/1']) {
      expect(catalog.sprites.has(name), name).toBe(true);
    }
  });

  it('los sonidos de criatura existen, suenan y no saturan', () => {
    for (const sound of [synthBossRoar(), synthBossGrowl(), synthBossHurt(), synthBossDeath(), synthBossSlam(), synthBossSpit(), synthBileSplat(), synthSpike(), synthTape()]) {
      const peak = sound.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  it('los textos se pueden escribir con la fuente de píxel y caben en la pantalla', () => {
    const texts = [
      BOSS_TEXT.name,
      BOSS_TEXT.title,
      MILITARY_RECORDING.header,
      MILITARY_RECORDING.meta,
      MILITARY_RECORDING.end,
      ...MILITARY_RECORDING.lines,
    ];
    for (const text of texts) {
      for (const ch of text.replace(/ /g, '')) expect(FONT_CHARS.includes(ch.toUpperCase()), `«${ch}» en «${text}»`).toBe(true);
      expect(text.length * 4, text).toBeLessThan(480 - 60);
    }
    // La grabación cuenta el origen del virus y deja abierta la segunda parte.
    const story = MILITARY_RECORDING.lines.join(' ');
    expect(story).toContain('Z-13');
    expect(story).toContain('ORIGEN');
    expect(story).toContain('NO ERA EL UNICO');
  });
});
