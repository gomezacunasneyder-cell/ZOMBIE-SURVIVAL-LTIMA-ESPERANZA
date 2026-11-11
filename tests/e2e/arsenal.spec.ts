import { expect, test, type Page } from '@playwright/test';
import { aimFromPlayer, click, openGame, sim, state, until } from './helpers';

/** Cambia de arma con su tecla y espera a que esté desenfundada. */
async function equip(page: Page, key: '1' | '2' | '3' | '4', id: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForFunction((want) => {
    const w = window.__ZS__!.sim!.state().weapon;
    return w.id === want && w.ready;
  }, id);
}

function setAmmo(page: Page, slot: number, magazine: number, reserve: number): Promise<void> {
  return page.evaluate(([s, m, r]) => window.__ZS__!.sim!.setAmmo(s!, m!, r!), [slot, magazine, reserve]);
}

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

function hudTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
}

test.describe('arsenal', () => {
  test('las teclas 1–4 cambian de arma, de dibujo y de HUD', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    const cases = [
      ['2', 'shotgun', 'ESCOPETA', '/12'],
      ['3', 'rifle', 'FUSIL DE ASALTO', '/60'],
      ['4', 'mg', 'AMETRALLADORA', '/120'],
      ['1', 'pistol', 'PISTOLA', '/36'],
    ] as const;
    for (const [key, id, name, reserve] of cases) {
      await equip(page, key, id);
      const s = await state(page);
      expect(s.weapon.name).toBe(name);
      expect(s.player.armFrame).toBe(id === 'pistol' ? 'alex2/arm/0' : `alex2/arm/${id}/0`);
      const texts = await hudTexts(page);
      expect(texts).toContain(name);
      expect(texts).toContain(reserve);
      expect(texts).toContain(String(s.weapon.magazineSize));
    }
  });

  test('mientras se desenfunda no dispara', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await page.keyboard.press('3');
    await until(page, (s) => s.weapon.id === 'rifle' && !s.weapon.ready);
    await click(page);
    await waitGame(page, 60);
    const s = await state(page);
    expect(s.weapon.magazine).toBe(30);
    expect(s.weapon.fired).toBe(0);
  });

  test('la rueda del ratón pasa a la siguiente arma y a la anterior', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await page.mouse.wheel(0, 120);
    await until(page, (s) => s.weapon.id === 'shotgun');
    await waitGame(page, 300);
    await page.mouse.wheel(0, -120);
    await until(page, (s) => s.weapon.id === 'pistol');
  });

  test('pistola: semiautomática, una bala por clic aunque se mantenga el botón', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await page.mouse.down();
    await waitGame(page, 900);
    await page.mouse.up();
    const s = await state(page);
    expect(s.weapon.magazine).toBe(11);
    expect(s.weapon.fired).toBe(1);
  });

  test('escopeta: un cartucho lanza siete perdigones, con bombeo y fogonazo ancho', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await equip(page, '2', 'shotgun');
    await click(page);
    const fired = await until(page, (s) => s.weapon.fired === 1 && s.bullets.length > 0);
    expect(fired.weapon.magazine).toBe(5);
    expect(fired.weapon.reserve).toBe(12);
    const pellets = fired.bullets.filter((b) => b.weapon === 'shotgun');
    expect(pellets).toHaveLength(7);
    // Abanico real: los perdigones no salen todos en la misma dirección.
    const slopes = pellets.map((b) => b.vy / b.vx);
    expect(Math.max(...slopes) - Math.min(...slopes)).toBeGreaterThan(0.15);
    expect(fired.player.flashFrame ?? '').toMatch(/^fx\/flash\/wide\//);
    // Bombeo tras el disparo.
    await until(page, (s) => s.player.armFrame.startsWith('alex2/arm/shotgun-pump/'), 3000);
    // Semiautomática: mantener el botón no vuelve a disparar. Se espera antes su cadencia (800 ms).
    await page.waitForFunction((t) => window.__ZS__!.sim!.state().time - t > 850, fired.time);
    await page.mouse.down();
    await waitGame(page, 1200);
    await page.mouse.up();
    expect((await state(page)).weapon.fired).toBe(2);
    // Alcance corto: ningún perdigón vuela más allá de su alcance.
    const gone = await until(page, (s) => s.bullets.filter((b) => b.weapon === 'shotgun').length === 0, 3000);
    expect(gone.weapon.magazine).toBe(4);
  });

  test('fusil: automático, vacía el cargador bala a bala y recarga de la reserva', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, -10);
    await equip(page, '3', 'rifle');
    await page.mouse.down();
    const midway = await until(page, (s) => s.weapon.fired >= 5);
    expect(midway.weapon.magazine + midway.weapon.fired).toBe(30);
    const empty = await until(page, (s) => s.weapon.magazine === 0, 12000);
    await waitGame(page, 400);
    await page.mouse.up();
    const after = await state(page);
    // Con el cargador vacío el gatillo no gasta reserva ni dispara de más.
    expect(after.weapon).toMatchObject({ magazine: 0, reserve: 60, fired: 30 });
    expect(empty.weapon.reserve).toBe(60);

    await page.keyboard.press('r');
    await until(page, (s) => s.weapon.reloading);
    const done = await until(page, (s) => !s.weapon.reloading, 8000);
    expect(done.weapon).toMatchObject({ magazine: 30, reserve: 30 });
  });

  test('ametralladora: sin reserva no recarga y el cargador no baja de cero', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await equip(page, '4', 'mg');
    await setAmmo(page, 3, 10, 0);
    await page.mouse.down();
    await until(page, (s) => s.weapon.magazine === 0, 8000);
    await waitGame(page, 400);
    await page.mouse.up();
    const dry = await state(page);
    expect(dry.weapon).toMatchObject({ magazine: 0, reserve: 0, fired: 10 });

    await page.keyboard.press('r');
    await waitGame(page, 200);
    expect((await state(page)).weapon.reloading).toBe(false);
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['SIN MUNICION DE RESERVA: CINTA 7.62']));
    await click(page);
    await waitGame(page, 150);
    expect((await state(page)).weapon).toMatchObject({ magazine: 0, reserve: 0, fired: 10 });
  });

  test('cambiar de arma durante la recarga la interrumpe sin perder balas', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await equip(page, '3', 'rifle');
    await setAmmo(page, 2, 5, 60);
    await page.keyboard.press('r');
    await until(page, (s) => s.weapon.reloading);
    await equip(page, '1', 'pistol');
    await waitGame(page, 2200);
    await equip(page, '3', 'rifle');
    const s = await state(page);
    expect(s.weapon).toMatchObject({ magazine: 5, reserve: 60, reloading: false });
  });

  test('las balas van hacia el cursor y la munición de cada arma es independiente', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 140, -35);
    await equip(page, '3', 'rifle');
    await click(page);
    const shot = await until(page, (s) => s.bullets.length > 0);
    const bullet = shot.bullets[0]!;
    const slope = bullet.vy / bullet.vx;
    // Ángulo libre hacia el cursor (unos 14°) con la dispersión del fusil, no los 30° del dibujo.
    expect(slope).toBeLessThan(-0.15);
    expect(slope).toBeGreaterThan(-0.4);
    expect(shot.player.aim).toBe(0);
    const arsenal = shot.arsenal.map((slot) => slot && { id: slot.id, magazine: slot.magazine });
    expect(arsenal).toEqual([
      { id: 'pistol', magazine: 12 },
      { id: 'shotgun', magazine: 6 },
      { id: 'rifle', magazine: 29 },
      { id: 'mg', magazine: 60 },
    ]);
  });

  test('una caja de suministros repone el arma equipada', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await equip(page, '2', 'shotgun');
    await sim(page, 'teleport', 570);
    const s = await until(page, (st) => st.weapon.reserve > 12);
    expect(s.weapon.reserve).toBe(18);
    expect(s.arsenal[0]!.reserve).toBe(36);
  });

  test('los impactos en muros y zombis generan efectos', async ({ page }) => {
    await openGame(page);
    await sim(page, 'spawnZombie', (await state(page)).player.x + 70);
    await aimFromPlayer(page, 70, 8);
    await equip(page, '2', 'shotgun');
    await click(page);
    await until(page, (s) => s.impacts.flesh > 0, 3000);
    // Hacia el suelo: impacto duro.
    await aimFromPlayer(page, 30, 60);
    await equip(page, '1', 'pistol');
    await click(page);
    await until(page, (s) => s.impacts.hard > 0, 3000);
  });
});
