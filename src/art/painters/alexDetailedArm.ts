import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import { ARM_CANVAS, band, gunArt, type GunPose } from './guns';

/**
 * Brazo del Alex detallado: apunta en cualquier ángulo con cualquier arma
 * y tiene una animación de recarga. Se dibuja en el lienzo común de 48×48
 * con el hombro en el centro; la boca del cañón queda a la distancia que
 * indica el dibujo del arma, de modo que balas y fogonazos salen de ella.
 */

interface ArmOptions extends GunPose {
  /** Ángulo del brazo en grados: 0 = horizontal, positivo = arriba. */
  angle: number;
  weapon: string;
  /** Cargador suelto, relativo al hueco del cargador: [a lo largo, hacia abajo]. */
  looseMagazine?: [along: number, down: number];
  /** Mano de apoyo: posición relativa al hombro [a lo largo, hacia abajo]. */
  supportHand?: [along: number, down: number] | null;
}

function paintArm(options: ArmOptions): PixelBuffer {
  const buf = new PixelBuffer(ARM_CANVAS, ARM_CANVAS);
  const { angle } = options;
  const gun = gunArt(options.weapon);

  gun.back?.(buf, angle, options);
  // Manga: luz arriba, sombra abajo, puño más claro.
  band(buf, angle, 0, 6, -1, 0.5, (side, along) => {
    if (along >= 5) return side < 0 ? P.blue1 : P.blue2;
    return side <= -1 ? P.blue1 : side > 0 ? P.blue3 : P.blue2;
  });
  gun.front(buf, angle, options);
  // Mano sobre la empuñadura.
  band(buf, angle, 6.5, 8, -0.5, 1, (side) => (side >= 1 ? P.skin2 : P.skin1));

  if (options.looseMagazine) {
    const [along, down] = options.looseMagazine;
    const [main, shade] = gun.looseColors;
    const start = gun.magazineAlong + along;
    band(buf, angle, start, start + 1.5, 3 + down, 5 + down, (side) => (side < 3.5 + down ? main : shade));
  }
  const support = options.supportHand === undefined ? gun.supportHand(options) : options.supportHand;
  if (support) {
    const [along, down] = support;
    band(buf, angle, along, along + 1.5, down, down + 1.5, (side) => (side > down + 1 ? P.skin2 : P.skin1));
    band(buf, angle, along - 2.5, along - 0.5, down, down + 1.5, (side) => (side > down + 1 ? P.blue4 : P.blue3));
  }
  return buf.outline(P.outline);
}

/** Brazo con un arma para un ángulo de puntería. */
export function paintDetailedArm(angleDeg: number, weapon = 'pistol', pose: GunPose = {}): PixelBuffer {
  return paintArm({ angle: angleDeg, weapon, ...pose });
}

export const DETAILED_RELOAD_FRAMES = 6;

/**
 * Recarga en 6 fotogramas: baja el arma, suelta el cargador, la otra mano
 * trae uno nuevo, lo inserta, monta el mecanismo y vuelve a apuntar.
 * En la escopeta la «pieza suelta» es un cartucho rojo.
 */
export function paintDetailedReload(weapon = 'pistol'): PixelBuffer[] {
  const gun = gunArt(weapon);
  const m = gun.magazineAlong;
  const rest = gun.supportHand({});
  // Las armas largas se sujetan con las dos manos y montan el cerrojo arriba.
  const rack: [number, number] = rest ? [Math.max(6, m - 2), -3] : [8.5, -3];
  return [
    paintArm({ angle: -18, weapon, supportHand: rest }),
    paintArm({ angle: -34, weapon, magazine: false, looseMagazine: [0, 2], supportHand: null }),
    paintArm({ angle: -36, weapon, magazine: false, supportHand: [m - 4, 6], looseMagazine: [-4.5, 3] }),
    paintArm({ angle: -32, weapon, supportHand: [m - 0.5, 3.5] }),
    paintArm({ angle: -14, weapon, supportHand: rack, pumpBack: gun.pump }),
    paintArm({ angle: -4, weapon }),
  ];
}
