import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { DEVOURER_FRAMES, FORTIFICATION_FRAMES } from '../../src/art/survivalArt';
import { SURVIVAL_ARENA } from '../../src/content/chapters/survival';
import { SOLIDS, hitsToBreak } from '../../src/content/level';
import { SURVIVAL_WAVES, WAVE_TIMING, rewardLoot } from '../../src/content/waves';
import { Rng } from '../../src/core/math/Rng';
import { WaveRun, buildQueue, waveTotal, type WaveDef, type WaveEvent } from '../../src/core/waves/WaveRun';

const kinds = (wave: WaveDef): Set<string> => new Set(wave.groups.map((g) => g.kind));

describe('las cinco oleadas', () => {
  it('la dificultad crece en cada oleada como pide el encargo', () => {
    expect(SURVIVAL_WAVES).toHaveLength(5);
    const [w1, w2, w3, w4, w5] = SURVIVAL_WAVES;
    expect([...kinds(w1!)]).toEqual(['walker']);
    expect(kinds(w2!).has('runner')).toBe(true);
    expect(kinds(w3!).has('clicker')).toBe(true);
    expect(kinds(w4!).has('mutant')).toBe(true);
    expect(w4!.burst).toBeGreaterThanOrEqual(4);
    expect(w5!.final).toBe(true);
    expect(w5!.sides).toBe('both');
    // Más enemigos, más a la vez y más deprisa en cada una.
    for (let i = 1; i < SURVIVAL_WAVES.length; i++) {
      const before = SURVIVAL_WAVES[i - 1]!;
      const wave = SURVIVAL_WAVES[i]!;
      expect(waveTotal(wave), wave.title).toBeGreaterThan(waveTotal(before));
      expect(wave.maxAlive, wave.title).toBeGreaterThan(before.maxAlive);
    }
    // La horda es masiva: más que todas las anteriores juntas.
    const previous = SURVIVAL_WAVES.slice(0, 4).reduce((sum, w) => sum + waveTotal(w), 0);
    expect(waveTotal(w5!)).toBeGreaterThan(previous);
    expect(waveTotal(w5!)).toBeGreaterThanOrEqual(150);
  });

  it('cada oleada menos la horda tiene recompensa y descanso', () => {
    for (const wave of SURVIVAL_WAVES.slice(0, 4)) {
      expect(wave.reward, wave.title).not.toBeNull();
      expect(wave.restMs, wave.title).toBeGreaterThanOrEqual(8000);
      expect(wave.subtitle.length).toBeGreaterThan(0);
    }
    expect(SURVIVAL_WAVES[4]!.reward).toBeNull();
  });

  it('la recompensa trae la primera arma que falta; con todas, munición', () => {
    const reward = SURVIVAL_WAVES[1]!.reward!;
    const loot = rewardLoot(reward, ['pistol']);
    expect(loot.items[0]).toEqual({ kind: 'weapon', weaponId: 'rifle' });
    expect(loot.rarity).toBe('uncommon');
    expect(rewardLoot(reward, ['pistol', 'rifle']).items[0]).toEqual({ kind: 'weapon', weaponId: 'shotgun' });
    const all = rewardLoot(reward, ['pistol', 'rifle', 'shotgun']);
    expect(all.items[0]).toEqual({ kind: 'ammo' });
    expect(all.items).toHaveLength(reward.items.length + 1);
  });
});

describe('cola de llegadas', () => {
  it('conserva el número de cada tipo, deja los duros al final y es reproducible', () => {
    const wave = SURVIVAL_WAVES[4]!;
    const queue = buildQueue(wave, new Rng(3));
    expect(queue).toHaveLength(waveTotal(wave));
    for (const group of wave.groups) expect(queue.filter((k) => k === group.kind)).toHaveLength(group.count);
    const mutants = wave.groups.find((g) => g.kind === 'mutant')!.count;
    expect(queue.slice(-mutants).every((k) => k === 'mutant')).toBe(true);
    expect(buildQueue(wave, new Rng(3))).toEqual(queue);
    expect(buildQueue(wave, new Rng(4))).not.toEqual(queue);
  });
});

/** Simula una partida: los enemigos «mueren» en cuanto llegan, `killDelay` ms después. */
function simulate(startAt = 0, killDelayMs = 400) {
  const run = new WaveRun(SURVIVAL_WAVES, WAVE_TIMING, new Rng(7), 0, startAt);
  const events: (WaveEvent & { at: number })[] = [...run.begin(0).map((e) => ({ ...e, at: 0 }))];
  const pending: number[] = [];
  let maxAlive = 0;
  let maxAliveIndex = 0;
  for (let t = 0; t < 30 * 60_000 && run.phase !== 'done'; t += 50) {
    while (pending.length > 0 && (pending[0] as number) <= t) {
      pending.shift();
      run.onKill();
    }
    for (const e of run.update(t, pending.length)) {
      events.push({ ...e, at: t });
      if (e.type === 'spawn') pending.push(t + killDelayMs);
    }
    if (pending.length > maxAlive) {
      maxAlive = pending.length;
      maxAliveIndex = run.index;
    }
    const wave = run.current;
    expect(pending.length).toBeLessThanOrEqual(wave.maxAlive);
  }
  return { run, events, maxAlive, maxAliveIndex };
}

