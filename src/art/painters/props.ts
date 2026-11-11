import { Rng } from '../../core/math/Rng';
import { drawText, textWidth } from '../font';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

function replaceIn(buf: PixelBuffer, x: number, y: number, w: number, h: number, from: number, to: number): void {
  buf.dither(x, y, w, h, to, 1, from);
}

/** Bidón de obra naranja con bandas blancas. */
export function paintBarrel(): PixelBuffer {
  const buf = new PixelBuffer(12, 16);
  buf.rect(1, 2, 10, 13, P.org2);
  buf.rect(2, 1, 8, 1, P.org3);
  buf.rect(2, 2, 8, 1, P.org1);
  for (const y of [5, 10]) {
    buf.rect(1, y, 10, 2, P.white);
    buf.rect(8, y, 3, 2, P.grey1);
  }
  buf.vline(2, 3, 12, P.org1);
  replaceIn(buf, 8, 3, 3, 12, P.org2, P.org3);
  buf.rect(1, 14, 10, 1, P.org3);
  return buf.outline(P.outline);
}

/** Bidón metálico quemado; las llamas van en fotogramas aparte. */
export function paintFireBarrel(): PixelBuffer {
  const buf = new PixelBuffer(12, 16);
  buf.rect(1, 2, 10, 13, P.asph3);
  buf.rect(1, 2, 10, 1, P.org2);
  buf.rect(2, 1, 8, 1, P.org1);
  buf.vline(2, 3, 12, P.asph1);
  replaceIn(buf, 8, 3, 3, 12, P.asph3, P.asph4);
  buf.hline(1, 6, 10, P.asph4);
  buf.hline(1, 11, 10, P.asph4);
  // Agujeros por los que se ve el fuego.
  buf.set(4, 4, P.org1).set(6, 8, P.org2).set(5, 9, P.light2).set(8, 5, P.org2).set(3, 13, P.org3);
  buf.dither(1, 8, 10, 6, P.org3, 0.2, P.asph3);
  return buf.outline(P.outline);
}

/** Barrera de hormigón con franjas de peligro. */
export function paintBarrier(): PixelBuffer {
  const buf = new PixelBuffer(28, 15);
  buf.trapezoid(1, 5, 22, 8, 3, 24, P.white);
  for (let x = -4; x < 30; x += 7) {
    for (let y = 1; y <= 8; y++) {
      for (let k = 0; k < 3; k++) {
        const px = x + k + (8 - y);
        if (buf.get(px, y) === P.white) buf.set(px, y, P.blood1);
      }
    }
  }
  buf.hline(5, 1, 18, P.white);
  buf.rect(1, 9, 26, 5, P.conc2);
  buf.hline(1, 9, 26, P.conc1);
  buf.rect(1, 12, 26, 2, P.conc3);
  buf.set(7, 11, P.conc4).set(8, 12, P.conc4).set(19, 10, P.conc3);
  return buf.outline(P.outline);
}

export function paintCone(): PixelBuffer {
  const buf = new PixelBuffer(9, 11);
  buf.trapezoid(1, 4, 4, 7, 2, 6, P.org2);
  buf.rect(3, 4, 3, 1, P.white);
  buf.rect(2, 6, 5, 1, P.white);
  buf.set(3, 2, P.org1).set(3, 3, P.org1).set(2, 5, P.org1);
  buf.rect(1, 8, 7, 2, P.org3);
  buf.hline(1, 8, 7, P.org2);
  return buf.outline(P.outline);
}

/** Parapeto de sacos terreros. */
export function paintSandbags(): PixelBuffer {
  const buf = new PixelBuffer(34, 15);
  const rows: [y: number, start: number, count: number][] = [
    [11, 1, 4],
    [7, 5, 3],
    [3, 9, 2],
  ];
  for (const [y, start, count] of rows) {
    for (let i = 0; i < count; i++) {
      const x = start + i * 8;
      buf.rect(x, y, 8, 3, P.mil2);
      buf.rect(x + 1, y - 1, 6, 1, P.mil2);
      buf.rect(x + 1, y - 1, 5, 1, P.mil1);
      buf.hline(x, y + 2, 8, P.mil3);
      buf.set(x + 7, y, P.mil4).set(x + 7, y + 1, P.mil4);
      buf.set(x + 3, y + 1, P.mil3);
    }
  }
  return buf.outline(P.outline);
}

/** Farola; la bombilla queda en (11, 5) para colocar la luz. */
export function paintStreetLamp(): PixelBuffer {
  const buf = new PixelBuffer(16, 76);
  buf.rect(3, 6, 2, 68, P.grey3);
  buf.vline(3, 6, 68, P.grey2);
  buf.rect(2, 66, 4, 8, P.grey3);
  buf.vline(2, 66, 8, P.grey2);
  buf.rect(1, 73, 6, 2, P.shadow);
  // Brazo y luminaria.
  buf.line(4, 6, 6, 3, P.grey3);
  buf.hline(6, 2, 8, P.grey3);
  buf.rect(8, 3, 7, 2, P.grey3);
  buf.hline(8, 3, 7, P.grey2);
  buf.rect(9, 5, 5, 1, P.light1);
  // Cartel pegado al poste.
  buf.rect(2, 40, 4, 5, P.white);
  buf.hline(3, 42, 2, P.grey2);
  return buf.outline(P.outline);
}

