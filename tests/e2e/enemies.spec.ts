import { expect, test, type Page } from '@playwright/test';
import { aimFromPlayer, click, openGame, state, until } from './helpers';

function spawn(page: Page, x: number, kind: string): Promise<void> {
  return page.evaluate(([px, k]) => window.__ZS__!.sim!.spawnZombie(px as number, k as string), [x, kind] as const);
}

function teleport(page: Page, x: number): Promise<void> {
  return page.evaluate((px) => window.__ZS__!.sim!.teleport(px), x);
}

/** Espera un tiempo de juego (no real). */
async function waitGame(page: Page, ms: number): Promise<void> {
  const start = (await state(page)).time;
  await page.waitForFunction(([t, d]) => window.__ZS__!.sim!.state().time - t! >= d!, [start, ms]);
}

test.describe('enemigos', () => {
  test('los cuatro tipos aparecen con su propio aspecto', async ({ page }) => {
    await openGame(page);
    await teleport(page, 300);
    await spawn(page, 520, 'walker');
    await spawn(page, 600, 'runner');
    await spawn(page, 680, 'clicker');
    await spawn(page, 780, 'mutant');
    const s = await until(page, (st) => st.zombies.length === 4 && st.zombies.every((z) => z.animation !== ''));
    expect(s.zombies.map((z) => z.kind)).toEqual(['walker', 'runner', 'clicker', 'mutant']);
    for (const zombie of s.zombies) expect(zombie.animation.startsWith(`${zombie.kind}/`), zombie.animation).toBe(true);
  });

  test('Chasqueador: no oye a Alex en sigilo, pero sí cuando corre', async ({ page }) => {
    await openGame(page);
    // Entre el coche (650) y los sacos (980) hay calle libre para alejarse.
    await teleport(page, 900);
    await aimFromPlayer(page, -100, 0);
    await spawn(page, 975, 'clicker');
    await waitGame(page, 300);
    // Se aleja en silencio: el medidor de ruido se queda vacío y el Chasqueador no se entera.
    await page.keyboard.down('s');
    await page.keyboard.down('a');
    const sneaking = await until(page, (st) => st.noise.sneaking && st.player.vx < -10);
    expect(sneaking.noise.level).toBe(0);
    await waitGame(page, 1500);
    await page.keyboard.up('a');
    await page.keyboard.up('s');
    const quiet = await state(page);
    expect(quiet.zombies[0]!.state).not.toBe('chase');
    expect(quiet.zombies[0]!.state).not.toBe('windup');
    // Al soltar S el HUD deja de mostrar «SIGILO» (en el fotograma siguiente).
    await page.waitForFunction(() => !window.__ZS__!.hudTexts!().some((t) => t.text === 'SIGILO'));

    // Ahora corre: lo oye y carga.
    // El ruido se mide mientras sigue corriendo: al parar se apaga enseguida.
    await page.keyboard.down('Shift');
    await page.keyboard.down('a');
    const heard = await until(page, (st) => st.zombies[0]!.state === 'chase', 3000);
    expect(heard.noise.level).toBeGreaterThan(0.3);
    await page.keyboard.up('a');
    await page.keyboard.up('Shift');
  });

  test('Chasqueador: acude a una explosión, chasquea al llegar y no va hacia Alex', async ({ page }) => {
    await openGame(page);
    await teleport(page, 880);
    await spawn(page, 1300, 'clicker');
    await waitGame(page, 300);
    await page.evaluate(() => window.__ZS__!.sim!.detonate(1140));
    const charging = await until(page, (st) => st.zombies[0]!.state === 'chase' && st.zombies[0]!.target !== null, 3000);
    expect(Math.abs(charging.zombies[0]!.target! - 1140)).toBeLessThan(30);
    // Llega al sitio, se para y chasquea (animación característica).
    const clicking = await until(page, (st) => st.zombies[0]!.animation.endsWith('/click'), 12_000);
    expect(clicking.zombies[0]!.state).toBe('listen');
    expect(Math.abs(clicking.zombies[0]!.x - 1140)).toBeLessThan(40);
    expect(clicking.player.health).toBe(100);
  });

  test('corredor: llega enseguida y encadena golpes rápidos', async ({ page }) => {
    await openGame(page);
    await teleport(page, 700);
    await aimFromPlayer(page, 100, 0);
    await spawn(page, 860, 'runner');
    await spawn(page, 540, 'walker');
    const start = await state(page);
    const hit = await until(page, (st) => st.player.health < 100, 10_000);
    expect(hit.time - start.time).toBeLessThan(4000);
    // Uno o los dos zarpazos de la serie (con el equipo lento pueden caer entre dos lecturas).
    expect([7, 14]).toContain(100 - hit.player.health);
    // El caminante, mucho más lento, sigue lejos cuando el corredor ya ha golpeado.
    expect(Math.abs(hit.zombies[1]!.x - hit.player.x)).toBeGreaterThan(60);
  });

  test('mutante: derriba la barricada, no se aturde con balas y aguanta muchísimo', async ({ page }) => {
    await openGame(page);
    await teleport(page, 2040);
    await aimFromPlayer(page, 100, -10);
    await spawn(page, 2225, 'mutant');
    const blocked = await until(page, (st) => st.zombies[0]!.state === 'smash', 15_000);
    expect(blocked.zombies[0]!.x).toBeGreaterThan(2180);

    // Mientras golpea la barricada: un disparo de pistola le quita su daño exacto y no lo aturde.
    await aimFromPlayer(page, blocked.zombies[0]!.x - blocked.player.x, -14);
    expect(blocked.zombies[0]!.health).toBe(1100);
    await click(page);
    const shot = await until(page, (st) => st.zombies[0]!.health < 1100, 3000);
    expect(shot.zombies[0]!.health).toBe(1100 - 34);
    await waitGame(page, 120);
    expect((await state(page)).zombies[0]!.state).not.toBe('stagger');

    const broken = await until(page, (st) => st.barricades.some((b) => b.x === 2180 && b.broken), 15_000);
    expect(broken.barricades.find((b) => b.x === 2180)!.hits).toBe(3);
    // Pasa por donde estaba la barricada.
    await until(page, (st) => st.zombies[0]!.x < 2170, 15_000);
  });

  test('cada arma daña a cada tipo con su daño y la escopeta tumba a un corredor de un disparo', async ({ page }) => {
    await openGame(page);
    await teleport(page, 700);
    await aimFromPlayer(page, 60, 6);
    await spawn(page, 740, 'clicker');
    await click(page);
    const clicker = await until(page, (st) => st.zombies[0]!.health < 190, 3000);
    expect(clicker.zombies[0]!.health).toBe(156);
    // El disparo lo ha despertado: va a por Alex.
    await until(page, (st) => ['chase', 'windup', 'stagger', 'recover'].includes(st.zombies[0]!.state), 2000);
    await page.evaluate(() => window.__ZS__!.sim!.clearZombies());

    await page.keyboard.press('2');
    await until(page, (st) => st.weapon.id === 'shotgun' && st.weapon.ready);
    // Pegado a Alex, más cerca que la boca del cañón: también debe recibir el disparo.
    await spawn(page, (await state(page)).player.x + 14, 'runner');
    await waitGame(page, 60);
    await aimFromPlayer(page, 40, 4);
    await click(page);
    const dead = await until(page, (st) => st.zombies.length > 0 && !st.zombies[0]!.alive, 3000);
    expect(dead.kills).toBe(1);
  });

  test('el medidor de ruido sube al correr y al disparar', async ({ page }) => {
    await openGame(page);
    await teleport(page, 700);
    await aimFromPlayer(page, 100, 0);
    expect((await state(page)).noise.level).toBe(0);
    await page.keyboard.down('Shift');
    await page.keyboard.down('d');
    await until(page, (st) => st.noise.level > 0.4, 3000);
    await page.keyboard.up('d');
    await page.keyboard.up('Shift');
    await until(page, (st) => st.noise.level === 0, 5000);
    await click(page);
    await until(page, (st) => st.noise.level > 0.7, 2000);
  });
});
