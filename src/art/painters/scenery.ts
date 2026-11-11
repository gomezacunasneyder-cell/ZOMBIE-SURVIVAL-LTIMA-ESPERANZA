import { Rng } from '../../core/math/Rng';
import { drawText, textWidth } from '../font';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Capas de escenario. Todas miden 480 px de ancho y, salvo el cielo, se
 * repiten sin costura (lo que sale por la derecha entra por la izquierda)
 * para usarlas como fondo con desplazamiento de paralaje.
 */

export const LAYER_WIDTH = 480;
export const SKY_HEIGHT = 270;
export const CITY_FAR_HEIGHT = 80;
export const CITY_MID_HEIGHT = 112;
export const WALL_HEIGHT = 78;
export const GROUND_HEIGHT = 100;
export const FOREGROUND_HEIGHT = 40;

/** Rectángulo que da la vuelta por los bordes laterales. */
export function wrapRect(buf: PixelBuffer, x: number, y: number, w: number, h: number, color: number): void {
  const start = ((x % buf.width) + buf.width) % buf.width;
  if (start + w <= buf.width) buf.rect(start, y, w, h, color);
  else {
    buf.rect(start, y, buf.width - start, h, color);
    buf.rect(0, y, start + w - buf.width, h, color);
  }
}

export function wrapSet(buf: PixelBuffer, x: number, y: number, color: number): void {
  buf.set(((x % buf.width) + buf.width) % buf.width, y, color);
}

/** Cielo de atardecer: bandas con tramado, sol velado y columnas de humo. */
export function paintSky(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, SKY_HEIGHT);
  const bands: [from: number, color: number][] = [
    [0, P.skyTop],
    [16, P.sky1],
    [40, P.sky2],
    [66, P.sky3],
    [94, P.sky4],
  ];
  buf.fill(P.skyTop);
  for (let i = 1; i < bands.length; i++) {
    const [from, color] = bands[i] as [number, number];
    buf.rect(0, from, LAYER_WIDTH, SKY_HEIGHT - from, color);
    // Transición tramada de 10 filas con la banda anterior.
    for (let k = 0; k < 10; k++) {
      buf.dither(0, from - 10 + k, LAYER_WIDTH, 1, color, (k + 1) / 11);
    }
  }

  // Sol bajo y velado por la contaminación.
  buf.ellipse(338, 92, 15, 15, P.sky4);
  buf.ellipse(338, 92, 11, 11, P.sun);
  // Jirones de nube horizontales.
  const rng = new Rng(1313);
  for (let i = 0; i < 16; i++) {
    const y = rng.int(22, 104);
    const x = rng.int(-40, 460);
    const w = rng.int(40, 130);
    const color = y < 44 ? P.skyTop : y < 70 ? P.sky1 : P.sky2;
    buf.rect(x, y, w, 1, color);
    buf.rect(x + 8, y + 1, w - 20, 1, color);
    buf.dither(x - 6, y, w + 12, 2, color, 0.5);
  }
  // Columnas de humo que suben de la ciudad y derivan con el viento.
  for (const base of [72, 214, 402]) {
    for (let y = 118; y > 18; y--) {
      const rise = 118 - y;
      const cx = base + rise * 0.45 + Math.sin(rise * 0.11 + base) * 4;
      const half = 2 + rise * 0.09;
      const density = Math.max(0.12, 0.7 - rise * 0.006);
      buf.dither(Math.round(cx - half), y, Math.round(half * 2), 1, P.skyTop, density);
    }
  }
  return buf;
}

/** Silueta lejana de la ciudad. */
export function paintCityFar(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, CITY_FAR_HEIGHT);
  const rng = new Rng(2024);
  let x = 0;
  while (x < LAYER_WIDTH) {
    const w = rng.int(12, 30);
    const h = rng.int(20, 62);
    const top = CITY_FAR_HEIGHT - h;
    wrapRect(buf, x, top, w, h, P.cityFar);
    const kind = rng.int(0, 5);
    if (kind === 0) wrapRect(buf, x + Math.floor(w / 2), top - rng.int(5, 12), 1, 12, P.cityFar);
    else if (kind === 1) wrapRect(buf, x + 3, top - 4, w - 6, 4, P.cityFar);
    else if (kind === 2) {
      // Remate derruido.
      for (let k = 0; k < w; k += 2) wrapRect(buf, x + k, top - rng.int(0, 5), 2, 6, P.cityFar);
    }
    // Ventanas apenas insinuadas.
    for (let wy = top + 4; wy < CITY_FAR_HEIGHT - 4; wy += 5) {
      for (let wx = 2; wx < w - 2; wx += 4) {
        if (rng.chance(0.3)) wrapSet(buf, x + wx, wy, P.cityMid);
      }
    }
    x += w + rng.int(-2, 6);
  }
  // Bruma en la base.
  buf.dither(0, CITY_FAR_HEIGHT - 16, LAYER_WIDTH, 16, P.sky4, 0.3, P.cityFar);
  return buf;
}

