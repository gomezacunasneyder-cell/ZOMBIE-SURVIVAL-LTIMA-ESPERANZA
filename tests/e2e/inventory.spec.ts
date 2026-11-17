import { expect, test, type Page } from '@playwright/test';
import { aimFromPlayer, clearZombies, openGame, sim, state, until } from './helpers';

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

function dropScrap(page: Page, x: number, amount: number): Promise<void> {
  return page.evaluate(([px, n]) => window.__ZS__!.sim!.dropScrap(px!, n!), [x, amount] as const);
}

test.describe('arrojadizos', () => {
  test('en una partida normal no se lleva ninguno: G solo avisa', async ({ page }) => {
    await openGame(page, '?test=1&arsenal=inicial');
    const s = await state(page);
    expect(s.throwables.grenade).toBe(0);
    expect(s.throwables.molotov).toBe(0);
    await page.keyboard.press('g');
    await waitGame(page, 200);
    expect((await state(page)).throwables.thrown).toBe(0);
    const texts = await page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
    expect(texts).toContain('SIN GRANADA');
  });

  test('la granada vuela hacia el ratón, rebota, estalla con la mecha y mata a los cercanos', async ({ page }) => {
    await openGame(page, '?test=1&hora=noche');
    await sim(page, 'teleport', 300);
    await clearZombies(page);
    const before = await state(page);
    expect(before.throwables.grenade).toBe(2);
    await aimFromPlayer(page, 110, 10);
    await page.keyboard.press('g');
    const flying = await until(page, (s) => s.throwables.flying.length === 1);
    expect(flying.throwables.grenade).toBe(1);
    // Sale de la mano, por encima de los pies de Alex.
    expect(flying.throwables.flying[0]!.y).toBeLessThan(flying.player.y);

    // Cae cerca de donde se apuntó y rueda un poco.
    await until(page, (s) => s.throwables.flying.length === 1 && s.throwables.flying[0]!.y > 214);
    await waitGame(page, 450);
    const resting = await state(page);
    expect(resting.throwables.exploded).toBe(0);
    const landedX = resting.throwables.flying[0]!.x;
    expect(landedX).toBeGreaterThan(before.player.x + 80);
    expect(landedX).toBeLessThan(before.player.x + 150);
    // Dos zombis llegan junto a la granada justo antes de que estalle.
    await page.evaluate((x) => {
      window.__ZS__!.sim!.spawnZombie(x - 10);
      window.__ZS__!.sim!.spawnZombie(x + 12);
    }, landedX);
    const blown = await until(page, (s) => s.throwables.exploded === 1, 6000);
    expect(blown.throwables.flying.length).toBe(0);
    expect(blown.explosions.total).toBeGreaterThanOrEqual(1);
    await until(page, (s) => s.zombies.filter((z) => z.alive).length === 0, 3000);
    // La explosión se oye: cuenta como ruido de Alex.
    expect(blown.noise.emitted).toBeGreaterThan(before.noise.emitted);
  });

  test('el molotov se rompe, deja un charco de fuego que prende a los zombis y se apaga', async ({ page }) => {
    await openGame(page, '?test=1&hora=noche');
    await sim(page, 'teleport', 300);
    await clearZombies(page);
    await sim(page, 'spawnZombie', 400);
    await aimFromPlayer(page, 100, 10);
    await page.keyboard.press('f');
    const lit = await until(page, (s) => s.throwables.fires === 1, 5000);
    expect(lit.throwables.molotov).toBe(1);
    expect(lit.throwables.flying.length).toBe(0);
    await until(page, (s) => s.burning >= 1, 3000);
    // El fuego dura unos segundos y se apaga solo.
    await until(page, (s) => s.throwables.fires === 0, 10_000);
  });

  test('no se puede lanzar mientras se cura', async ({ page }) => {
    await openGame(page, '?test=1');
    await page.evaluate(() => window.__ZS__!.sim!.hurtPlayer(40));
    await page.keyboard.press('q');
    await until(page, (s) => s.medkits.using);
    await page.keyboard.press('g');
    await waitGame(page, 150);
    expect((await state(page)).throwables.thrown).toBe(0);
  });
});

test.describe('piezas', () => {
  test('el mutante suelta piezas al morir y Alex las recoge al pasar', async ({ page }) => {
    await openGame(page, '?test=1');
    await sim(page, 'teleport', 300);
    await clearZombies(page);
    // Un mutante siempre suelta piezas.
    await page.evaluate(() => window.__ZS__!.sim!.spawnZombie(380, 'mutant'));
    await page.evaluate(() => window.__ZS__!.sim!.killAll());
    const dropped = await until(page, (s) => s.scrap.onGround > 0);
    expect(dropped.scrap.dropped).toBeGreaterThanOrEqual(8);
    expect(dropped.scrap.total).toBe(0);
    await sim(page, 'teleport', 384);
    const picked = await until(page, (s) => s.scrap.onGround === 0, 4000);
    expect(picked.scrap.total).toBe(dropped.scrap.dropped);
  });

  test('desde un poco más lejos las piezas vuelan hacia Alex', async ({ page }) => {
    await openGame(page, '?test=1');
    await sim(page, 'teleport', 300);
    await dropScrap(page, 326, 3);
    const s = await until(page, (st) => st.scrap.total === 3, 4000);
    expect(s.scrap.onGround).toBe(0);
  });
});

test.describe('inventario', () => {
  test('Tab lo abre con el juego en pausa, muestra el equipo y permite cambiar de arma', async ({ page }) => {
    await openGame(page, '?test=1');
    await dropScrap(page, (await state(page)).player.x + 2, 5);
    await until(page, (s) => s.scrap.total === 5, 4000);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__ZS__!.inventoryOpen === true);
    const frozen = (await state(page)).time;
    await page.waitForTimeout(300);
    expect((await state(page)).time).toBe(frozen);

    // Con el número de ranura se equipa y se vuelve al juego.
    await page.keyboard.press('3');
    await page.waitForFunction(() => window.__ZS__!.inventoryOpen === false);
    await until(page, (s) => s.weapon.id === 'rifle' && s.time > 0);

    // Se vuelve a abrir y se cierra con Tab; no se reabre sola.
    await page.waitForTimeout(250);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__ZS__!.inventoryOpen === true);
    await page.waitForTimeout(250);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__ZS__!.inventoryOpen === false);
    const after = (await state(page)).time;
    await waitGame(page, 300);
    expect((await state(page)).time).toBeGreaterThan(after);
    expect(await page.evaluate(() => window.__ZS__!.inventoryOpen)).toBe(false);
  });
});
