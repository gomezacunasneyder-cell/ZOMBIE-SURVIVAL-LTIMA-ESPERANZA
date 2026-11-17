// Capturas de los arrojadizos, las piezas y el inventario (Fase 3).
// Uso: node scripts/capturar-mochila.mjs  (necesita `npm run dev` en marcha).
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.ZS_URL ?? 'http://localhost:5173';
const OUT = 'docs/capturas';
const ZOOM = 4;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.ZS_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 480 * ZOOM, height: 270 * ZOOM }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

const canvas = page.locator('canvas');
const shot = (name) => canvas.screenshot({ path: `${OUT}/${name}.png` });
const sim = (fn, arg) => page.evaluate(fn, arg);
const untilState = (src, timeout = 30000) =>
  page.waitForFunction((code) => new Function('s', `return (${code})(s)`)(window.__ZS__.sim.state()), src, { timeout });
const waitGame = async (ms) => {
  const t = await page.evaluate(() => window.__ZS__.sim.state().time);
  await page.waitForFunction(([t0, d]) => window.__ZS__.sim.state().time - t0 >= d, [t, ms]);
};

/** Recorte ampliado, en píxeles del juego. */
async function crop(name, x, y, w, h) {
  const box = await canvas.boundingBox();
  const scale = box.width / 480;
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: box.x + x * scale, y: box.y + y * scale, width: w * scale, height: h * scale } });
}

/** Abre el nivel con dos granadas y dos molotov, coloca a Alex y apunta `dx` px por delante de él. */
async function openAt(hour, x, dx) {
  await page.goto(`${BASE}/?test=1&hora=${hour}&arsenal=basico`);
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Game' && !!window.__ZS__.sim);
  await sim((px) => window.__ZS__.sim.teleport(px), x);
  await waitGame(600);
  const s = await page.evaluate(() => window.__ZS__.sim.state());
  const box = await canvas.boundingBox();
  const scale = box.width / 480;
  await page.mouse.move(box.x + (s.player.x - s.cameraX + dx) * scale, box.y + (s.player.y - 8) * scale);
  await waitGame(200);
}

// 1. Granada: en vuelo y al estallar entre los caminantes.
await openAt('noche', 420, 95);
await sim(() => [560, 585, 610].forEach((x) => window.__ZS__.sim.spawnZombie(x)));
await page.keyboard.press('g');
await untilState(String((s) => s.throwables.flying.length === 1 && s.throwables.flying[0].x > s.player.x + 35));
await shot('fase3-granada-1-vuelo');
await untilState(String((s) => s.throwables.exploded === 1), 6000);
await page.waitForTimeout(70);
await shot('fase3-granada-2-explosion');

// 2. Molotov: el charco de fuego prende a los que lo pisan e ilumina la calle.
await openAt('noche', 420, 95);
await sim(() => {
  window.__ZS__.sim.spawnZombie(560);
  window.__ZS__.sim.spawnZombie(600, 'runner');
});
await page.keyboard.press('f');
await untilState(String((s) => s.throwables.fires === 1));
await untilState(String((s) => s.burning >= 1), 8000);
await waitGame(500);
await shot('fase3-molotov');

// 3. Piezas: el mutante cae y suelta su botín; Alex lo recoge.
await openAt('atardecer', 420, 80);
await sim(() => window.__ZS__.sim.spawnZombie(500, 'mutant'));
await waitGame(300);
await sim(() => window.__ZS__.sim.killAll());
await waitGame(900);
await crop('fase3-piezas-suelo', 400 - (await page.evaluate(() => window.__ZS__.sim.state().cameraX)) + 50, 170, 160, 70);
await shot('fase3-piezas');
await crop('fase3-hud-mochila', 0, 0, 480, 34);

// 4. Inventario (Tab) con el juego en pausa.
await sim(() => {
  window.__ZS__.sim.giveWeapon('flamer');
  window.__ZS__.sim.setAmmo(1, 2, 0);
});
await sim(() => window.__ZS__.sim.teleport(window.__ZS__.sim.state().player.x + 80));
await waitGame(700);
await page.keyboard.press('Tab');
await page.waitForFunction(() => window.__ZS__.inventoryOpen === true);
await page.waitForTimeout(200);
await shot('fase3-inventario');

await browser.close();
if (errors.length > 0) {
  console.error('ERRORES EN CONSOLA:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log('Capturas de la mochila guardadas en ' + OUT);