/** Edificios en ruinas a media distancia, con alguna ventana encendida. */
export function paintCityMid(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, CITY_MID_HEIGHT);
  const rng = new Rng(5150);

  const building = (x: number, w: number, h: number, wall: number, dark: number, lit: number): void => {
    const top = CITY_MID_HEIGHT - h;
    wrapRect(buf, x, top, w, h, wall);
    wrapRect(buf, x + w - 2, top, 2, h, dark);
    // Remate: liso, con depósito o derruido.
    const kind = rng.int(0, 3);
    if (kind === 0) {
      for (let k = 0; k < w; k += 3) {
        const bite = rng.int(0, 7);
        wrapRect(buf, x + k, top, 3, bite, 0);
      }
    } else if (kind === 1) {
      wrapRect(buf, x + 3, top - 6, 7, 6, wall);
      wrapRect(buf, x + 4, top - 8, 5, 2, dark);
    } else if (kind === 2) {
      wrapRect(buf, x + w - 6, top - 14, 1, 14, dark);
      wrapRect(buf, x + w - 9, top - 11, 7, 1, dark);
    }
    // Ventanas en rejilla.
    for (let wy = top + 8; wy < CITY_MID_HEIGHT - 6; wy += 8) {
      for (let wx = 3; wx < w - 6; wx += 6) {
        const px = ((x + wx) % LAYER_WIDTH + LAYER_WIDTH) % LAYER_WIDTH;
        if (buf.get(px, wy) !== wall) continue;
        const roll = rng.next();
        if (roll < 0.04) {
          wrapRect(buf, x + wx, wy, 3, 4, lit);
          wrapSet(buf, x + wx, wy, P.light1);
        } else if (roll < 0.8) wrapRect(buf, x + wx, wy, 3, 4, dark);
      }
    }
  };

  let x = 0;
  while (x < LAYER_WIDTH) {
    const w = rng.int(26, 52);
    building(x, w, rng.int(48, 104), P.cityMid, P.cityNear, P.yel2);
    x += w + rng.int(-4, 10);
  }
  return buf;
}

