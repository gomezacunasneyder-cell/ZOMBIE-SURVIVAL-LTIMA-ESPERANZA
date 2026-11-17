import { expect, test, type Page } from '@playwright/test';
import { openGame, state, until } from './helpers';

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

function hudTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
}

/** Mata a los enemigos según llegan (como haría un jugador muy bueno). */
async function autoKill(page: Page, on: boolean): Promise<void> {
  await page.evaluate((enable) => {
    const w = window as unknown as { __autokill?: number };
    if (w.__autokill) clearInterval(w.__autokill);
    w.__autokill = enable ? window.setInterval(() => window.__ZS__!.sim!.killAll(), 250) : undefined;
  }, on);
}

/** Tiempo de CPU medio de un fotograma (de `prestep` a `postrender`) durante `ms` de tiempo real. */
function frameCost(page: Page, ms: number): Promise<{ frames: number; avgMs: number; p95Ms: number }> {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const events = window.__ZS__!.game.events;
        const times: number[] = [];
        let start = 0;
        const pre = (): void => void (start = performance.now());
        const post = (): void => void times.push(performance.now() - start);
        events.on('prestep', pre);
        events.on('postrender', post);
        setTimeout(() => {
          events.off('prestep', pre);
          events.off('postrender', post);
          times.sort((a, b) => a - b);
          resolve({
            frames: times.length,
            avgMs: times.reduce((a, b) => a + b, 0) / Math.max(1, times.length),
            p95Ms: times[Math.floor(times.length * 0.95)] ?? 0,
          });
        }, duration);
      }),
    ms,
  );
}

