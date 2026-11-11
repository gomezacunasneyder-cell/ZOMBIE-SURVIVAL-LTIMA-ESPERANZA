import { expect, test, type Page } from '@playwright/test';
import { PALETTE_HEX } from '../../src/art/palette';

/** Espera a que la escena indicada haya terminado de montarse. */
async function waitForScene(page: Page, scene: string): Promise<void> {
  await page.waitForFunction((key) => window.__ZS__?.readyScene === key, scene);
}

/** Colores distintos del fotograma renderizado, a resolución interna. */
async function renderedColors(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const game = window.__ZS__!.game;
        game.renderer.snapshot((snapshot) => {
          const image = snapshot as HTMLImageElement;
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          const colors = new Set<string>();
          for (let i = 0; i < data.length; i += 4) {
            colors.add(
              '#' + [data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join(''),
            );
          }
          resolve([...colors]);
        });
      }),
  );
}

test('arranca sin errores y renderiza el nivel', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/?test=1');
  await waitForScene(page, 'Game');

  const state = await page.evaluate(() => {
    const hook = window.__ZS__!;
    const canvas = document.querySelector('canvas')!;
    return {
      width: canvas.width,
      height: canvas.height,
      renderer: hook.renderer,
      lights: hook.lightCount,
      audio: hook.audioRegistered,
    };
  });
  expect(state).toMatchObject({ width: 480, height: 270, renderer: 'webgl', audio: true });
  expect(state.lights).toBeGreaterThanOrEqual(6);

  // El fotograma tiene contenido real: muchos colores, no una pantalla plana.
  const colors = await renderedColors(page);
  expect(colors.length).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test('la galería solo muestra colores de la paleta (nada borroso)', async ({ page }) => {
  await page.goto('/?scene=gallery&freeze=1');
  await waitForScene(page, 'Gallery');

  const palette = new Set(PALETTE_HEX.filter((hex): hex is string => hex !== null));
  const colors = await renderedColors(page);
  // Un escalado con suavizado crearía tonos intermedios ajenos a la paleta.
  expect(colors.filter((color) => !palette.has(color))).toEqual([]);
  expect(colors.length).toBeGreaterThan(40);
});

test('las texturas usan filtrado «nearest»', async ({ page }) => {
  await page.goto('/?scene=gallery&freeze=1');
  await waitForScene(page, 'Gallery');
  const modes = await page.evaluate(() => {
    const textures = window.__ZS__!.game.textures;
    return ['atlas', 'layer/sky', 'layer/ground', 'font-tiny-sheet'].map(
      (key) => textures.get(key).source[0]!.scaleMode,
    );
  });
  // Phaser.ScaleModes.NEAREST === 1
  expect(modes).toEqual([1, 1, 1, 1]);
});

for (const screen of [
  { width: 1280, height: 720, dpr: 1 },
  { width: 1366, height: 768, dpr: 1.25 },
  { width: 1920, height: 1080, dpr: 1 },
  { width: 1536, height: 864, dpr: 1.5 },
  { width: 900, height: 700, dpr: 2 },
]) {
  test(`escala por píxeles enteros en ${screen.width}×${screen.height} @${screen.dpr}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: screen.width, height: screen.height },
      deviceScaleFactor: screen.dpr,
    });
    const page = await context.newPage();
    await page.goto('/?test=1');
    await waitForScene(page, 'Game');

    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!;
      const box = canvas.getBoundingClientRect();
      return {
        deviceWidth: box.width * window.devicePixelRatio,
        deviceHeight: box.height * window.devicePixelRatio,
        fitsX: box.left >= 0 && box.right <= window.innerWidth,
        fitsY: box.top >= 0 && box.bottom <= window.innerHeight,
        rendering: getComputedStyle(canvas).imageRendering,
      };
    });

    const zoomX = layout.deviceWidth / 480;
    const zoomY = layout.deviceHeight / 270;
    expect(Math.abs(zoomX - Math.round(zoomX))).toBeLessThan(1e-6);
    expect(zoomX).toBeCloseTo(zoomY, 6);
    expect(zoomX).toBeGreaterThanOrEqual(1);
    expect(layout.fitsX && layout.fitsY).toBe(true);
    expect(layout.rendering).toBe('pixelated');
    await context.close();
  });
}
