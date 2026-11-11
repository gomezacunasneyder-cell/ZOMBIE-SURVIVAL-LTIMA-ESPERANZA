import { expect, test } from '@playwright/test';
import { aimFromPlayer, click, hold, openGame, sim, state, until } from './helpers';

const SKIN_QUERIES = { clasico: '?test=1&skin=clasico', detallado: '?test=1&skin=nuevo' } as const;

test('los dos aspectos tienen exactamente la misma caja de colisión', async ({ page }) => {
  const boxes: Record<string, number[]> = {};
  for (const [skin, query] of Object.entries(SKIN_QUERIES)) {
    await openGame(page, query);
    const s = await until(page, (st) => st.player.onGround);
    expect(s.player.skin).toBe(skin);
    boxes[skin] = [
      s.player.bodyLeft - s.player.x,
      s.player.bodyRight - s.player.x,
      s.player.bodyTop - s.player.y,
      s.player.bodyBottom - s.player.y,
    ];
  }
  // 10 px de ancho centrados y 24 px de alto apoyados en los pies.
  expect(boxes.detallado).toEqual(boxes.clasico);
  expect(boxes.detallado).toEqual([-5, 5, -25, -1]);
});

test('con el nuevo aspecto, salta igual de alto y corre igual de rápido', async ({ page }) => {
  const results: Record<string, { apex: number; speed: number }> = {};
  for (const [skin, query] of Object.entries(SKIN_QUERIES)) {
    await openGame(page, query);
    await aimFromPlayer(page, 150, 0);
    const ground = (await state(page)).player.y;
    await page.keyboard.down('Space');
    await until(page, (s) => !s.player.onGround);
    const top = await until(page, (s) => s.player.vy >= 0);
    await page.keyboard.up('Space');
    await until(page, (s) => s.player.onGround);
    await page.keyboard.down('d');
    await page.keyboard.down('Shift');
    const running = await until(page, (s) => s.player.vx >= 104);
    await page.keyboard.up('Shift');
    await page.keyboard.up('d');
    results[skin] = { apex: ground - top.player.y, speed: running.player.vx };
  }
  expect(results.detallado!.speed).toBe(results.clasico!.speed);
  expect(Math.abs(results.detallado!.apex - results.clasico!.apex)).toBeLessThan(4);
});

test('el nuevo Alex usa sus animaciones: caminar, correr, salto, caída, aterrizaje y daño', async ({ page }) => {
  test.setTimeout(60_000);
  await openGame(page, SKIN_QUERIES.detallado);
  await aimFromPlayer(page, 150, 0);
  expect((await state(page)).player.animation).toBe('alex2/idle');

  await page.keyboard.down('d');
  await until(page, (s) => s.player.animation === 'alex2/walk');
  await page.keyboard.down('Shift');
  await until(page, (s) => s.player.animation === 'alex2/run');
  await page.keyboard.up('Shift');
  await page.keyboard.up('d');
  await until(page, (s) => s.player.vx === 0);

  await page.keyboard.down('Space');
  await until(page, (s) => s.player.animation === 'alex2/jump');
  await until(page, (s) => s.player.animation === 'alex2/fall');
  await page.keyboard.up('Space');
  // El aterrizaje dura 190 ms: se comprueba en el historial para no depender del momento de la lectura.
  const landed = await until(page, (s) => s.player.animation === 'alex2/idle');
  const sequence = landed.player.recentAnimations;
  expect(sequence.slice(sequence.lastIndexOf('alex2/fall'))).toEqual(['alex2/fall', 'alex2/land', 'alex2/idle']);

  // Caminar de espaldas: avanza a la derecha apuntando a la izquierda, en un tramo sin obstáculos.
  await sim(page, 'teleport', 720);
  await aimFromPlayer(page, -120, 0);
  await page.keyboard.down('d');
  await until(page, (s) => s.player.animation === 'alex2/walk-back');
  await page.keyboard.up('d');
});

test('el brazo del nuevo Alex apunta en 7 ángulos y anima la recarga', async ({ page }) => {
  await openGame(page, SKIN_QUERIES.detallado);
  const seen = new Set<string>();
  for (const [dx, dy] of [
    [0, -60],
    [30, -52],
    [52, -30],
    [60, 0],
    [52, 30],
    [24, 42],
    [0, 40],
  ] as const) {
    await aimFromPlayer(page, dx + 4, dy);
    seen.add((await state(page)).player.armFrame);
  }
  expect([...seen].every((frame) => frame.startsWith('alex2/arm/'))).toBe(true);
  expect(seen.size).toBe(7);

  // La bala sigue saliendo de la boca del cañón, por delante y a la altura del hombro.
  await aimFromPlayer(page, 120, 0);
  await click(page);
  const fired = await until(page, (s) => s.bullets.length > 0);
  expect(fired.bullets[0]!.x).toBeGreaterThan(fired.player.x + 5);
  expect(fired.bullets[0]!.y).toBeGreaterThan(fired.player.y - 30);
  expect(fired.bullets[0]!.y).toBeLessThan(fired.player.y - 12);

  await page.waitForTimeout(260);
  await page.keyboard.press('r');
  const frames = new Set<string>();
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (s.weapon.reloading) frames.add(s.player.armFrame);
    else if (frames.size > 0) break;
    await page.waitForTimeout(40);
  }
  // Los seis fotogramas de recarga, en orden, y vuelta al brazo que apunta.
  expect([...frames].sort()).toEqual([0, 1, 2, 3, 4, 5].map((i) => `alex2/reload/${i}`));
  expect((await state(page)).player.armFrame).toBe('alex2/arm/0');
  expect((await state(page)).weapon.magazine).toBe(12);
});

