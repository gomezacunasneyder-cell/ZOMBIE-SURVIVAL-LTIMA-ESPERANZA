import { expect, test, type Page } from '@playwright/test';
import { holdGame, openGame, state, until } from './helpers';

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

function hudTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
}

function damageBoss(page: Page, amount: number): Promise<number> {
  return page.evaluate((n) => window.__ZS__!.sim!.damageBoss(n), amount);
}

/** Abre directamente el combate (`?modo=jefe`) y espera a que empiece. */
async function openFight(page: Page): Promise<void> {
  await openGame(page, '?modo=jefe&hora=noche&semilla=3');
  // Pasada la aparición (unos instantes en que no se le puede herir).
  await until(page, (s) => s.survival?.fight?.stage === 'fight' && s.survival.fight.state !== 'emerging', 25_000);
}

test.describe('EL DEVORADOR', () => {
  test('presentación: silencio, los zombis huyen, surge del humo, nombre y Cóndor 7 deja munición', async ({ page }) => {
    test.setTimeout(60_000);
    await openGame(page, '?modo=jefe&hora=noche&semilla=3');
    const intro = await until(page, (s) => s.survival?.fight?.stage === 'intro', 25_000);
    expect(intro.survival!.phase).toBe('boss');
    // Llegan rezagados… y huyen sin contar como bajas.
    await until(page, (s) => s.alive >= 4, 5000);
    // Alex no se controla durante la presentación.
    const x = (await state(page)).player.x;
    await holdGame(page, ['d'], 400);
    expect(Math.abs((await state(page)).player.x - x)).toBeLessThan(2);
    await until(page, (s) => s.alive === 0, 12_000);
    expect((await state(page)).kills).toBe(0);
    // La música calla, el suelo tiembla y el jefe sale del humo.
    await until(page, (s) => (s.audio.loops['loop/combat'] ?? 1) < 0.2, 5000);
    await until(page, (s) => s.survival!.bossRevealed, 12_000);
    await page.waitForFunction(() => window.__ZS__!.hudTexts!().some((t) => t.text === 'EL DEVORADOR'), null, { timeout: 5000 });
    const fight = await until(page, (s) => s.survival?.fight?.stage === 'fight', 10_000);
    expect(fight.survival!.fight!.health).toBe(fight.survival!.fight!.max);
    // Barra de vida y suministros junto a Alex.
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['EL DEVORADOR', 'FASE 1']));
    await until(page, (s) => s.airdrop.crates.length >= 1, 6000);
  });

  test('las balas le hieren, se mueve, ataca y derriba la barricada', async ({ page }) => {
    test.setTimeout(90_000);
    await openFight(page);
    // Fusil hacia el pecho del jefe, por encima de la barricada: se le ve el daño en la barra.
    await page.keyboard.press('3');
    await waitGame(page, 400);
    const before = await state(page);
    const box = (await page.locator('canvas').boundingBox())!;
    const scale = box.width / 480;
    const bossScreenX = before.survival!.fight!.x - before.cameraX;
    await page.mouse.move(box.x + bossScreenX * scale, box.y + (before.player.y - 50) * scale);
    await page.mouse.down();
    await waitGame(page, 1500);
    await page.mouse.up();
    const shot = await state(page);
    expect(shot.survival!.fight!.taken).toBeGreaterThan(0);
    expect(shot.survival!.fight!.health).toBeLessThan(shot.survival!.fight!.max);
    // Va a por Alex: derriba la barricada que los separa y sus ataques hacen daño.
    const broken = await until(page, (s) => s.barricades.some((b) => b.broken), 45_000);
    expect(broken.survival!.fight!.state).not.toBe('intro');
    await until(page, (s) => s.player.health < 100, 30_000);
  });

  test('fases: se enfurece al 50 %, frenesí al 25 % con espinas y queda agotado con el punto débil', async ({ page }) => {
    test.setTimeout(90_000);
    await openFight(page);
    const crates = (await state(page)).airdrop.crates.length;
    await damageBoss(page, 2200);
    const enraged = await until(page, (s) => s.survival!.fight!.state === 'enrage', 10_000);
    expect(enraged.survival!.fight!.phase).toBe(2);
    // Enfurecido no recibe daño y cambia de aspecto.
    expect(await damageBoss(page, 100)).toBe(0);
    await until(page, (s) => s.survival!.fight!.animation.includes('/enraged/'), 3000);
    await page.waitForFunction(() => window.__ZS__!.hudTexts!().some((t) => t.text === 'FASE 2'), null, { timeout: 2000 });
    // Cóndor 7 manda munición al enfurecerse.
    await page.waitForFunction((n) => window.__ZS__!.sim!.state().airdrop.crates.length > n, crates, { timeout: 8000 });

    await until(page, (s) => s.survival!.fight!.state !== 'enrage', 6000);
    await damageBoss(page, 1100);
    await until(page, (s) => s.survival!.fight!.phase === 3, 10_000);
    const eruption = await until(page, (s) => s.survival!.fight!.state === 'eruption' && s.survival!.fight!.hazards.spikes > 10, 15_000);
    expect(eruption.survival!.fight!.hazards.spikes).toBeGreaterThan(10);
    await until(page, (s) => s.survival!.fight!.state === 'exhausted', 10_000);
    await page.waitForFunction(() => window.__ZS__!.hudTexts!().some((t) => t.text === '¡PUNTO DEBIL!'), null, { timeout: 2000 });
    // Agotado recibe el doble.
    expect(await damageBoss(page, 50)).toBe(100);
    // Las espinas se retiran sin dejar nada.
    await until(page, (s) => s.survival!.fight!.hazards.spikes === 0, 6000);
  });

  test('final: muere, VICTORIA, la grabación militar, un chasquido detrás de Alex y CONTINUARA', async ({ page }) => {
    test.setTimeout(120_000);
    await openFight(page);
    await damageBoss(page, 1e6);
    const dying = await until(page, (s) => s.survival!.fight!.stage === 'dying', 5000);
    expect(dying.survival!.fight!.cinematic).toBe(true);
    expect(dying.survival!.fight!.hazards).toEqual({ waves: 0, bile: 0, puddles: 0, spikes: 0 });
    await until(page, (s) => s.survival!.fight!.animation.endsWith('/die'), 3000);
    await page.waitForFunction(() => window.__ZS__!.hudTexts!().some((t) => t.text === 'VICTORIA'), null, { timeout: 10_000 });

    // La grabación: VICTORIA con el resumen y la cinta que se escribe sola.
    await page.waitForFunction(() => window.__ZS__!.epilogue === 'victory', null, { timeout: 15_000, polling: 50 });
    const paused = (await state(page)).time;
    await page.waitForFunction(() => window.__ZS__!.epilogue === 'recording', null, { timeout: 10_000 });
    expect((await state(page)).time).toBe(paused);
    // Intro adelanta línea a línea hasta el final de la cinta.
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__ZS__!.epilogue)) !== null; i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    expect(await page.evaluate(() => window.__ZS__!.epilogue)).toBeNull();

    // Silencio y el chasquido: Alex se da la vuelta.
    const final = await until(page, (s) => s.survival!.fight!.stage === 'final', 5000);
    const facing = final.player.facing;
    await page.waitForFunction((f) => window.__ZS__!.sim!.state().player.facing === -f, facing, { timeout: 6000 });
    const end = await until(page, (s) => s.survival!.finished, 8000);
    expect(end.survival!.fight!.stage).toBe('done');
    expect(await hudTexts(page)).toEqual(expect.arrayContaining(['CONTINUARA...', 'ZOMBIE SURVIVAL: ULTIMA ESPERANZA - PARTE 2', 'PULSA R PARA JUGAR DE NUEVO']));
    await page.keyboard.press('r');
    await until(page, (s) => s.survival?.fight?.stage === 'intro' && s.survival.fight.health === s.survival.fight.max, 10_000);
  });
});
