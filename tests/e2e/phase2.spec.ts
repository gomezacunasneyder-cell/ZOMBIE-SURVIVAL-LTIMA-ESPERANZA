import { expect, test, type Page } from '@playwright/test';
import { aimFromPlayer, click, hold, openGame, sim, state, until } from './helpers';

/** Luminosidad media de una franja horizontal del fotograma (0–1). */
async function bandBrightness(page: Page, fromY: number, toY: number): Promise<number> {
  return page.evaluate(
    ([y0, y1]) =>
      new Promise<number>((resolve) => {
        window.__ZS__!.game.renderer.snapshot((snapshot) => {
          const image = snapshot as HTMLImageElement;
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, y0!, image.width, y1! - y0!);
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) sum += data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
          resolve(sum / (data.length / 4) / 255);
        });
      }),
    [fromY, toY],
  );
}

test('el atardecer da paso a la noche: oscurece, se encienden farolas y cambia la etiqueta', async ({ page }) => {
  await openGame(page, '?test=1&hora=atardecer');
  const dusk = await state(page);
  expect(dusk.night).toBe(0);
  expect(dusk.lampsOn).toBe(0);
  const duskSky = await bandBrightness(page, 20, 90);
  const duskStreet = await bandBrightness(page, 190, 250);

  await page.evaluate(() => window.__ZS__!.sim!.setNight(1));
  const night = await until(page, (s) => s.night === 1 && s.lampsOn === s.lampCount);
  expect(night.lampCount).toBeGreaterThanOrEqual(6);
  await page.waitForTimeout(200);
  const nightSky = await bandBrightness(page, 20, 90);
  const nightStreet = await bandBrightness(page, 190, 250);
  expect(nightSky).toBeLessThan(duskSky * 0.7);
  expect(nightStreet).toBeLessThan(duskStreet);
  // La calle sigue siendo visible de noche: no queda en negro.
  expect(nightStreet).toBeGreaterThan(0.12);

  const labels = await page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
  expect(labels).toContain('NOCHE');
});

test('el ciclo avanza solo con el tiempo de juego', async ({ page }) => {
  await openGame(page);
  const start = (await state(page)).night;
  expect(start).toBe(0);
  // Se acelera fijando valores intermedios y liberando después el ciclo.
  await page.evaluate(() => window.__ZS__!.sim!.setNight(0.5));
  const mid = await until(page, (s) => s.night === 0.5);
  expect(mid.lampsOn).toBeGreaterThan(0);
  await page.evaluate(() => window.__ZS__!.sim!.setNight(null));
  await until(page, (s) => s.night < 0.5);
});

test('un bidón aguanta un disparo, estalla con el segundo y hiere a los zombis cercanos', async ({ page }) => {
  await openGame(page, '?test=1&hora=noche');
  // Bidón en x = 590. Alex fuera del radio y de la vista del caminante, que espera detrás del bidón.
  await sim(page, 'teleport', 420);
  await sim(page, 'spawnZombie', 612);
  await page.waitForTimeout(200);
  const before = await state(page);
  expect(before.explosions.total).toBe(0);

  // Disparo horizontal: la bala sale a la altura del hombro y alcanza el bidón alto.
  await aimFromPlayer(page, 120, 0);
  await click(page);
  await page.waitForTimeout(400);
  const afterFirst = await state(page);
  expect(afterFirst.explosions.total).toBe(0);

  await click(page);
  const boom = await until(page, (s) => s.explosions.total >= 1, 4000);
  expect(boom.explosions.remaining).toBe(before.explosions.remaining - 1);
  const result = await until(page, (s) => s.kills === 1, 3000);
  expect(result.zombies[0]!.alive).toBe(false);
  // Alex está fuera del radio: no recibe daño.
  expect(result.player.health).toBe(100);
});

