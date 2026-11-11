import { Rng } from '../../core/math/Rng';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { LAYER_WIDTH, SKY_HEIGHT, wrapRect, wrapSet } from './scenery';

/**
 * Capas de cielo y ciudad de la Fase 2: cielo nocturno, nubes, una fila
 * de ruinas cercanas, las ventanas que se encienden de noche y la niebla.
 * Todas son repetibles en horizontal para el paralaje.
 */

export const CLOUDS_HEIGHT = 70;
export const CITY_NEAR_HEIGHT = 124;
export const FOG_HEIGHT = 48;

/** Tramado que da la vuelta por los bordes laterales. */
function wrapDither(buf: PixelBuffer, x: number, y: number, w: number, color: number, density: number): void {
  const start = ((x % buf.width) + buf.width) % buf.width;
  if (start + w <= buf.width) buf.dither(start, y, w, 1, color, density);
  else {
    buf.dither(start, y, buf.width - start, 1, color, density);
    buf.dither(0, y, start + w - buf.width, 1, color, density);
  }
}

/** Cielo de noche cerrada: azul profundo, estrellas y luna velada. */
export function paintNightSky(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, SKY_HEIGHT);
  const rng = new Rng(777);
  const bands: [from: number, color: number][] = [
    [0, P.night1],
    [44, P.night2],
    [92, P.night3],
  ];
  buf.fill(P.night1);
  for (let i = 1; i < bands.length; i++) {
    const [from, color] = bands[i] as [number, number];
    buf.rect(0, from, LAYER_WIDTH, SKY_HEIGHT - from, color);
    for (let k = 0; k < 14; k++) buf.dither(0, from - 14 + k, LAYER_WIDTH, 1, color, (k + 1) / 15);
  }
  // Resplandor de la ciudad contaminada en el horizonte.
  buf.dither(0, 104, LAYER_WIDTH, 30, P.asph3, 0.35);

  // Estrellas: pocas y apagadas por la contaminación.
  for (let i = 0; i < 110; i++) {
    const x = rng.int(0, LAYER_WIDTH - 1);
    const y = rng.int(0, 96);
    const bright = rng.chance(0.22);
    buf.set(x, y, bright ? P.white : rng.chance(0.5) ? P.grey1 : P.grey2);
    if (bright && rng.chance(0.4)) {
      buf.set(x - 1, y, P.grey2).set(x + 1, y, P.grey2).set(x, y - 1, P.grey2).set(x, y + 1, P.grey2);
    }
  }
  // Luna con halo y cráteres.
  const mx = 92;
  const my = 38;
  buf.dither(mx - 17, my - 17, 34, 34, P.night3, 0.5);
  buf.ellipse(mx, my, 12, 12, P.night3);
  buf.ellipse(mx, my, 9, 9, P.light1);
  buf.ellipse(mx - 3, my + 2, 2, 2, P.grey1);
  buf.ellipse(mx + 4, my - 3, 1.4, 1.4, P.grey1);
  buf.set(mx + 2, my + 5, P.grey1).set(mx - 5, my - 4, P.grey1);
  buf.dither(mx - 9, my - 9, 6, 18, P.grey1, 0.5, P.light1);
  return buf;
}

/** Nubes bajas y alargadas que derivan con el viento. */
export function paintClouds(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, CLOUDS_HEIGHT);
  const rng = new Rng(4040);
  for (let i = 0; i < 9; i++) {
    const cx = rng.int(0, LAYER_WIDTH - 1);
    const cy = rng.int(8, CLOUDS_HEIGHT - 12);
    const length = rng.int(60, 150);
    const thickness = rng.int(3, 8);
    const color = cy < 30 ? P.skyTop : P.sky1;
    for (let row = -thickness; row <= thickness; row++) {
      const k = 1 - Math.abs(row) / (thickness + 1);
      const w = Math.round(length * (0.45 + k * 0.55));
      const offset = Math.round((length - w) / 2 + Math.sin(row * 0.9 + i) * 6);
      if (k > 0.55) wrapRect(buf, cx + offset, cy + row, w, 1, color);
      else wrapDither(buf, cx + offset, cy + row, w, color, 0.25 + k * 0.6);
    }
    // Borde superior con algo de luz del ocaso.
    wrapDither(buf, cx + 10, cy - thickness, length - 30, P.sky2, 0.4);
  }
  return buf;
}

