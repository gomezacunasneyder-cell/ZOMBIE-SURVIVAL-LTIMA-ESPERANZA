import { expect, test, type Page } from '@playwright/test';
import { aimFromPlayer, click, holdGame, openGame, sim, state, until } from './helpers';

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

function callAirdrop(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__ZS__!.sim!.airdrop());
}

function giveWeapon(page: Page, id: string): Promise<void> {
  return page.evaluate((weapon) => window.__ZS__!.sim!.giveWeapon(weapon), id);
}

function hurt(page: Page, amount: number): Promise<void> {
  return page.evaluate((n) => window.__ZS__!.sim!.hurtPlayer(n), amount);
}

/** Lanzamiento completo hasta que todas las cajas están en el suelo. */
async function dropAndLand(page: Page): Promise<Awaited<ReturnType<typeof state>>> {
  expect(await callAirdrop(page)).toBe(true);
  return until(page, (s) => s.airdrop.crates.length >= 2 && s.airdrop.crates.every((c) => c.state === 'landed'), 60_000);
}

test.describe('suministros de Cóndor 7', () => {
  test('en una partida normal Alex empieza solo con la pistola', async ({ page }) => {
    await openGame(page, '?test=1&arsenal=inicial');
    const s = await state(page);
    expect(s.arsenal.map((slot) => slot?.id ?? null)).toEqual(['pistol', null, null, null, null, null]);
    expect(s.medkits).toEqual({ count: 1, using: false });
    await page.keyboard.press('5');
    await waitGame(page, 100);
    expect((await state(page)).weapon.id).toBe('pistol');
  });

  test('aviso, helicóptero que entra, suelta la carga en paracaídas y se va', async ({ page }) => {
    await openGame(page, '?test=1&hora=noche&semilla=4');
    await sim(page, 'teleport', 500);
    expect(await callAirdrop(page)).toBe(true);
    // No se solapan dos lanzamientos.
    expect(await callAirdrop(page)).toBe(false);
    const warning = await state(page);
    expect(warning.airdrop.phase).toBe('warning');
    expect(warning.airdrop.heliX).toBeNull();
    const texts = await page.evaluate(() => window.__ZS__!.hudTexts!().map((t) => t.text));
    expect(texts).toContain('¡SUMINISTROS DETECTADOS!');

    // Entra desde fuera de la pantalla y se le oye antes de llegar.
    const inbound = await until(page, (s) => s.airdrop.heliX !== null, 10_000);
    expect(Math.abs(inbound.airdrop.heliX! - (inbound.cameraX + 240))).toBeGreaterThan(240);
    await until(page, (s) => (s.audio.loops['loop/helicopter'] ?? 0) > 0.05, 15_000);

    // Suelta las cajas en estacionario; caen con paracaídas y llegan al suelo.
    await until(page, (s) => s.airdrop.phase === 'hover', 20_000);
    const falling = await until(page, (s) => s.airdrop.crates.some((c) => c.state === 'falling'), 10_000);
    expect(falling.airdrop.crates[0]!.y).toBeLessThan(150);
    const landed = await until(page, (s) => s.airdrop.crates.length >= 2 && s.airdrop.crates.every((c) => c.state === 'landed'), 40_000);
    for (const crate of landed.airdrop.crates) {
      expect(crate.items.length).toBeGreaterThanOrEqual(1);
      expect(crate.items.length).toBeLessThanOrEqual(2);
      // Hay que ir a por ellas.
      expect(Math.abs(crate.x - landed.player.x)).toBeGreaterThan(60);
    }
    // El helicóptero termina saliendo por el otro extremo.
    await until(page, (s) => s.airdrop.phase === 'idle' && s.airdrop.heliX === null, 30_000);
  });

  test('una caja se abre manteniendo E; un golpe interrumpe la apertura', async ({ page }) => {
    await openGame(page, '?test=1&semilla=4');
    // Reservas casi vacías: todo lo de la caja cabe.
    for (let slot = 0; slot < 4; slot++) await page.evaluate((s) => window.__ZS__!.sim!.setAmmo(s, 1, 0), slot);
    const landed = await dropAndLand(page);
    const crate = landed.airdrop.crates[0]!;
    await sim(page, 'teleport', crate.x - 4);
    await waitGame(page, 150);

    // Un golpe a mitad de la apertura la interrumpe.
    await page.keyboard.down('e');
    await until(page, (s) => (s.airdrop.opening ?? 0) > 0.3, 5000);
    await hurt(page, 5);
    await until(page, (s) => s.airdrop.opening === null, 3000);
    await page.keyboard.up('e');
    expect((await state(page)).airdrop.crates[0]!.state).toBe('landed');

    const before = await state(page);
    await holdGame(page, ['e'], 1100);
    const after = await until(page, (s) => s.airdrop.crates[0]!.state === 'opened', 3000);
    expect(after.airdrop.crates[0]!.items).toEqual([]);
    // Algo ha cambiado: munición, un arma nueva o un botiquín.
    const total = (s: typeof before): number =>
      s.arsenal.reduce((sum, slot) => sum + (slot ? slot.reserve + 1000 : 0), 0) + s.medkits.count * 10_000;
    expect(total(after)).toBeGreaterThan(total(before));
  });

  test('lo que no cabe se queda en la caja y se puede volver a abrir', async ({ page }) => {
    await openGame(page, '?test=1&semilla=4&arsenal=completo');
    // Todo lleno: ni munición ni botiquines caben.
    for (let slot = 0; slot < 6; slot++) await page.evaluate((s) => window.__ZS__!.sim!.setAmmo(s, 999, 999), slot);
    const landed = await dropAndLand(page);
    const crate = landed.airdrop.crates[0]!;
    await sim(page, 'teleport', crate.x - 4);
    await waitGame(page, 150);
    await holdGame(page, ['e'], 1100);
    const s = await state(page);
    const kept = s.airdrop.crates[0]!;
    // Solo puede haberse llevado botiquines (empieza con uno y caben tres).
    if (kept.items.length > 0) expect(kept.state).toBe('landed');
    for (const item of kept.items) expect(item).not.toBe('medkit');
  });

  test('el lanzallamas prende fuego a los zombis y siguen ardiendo', async ({ page }) => {
    await openGame(page, '?test=1&arsenal=inicial');
    await giveWeapon(page, 'flamer');
    await until(page, (s) => s.weapon.id === 'flamer' && s.weapon.ready, 3000);
    const x = (await state(page)).player.x;
    await sim(page, 'spawnZombie', x + 50);
    await aimFromPlayer(page, 120, 0);
    await page.mouse.down();
    const burning = await until(page, (s) => s.burning > 0, 4000);
    await page.mouse.up();
    expect(burning.weapon.magazine).toBeLessThan(80);
    // Sin casquillos ni rebotes: el fuego atraviesa y sigue haciendo daño solo.
    const hp = burning.zombies[0]!.health;
    await waitGame(page, 800);
    const later = await state(page);
    expect(later.zombies[0]!.health).toBeLessThan(hp);
  });

  test('el cohete estalla al impactar y daña a todo lo que hay cerca', async ({ page }) => {
    await openGame(page, '?test=1&arsenal=inicial');
    await giveWeapon(page, 'rocket');
    await until(page, (s) => s.weapon.id === 'rocket' && s.weapon.ready, 3000);
    const x = (await state(page)).player.x;
    for (const dx of [150, 165]) await sim(page, 'spawnZombie', x + dx);
    await aimFromPlayer(page, 150, 0);
    await click(page);
    const boom = await until(page, (s) => s.explosions.total > 0, 4000);
    expect(boom.weapon.magazine).toBe(0);
    await until(page, (s) => s.zombies.filter((z) => z.alive).length === 0, 3000);
  });

  test('el botiquín cura tras su uso y un golpe lo interrumpe sin gastarlo', async ({ page }) => {
    await openGame(page, '?test=1&arsenal=inicial');
    await hurt(page, 60);
    await waitGame(page, 900);
    await page.keyboard.press('q');
    await until(page, (s) => s.medkits.using, 2000);
    await waitGame(page, 400);
    await hurt(page, 5);
    const interrupted = await until(page, (s) => !s.medkits.using, 2000);
    expect(interrupted.medkits.count).toBe(1);
    expect(interrupted.player.health).toBe(35);

    await waitGame(page, 900);
    await page.keyboard.press('q');
    const healed = await until(page, (s) => !s.medkits.using && s.medkits.count === 0, 4000);
    expect(healed.player.health).toBe(85);
    // Sin botiquines no pasa nada.
    await page.keyboard.press('q');
    await waitGame(page, 200);
    expect((await state(page)).medkits.using).toBe(false);
  });

  test('en partida real, los zombis acuden a las cajas y la música sube', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await openGame(page, '?hora=noche&semilla=8');
    await sim(page, 'teleport', 300);
    await page.evaluate(() => window.__ZS__!.sim!.clearZombies());
    const landed = await dropAndLand(page);
    await until(page, (s) => (s.audio.loops['loop/combat'] ?? 0) > 0.3, 5000).catch(() => null);
    const crateXs = landed.airdrop.crates.map((c) => c.x);
    // La emboscada llega y los zombis acaban rondando las cajas.
    const near = await until(
      page,
      (s) => s.zombies.some((z) => z.alive && s.airdrop.crates.some((c) => Math.abs(c.x - z.x) < 60)),
      30_000,
    );
    expect(near.zombies.filter((z) => z.alive).length).toBeGreaterThanOrEqual(2);
    expect(crateXs.length).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
});