test('una explosión cercana sacude la cámara y daña a Alex sin matarlo', async ({ page }) => {
  await openGame(page);
  await sim(page, 'teleport', 1140);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__ZS__!.sim!.detonate(1140));
  const shaken = await until(page, (s) => s.shake > 0.3, 2000);
  expect(shaken.player.health).toBeLessThan(100);
  expect(shaken.player.alive).toBe(true);
  // Los dos bidones contiguos estallan en cadena.
  const chain = await until(page, (s) => s.explosions.total >= 2, 2000);
  expect(chain.explosions.total).toBe(2);

  // El desplazamiento nunca pasa de 3 px y la cámara vuelve a su sitio.
  let largest = 0;
  for (let i = 0; i < 15; i++) {
    const s = await state(page);
    largest = Math.max(largest, Math.abs(s.cameraOffset.x), Math.abs(s.cameraOffset.y));
    await page.waitForTimeout(40);
  }
  expect(largest).toBeLessThanOrEqual(3);
  const calm = await until(page, (s) => s.shake === 0, 3000);
  expect(calm.cameraOffset).toEqual({ x: 0, y: 0 });
});

test('la cámara sigue con suavidad, sin saltos bruscos', async ({ page }) => {
  await openGame(page);
  await aimFromPlayer(page, 120, 0);
  await page.keyboard.down('d');
  await page.keyboard.down('Shift');
  let previous = (await state(page)).cameraX;
  let biggestJump = 0;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(50);
    const s = await state(page);
    biggestJump = Math.max(biggestJump, Math.abs(s.cameraX - previous));
    previous = s.cameraX;
  }
  await page.keyboard.up('Shift');
  await page.keyboard.up('d');
  expect(previous).toBeGreaterThan(0);
  // A la carrera (104 px/s) la cámara nunca avanza más de unos pocos píxeles por lectura.
  expect(biggestJump).toBeLessThan(16);
});

test('la pausa detiene el juego y regula música y efectos por separado', async ({ page }) => {
  await openGame(page);
  const start = await state(page);
  const initial = start.audio;

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ZS__!.optionsOpen === true);
  // Con la pausa abierta, Alex no se mueve aunque se pulse D.
  await hold(page, ['d'], 300);
  expect((await state(page)).player.x).toBe(start.player.x);

  // Primera fila: música, bajar dos pasos. Segunda fila: efectos, subir uno.
  // Una persona no pulsa dos veces en el mismo fotograma: se deja un instante entre teclas.
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
  }
  const changed = await state(page);
  expect(changed.audio.music).toBeCloseTo(initial.music - 0.2, 5);
  expect(changed.audio.sfx).toBeCloseTo(Math.min(1, initial.sfx + 0.1), 5);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ZS__!.optionsOpen === false);
  await aimFromPlayer(page, 120, 0);
  await hold(page, ['d'], 400);
  expect((await state(page)).player.x).toBeGreaterThan(start.player.x + 5);

  // Los ajustes se conservan al recargar la página.
  await page.reload();
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Game' && !!window.__ZS__.sim);
  expect((await state(page)).audio).toMatchObject({ music: changed.audio.music, sfx: changed.audio.sfx });
});

test('los bucles de ambiente y música suenan y reaccionan al juego', async ({ page }) => {
  await openGame(page, '?test=1&hora=noche');
  const calm = await until(page, (s) => (s.audio.loops['loop/wind'] ?? 0) > 0.3, 5000);
  expect(Object.keys(calm.audio.loops).sort()).toEqual(
    ['loop/alarm', 'loop/combat', 'loop/helicopter', 'loop/night', 'loop/tension', 'loop/wind'].sort(),
  );
  expect(calm.audio.loops['loop/tension']).toBeGreaterThan(0.3);
  expect(calm.audio.loops['loop/combat']).toBe(0);

  // Cerca de la alarma del campamento, la sirena sube.
  await sim(page, 'teleport', 2172);
  await until(page, (s) => (s.audio.loops['loop/alarm'] ?? 0) > 0.5, 5000);

  // Tres zombis persiguiendo: entra la música de combate.
  for (const offset of [80, 110, 140]) await sim(page, 'spawnZombie', 2172 - offset);
  await until(page, (s) => (s.audio.loops['loop/combat'] ?? 0) > 0.5, 6000);
});

test('ninguna pantalla nueva produce errores en consola', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openGame(page, '?hora=noche');
  await aimFromPlayer(page, 120, 0);
  await hold(page, ['d', 'Shift'], 2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__ZS__!.sim!.detonate(590));
  await page.waitForTimeout(800);
  const fps = await page.evaluate(() => window.__ZS__!.game.loop.actualFps);
  expect(fps).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