describe('desarrollo de una partida', () => {
  it('aviso, combate, descanso… alarma, horda, jefe y fin, en ese orden', () => {
    const { run, events } = simulate();
    const flow = events.filter((e) => e.type !== 'spawn').map((e) => (e.type === 'boss' || e.type === 'done' ? e.type : `${e.type}${(e as { wave: number }).wave + 1}`));
    expect(flow).toEqual([
      'intro1', 'fight1', 'cleared1',
      'intro2', 'fight2', 'cleared2',
      'intro3', 'fight3', 'cleared3',
      'intro4', 'fight4', 'cleared4',
      'alarm5', 'fight5', 'cleared5', 'boss', 'done',
    ]);
    expect(run.phase).toBe('done');
    // Todos los enemigos de todas las oleadas llegan.
    const spawns = events.filter((e) => e.type === 'spawn');
    expect(spawns).toHaveLength(SURVIVAL_WAVES.reduce((sum, w) => sum + waveTotal(w), 0));
  });

  it('respeta aviso, descanso, alarma y duración del jefe', () => {
    const { events } = simulate();
    const at = (type: string, wave?: number): number =>
      events.find((e) => e.type === type && (wave === undefined || (e as { wave?: number }).wave === wave))!.at;
    expect(at('fight', 0) - at('intro', 0)).toBeGreaterThanOrEqual(WAVE_TIMING.introMs);
    expect(at('intro', 1) - at('cleared', 0)).toBeGreaterThanOrEqual(SURVIVAL_WAVES[0]!.restMs);
    expect(at('fight', 4) - at('alarm', 4)).toBeGreaterThanOrEqual(WAVE_TIMING.alarmMs);
    expect(at('done') - at('boss')).toBeGreaterThanOrEqual(WAVE_TIMING.bossMs);
  });

  it('la horda entra por los dos lados por igual y en grupos', () => {
    const { events } = simulate(4);
    const spawns = events.filter((e): e is { type: 'spawn'; kind: string; side: -1 | 1; at: number } => e.type === 'spawn');
    const left = spawns.filter((s) => s.side === -1).length;
    expect(Math.abs(left - (spawns.length - left))).toBeLessThanOrEqual(1);
    const sameInstant = new Map<number, number>();
    for (const s of spawns) sameInstant.set(s.at, (sameInstant.get(s.at) ?? 0) + 1);
    expect(Math.max(...sameInstant.values())).toBe(SURVIVAL_WAVES[4]!.burst);
  });

  it('con enemigos que no mueren, nunca hay más vivos que el tope de la oleada', () => {
    const run = new WaveRun(SURVIVAL_WAVES, WAVE_TIMING, new Rng(1), 0, 4);
    run.begin(0);
    let alive = 0;
    for (let t = 0; t < 120_000; t += 50) for (const e of run.update(t, alive)) if (e.type === 'spawn') alive += 1;
    expect(alive).toBe(SURVIVAL_WAVES[4]!.maxAlive);
    expect(run.phase).toBe('fighting');
    expect(run.remaining).toBe(waveTotal(SURVIVAL_WAVES[4]!));
  });

  it('el progreso y los restantes siguen a las bajas; saltar de oleada reinicia la cuenta', () => {
    const run = new WaveRun(SURVIVAL_WAVES, WAVE_TIMING, new Rng(1), 0);
    run.begin(0);
    run.update(WAVE_TIMING.introMs, 0);
    expect(run.phase).toBe('fighting');
    run.onKill();
    run.onKill();
    expect(run.remaining).toBe(waveTotal(SURVIVAL_WAVES[0]!) - 2);
    expect(run.progress).toBeCloseTo(2 / waveTotal(SURVIVAL_WAVES[0]!), 6);
    const events = run.skipTo(4, 100_000);
    expect(events).toEqual([{ type: 'alarm', wave: 4 }]);
    expect(run.phase).toBe('alarm');
    expect(run.kills).toBe(0);
    expect(run.timeLeft(100_000 + 1000)).toBe(WAVE_TIMING.alarmMs - 1000);
  });
});

describe('escenario y arte del modo supervivencia', () => {
  const catalog = buildArtCatalog();
  it('el refugio queda entre dos barricadas reforzadas', () => {
    const forts = SURVIVAL_ARENA.solids.filter((s) => s.kind === 'fortification').map((s) => s.x);
    expect(forts).toHaveLength(2);
    expect(Math.min(...forts)).toBeLessThan(SURVIVAL_ARENA.spawnX);
    expect(Math.max(...forts)).toBeGreaterThan(SURVIVAL_ARENA.spawnX);
    expect(hitsToBreak('fortification', 3)).toBeGreaterThan(hitsToBreak('barrier', 3) * 10);
    expect(SURVIVAL_ARENA.fixtures.filter((f) => f.kind === 'alarm')).toHaveLength(2);
    expect(SURVIVAL_ARENA.enemies).toEqual([]);
  });

  it('todo el arte del modo existe', () => {
    for (const solid of SURVIVAL_ARENA.solids) expect(catalog.sprites.has(SOLIDS[solid.kind].frame)).toBe(true);
    for (const name of [...FORTIFICATION_FRAMES, DEVOURER_FRAMES.dark, DEVOURER_FRAMES.eyes]) expect(catalog.sprites.has(name), name).toBe(true);
    // Los ojos se encienden: los dos fotogramas son distintos.
    const dark = catalog.sprites.get(DEVOURER_FRAMES.dark)!;
    const eyes = catalog.sprites.get(DEVOURER_FRAMES.eyes)!;
    expect(Buffer.from(dark.data).equals(Buffer.from(eyes.data))).toBe(false);
    // La barricada se ve más dañada en cada estado.
    const stages = FORTIFICATION_FRAMES.map((name) => Buffer.from(catalog.sprites.get(name)!.data).toString('base64'));
    expect(new Set(stages).size).toBe(FORTIFICATION_FRAMES.length);
  });
});
