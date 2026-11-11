import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { ARM_CANVAS, ARM_PIVOT } from './alex';

/**
 * Brazo del Alex detallado: apunta en cualquier ángulo y tiene una
 * animación de recarga. Se dibuja en el lienzo común de 48×48 con el
 * hombro en el centro y la boca del cañón a 13 px, igual que el clásico,
 * de modo que balas y fogonazos salen del mismo punto.
 */

interface ArmOptions {
  /** Ángulo del brazo en grados: 0 = horizontal, positivo = arriba. */
  angle: number;
  /** Cargador puesto en la pistola. */
  magazine?: boolean;
  /** Cargador suelto, relativo a la empuñadura: [a lo largo, hacia abajo]. */
  looseMagazine?: [along: number, down: number];
  /** Mano de apoyo: posición relativa al hombro [a lo largo, hacia abajo]. */
  supportHand?: [along: number, down: number];
}

/** Rellena una franja orientada: `along` a lo largo del brazo, `side` hacia abajo del arma. */
function band(
  buf: PixelBuffer,
  angle: number,
  from: number,
  to: number,
  sideFrom: number,
  sideTo: number,
  color: (side: number, along: number) => number,
): void {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const px = Math.sin(a);
  const py = Math.cos(a);
  for (let along = from; along <= to; along += 0.5) {
    for (let side = sideFrom; side <= sideTo; side += 0.5) {
      buf.set(ARM_PIVOT + dx * along + px * side, ARM_PIVOT + dy * along + py * side, color(side, along));
    }
  }
}

function paintArm(options: ArmOptions): PixelBuffer {
  const buf = new PixelBuffer(ARM_CANVAS, ARM_CANVAS);
  const { angle } = options;
  const solid = (c: number) => (): number => c;

  // Manga: luz arriba, sombra abajo, puño más claro.
  band(buf, angle, 0, 6, -1, 0.5, (side, along) => {
    if (along >= 5) return side < 0 ? P.blue1 : P.blue2;
    return side <= -1 ? P.blue1 : side > 0 ? P.blue3 : P.blue2;
  });
  // Pistola: empuñadura, armazón, corredera con brillo y boca del cañón.
  band(buf, angle, 7, 8.5, 0.5, 3, (side) => (side > 2 ? P.brown3 : P.brown2));
  if (options.magazine !== false) band(buf, angle, 7, 8.5, 3, 3.5, solid(P.shadow));
  band(buf, angle, 7, 12, -1.5, 0, (side) => (side <= -1.5 ? P.grey1 : side < -0.5 ? P.grey2 : P.grey3));
  band(buf, angle, 12.5, 12.5, -1.5, 0, solid(P.shadow));
  band(buf, angle, 9.5, 10, 0.5, 1.5, solid(P.shadow));
  // Mano sobre la empuñadura.
  band(buf, angle, 6.5, 8, -0.5, 1, (side) => (side >= 1 ? P.skin2 : P.skin1));

  if (options.looseMagazine) {
    const [along, down] = options.looseMagazine;
    band(buf, angle, 7 + along, 8.5 + along, 3 + down, 5 + down, (side) => (side < 3.5 + down ? P.grey2 : P.grey3));
  }
  if (options.supportHand) {
    const [along, down] = options.supportHand;
    band(buf, angle, along, along + 1.5, down, down + 1.5, (side) => (side > down + 1 ? P.skin2 : P.skin1));
    band(buf, angle, along - 2.5, along - 0.5, down, down + 1.5, (side) => (side > down + 1 ? P.blue4 : P.blue3));
  }
  return buf.outline(P.outline);
}

/** Brazo con pistola para un ángulo de puntería. La boca queda a 13 px del hombro. */
export function paintDetailedArm(angleDeg: number): PixelBuffer {
  return paintArm({ angle: angleDeg });
}

export const DETAILED_RELOAD_FRAMES = 6;

/**
 * Recarga en 6 fotogramas: baja el arma, suelta el cargador, la otra mano
 * trae uno nuevo, lo inserta, monta la corredera y vuelve a apuntar.
 */
export function paintDetailedReload(): PixelBuffer[] {
  return [
    paintArm({ angle: -18 }),
    paintArm({ angle: -34, magazine: false, looseMagazine: [0, 2] }),
    paintArm({ angle: -36, magazine: false, supportHand: [3, 6], looseMagazine: [-4.5, 3] }),
    paintArm({ angle: -32, supportHand: [6.5, 3.5] }),
    paintArm({ angle: -14, supportHand: [8.5, -3] }),
    paintArm({ angle: -4 }),
  ];
}