/** Muro de hormigón del perímetro con alambrada, carteles y pintadas. */
export function paintWall(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, WALL_HEIGHT);
  const rng = new Rng(8088);
  const top = 12;

  buf.rect(0, top, LAYER_WIDTH, WALL_HEIGHT - top, P.conc2);
  buf.rect(0, top, LAYER_WIDTH, 2, P.conc1);
  buf.rect(0, top + 2, LAYER_WIDTH, 1, P.conc3);
  // Zócalo oscuro con transición tramada.
  buf.rect(0, WALL_HEIGHT - 9, LAYER_WIDTH, 9, P.conc3);
  buf.dither(0, WALL_HEIGHT - 15, LAYER_WIDTH, 6, P.conc3, 0.5, P.conc2);
  buf.rect(0, WALL_HEIGHT - 2, LAYER_WIDTH, 2, P.conc4);

  // Juntas entre paneles y anclajes.
  for (let x = 0; x < LAYER_WIDTH; x += 40) {
    buf.vline(x, top + 3, WALL_HEIGHT - top - 3, P.conc3);
    buf.vline(x + 1, top + 3, WALL_HEIGHT - top - 5, P.conc1);
    buf.rect(x + 18, top + 8, 2, 2, P.conc3);
    buf.rect(x + 18, top + 44, 2, 2, P.conc4);
  }
  // Chorreones de humedad y desconchones.
  for (let i = 0; i < 46; i++) {
    const x = rng.int(0, LAYER_WIDTH - 3);
    const len = rng.int(6, 34);
    buf.dither(x, top + 3, rng.int(1, 3), len, P.conc3, 0.5, P.conc2);
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.int(2, LAYER_WIDTH - 8);
    const y = rng.int(top + 6, WALL_HEIGHT - 16);
    const w = rng.int(2, 5);
    if (buf.get(x, y) !== P.conc2) continue;
    buf.rect(x, y, w, rng.int(1, 3), P.conc3);
    buf.hline(x, y - 1, w, P.conc1);
  }
  // Grietas.
  for (let i = 0; i < 8; i++) {
    let x = rng.int(10, LAYER_WIDTH - 10);
    let y = top + 3;
    const len = rng.int(10, 40);
    for (let k = 0; k < len; k++) {
      buf.set(x, y, P.conc4);
      y += 1;
      x += rng.int(-1, 1);
    }
  }

  // Carteles de desaparecidos.
  for (const px of [52, 60, 291, 300, 309, 421]) {
    const py = rng.int(top + 20, top + 30);
    buf.rect(px, py, 7, 9, P.white);
    buf.rect(px + 2, py + 1, 3, 3, P.grey2);
    buf.hline(px + 1, py + 5, 5, P.grey2);
    buf.hline(px + 1, py + 7, 4, P.grey1);
    buf.set(px + 6, py + 8, P.conc2);
  }

  // Pintadas con goterones.
  const graffiti = (text: string, x: number, y: number, scale: number): void => {
    drawText(buf, text, x, y, P.blood1, scale);
    const width = textWidth(text, scale);
    for (let i = 0; i < Math.floor(width / 9); i++) {
      const dx = x + rng.int(0, width);
      if (buf.get(dx, y + 5 * scale - 1) === P.blood1) buf.vline(dx, y + 5 * scale, rng.int(2, 9), P.blood2);
    }
  };
  graffiti('NO HAY CURA', 96, top + 14, 2);
  graffiti('Z-13', 348, top + 10, 3);
  graffiti('AYUDA', 204, top + 36, 1);
  // Flecha hacia la zona de rescate.
  buf.hline(404, top + 40, 22, P.white);
  buf.line(426, top + 40, 421, top + 36, P.white);
  buf.line(426, top + 40, 421, top + 44, P.white);
  // Salpicadura.
  buf.dither(250, top + 22, 14, 10, P.blood2, 0.4, P.conc2);
  buf.ellipse(257, top + 27, 3, 2, P.blood2);

  // Alambrada de espino: postes inclinados, cables y espiral.
  for (let x = 0; x < LAYER_WIDTH; x += 40) {
    buf.line(x + 20, top, x + 23, 2, P.grey3);
    buf.set(x + 20, top - 1, P.grey2);
  }
  buf.hline(0, 4, LAYER_WIDTH, P.shadow);
  for (let x = 0; x < LAYER_WIDTH; x++) {
    const t = (x % 8) / 8;
    const y = 6 + Math.round(Math.sin(t * Math.PI * 2) * 3.4);
    buf.set(x, y, P.shadow);
    const y2 = 6 + Math.round(Math.cos(t * Math.PI * 2) * 3.4);
    if (x % 2 === 0) buf.set(x, y2, P.grey3);
    if (x % 8 === 3) buf.set(x, y - 1, P.grey2);
  }
  return buf;
}