/** Torre de iluminación con generador; los focos quedan en la parte alta. */
export function paintLightTower(): PixelBuffer {
  const buf = new PixelBuffer(30, 62);
  // Mástil telescópico.
  buf.rect(14, 8, 2, 38, P.grey2);
  buf.vline(15, 8, 38, P.grey3);
  buf.rect(13, 26, 4, 20, P.grey3);
  buf.vline(13, 26, 20, P.grey2);
  buf.line(9, 46, 14, 34, P.grey3);
  buf.line(20, 46, 15, 34, P.grey3);
  // Panel de focos.
  buf.rect(5, 1, 20, 8, P.shadow);
  buf.rect(5, 1, 20, 1, P.grey3);
  for (let i = 0; i < 4; i++) {
    buf.rect(7 + i * 4, 3, 3, 4, P.light1);
    buf.rect(7 + i * 4, 6, 3, 1, P.light2);
  }
  // Generador sobre ruedas.
  buf.rect(3, 46, 24, 10, P.yel2);
  buf.rect(3, 46, 24, 1, P.yel1);
  buf.rect(3, 54, 24, 2, P.yel3);
  buf.rect(6, 49, 7, 4, P.shadow);
  buf.hline(7, 50, 5, P.grey3);
  buf.hline(7, 52, 5, P.grey3);
  buf.rect(17, 49, 2, 2, P.blood1);
  buf.rect(21, 49, 2, 2, P.ui1);
  buf.dither(3, 47, 24, 7, P.yel3, 0.15, P.yel2);
  buf.ellipse(8, 58, 2.5, 2.5, P.outline);
  buf.ellipse(22, 58, 2.5, 2.5, P.outline);
  buf.set(8, 58, P.grey3).set(22, 58, P.grey3);
  buf.line(27, 54, 29, 59, P.grey3);
  return buf.outline(P.outline);
}

/** Tienda de campaña militar. */
export function paintTent(): PixelBuffer {
  const buf = new PixelBuffer(112, 54);
  const rng = new Rng(4211);
  // Techo a dos aguas.
  buf.trapezoid(1, 30, 82, 20, 2, 109, P.conc2);
  buf.hline(30, 1, 53, P.conc1);
  buf.trapezoid(2, 30, 60, 8, 22, 64, P.conc1);
  buf.dither(56, 3, 54, 18, P.conc3, 0.5, P.conc2);
  for (const x of [34, 56, 78]) buf.line(x, 2, x + (x - 56) * 0.5, 20, P.conc3);
  // Alero.
  buf.rect(2, 20, 108, 2, P.conc3);
  buf.hline(2, 20, 108, P.conc1);
  // Paredes de lona.
  buf.rect(4, 22, 104, 30, P.conc3);
  for (let x = 4; x < 108; x += 13) buf.vline(x, 22, 30, P.conc4);
  buf.dither(4, 40, 104, 12, P.conc4, 0.4, P.conc3);
  buf.rect(4, 50, 104, 2, P.conc4);
  // Entrada abierta con la lona recogida.
  buf.trapezoid(24, 46, 66, 51, 42, 70, P.shadow);
  buf.line(46, 24, 41, 51, P.conc2);
  buf.line(66, 24, 71, 51, P.conc2);
  buf.rect(52, 40, 8, 12, P.outline);
  // Ventanas de plástico y cruz roja.
  for (const x of [14, 86]) {
    buf.rect(x, 28, 12, 8, P.conc4);
    buf.rect(x + 1, 29, 10, 6, P.glass2);
    buf.line(x + 2, 33, x + 5, 30, P.glass1);
    buf.vline(x + 6, 29, 6, P.conc4);
  }
  buf.rect(53, 8, 6, 6, P.white);
  buf.rect(55, 9, 2, 4, P.blood1);
  buf.rect(54, 10, 4, 2, P.blood1);
  // Manchas.
  for (let i = 0; i < 40; i++) {
    const x = rng.int(5, 106);
    const y = rng.int(23, 50);
    if (buf.get(x, y) === P.conc3) buf.set(x, y, P.conc4);
  }
  buf.rect(74, 44, 5, 3, P.blood2);
  buf.vline(76, 47, 3, P.blood3);
  // Vientos y estacas.
  buf.line(2, 21, 0, 52, P.grey3);
  buf.line(109, 21, 111, 52, P.grey3);
  return buf.outline(P.outline);
}

