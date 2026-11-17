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
let canvasBox = null;
const box0 = () => canvasBox;

/** Recorte ampliado, en píxeles del juego. */
async function crop(name, x, y, w, h) {
  const box = await canvas.boundingBox();
  const scale = box.width / 480;
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: box.x + x * scale, y: box.y + y * scale, width: w * scale, height: h * scale },
  });
}

/** Abre el nivel en un momento del día y coloca a Alex (con las cuatro armas de la Fase 3 salvo que se indique). */
async function openAt(hour, x, extra = '') {
  const arsenal = extra.includes('arsenal=') ? '' : '&arsenal=basico';
  await page.goto(`${BASE}/?test=1&hora=${hour}${arsenal}${extra}`);
  await ready('Game');
  await page.evaluate((px) => window.__ZS__.sim.teleport(px), x);
  const box = await canvas.boundingBox();
  canvasBox = box;
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
await page.keyboard.press('2');
await page.waitForTimeout(400);
await shot('fase3-arsenal-2');

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

// 10. Enemigos: bestiario y los cuatro en la calle.
await page.goto(`${BASE}/?scene=bestiario&freeze=1`);
await ready('Bestiary');
await page.waitForTimeout(300);
await shot('fase4-bestiario');

await openAt('0.6', 900);
await page.evaluate(() => {
  const sim = window.__ZS__.sim;
  sim.spawnZombie(990, 'walker');
  sim.spawnZombie(1040, 'runner');
  sim.spawnZombie(1090, 'clicker');
});
await page.waitForTimeout(500);
await shot('fase4-enemigos-calle');

// Chasqueador escuchando tras una explosión (Alex a distancia, en silencio).
await openAt('noche', 960);
await page.evaluate(() => {
  window.__ZS__.sim.spawnZombie(1300, 'clicker');
  window.__ZS__.sim.detonate(1140);
});
await page.waitForFunction(() => window.__ZS__.sim.state().zombies[0]?.animation.endsWith('/click'), null, { timeout: 20000 });
await shot('fase4-chasqueador-escucha');

// Mutante contra la barricada del campamento.
await openAt('noche', 2060);
await page.evaluate(() => window.__ZS__.sim.spawnZombie(2225, 'mutant'));
await page.waitForFunction(() => window.__ZS__.sim.state().zombies[0]?.state === 'smash', null, { timeout: 20000 });
await page.waitForTimeout(500);
await shot('fase4-mutante-barricada');

// 11. Suministros de Cóndor 7 (semilla 1: una caja común y otra épica con el lanzacohetes).
const gameTime = () => page.evaluate(() => window.__ZS__.sim.state().time);
const untilState = (src, timeout = 60000) =>
  page.waitForFunction((code) => new Function('s', `return (${code})(s)`)(window.__ZS__.sim.state()), src, { timeout });
const waitGame = async (ms) => {
  const t = await gameTime();
  await page.waitForFunction(([t0, d]) => window.__ZS__.sim.state().time - t0 >= d, [t, ms]);
};
await openAt('noche', 500, '&arsenal=inicial&semilla=1');
await page.evaluate(() => window.__ZS__.sim.airdrop());
await waitGame(700);
await shot('fase3-suministros-1-aviso');
await untilState(String((s) => s.airdrop.heliX !== null && s.airdrop.heliX > s.cameraX + 60 && s.airdrop.heliX < s.cameraX + 420));
await shot('fase3-suministros-2-helicoptero');
await untilState(String((s) => s.airdrop.crates.some((c) => c.state === 'falling' && c.y > 120)));
await shot('fase3-suministros-3-paracaidas');
await untilState(String((s) => s.airdrop.crates.length >= 2 && s.airdrop.crates.every((c) => c.state === 'landed')));
await waitGame(600);
await shot('fase3-suministros-4-cajas');
const epic = await page.evaluate(() => window.__ZS__.sim.state().airdrop.crates.find((c) => c.rarity === 'epic') ?? window.__ZS__.sim.state().airdrop.crates[0]);
await page.evaluate((x) => window.__ZS__.sim.teleport(x), epic.x - 4);
await waitGame(300);
await page.keyboard.down('e');
await waitGame(1000);
await page.keyboard.up('e');
await waitGame(250);
await shot('fase3-suministros-5-botin');

// Partida real: los zombis acuden a rodear las cajas.
await page.goto(`${BASE}/?hora=noche&semilla=6&suministros=ya`);
await ready('Game');
await page.mouse.move(box0().x + 1500, box0().y + 600);
await untilState(String((s) => s.airdrop.crates.length >= 2 && s.airdrop.crates.every((c) => c.state === 'landed')));
await waitGame(5000);
await shot('fase3-suministros-6-emboscada');

// Lanzallamas, lanzacohetes y botiquín.
await openAt('noche', 1560, '&arsenal=completo');
await page.evaluate(() => {
  const sim = window.__ZS__.sim;
  sim.spawnZombie(1615);
  sim.spawnZombie(1640);
});
await equip('5', 'flamer');
await page.mouse.down();
await waitGame(600);
await shot('fase3-lanzallamas');
await page.mouse.up();
await openAt('noche', 1560, '&arsenal=completo');
await page.evaluate(() => window.__ZS__.sim.spawnZombie(1700));
await equip('6', 'rocket');
await page.mouse.down();
await page.mouse.up();
await untilState(String((s) => s.explosions.total > 0), 8000);
await page.waitForTimeout(60);
await shot('fase3-lanzacohetes');
await openAt('atardecer', 600, '&arsenal=inicial');
await page.evaluate(() => window.__ZS__.sim.hurtPlayer(55));
await waitGame(900);
await page.keyboard.press('q');
await waitGame(800);
await crop('fase3-botiquin', 0, 0, 240, 70);
await shot('fase3-botiquin-juego');

// 12. Modo supervivencia: oleadas, horda final y llegada del jefe.
const openSurvival = async (extra = '') => {
  await page.goto(`${BASE}/?modo=oleadas&hora=noche&semilla=2&arsenal=completo${extra}`);
  await ready('Game');
  canvasBox = await canvas.boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.82, canvasBox.y + canvasBox.height * 0.74);
};
const autoKill = (on) =>
  page.evaluate((enable) => {
    if (window.__autokill) clearInterval(window.__autokill);
    window.__autokill = enable ? setInterval(() => window.__ZS__.sim.killAll(), 250) : undefined;
  }, on);