/** Acera, bordillo y calzada agrietada. */
export function paintGround(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, GROUND_HEIGHT);
  const rng = new Rng(6606);
  const road = 17;

  // Acera de losas.
  buf.rect(0, 0, LAYER_WIDTH, 14, P.conc3);
  buf.rect(0, 0, LAYER_WIDTH, 1, P.conc4);
  buf.hline(0, 7, LAYER_WIDTH, P.conc4);
  for (let x = 0; x < LAYER_WIDTH; x += 16) {
    buf.vline(x, 1, 6, P.conc4);
    buf.vline(x + 8, 8, 6, P.conc4);
  }
  buf.dither(0, 1, LAYER_WIDTH, 13, P.conc2, 0.12, P.conc3);
  // Bordillo.
  buf.rect(0, 14, LAYER_WIDTH, 1, P.conc1);
  buf.rect(0, 15, LAYER_WIDTH, 1, P.conc2);
  buf.rect(0, 16, LAYER_WIDTH, 1, P.conc4);

  // Calzada.
  buf.rect(0, road, LAYER_WIDTH, GROUND_HEIGHT - road, P.asph2);
  buf.rect(0, road, LAYER_WIDTH, 2, P.asph4);
  buf.dither(0, road + 2, LAYER_WIDTH, 5, P.asph3, 0.5, P.asph2);
  // Parches de asfalto más oscuro.
  for (let i = 0; i < 9; i++) {
    const x = rng.int(0, LAYER_WIDTH - 60);
    const y = rng.int(road + 8, GROUND_HEIGHT - 22);
    const w = rng.int(24, 64);
    const h = rng.int(5, 12);
    buf.dither(x, y, w, h, P.asph3, 0.5, P.asph2);
    buf.dither(x + 3, y + 1, w - 6, h - 2, P.asph3, 0.8, P.asph2);
  }
  // Grano del asfalto.
  for (let i = 0; i < 1500; i++) {
    const x = rng.int(0, LAYER_WIDTH - 1);
    const y = rng.int(road + 3, GROUND_HEIGHT - 1);
    const here = buf.get(x, y);
    if (here === P.asph2) buf.set(x, y, rng.chance(0.4) ? P.asph1 : P.asph3);
    else if (here === P.asph3 && rng.chance(0.3)) buf.set(x, y, P.asph4);
  }
  // Línea discontinua central, gastada.
  const laneY = 64;
  for (let x = 6; x < LAYER_WIDTH; x += 48) {
    buf.rect(x, laneY, 22, 2, P.lane);
    buf.dither(x, laneY, 22, 2, P.asph2, 0.3, P.lane);
    buf.hline(x + 1, laneY + 2, 21, P.asph3);
  }
  // Línea continua de borde.
  buf.rect(0, 90, LAYER_WIDTH, 2, P.lane);
  buf.dither(0, 90, LAYER_WIDTH, 2, P.asph2, 0.25, P.lane);
  buf.hline(0, 92, LAYER_WIDTH, P.asph3);
  buf.rect(0, 95, LAYER_WIDTH, 5, P.asph3);
  buf.dither(0, 93, LAYER_WIDTH, 2, P.asph3, 0.5, P.asph2);
  // Grietas ramificadas.
  for (let i = 0; i < 14; i++) {
    let x = rng.int(0, LAYER_WIDTH - 1);
    let y = rng.int(road + 4, GROUND_HEIGHT - 12);
    const len = rng.int(8, 28);
    for (let k = 0; k < len; k++) {
      buf.set(x, y, P.asph4);
      x += rng.int(0, 2);
      y += rng.int(-1, 1);
      if (x >= LAYER_WIDTH || y < road + 3 || y >= GROUND_HEIGHT - 6) break;
    }
  }
  // Tapas de alcantarilla.
  for (const [mx, my] of [
    [150, 44],
    [372, 78],
  ] as const) {
    buf.ellipse(mx, my, 7, 2.6, P.asph4);
    buf.ellipse(mx, my, 5, 1.6, P.asph3);
    buf.hline(mx - 4, my, 9, P.asph4);
    buf.hline(mx - 5, my - 2, 10, P.asph1);
  }
  // Papeles y restos.
  for (let i = 0; i < 22; i++) {
    const x = rng.int(0, LAYER_WIDTH - 3);
    const y = rng.int(road + 4, GROUND_HEIGHT - 4);
    buf.rect(x, y, rng.int(1, 2), 1, rng.chance(0.6) ? P.grey1 : P.white);
  }
  // Huellas de frenada.
  for (let k = 0; k < 70; k++) {
    const x = 250 + k;
    const y = 36 + Math.round(k * 0.12);
    buf.dither(x, y, 1, 2, P.asph4, 0.5);
    buf.dither(x + 4, y + 9, 1, 2, P.asph4, 0.5);
  }
  return buf;
}

/** Primer plano: siluetas oscuras de escombros, vallas y maleza. */
export function paintForeground(): PixelBuffer {
  const buf = new PixelBuffer(LAYER_WIDTH, FOREGROUND_HEIGHT);
  const rng = new Rng(3003);
  const base = FOREGROUND_HEIGHT;

  // Montones de escombros.
  for (let i = 0; i < 7; i++) {
    const cx = rng.int(0, LAYER_WIDTH);
    const w = rng.int(26, 70);
    const h = rng.int(6, 16);
    for (let k = 0; k < w; k++) {
      const t = k / w;
      const height = Math.round(Math.sin(t * Math.PI) * h + rng.int(0, 2));
      wrapRect(buf, cx + k, base - height, 1, height, P.outline);
      if (height > 2) wrapSet(buf, cx + k, base - height, P.shadow);
    }
  }
  // Valla rota con postes inclinados y alambre.
  for (let x = 20; x < LAYER_WIDTH; x += rng.int(34, 80)) {
    const tilt = rng.int(-4, 4);
    const h = rng.int(18, 34);
    buf.line(x, base, x + tilt, base - h, P.outline, 2);
    buf.set(x + tilt, base - h, P.shadow);
    if (rng.chance(0.6)) {
      const span = rng.int(20, 44);
      for (let k = 0; k < span; k++) {
        const sag = Math.round(Math.sin((k / span) * Math.PI) * 5);
        wrapSet(buf, x + tilt + k, base - h + 3 + sag, P.outline);
      }
    }
  }
  // Maleza.
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, LAYER_WIDTH - 1);
    const h = rng.int(2, 7);
    buf.line(x, base, x + rng.int(-2, 2), base - h, P.cityDark);
  }
  buf.rect(0, base - 2, LAYER_WIDTH, 2, P.outline);
  return buf;
}