/** Ruinas cercanas: bloques grandes, vigas al aire y huecos entre ellos. */
export function paintCityNear(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, CITY_NEAR_HEIGHT);
  const rng = new Rng(9191);
  const base = CITY_NEAR_HEIGHT;

  let x = 6;
  while (x < LAYER_WIDTH - 20) {
    const w = rng.int(44, 86);
    const h = rng.int(52, 112);
    const top = base - h;
    wrapRect(buf, x, top, w, h, P.cityNear);
    wrapRect(buf, x + w - 3, top, 3, h, P.cityDark);
    wrapRect(buf, x, top, w, 1, P.cityMid);

    const ruin = rng.int(0, 3);
    if (ruin === 0) {
      // Esquina derrumbada en escalones, con vigas a la vista.
      let bite = rng.int(8, 20);
      for (let step = 0; step < 4 && bite > 0; step++) {
        wrapRect(buf, x + w - bite, top + step * 6, bite, 6, 0);
        wrapRect(buf, x + w - bite - 1, top + step * 6, 1, 6, P.cityDark);
        bite -= rng.int(3, 6);
      }
      for (let k = 0; k < 3; k++) wrapRect(buf, x + w - 14 + k * 4, top - rng.int(2, 8), 1, 10, P.cityDark);
    } else if (ruin === 1) {
      // Depósito de agua en la azotea.
      wrapRect(buf, x + 8, top - 12, 12, 9, P.cityNear);
      wrapRect(buf, x + 8, top - 13, 12, 1, P.cityMid);
      wrapRect(buf, x + 10, top - 3, 1, 3, P.cityDark);
      wrapRect(buf, x + 17, top - 3, 1, 3, P.cityDark);
    } else if (ruin === 2) {
      // Antenas y cartel publicitario roto.
      wrapRect(buf, x + w - 12, top - 18, 1, 18, P.cityDark);
      wrapRect(buf, x + w - 16, top - 14, 9, 1, P.cityDark);
      wrapRect(buf, x + 6, top - 10, 22, 8, P.cityDark);
      wrapRect(buf, x + 8, top - 2, 1, 2, P.cityDark);
      wrapRect(buf, x + 25, top - 2, 1, 2, P.cityDark);
    }

    // Ventanas grandes en rejilla, casi todas a oscuras.
    for (let wy = top + 8; wy < base - 8; wy += 10) {
      for (let wx = 5; wx < w - 9; wx += 9) {
        const px = (((x + wx) % LAYER_WIDTH) + LAYER_WIDTH) % LAYER_WIDTH;
        if (buf.get(px, wy) !== P.cityNear || buf.get(px + 3, wy + 4) !== P.cityNear) continue;
        if (rng.chance(0.86)) wrapRect(buf, x + wx, wy, 4, 5, P.cityDark);
      }
    }
    // Boquete de proyectil.
    if (rng.chance(0.5)) {
      const hx = x + rng.int(8, w - 12);
      const hy = top + rng.int(14, Math.max(15, h - 30));
      wrapRect(buf, hx, hy, 7, 5, P.cityDark);
      wrapRect(buf, hx + 1, hy - 1, 5, 1, P.cityDark);
      wrapSet(buf, hx + 7, hy + 2, P.cityDark);
    }
    x += w + rng.int(18, 54);
  }
  return buf;
}

/**
 * Ventanas encendidas de una capa de ciudad: localiza los huecos de
 * ventana ya pintados y enciende una parte. Va en una capa aparte para
 * que no la oscurezca el tinte nocturno de los edificios.
 */
export function paintCityLights(
  base: PixelBuffer,
  windowColor: number,
  windowWidth: number,
  windowHeight: number,
  fraction: number,
  seed: number,
): PixelBuffer {
  const lights = new PixelBuffer(base.width, base.height);
  const rng = new Rng(seed);
  for (let y = 1; y < base.height - windowHeight; y++) {
    for (let x = 1; x < base.width - windowWidth; x++) {
      if (base.get(x, y) !== windowColor) continue;
      if (base.get(x - 1, y) === windowColor || base.get(x, y - 1) === windowColor) continue;
      let whole = base.get(x + windowWidth, y) !== windowColor && base.get(x, y + windowHeight) !== windowColor;
      for (let dy = 0; whole && dy < windowHeight; dy++) {
        for (let dx = 0; dx < windowWidth; dx++) {
          if (base.get(x + dx, y + dy) !== windowColor) whole = false;
        }
      }
      if (!whole || !rng.chance(fraction)) continue;
      const warm = rng.chance(0.75);
      lights.rect(x, y, windowWidth, windowHeight, warm ? P.yel2 : P.glass1);
      lights.rect(x, y, windowWidth, 1, warm ? P.light2 : P.white);
      // Alguna con la persiana a medio bajar.
      if (rng.chance(0.3)) lights.rect(x, y, windowWidth, 2, warm ? P.yel3 : P.glass2);
    }
  }
  return lights;
}

/** Jirones de niebla a ras de suelo. */
export function paintFog(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, FOG_HEIGHT);
  const rng = new Rng(6161);
  for (let i = 0; i < 14; i++) {
    const cx = rng.int(0, LAYER_WIDTH - 1);
    const cy = rng.int(6, FOG_HEIGHT - 7);
    const length = rng.int(70, 190);
    const thickness = rng.int(3, 6);
    for (let row = -thickness; row <= thickness; row++) {
      const k = 1 - Math.abs(row) / (thickness + 1);
      const w = Math.round(length * (0.3 + k * 0.7));
      wrapDither(buf, cx + Math.round((length - w) / 2), cy + row, w, P.white, 0.2 + k * 0.45);
    }
  }
  return buf;
}
