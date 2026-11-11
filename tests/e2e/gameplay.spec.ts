import { expect, test } from '@playwright/test';
import { aimFromPlayer, click, hold, openGame, sim, state, until } from './helpers';

test.describe('movimiento', () => {
  test('A/D y las flechas mueven a Alex, no a la cámara por separado', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    const start = await state(page);

    await hold(page, ['d'], 700);
    const afterD = await state(page);
    expect(afterD.player.x).toBeGreaterThan(start.player.x + 20);

    await hold(page, ['ArrowRight'], 500);
    const afterRight = await state(page);
    expect(afterRight.player.x).toBeGreaterThan(afterD.player.x + 12);

    await aimFromPlayer(page, -120, 0);
    await hold(page, ['a'], 500);
    const afterA = await state(page);
    expect(afterA.player.x).toBeLessThan(afterRight.player.x - 12);

    await hold(page, ['ArrowLeft'], 400);
    expect((await state(page)).player.x).toBeLessThan(afterA.player.x - 8);
  });

  test('acelera y frena de forma gradual', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await page.keyboard.down('d');
    const early = await until(page, (s) => s.player.vx > 2);
    expect(early.player.vx).toBeLessThan(50);
    const cruising = await until(page, (s) => s.player.vx > 52);
    expect(cruising.player.vx).toBeLessThanOrEqual(55);
    expect(cruising.player.animation).toMatch(/\/walk$/);
    await page.keyboard.up('d');
    const slowing = await until(page, (s) => s.player.vx < 50);
    expect(slowing.player.vx).toBeGreaterThanOrEqual(0);
    await until(page, (s) => s.player.vx === 0);
  });

  test('Shift corre más rápido que caminar', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 150, 0);
    await page.keyboard.down('d');
    await until(page, (s) => s.player.vx > 52);
    await page.keyboard.down('Shift');
    const running = await until(page, (s) => s.player.vx > 100);
    expect(running.player.animation).toMatch(/\/run$/);
    await page.keyboard.up('Shift');
    await until(page, (s) => s.player.vx < 60 && s.player.vx > 40);
    await page.keyboard.up('d');
  });

  test('Espacio salta, la gravedad lo devuelve al suelo', async ({ page }) => {
    await openGame(page);
    const ground = (await state(page)).player.y;
    await page.keyboard.down('Space');
    const airborne = await until(page, (s) => !s.player.onGround && s.player.vy < 0);
    expect(airborne.player.animation).toMatch(/\/jump$/);
    const apex = await until(page, (s) => s.player.vy > 0);
    expect(ground - apex.player.y).toBeGreaterThan(25);
    await page.keyboard.up('Space');
    const landed = await until(page, (s) => s.player.onGround);
    expect(landed.player.y).toBeCloseTo(ground, 0);
  });

  test('la cámara sigue a Alex y lo mantiene cerca del centro', async ({ page }) => {
    await openGame(page);
    expect((await state(page)).cameraX).toBe(0);
    await sim(page, 'teleport', 900);
    await aimFromPlayer(page, 100, 0);
    await hold(page, ['d', 'Shift'], 1500);
    const s = await state(page);
    expect(s.cameraX).toBeGreaterThan(700);
    const screenX = s.player.x - s.cameraX;
    expect(screenX).toBeGreaterThan(170);
    expect(screenX).toBeLessThan(310);
    expect(Number.isInteger(s.cameraX)).toBe(true);
    expect(s.zone).toBe('PUESTO DE CONTROL');
  });

  test('los límites del nivel detienen a Alex', async ({ page }) => {
    await openGame(page);
    const { worldWidth } = await state(page);
    await sim(page, 'teleport', worldWidth - 30);
    await aimFromPlayer(page, 20, 0);
    await hold(page, ['d', 'Shift'], 900);
    const right = await state(page);
    expect(right.player.x).toBeLessThanOrEqual(worldWidth);
    expect(right.player.x).toBeGreaterThan(worldWidth - 12);
    expect(right.cameraX).toBe(worldWidth - 480);

    await sim(page, 'teleport', 30);
    await aimFromPlayer(page, -20, 0);
    await hold(page, ['a', 'Shift'], 900);
    const left = await state(page);
    expect(left.player.x).toBeGreaterThanOrEqual(0);
    expect(left.player.x).toBeLessThan(12);
  });

  test('un obstáculo bloquea el paso y se supera saltando', async ({ page }) => {
    await openGame(page);
    // Caja en x = 300 (de 293 a 307).
    await sim(page, 'teleport', 262);
    await aimFromPlayer(page, 150, 0);
    await hold(page, ['d'], 1300);
    const blocked = await state(page);
    expect(blocked.player.x).toBeLessThan(290);
    expect(blocked.player.x).toBeGreaterThan(280);

    await page.keyboard.down('d');
    await page.keyboard.down('Space');
    await until(page, (s) => s.player.x > 312, 4000);
    await page.keyboard.up('Space');
    await page.keyboard.up('d');
  });
});

