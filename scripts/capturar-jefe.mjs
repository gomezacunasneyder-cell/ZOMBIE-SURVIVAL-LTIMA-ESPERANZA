// Capturas del combate contra EL DEVORADOR (Fase 6).
// Uso: node scripts/capturar-jefe.mjs  (necesita `npm run dev` en marcha).
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
const state = () => page.evaluate(() => window.__ZS__.sim.state());
const untilState = (src, timeout = 60000) =>
  page.waitForFunction((code) => new Function('s', `return (${code})(s)`)(window.__ZS__.sim.state()), src, { timeout });
const waitGame = async (ms) => {
  const t = (await state()).time;
  await page.waitForFunction(([t0, d]) => window.__ZS__.sim.state().time - t0 >= d, [t, ms]);
};
const damage = (n) => page.evaluate((v) => window.__ZS__.sim.damageBoss(v), n);
/** Alex, invulnerable para las capturas: se le cura cada poco. */
const keepAlive = () => page.evaluate(() => setInterval(() => {
  const s = window.__ZS__.sim.state();
  if (s.player.health < 60) window.__ZS__.sim.healPlayer();
}, 300));

async function open() {
  await page.goto(`${BASE}/?modo=jefe&hora=noche&semilla=3`);
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Game' && !!window.__ZS__.sim);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6);
  await untilState(String((s) => s.survival?.fight?.stage === 'intro'));
}

// 1. Presentación: oscuridad, los rezagados huyen, surge del humo y ruge.
await open();
await keepAlive();
await untilState(String((s) => s.alive >= 4));
await waitGame(2600);
await shot('fase6-1-huyen');
await untilState(String((s) => s.survival.fight.stage === 'intro' && s.survival.bossRevealed === false && s.time > 0));
await page.waitForFunction(() => window.__ZS__.sim.state().survival.fight.animation.endsWith('/walk'), null, { timeout: 20000 });
await waitGame(1200);
await shot('fase6-2-surge-del-humo');
await page.waitForFunction(() => window.__ZS__.hudTexts().some((t) => t.text === 'SUJETO 7 - VIRUS Z-13'), null, { timeout: 15000 });
await waitGame(500);
await shot('fase6-3-el-devorador');

// 2. Combate: preparación de un ataque y onda expansiva.
await untilState(String((s) => s.survival.fight.stage === 'fight'));
await untilState(String((s) => s.survival.fight.hazards.waves > 0 || s.survival.fight.hazards.bile > 0 || s.survival.fight.state === 'smash'), 40000);
await waitGame(150);
await shot('fase6-4-combate');

// 3. Fase 2: se enfurece y cambia de aspecto.
await untilState(String((s) => s.survival.fight.state === 'stalk'));
await damage(2200);
await untilState(String((s) => s.survival.fight.state === 'enrage'));
await waitGame(900);
await shot('fase6-5-enfurecido');

// 4. Fase 3: erupción de espinas y agotamiento.
await untilState(String((s) => s.survival.fight.state !== 'enrage'));
await damage(1100);
await untilState(String((s) => s.survival.fight.state === 'eruption' && s.survival.fight.hazards.spikes > 20), 20000);
await waitGame(1700);
await shot('fase6-6-erupcion');
await untilState(String((s) => s.survival.fight.state === 'exhausted'));
await waitGame(500);
await shot('fase6-7-agotado');

// 5. Muerte, victoria y grabación militar.
await damage(1e6);
await untilState(String((s) => s.survival.fight.stage === 'dying'));
await waitGame(1800);
await shot('fase6-8-muerte');
await page.waitForFunction(() => window.__ZS__.epilogue === 'victory', null, { timeout: 20000, polling: 50 });
await page.waitForTimeout(900);
await shot('fase6-9-victoria');
await page.waitForFunction(() => window.__ZS__.epilogue === 'recording', null, { timeout: 15000 });
await page.waitForTimeout(16000);
await shot('fase6-10-grabacion');
while ((await page.evaluate(() => window.__ZS__.epilogue)) !== null) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
}

// 6. El chasquido y CONTINUARA.
await untilState(String((s) => s.survival.fight.stage === 'final'));
await waitGame(3300);
await shot('fase6-11-chasquido');
await untilState(String((s) => s.survival.finished));
await waitGame(500);
await shot('fase6-12-continuara');

await browser.close();
if (errors.length > 0) {
  console.error('ERRORES EN CONSOLA:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log('Capturas del jefe guardadas en ' + OUT);