/** Cartel luminoso de carretera con texto propio. */
export function paintLedSign(): PixelBuffer {
  const buf = new PixelBuffer(46, 44);
  buf.rect(1, 1, 44, 21, P.grey3);
  buf.rect(2, 2, 42, 19, P.outline);
  buf.hline(1, 1, 44, P.grey2);
  // Matriz de puntos apagada de fondo y texto ámbar.
  buf.dither(3, 3, 40, 17, P.shadow, 0.5, P.outline);
  const lines = ['ZONA DE', 'RESCATE'];
  lines.forEach((text, i) => {
    const x = Math.floor((46 - textWidth(text)) / 2);
    drawText(buf, text, x, 5 + i * 8, P.org1);
  });
  buf.hline(8, 12, 30, P.org3);
  // Patas y base con peso.
  buf.rect(8, 22, 2, 20, P.grey3);
  buf.rect(36, 22, 2, 20, P.grey3);
  buf.line(9, 30, 36, 24, P.grey3);
  buf.rect(4, 41, 10, 2, P.shadow);
  buf.rect(32, 41, 10, 2, P.shadow);
  buf.rect(20, 23, 6, 4, P.yel2);
  buf.hline(20, 23, 6, P.yel1);
  return buf.outline(P.outline);
}

/** Caja de madera. */
export function paintCrate(): PixelBuffer {
  const buf = new PixelBuffer(16, 14);
  buf.rect(1, 1, 14, 12, P.brown2);
  buf.rect(1, 1, 14, 1, P.brown1);
  buf.rect(1, 12, 14, 1, P.brown3);
  buf.vline(1, 1, 12, P.brown1);
  buf.vline(14, 1, 12, P.brown3);
  buf.line(2, 11, 13, 2, P.brown3);
  buf.hline(2, 5, 12, P.brown3);
  buf.hline(2, 9, 12, P.brown3);
  return buf.outline(P.outline);
}

/** Caja de suministros de Cóndor 7: verde militar con banda de señal. */
export function paintSupplyCrate(): PixelBuffer {
  const buf = new PixelBuffer(18, 15);
  buf.rect(1, 2, 16, 12, P.mil3);
  buf.rect(1, 2, 16, 1, P.mil1);
  buf.rect(1, 12, 16, 2, P.mil4);
  buf.rect(1, 6, 16, 3, P.ui1);
  buf.hline(1, 8, 16, P.ui2);
  buf.rect(7, 4, 4, 7, P.white);
  buf.rect(8, 5, 2, 5, P.blood1);
  buf.rect(7, 7, 4, 1, P.blood1);
  buf.rect(3, 1, 3, 1, P.grey3);
  buf.rect(12, 1, 3, 1, P.grey3);
  return buf.outline(P.outline);
}

/** Bolsa mortuoria. */
export function paintBodyBag(): PixelBuffer {
  const buf = new PixelBuffer(26, 9);
  buf.ellipse(13, 5, 11, 2.6, P.asph4);
  buf.ellipse(6, 4, 4, 2.4, P.asph4);
  buf.hline(4, 3, 16, P.asph2);
  buf.hline(8, 2, 6, P.asph1);
  buf.hline(5, 5, 17, P.grey3);
  buf.rect(11, 4, 3, 2, P.yel2);
  return buf.outline(P.outline);
}

/** Manchas de sangre para pegar sobre el suelo (3 variantes). */
export function paintBloodDecal(variant: number): PixelBuffer {
  const rng = new Rng(900 + variant * 31);
  const buf = new PixelBuffer(22, 8);
  const blobs = 3 + variant;
  for (let i = 0; i < blobs; i++) {
    buf.ellipse(rng.int(5, 16), rng.int(2, 5), rng.int(2, 5), rng.int(1, 2), P.blood2);
  }
  for (let i = 0; i < 8; i++) buf.set(rng.int(0, 21), rng.int(0, 7), P.blood2);
  for (let i = 0; i < 5; i++) {
    const x = rng.int(5, 16);
    const y = rng.int(2, 5);
    if (buf.get(x, y) === P.blood2) buf.rect(x, y, 2, 1, P.blood3);
  }
  return buf;
}

/** Sombra de contacto bajo personajes; se dibuja semitransparente. */
export function paintContactShadow(): PixelBuffer {
  const buf = new PixelBuffer(16, 5);
  buf.ellipse(7.5, 2, 7, 1.6, P.outline);
  return buf;
}

export const FIRE_FRAMES = 6;

/** Llama animada (6 fotogramas) para bidones y hogueras. */
export function paintFire(frame: number): PixelBuffer {
  const buf = new PixelBuffer(12, 18);
  const rng = new Rng(300 + frame * 17);
  for (let x = 1; x < 11; x++) {
    const centre = 1 - Math.abs(x - 5.5) / 5.5;
    const wave = Math.sin((x * 1.3 + frame * 1.05) * 1.7) * 2.2;
    const height = Math.max(2, Math.round(4 + centre * 10 + wave + rng.int(-1, 1)));
    for (let h = 0; h < height; h++) {
      const y = 17 - h;
      const t = h / height;
      const core = centre > 0.45;
      let color: number = P.org2;
      if (t < 0.25) color = core ? P.light1 : P.yel1;
      else if (t < 0.5) color = core ? P.yel1 : P.org1;
      else if (t < 0.78) color = P.org1;
      else color = t > 0.9 ? P.blood1 : P.org2;
      buf.set(x, y, color);
    }
  }
  // Chispas sueltas.
  buf.set(rng.int(2, 9), rng.int(0, 4), P.org1);
  buf.set(rng.int(2, 9), rng.int(1, 6), P.yel1);
  return buf;
}