test.describe('arma', () => {
  test('apunta en los siete ángulos y se gira hacia el ratón', async ({ page }) => {
    await openGame(page);
    const targets: [dx: number, dy: number, aim: number][] = [
      [0, -60, 90],
      [30, -52, 60],
      [52, -30, 30],
      [60, 0, 0],
      [52, 30, -30],
      [24, 42, -60],
      [0, 40, -90],
    ];
    for (const [dx, dy, aim] of targets) {
      await aimFromPlayer(page, dx + 4, dy);
      const s = await state(page);
      expect(s.player.aim, `ratón en (${dx}, ${dy})`).toBe(aim);
      expect(s.player.facing).toBe(1);
    }
    await aimFromPlayer(page, -100, 0);
    const left = await state(page);
    expect(left.player.facing).toBe(-1);
    expect(left.player.aim).toBe(0);
  });

  test('la bala sale del arma y sigue la dirección apuntada', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, 0);
    await click(page);
    const flat = await until(page, (s) => s.bullets.length > 0);
    const bullet = flat.bullets[0]!;
    expect(bullet.vx).toBeGreaterThan(500);
    expect(Math.abs(bullet.vy)).toBeLessThan(20);
    // Nace junto al arma, por delante de Alex y a la altura del hombro.
    expect(bullet.x).toBeGreaterThan(flat.player.x + 5);
    expect(bullet.y).toBeGreaterThan(flat.player.y - 26);
    expect(bullet.y).toBeLessThan(flat.player.y - 10);
    await until(page, (s) => s.bullets.length === 0, 3000);

    await aimFromPlayer(page, 4, -90);
    await page.waitForTimeout(250);
    await click(page);
    const up = await until(page, (s) => s.bullets.length > 0);
    expect(up.bullets[0]!.vy).toBeLessThan(-500);

    await aimFromPlayer(page, -87, -50);
    await page.waitForTimeout(250);
    await click(page);
    const diagonal = await until(page, (s) => s.bullets.length > 0 && s.bullets.some((b) => b.vx < -300));
    const shot = diagonal.bullets.find((b) => b.vx < -300)!;
    expect(shot.vy).toBeLessThan(-200);
  });

  test('cada disparo gasta una bala; vacío no dispara; R recarga con duración', async ({ page }) => {
    await openGame(page);
    await aimFromPlayer(page, 120, -40);
    const start = await state(page);
    expect(start.weapon).toMatchObject({ name: 'PISTOLA', magazine: 12, reserve: 36, reloading: false });

    for (let shot = 1; shot <= 12; shot++) {
      await click(page);
      const expected = 12 - shot;
      await page.waitForFunction((m) => window.__ZS__!.sim!.state().weapon.magazine <= m, expected, { timeout: 2000 });
      const fired = await state(page);
      expect(fired.weapon.magazine).toBe(12 - shot);
      // Se espera la cadencia del arma (230 ms) en tiempo de juego, no en tiempo real.
      await page.waitForFunction((t) => window.__ZS__!.sim!.state().time - t > 260, fired.time);
    }

    // Cargador vacío: el clic no dispara ni gasta reserva.
    await until(page, (s) => s.bullets.length === 0, 3000);
    await click(page);
    await page.waitForTimeout(150);
    const empty = await state(page);
    expect(empty.weapon).toMatchObject({ magazine: 0, reserve: 36 });
    expect(empty.bullets.length).toBe(0);

    await page.keyboard.press('r');
    const reloading = await until(page, (s) => s.weapon.reloading);
    expect(reloading.weapon.magazine).toBe(0);
    // Durante la recarga tampoco se puede disparar.
    await click(page);
    await page.waitForTimeout(100);
    expect((await state(page)).weapon.magazine).toBe(0);

    const done = await until(page, (s) => !s.weapon.reloading, 4000);
    expect(done.time - reloading.time).toBeGreaterThan(1000);
    expect(done.weapon).toMatchObject({ magazine: 12, reserve: 24 });
  });

  test('una caja de suministros repone munición', async ({ page }) => {
    await openGame(page);
    await sim(page, 'teleport', 570);
    const s = await until(page, (st) => st.weapon.reserve > 36);
    expect(s.weapon.reserve).toBe(60);
  });
});