await openSurvival();
await waitGame(900);
await shot('fase4-oleadas-1-aviso');
await openSurvival('&oleada=3');
await untilState(String((s) => s.survival.phase === 'fighting' && s.alive >= 8));
await waitGame(4500);
await shot('fase4-oleadas-2-combate');
await autoKill(true);
await untilState(String((s) => s.survival.phase === 'rest'), 90000);
await autoKill(false);
await waitGame(2200);
await shot('fase4-oleadas-3-recompensa');

await openSurvival('&oleada=5');
await waitGame(2500);
await shot('fase4-horda-1-alarma');
await untilState(String((s) => s.survival.phase === 'fighting' && s.barricades.every((b) => b.hits >= 18)), 90000);
await shot('fase4-horda-2-asedio');
await autoKill(true);
await untilState(String((s) => s.survival.phase === 'boss'), 120000);
await autoKill(false);
await waitGame(7600);
await shot('fase4-jefe-1-silueta');
await untilState(String((s) => s.survival.bossRevealed));
await waitGame(900);
await shot('fase4-jefe-2-devorador');
await untilState(String((s) => s.survival.finished));
await waitGame(400);
await shot('fase4-oleadas-fin');

// Prueba de estrés: 150 zombis a la vez.
await openAt('noche', 1200);
await page.evaluate(() => window.__ZS__.sim.stress(150));
await waitGame(2500);
await shot('fase4-estres-150');

await browser.close();
if (errors.length > 0) {
  console.error('ERRORES EN CONSOLA:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log('Capturas guardadas en ' + OUT);