test.describe('modo supervivencia', () => {
  test('oleada 1: aviso, contador, barra, bajas, recompensa y descanso', async ({ page }) => {
    test.setTimeout(120_000);
    await openGame(page, '?modo=oleadas&semilla=2&arsenal=inicial');
    const intro = await state(page);
    expect(intro.survival).toMatchObject({ wave: 1, phase: 'intro', total: 10, remaining: 10 });
    await until(page, (s) => s.survival!.phase === 'intro' && s.survival!.timeLeft < 3000, 5000);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['OLEADA 1', 'CAMINANTES', 'OLEADA 1/5']));

    // Llegan de fuera de la pantalla, sin pasar del tope de la oleada.
    const fighting = await until(page, (s) => s.survival!.phase === 'fighting' && s.alive >= 2, 10_000);
    const camera = fighting.cameraX;
    for (const z of fighting.zombies) expect(z.x < camera + 10 || z.x > camera + 470).toBe(true);
    expect((await hudTexts(page)).some((t) => t.startsWith('ENEMIGOS'))).toBe(true);

    await autoKill(page, true);
    const rest = await until(page, (s) => s.survival!.phase === 'rest', 40_000);
    await autoKill(page, false);
    expect(rest.survival).toMatchObject({ kills: 10, remaining: 0 });
    expect(rest.kills).toBe(10);
    // La recompensa cae en el refugio, cerca de Alex.
    await until(page, (s) => s.airdrop.crates.length === 1, 3000);
    const crate = (await state(page)).airdrop.crates[0]!;
    expect(crate.items[0]).toBe('shotgun');
    expect(Math.abs(crate.x - 700)).toBeLessThan(60);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['OLEADA 1 SUPERADA']));

    // Tras el descanso, la oleada 2.
    await until(page, (s) => s.survival!.wave === 2 && s.survival!.phase === 'intro', 20_000);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['OLEADA 2', '¡LLEGAN LOS CORREDORES!']));
  });

  test('horda final: alarma, luz roja, dos frentes y barricadas atacadas', async ({ page }) => {
    await openGame(page, '?modo=oleadas&semilla=2&oleada=5&hora=noche');
    const alarm = await until(page, (s) => s.survival!.phase === 'alarm' && s.survival!.alert > 0.3, 6000);
    expect(alarm.survival!.horde).toBe('alarm');
    expect(alarm.survival!.danger).toBeGreaterThan(0.5);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['¡ALARMA!']));
    await until(page, (s) => (s.audio.loops['loop/alarm'] ?? 0) > 0.2, 6000);
    // Mientras suena la alarma se preparan los enemigos de antemano.
    const ready = await until(page, (s) => s.pool.pooled >= 60, 8000);

    const horde = await until(page, (s) => s.survival!.phase === 'fighting' && s.alive >= 40, 30_000);
    const refuge = 700;
    expect(horde.zombies.some((z) => z.alive && z.x < refuge)).toBe(true);
    expect(horde.zombies.some((z) => z.alive && z.x > refuge)).toBe(true);
    // Se reutilizan los enemigos preparados: apenas se crean objetos nuevos al llegar la horda.
    expect(horde.pool.created - ready.pool.created).toBeLessThan(15);
    expect(horde.pool.spawned).toBeGreaterThanOrEqual(40);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['HORDA FINAL']));
    // Golpean las dos barricadas en vez de saltarlas.
    const hit = await until(page, (s) => s.barricades.every((b) => b.hits > 0), 30_000);
    expect(hit.alive).toBeLessThanOrEqual(70);
    expect(hit.player.x).toBeGreaterThan(610);
    expect(hit.player.x).toBeLessThan(790);
  });

  test('al terminar la horda llega el jefe y la pantalla final; R vuelve a empezar', async ({ page }) => {
    test.setTimeout(150_000);
    await openGame(page, '?modo=oleadas&semilla=2&oleada=5&hora=noche');
    await until(page, (s) => s.survival!.phase === 'fighting', 15_000);
    await autoKill(page, true);
    const boss = await until(page, (s) => s.survival!.phase === 'boss', 90_000);
    await autoKill(page, false);
    expect(boss.survival).toMatchObject({ kills: 154, remaining: 0, boss: true });
    // La música se apaga, las farolas también y aparece la silueta.
    await until(page, (s) => (s.audio.loops['loop/combat'] ?? 1) < 0.2, 8000);
    await until(page, (s) => s.survival!.bossRevealed, 15_000);
    await page.waitForFunction(() => window.__ZS__!.hudTexts!().some((t) => t.text === 'EL DEVORADOR'), null, { timeout: 5000 });
    await until(page, (s) => s.survival!.finished, 10_000);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['HAS SOBREVIVIDO', 'PULSA R PARA JUGAR DE NUEVO']));
    await page.keyboard.press('r');
    await page.waitForFunction(() => {
      const s = window.__ZS__?.sim?.state();
      return s?.survival?.wave === 5 && s.survival.phase === 'alarm' && s.kills === 0;
    });
  });

  test('si Alex muere en una oleada se puede reintentar', async ({ page }) => {
    await openGame(page, '?modo=oleadas&semilla=2');
    await page.evaluate(() => window.__ZS__!.sim!.hurtPlayer(500));
    await until(page, (s) => !s.player.alive, 2000);
    await waitGame(page, 1000);
    await page.keyboard.press('r');
    await until(page, (s) => s.player.alive && s.survival!.wave === 1, 5000);
  });
});

test('rendimiento: 150 zombis activos dentro del presupuesto de un fotograma', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await openGame(page, '?test=1&hora=noche&semilla=1');
  await page.evaluate(() => window.__ZS__!.sim!.teleport(1200));
  const empty = await frameCost(page, 1500);
  await page.evaluate(() => window.__ZS__!.sim!.stress(150));
  await until(page, (s) => s.alive === 150, 3000);
  await waitGame(page, 1500);
  const crowded = await frameCost(page, 3000);
  const s = await state(page);
  expect(s.alive).toBe(150);
  // El fotograma completo (lógica, física y dibujo) muy por debajo de los 16,7 ms de 60 fps.
  expect(crowded.avgMs).toBeLessThan(8);
  expect(crowded.p95Ms).toBeLessThan(16.7);
  expect(crowded.frames).toBeGreaterThan(60);
  console.log(`150 zombis: ${crowded.avgMs.toFixed(2)} ms de media (p95 ${crowded.p95Ms.toFixed(2)}), sin zombis ${empty.avgMs.toFixed(2)} ms`);
  expect(errors).toEqual([]);
});