test.describe('zombi', () => {
  test('detecta a Alex, lo persigue, choca con él y le hace daño', async ({ page }) => {
    test.setTimeout(45_000);
    await openGame(page);
    const start = await state(page);
    await sim(page, 'spawnZombie', start.player.x + 130);

    const chasing = await until(page, (s) => s.zombies[0]?.state === 'chase');
    const firstX = chasing.zombies[0]!.x;
    const closer = await until(page, (s) => s.zombies[0]!.x < s.player.x + 80, 10_000);
    expect(closer.zombies[0]!.x).toBeLessThan(firstX);

    await until(page, (s) => s.zombies[0]!.state === 'windup', 15_000);
    const hurt = await until(page, (s) => s.player.health < 100, 5000);
    expect(hurt.player.health).toBe(85);

    // Colisión real: los cuerpos (10 px de ancho) nunca se solapan.
    let closest = Infinity;
    for (let i = 0; i < 12; i++) {
      const s = await state(page);
      if (s.player.onGround) closest = Math.min(closest, Math.abs(s.zombies[0]!.x - s.player.x));
      await page.waitForTimeout(120);
    }
    expect(closest).toBeGreaterThanOrEqual(9.5);
  });

  test('trepa un obstáculo que le cierra el paso hacia Alex', async ({ page }) => {
    await openGame(page);
    // Caja en x = 300: Alex a su izquierda, el zombi a su derecha.
    await sim(page, 'teleport', 250);
    await sim(page, 'spawnZombie', 345);
    const crossed = await until(page, (s) => s.zombies[0]!.x < 290, 12_000);
    expect(crossed.zombies[0]!.alive).toBe(true);
  });

  test('recibe disparos, pierde vida y muere; el contador sube', async ({ page }) => {
    await openGame(page);
    const start = await state(page);
    await sim(page, 'spawnZombie', start.player.x + 140);
    await aimFromPlayer(page, 140, 0);

    await click(page);
    const wounded = await until(page, (s) => s.zombies[0]!.health < 100, 3000);
    expect(wounded.zombies[0]!.health).toBe(66);
    expect(wounded.zombies[0]!.alive).toBe(true);

    await page.waitForTimeout(260);
    await click(page);
    await until(page, (s) => s.zombies[0]!.health === 32, 3000);
    await page.waitForTimeout(260);
    await click(page);
    const dead = await until(page, (s) => s.kills === 1, 3000);
    expect(dead.zombies[0]).toMatchObject({ alive: false, state: 'dead', health: 0 });
    expect(dead.weapon.magazine).toBe(9);
  });

  test('un disparo alerta a un zombi que no veía a Alex', async ({ page }) => {
    await openGame(page);
    const start = await state(page);
    await sim(page, 'spawnZombie', start.player.x + 230);
    await page.waitForTimeout(400);
    expect((await state(page)).zombies[0]!.state).toBe('wander');
    await aimFromPlayer(page, 4, -90);
    await click(page);
    await until(page, (s) => s.zombies[0]!.state === 'chase', 2000);
  });

  test('Alex muere al agotar la vida y se puede reintentar', async ({ page }) => {
    test.setTimeout(60_000);
    await openGame(page);
    const start = await state(page);
    for (const offset of [40, -40, 60, -60]) await sim(page, 'spawnZombie', start.player.x + offset);
    const dead = await until(page, (s) => !s.player.alive, 40_000);
    expect(dead.player.health).toBe(0);
    expect(dead.player.animation).toMatch(/\/die$/);

    await page.waitForTimeout(1200);
    await page.keyboard.press('r');
    const again = await until(page, (s) => s.player.alive && s.player.health === 100, 5000);
    expect(again.kills).toBe(0);
  });
});

