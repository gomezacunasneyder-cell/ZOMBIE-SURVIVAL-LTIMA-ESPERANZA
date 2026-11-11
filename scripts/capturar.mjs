// Genera capturas del juego en docs/capturas/.
// Uso: npm run capturas  (necesita el servidor de desarrollo en marcha: npm run dev)
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.ZS_URL ?? 'http://localhost:5173';
const OUT = 'docs/capturas';
const ZOOM = 4;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.ZS_CHANNEL ?? 'msedge' });
const page = await browser.newPage({
  viewport: { width: 480 * ZOOM, height: 270 * ZOOM },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

const canvas = page.locator('canvas');
const ready = (scene) => page.waitForFunction((key) => window.__ZS__?.readyScene === key, scene);
const shot = (name) => canvas.screenshot({ path: `${OUT}/${name}.png` });

/** Recorte ampliado, en píxeles del juego. */
async function crop(name, x, y, w, h) {
  const box = await canvas.boundingBox();
  const scale = box.width / 480;
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: box.x + x * scale, y: box.y + y * scale, width: w * scale, height: h * scale },
  });
}

/** Abre el nivel en un momento del día y coloca a Alex. */
async function openAt(hour, x, extra = '') {
  await page.goto(`${BASE}/?test=1&hora=${hour}${extra}`);
  await ready('Game');
  await page.evaluate((px) => window.__ZS__.sim.teleport(px), x);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.74);
  await page.waitForTimeout(1500);
}

// 1. El mismo lugar al atardecer, al anochecer y de noche.
for (const [name, hour] of [['atardecer', 'atardecer'], ['anochecer', '0.5'], ['noche', 'noche']]) {
  await openAt(hour, 420);
  await shot(`fase2-${name}-avenida`);
}

// 2. Otras zonas, atardecer y noche: barricada con farola averiada y campamento con alarma.
for (const [name, hour] of [['atardecer', 'atardecer'], ['noche', 'noche']]) {
  await openAt(hour, 1290);
  await shot(`fase2-${name}-barricada`);
  await openAt(hour, 2060);
  await shot(`fase2-${name}-campamento`);
}

// 3. Combate nocturno: disparo que ilumina y caminantes acercándose.
await openAt('noche', 1560);
await page.evaluate(() => {
  const sim = window.__ZS__.sim;
  sim.spawnZombie(1640);
  sim.spawnZombie(1690);
});
await page.waitForTimeout(900);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(40);
await shot('fase2-noche-combate');

// 4. Explosión de un bidón, en tres instantes.
await openAt('noche', 1100);
await page.evaluate(() => window.__ZS__.sim.detonate(1140));
await page.waitForTimeout(90);
await shot('fase2-explosion-1-destello');
await page.waitForTimeout(260);
await shot('fase2-explosion-2-bola');
await page.waitForTimeout(1600);
await shot('fase2-explosion-3-incendio');

// 5. Pausa con los ajustes de sonido.
await openAt('noche', 420);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__ZS__.optionsOpen === true);
await page.waitForTimeout(200);
await shot('fase2-pausa-sonido');

// 6. Comparación de aspectos de Alex y galería.
await page.goto(`${BASE}/?scene=compare`);
await ready('Compare');
await page.waitForTimeout(500);
await shot('alex-comparacion');
await page.goto(`${BASE}/?scene=gallery&freeze=1`);
await ready('Gallery');
await page.waitForTimeout(300);
await shot('galeria');

// 7. El nuevo Alex en el juego, de cerca.
await openAt('atardecer', 600);
await page.evaluate(() => window.__ZS__.sim.spawnZombie(700));
await page.waitForTimeout(700);
await crop('alex-en-juego', 150, 150, 220, 90);

// 8. Arsenal: las cuatro armas en los 7 ángulos y en combate.
await page.goto(`${BASE}/?scene=arsenal&freeze=1`);
await ready('Arsenal');
await page.waitForTimeout(300);
await shot('fase3-arsenal');

const equip = async (key, id) => {
  await page.keyboard.press(key);
  await page.waitForFunction((want) => {
    const w = window.__ZS__.sim.state().weapon;
    return w.id === want && w.ready;
  }, id);
};
for (const [key, id, name] of [['1', 'pistol', 'pistola'], ['2', 'shotgun', 'escopeta'], ['3', 'rifle', 'fusil'], ['4', 'mg', 'ametralladora']]) {
  await openAt('noche', 1560);
  await page.evaluate(() => {
    const sim = window.__ZS__.sim;
    sim.spawnZombie(1625);
    sim.spawnZombie(1680);
  });
  await page.waitForTimeout(500);
  await equip(key, id);
  await page.mouse.down();
  await page.waitForTimeout(id === 'shotgun' || id === 'pistol' ? 30 : 260);
  await shot(`fase3-disparo-${name}`);
  await page.mouse.up();
}

// 9. HUD: recargando el fusil y ametralladora sin munición.
await openAt('atardecer', 600);
await equip('3', 'rifle');
await page.evaluate(() => window.__ZS__.sim.setAmmo(2, 4, 60));
await page.keyboard.press('r');
await page.waitForFunction(() => window.__ZS__.sim.state().weapon.reloading);
await page.waitForTimeout(700);
await crop('fase3-hud-recarga', 240, 200, 240, 70);
await equip('4', 'mg');
await page.evaluate(() => window.__ZS__.sim.setAmmo(3, 0, 0));
await page.waitForTimeout(300);
await crop('fase3-hud-sin-municion', 240, 200, 240, 70);

await browser.close();
if (errors.length > 0) {
  console.error('ERRORES EN CONSOLA:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log('Capturas guardadas en ' + OUT);