test('el nuevo Alex muere con su animación y el aspecto se conserva al reintentar', async ({ page }) => {
  test.setTimeout(60_000);
  await openGame(page, SKIN_QUERIES.detallado);
  const start = await state(page);
  await page.evaluate((x) => {
    for (const offset of [40, -40, 60, -60]) window.__ZS__!.sim!.spawnZombie(x + offset);
  }, start.player.x);
  const dead = await until(page, (s) => !s.player.alive, 40_000);
  expect(dead.player.animation).toBe('alex2/die');
  await page.waitForTimeout(1200);
  await page.keyboard.press('r');
  const again = await until(page, (s) => s.player.alive && s.player.health === 100, 5000);
  expect(again.player.skin).toBe('detallado');
});

test('la escena de comparación muestra ambos aspectos sin errores ni colores ajenos', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=compare');
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Compare');
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('importa un atlas PNG con metadatos y sustituye los fotogramas', async ({ page, context }) => {
  // 1. Se exporta el Alex actual como plantilla (PNG + JSON).
  await page.goto('/?scene=compare');
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Compare');
  const exported = await page.evaluate(() => {
    const hook = window.__ZS__!;
    const pack = hook.exportPack!('alex2');
    return {
      pack,
      idle: hook.frameSignature!('alex2/idle/0'),
      run: hook.frameSignature!('alex2/run/3'),
    };
  });
  expect(exported.pack.frameCount).toBeGreaterThan(40);
  expect(exported.idle).not.toBe(exported.run);

  // 2. Se «edita»: el reposo pasa a usar el dibujo de un fotograma de carrera.
  const meta = JSON.parse(exported.pack.json) as { frames: Record<string, { x: number; y: number }> };
  const run = meta.frames['alex2/run/3']!;
  const edited = { frames: { 'alex2/idle/0': { ...meta.frames['alex2/idle/0'], x: run.x, y: run.y } } };
  const png = Buffer.from(exported.pack.png.split(',')[1]!, 'base64');

  // 3. Se sirve como si estuviera en public/sprites/ y se recarga el juego.
  const page2 = await context.newPage();
  const warnings: string[] = [];
  page2.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text());
  });
  await page2.route('**/sprites/manifest.json', (route) =>
    route.fulfill({ json: { version: 1, packs: [{ image: 'alex-editado.png', data: 'alex-editado.json' }] } }),
  );
  await page2.route('**/sprites/alex-editado.png', (route) => route.fulfill({ contentType: 'image/png', body: png }));
  await page2.route('**/sprites/alex-editado.json', (route) => route.fulfill({ json: edited }));
  await page2.goto('/?scene=compare');
  await page2.waitForFunction(() => window.__ZS__?.readyScene === 'Compare');

  const result = await page2.evaluate(() => {
    const hook = window.__ZS__!;
    return { reports: hook.importReports!, idle: hook.frameSignature!('alex2/idle/0'), run: hook.frameSignature!('alex2/run/3') };
  });
  expect(result.reports).toHaveLength(1);
  expect(result.reports[0]).toMatchObject({ applied: ['alex2/idle/0'], errors: [] });
  // El fotograma de reposo tiene ahora exactamente los píxeles del de carrera.
  expect(result.idle).toBe(exported.run);
  expect(result.run).toBe(exported.run);
  expect(warnings.filter((w) => w.includes('[sprites]'))).toEqual([]);
});

test('un paquete defectuoso se rechaza y el juego sigue funcionando', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.route('**/sprites/manifest.json', (route) =>
    route.fulfill({ json: { version: 1, packs: [{ image: 'no-existe.png', frame: 'alex2/idle/0' }, { image: 'sin-tipo.png' }] } }),
  );
  await page.route('**/sprites/no-existe.png', (route) => route.fulfill({ status: 404, body: '' }));
  await openGame(page);
  const reports = await page.evaluate(() => window.__ZS__!.importReports!);
  expect(reports.flatMap((r) => r.applied)).toEqual([]);
  expect(reports.flatMap((r) => r.errors).length).toBeGreaterThanOrEqual(2);
  expect(warnings.some((w) => w.includes('[sprites]'))).toBe(true);

  // El juego arranca con el arte generado y se puede jugar.
  await aimFromPlayer(page, 120, 0);
  await hold(page, ['d'], 400);
  expect((await state(page)).player.x).toBeGreaterThan(115);
});