test('moverse, correr, saltar y disparar a la vez funciona sin errores', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openGame(page, '');
  await aimFromPlayer(page, 150, -30);
  const start = await state(page);

  await page.keyboard.down('d');
  await page.keyboard.down('Shift');
  let airborneShots = 0;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    const before = await state(page);
    await click(page);
    await page.waitForTimeout(140);
    const after = await state(page);
    if (!before.player.onGround && after.weapon.magazine < before.weapon.magazine) airborneShots++;
    await page.keyboard.up('Space');
    await page.waitForTimeout(160);
  }
  await page.keyboard.press('r');
  await page.keyboard.up('Shift');
  await page.keyboard.up('d');

  const end = await state(page);
  expect(end.player.x).toBeGreaterThan(start.player.x + 150);
  expect(airborneShots).toBeGreaterThan(0);
  expect(end.weapon.magazine + end.weapon.reserve).toBeLessThan(48);
  const fps = await page.evaluate(() => window.__ZS__!.game.loop.actualFps);
  expect(fps).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

for (const screen of [
  { width: 1280, height: 720, dpr: 1 },
  { width: 1425, height: 790, dpr: 1.25 },
  { width: 1920, height: 1080, dpr: 1 },
  { width: 800, height: 600, dpr: 1 },
  { width: 640, height: 400, dpr: 2 },
]) {
  test(`ningún texto del HUD se corta en ${screen.width}×${screen.height} @${screen.dpr}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: screen.width, height: screen.height },
      deviceScaleFactor: screen.dpr,
    });
    const page = await context.newPage();
    await openGame(page);
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
      const box = document.querySelector('canvas')!.getBoundingClientRect();
      return {
        texts: window.__ZS__!.hudTexts!(),
        inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 0.01 && box.bottom <= window.innerHeight + 0.01,
        zoom: (box.width * window.devicePixelRatio) / 480,
      };
    });
    // El lienzo completo cabe en la ventana y con zoom entero.
    expect(layout.inside).toBe(true);
    expect(Math.abs(layout.zoom - Math.round(layout.zoom))).toBeLessThan(1e-6);
    // Cada texto queda dentro de la pantalla del juego con margen.
    expect(layout.texts.length).toBeGreaterThanOrEqual(8);
    for (const t of layout.texts) {
      expect(t.x, t.text).toBeGreaterThanOrEqual(3);
      expect(t.y, t.text).toBeGreaterThanOrEqual(3);
      expect(t.x + t.width, t.text).toBeLessThanOrEqual(477);
      expect(t.y + t.height, t.text).toBeLessThanOrEqual(267);
    }
    await context.close();
  });
}
