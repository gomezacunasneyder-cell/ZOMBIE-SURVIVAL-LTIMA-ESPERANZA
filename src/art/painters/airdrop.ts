import { drawText } from '../font';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { paintHelicopterBody } from './vehicles';

/**
 * Arte del lanzamiento de suministros: el Cóndor 7 inclinado al acelerar
 * y al frenar, la carga colgada, las cajas, el paracaídas y sus fases.
 */

// ───────────────────────── Helicóptero ─────────────────────────

/** Margen arriba y abajo de los fotogramas inclinados. */
export const HELI_TILT_PAD = 3;
/** Columna sobre la que pivota la inclinación (cerca del mástil). */
const TILT_PIVOT = 40;

/**
 * Desplazamiento vertical de cada columna del fuselaje al inclinarse
 * (1 = morro abajo, -1 = morro arriba; el morro está a la izquierda).
 * Es un cizallado por columnas, píxel a píxel: no hay rotación ni suavizado.
 */
export function heliTiltShift(x: number, tilt: -1 | 0 | 1): number {
  return tilt * Math.round((TILT_PIVOT - x) / 14);
}

/** Fuselaje inclinado, con el mismo margen en las tres actitudes. */
export function paintHelicopterTilted(tilt: -1 | 0 | 1): PixelBuffer {
  const body = paintHelicopterBody();
  const buf = new PixelBuffer(body.width, body.height + HELI_TILT_PAD * 2);
  for (let x = 0; x < body.width; x++) {
    const dy = HELI_TILT_PAD + heliTiltShift(x, tilt);
    for (let y = 0; y < body.height; y++) {
      const color = body.get(x, y);
      if (color !== 0) buf.set(x, y + dy, color);
    }
  }
  return buf;
}

/** Carga colgada bajo el fuselaje: red con cajas y eslinga. */
export function paintCargoSling(crates: number): PixelBuffer {
  const buf = new PixelBuffer(24, 14);
  buf.vline(12, 0, 4, P.grey3);
  buf.line(12, 3, 3, 6, P.grey3);
  buf.line(12, 3, 21, 6, P.grey3);
  const shown = Math.max(1, Math.min(3, crates));
  for (let i = 0; i < shown; i++) {
    const x = 2 + i * 7;
    buf.rect(x, 6, 7, 7, P.mil3);
    buf.hline(x, 6, 7, P.mil2);
    buf.hline(x, 9, 7, P.ui2);
    buf.vline(x + 6, 7, 6, P.mil4);
  }
  // Red tramada por encima.
  buf.dither(2, 6, shown * 7, 7, P.grey3, 0.25);
  return buf.outline(P.outline);
}

// ───────────────────────── Cajas ─────────────────────────

/** Caja de suministros de Cóndor 7, cerrada: verde militar, banda y cruz. */
export function paintAirdropCrate(): PixelBuffer {
  const buf = new PixelBuffer(18, 15);
  buf.rect(1, 2, 16, 12, P.mil3);
  buf.rect(1, 2, 16, 1, P.mil1);
  buf.rect(1, 3, 16, 1, P.mil2);
  buf.rect(1, 12, 16, 2, P.mil4);
  // Flejes metálicos y banda de señal.
  buf.vline(4, 3, 9, P.grey3);
  buf.vline(13, 3, 9, P.grey3);
  buf.rect(5, 6, 8, 3, P.ui1);
  buf.hline(5, 8, 8, P.ui2);
  buf.rect(8, 5, 2, 5, P.white);
  buf.rect(7, 6, 4, 2, P.white);
  drawText(buf, 'C7', 2, 9, P.mil1);
  // Anillas de la eslinga.
  buf.rect(3, 1, 2, 1, P.grey2);
  buf.rect(13, 1, 2, 1, P.grey2);
  return buf.outline(P.outline);
}

/** Caja abierta: tapa echada atrás y el interior vacío. */
export function paintAirdropCrateOpen(): PixelBuffer {
  const buf = new PixelBuffer(18, 18);
  // Tapa abierta, apoyada detrás.
  buf.trapezoid(0, 3, 14, 3, 2, 15, P.mil2);
  buf.hline(3, 0, 12, P.mil1);
  // Interior oscuro y paja.
  buf.rect(1, 4, 16, 3, P.shadow);
  buf.dither(2, 5, 14, 2, P.yel3, 0.4);
  // Cuerpo.
  buf.rect(1, 7, 16, 10, P.mil3);
  buf.rect(1, 7, 16, 1, P.mil2);
  buf.rect(1, 15, 16, 2, P.mil4);
  buf.vline(4, 8, 7, P.grey3);
  buf.vline(13, 8, 7, P.grey3);
  buf.rect(5, 10, 8, 3, P.ui2);
  return buf.outline(P.outline);
}

