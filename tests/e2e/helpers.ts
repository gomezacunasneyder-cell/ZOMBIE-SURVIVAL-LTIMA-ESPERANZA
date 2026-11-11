import type { Page } from '@playwright/test';
import type { SimState } from '../../src/game/debug/simState';

/** Abre el nivel sin enemigos y espera a que esté listo. */
export async function openGame(page: Page, query = '?test=1'): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__ZS__?.readyScene === 'Game' && !!window.__ZS__.sim);
  // Un clic fuera de la acción da el foco de teclado al juego.
  await page.locator('canvas').hover();
}

export function state(page: Page): Promise<SimState> {
  return page.evaluate(() => window.__ZS__!.sim!.state());
}

/** Espera hasta que el estado del juego cumpla una condición. */
export async function until(
  page: Page,
  predicate: (s: SimState) => boolean,
  timeout = 8000,
): Promise<SimState> {
  const handle = await page.waitForFunction(
    (source) => {
      const s = window.__ZS__!.sim!.state();
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return (new Function('s', `return (${source})(s)`) as (s: unknown) => boolean)(s) ? s : false;
    },
    predicate.toString(),
    { timeout },
  );
  return (await handle.jsonValue()) as SimState;
}

/** Mueve el ratón a un punto relativo a Alex, en píxeles del juego. */
export async function aimFromPlayer(page: Page, dx: number, dy: number): Promise<void> {
  const s = await state(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const scale = box.width / 480;
  // El hombro queda unos 18 px por encima de los pies.
  const gameX = s.player.x - s.cameraX + dx;
  const gameY = s.player.y - 18 + dy;
  await page.mouse.move(box.x + gameX * scale, box.y + gameY * scale);
  await page.waitForTimeout(60);
}

export async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of keys) await page.keyboard.up(key);
}

export async function click(page: Page): Promise<void> {
  await page.mouse.down();
  await page.mouse.up();
}

export function sim(page: Page, call: 'spawnZombie' | 'teleport', x: number): Promise<void> {
  return page.evaluate(([name, value]) => window.__ZS__!.sim![name as 'teleport'](value as number), [call, x] as const);
}

export function clearZombies(page: Page): Promise<void> {
  return page.evaluate(() => window.__ZS__!.sim!.clearZombies());
}