// ───────────────────────── Paracaídas ─────────────────────────

export const CHUTE_WIDTH = 28;
export const CHUTE_HEIGHT = 24;
/** Fila del lienzo del paracaídas donde se engancha la caja. */
export const CHUTE_HOOK_Y = CHUTE_HEIGHT - 1;

/**
 * Paracaídas abierto con su balanceo (-1 izquierda, 0 centro, 1 derecha).
 * Gajos alternos blancos y naranjas para verse de noche. Las cuerdas
 * bajan hasta el centro del borde inferior, donde cuelga la caja.
 */
export function paintChute(lean: -1 | 0 | 1): PixelBuffer {
  const buf = new PixelBuffer(CHUTE_WIDTH, CHUTE_HEIGHT);
  const cx = CHUTE_WIDTH / 2 + lean * 2;
  const top = 1;
  // Casquete: semielipse en gajos.
  for (let y = top; y <= top + 7; y++) {
    const k = (y - top) / 7;
    const half = Math.round(12 * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))));
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const gore = Math.floor((x - (cx - 12)) / 4) % 2 === 0;
      const lit = y < top + 3;
      buf.set(x, y, gore ? (lit ? P.white : P.grey1) : lit ? P.org1 : P.org2);
    }
  }
  // Borde inferior ondulado y sombra interior.
  for (let x = Math.round(cx - 12); x <= Math.round(cx + 12); x++) {
    if ((x + lean) % 4 === 0) buf.set(x, top + 8, P.org3);
  }
  // Cuerdas hasta el gancho.
  const hookX = CHUTE_WIDTH / 2;
  for (const edge of [-12, -6, 6, 12]) buf.line(cx + edge, top + 8, hookX, CHUTE_HOOK_Y, P.grey2);
  buf.set(hookX, CHUTE_HOOK_Y, P.grey3);
  return buf.outline(P.outline);
}

/** Paracaídas desplegándose: tela todavía plegada, estrecha y alargada. */
export function paintChuteDeploy(): PixelBuffer {
  const buf = new PixelBuffer(CHUTE_WIDTH, CHUTE_HEIGHT);
  const cx = CHUTE_WIDTH / 2;
  // Tela blanca y naranja todavía arrugada, con las cuerdas tensas.
  buf.rect(cx - 4, 9, 9, 5, P.white);
  buf.rect(cx - 3, 7, 7, 2, P.grey1);
  buf.hline(cx - 4, 11, 9, P.org1);
  buf.set(cx - 2, 9, P.org2);
  buf.set(cx + 2, 12, P.org2);
  buf.line(cx - 4, 14, cx, CHUTE_HOOK_Y, P.grey2);
  buf.line(cx + 4, 14, cx, CHUTE_HOOK_Y, P.grey2);
  return buf.outline(P.outline);
}

export const CHUTE_COLLAPSE_FRAMES = 4;

/** El paracaídas se desinfla y cae sobre el asfalto junto a la caja. */
export function paintChuteCollapse(frame: number): PixelBuffer {
  const buf = new PixelBuffer(CHUTE_WIDTH + 8, CHUTE_HEIGHT);
  const k = Math.min(1, frame / (CHUTE_COLLAPSE_FRAMES - 1));
  const height = Math.round(8 * (1 - k)) + 2;
  const top = CHUTE_HEIGHT - 2 - height - Math.round((1 - k) * 10);
  const cx = CHUTE_WIDTH / 2 + 4 + Math.round(k * 8);
  const half = 10 + Math.round(k * 4);
  buf.ellipse(cx, top + height / 2, half, height / 2, P.org2);
  for (let x = cx - half; x <= cx + half; x += 4) buf.vline(x, top, height, P.grey1);
  buf.hline(cx - half + 2, top, half * 2 - 4, P.org1);
  if (k < 1) buf.line(cx - half, top + height, CHUTE_WIDTH / 2 + 4, CHUTE_HEIGHT - 1, P.grey2);
  return buf.outline(P.outline);
}

// ───────────────────────── Interfaz ─────────────────────────

/** Flecha que señala una caja fuera de la pantalla (apunta a la derecha). */
export function paintCrateArrow(): PixelBuffer {
  return PixelBuffer.fromRows(['gg...', 'gGg..', 'gGGg.', 'gGGGg', 'gGGg.', 'gGg..', 'gg...'], {
    g: P.ui2,
    G: P.ui1,
  }).outline(P.outline);
}
