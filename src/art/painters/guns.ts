import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Armas que sostiene Alex. Cada arma se dibuja en «coordenadas de cañón»:
 * `along` es la distancia desde el hombro a lo largo del arma y `side` la
 * distancia perpendicular (positivo = hacia la culata de abajo). Así un
 * mismo dibujo sirve para los 7 ángulos de puntería sin rotar sprites.
 */

/** Lienzo de las capas de brazo; el hombro queda en su centro. */
export const ARM_CANVAS = 48;
export const ARM_PIVOT = ARM_CANVAS / 2;

type Shade = (side: number, along: number) => number;

/** Rellena una franja orientada: `along` a lo largo del brazo, `side` hacia abajo del arma. */
export function band(
  buf: PixelBuffer,
  angle: number,
  from: number,
  to: number,
  sideFrom: number,
  sideTo: number,
  color: Shade,
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

const solid =
  (c: number): Shade =>
  () =>
    c;

/** Metal con luz arriba y sombra abajo. */
const metal =
  (top: number, bottom: number): Shade =>
  (side) =>
    side <= top ? P.grey1 : side < bottom ? P.grey2 : P.grey3;

export interface GunPose {
  /** Cargador puesto. */
  magazine?: boolean;
  /** Corredera de la escopeta echada atrás. */
  pumpBack?: boolean;
}

export type FlashStyle = 'small' | 'wide' | 'long' | 'heavy';

export interface GunArt {
  /** Distancia del hombro a la boca del cañón. */
  muzzle: number;
  flash: FlashStyle;
  /** Tiene animación de bombeo tras cada disparo. */
  pump: boolean;
  /** Partes que quedan detrás de la manga (culata). */
  back?(buf: PixelBuffer, angle: number, pose: GunPose): void;
  /** Cuerpo del arma, por encima de la manga. */
  front(buf: PixelBuffer, angle: number, pose: GunPose): void;
  /** Mano de apoyo [a lo largo, hacia abajo], o `null` si se dispara a una mano. */
  supportHand(pose: GunPose): [along: number, down: number] | null;
  /** Dónde está el cargador (a lo largo) y sus colores, para la recarga. */
  magazineAlong: number;
  looseColors: [main: number, shade: number];
}

const PISTOL_ART: GunArt = {
  muzzle: 13,
  flash: 'small',
  pump: false,
  magazineAlong: 7,
  looseColors: [P.grey2, P.grey3],
  front(buf, angle, pose) {
    band(buf, angle, 7, 8.5, 0.5, 3, (side) => (side > 2 ? P.brown3 : P.brown2));
    if (pose.magazine !== false) band(buf, angle, 7, 8.5, 3, 3.5, solid(P.shadow));
    band(buf, angle, 7, 12, -1.5, 0, metal(-1.5, -0.5));
    band(buf, angle, 12.5, 12.5, -1.5, 0, solid(P.shadow));
    band(buf, angle, 9.5, 10, 0.5, 1.5, solid(P.shadow));
  },
  supportHand: () => null,
};

const SHOTGUN_ART: GunArt = {
  muzzle: 20,
  flash: 'wide',
  pump: true,
  magazineAlong: 9,
  looseColors: [P.blood1, P.yel2],
  back(buf, angle) {
    // Culata de madera que apoya en el hombro.
    band(buf, angle, -1.5, 5, -0.5, 1.5, (side) => (side < 0 ? P.brown1 : side > 1 ? P.brown3 : P.brown2));
  },
  front(buf, angle, pose) {
    band(buf, angle, 5, 7, 0.5, 2.5, (side) => (side > 2 ? P.brown3 : P.brown2));
    band(buf, angle, 6, 10, -1.5, 0.5, metal(-1.5, 0));
    band(buf, angle, 8, 8.5, 1, 1.5, solid(P.shadow));
    // Cañón y tubo del depósito debajo.
    band(buf, angle, 10, 19.5, -1.5, -0.5, metal(-1.5, -0.5));
    band(buf, angle, 10, 17, 0, 0.5, solid(P.grey3));
    band(buf, angle, 19.5, 20, -1.5, -0.5, solid(P.shadow));
    // Corredera de bombeo, que retrocede al recargar el cartucho.
    const shift = pose.pumpBack ? -2.5 : 0;
    band(buf, angle, 11.5 + shift, 15 + shift, -0.5, 1.5, (side, along) =>
      Math.round(along * 2) % 3 === 0 ? P.brown3 : side > 1 ? P.brown3 : P.brown2,
    );
  },
  supportHand: (pose) => [pose.pumpBack ? 10.5 : 13, 1],
};

const RIFLE_ART: GunArt = {
  muzzle: 20,
  flash: 'long',
  pump: false,
  magazineAlong: 9,
  looseColors: [P.shadow, P.grey3],
  back(buf, angle) {
    band(buf, angle, -1.5, 5, -1, 1.5, (side) => (side < -0.5 ? P.mil2 : side > 1 ? P.mil4 : P.mil3));
  },
  front(buf, angle, pose) {
    // Empuñadura, cajón de mecanismos y asa con riel.
    band(buf, angle, 6.5, 7.5, 0.5, 2.5, solid(P.shadow));
    band(buf, angle, 5, 11, -1.5, 0.5, metal(-1.5, 0));
    band(buf, angle, 6, 10, -2, -2, solid(P.grey3));
    // Cargador curvo.
    if (pose.magazine !== false) {
      band(buf, angle, 9, 10.5, 0.5, 2.5, solid(P.shadow));
      band(buf, angle, 9.5, 11, 2.5, 4, solid(P.shadow));
    }
    // Guardamanos, cañón y punto de mira.
    band(buf, angle, 11, 16, -1.5, 0.5, (side) => (side < -1 ? P.mil2 : side > 0 ? P.mil4 : P.mil3));
    band(buf, angle, 16, 19.5, -1, -0.5, solid(P.grey2));
    band(buf, angle, 16.5, 17, -2.5, -1.5, solid(P.grey3));
  },
  supportHand: () => [13.5, 1],
};

const MACHINE_GUN_ART: GunArt = {
  muzzle: 22,
  flash: 'heavy',
  pump: false,
  magazineAlong: 8,
  looseColors: [P.mil2, P.mil4],
  back(buf, angle) {
    band(buf, angle, -1.5, 4, -1, 1.5, (side) => (side < -0.5 ? P.mil2 : side > 1 ? P.mil4 : P.mil3));
  },
  front(buf, angle, pose) {
    band(buf, angle, 5.5, 7, 1, 2.5, solid(P.shadow));
    band(buf, angle, 4, 12, -2, 1, metal(-2, 0.5));
    // Asa de transporte.
    band(buf, angle, 7.5, 10, -3.5, -3, solid(P.grey3));
    band(buf, angle, 7.5, 7.5, -3, -2.5, solid(P.grey3));
    band(buf, angle, 10, 10, -3, -2.5, solid(P.grey3));
    // Caja de munición con la cinta asomando.
    if (pose.magazine !== false) {
      band(buf, angle, 7.5, 11.5, 1.5, 5, (side) => (side < 2 ? P.mil1 : side > 4.5 ? P.mil4 : P.mil2));
      band(buf, angle, 12, 12.5, 0.5, 1.5, (_, along) => (Math.round(along * 2) % 2 === 0 ? P.yel2 : P.yel3));
    }
    // Camisa perforada del cañón, cañón y bípode plegado.
    band(buf, angle, 12, 18, -1.5, 0, (side, along) =>
      side > -1 && side < -0.5 && Math.round(along * 2) % 4 === 0 ? P.shadow : side < -1 ? P.grey1 : P.grey2,
    );
    band(buf, angle, 18, 21.5, -1, -0.5, solid(P.grey2));
    band(buf, angle, 15, 19, 0.5, 1, solid(P.grey3));
  },
  supportHand: () => [14, 1],
};

/** Dibujo de cada arma, por identificador (el mismo de `content/weapons`). */
export const GUNS: Readonly<Record<string, GunArt>> = {
  pistol: PISTOL_ART,
  shotgun: SHOTGUN_ART,
  rifle: RIFLE_ART,
  mg: MACHINE_GUN_ART,
};

export function gunArt(id: string): GunArt {
  const art = GUNS[id];
  if (!art) throw new Error(`Arma sin dibujo: ${id}`);
  return art;
}

// ───────────────────────── Fogonazos ─────────────────────────

/** Lienzo impar: el centro (la boca del cañón) no se mueve al voltear. */
export const FLASH_CANVAS = 33;
const FLASH_CENTRE = (FLASH_CANVAS - 1) / 2;
export const FLASH_STYLES: readonly FlashStyle[] = ['small', 'wide', 'long', 'heavy'];

/**
 * Fogonazo de dos fases con el centro del lienzo en la boca del cañón.
 * Cada arma tiene su forma: corto en la pistola, abanico ancho en la
 * escopeta, dardo largo en el fusil y estrella en la ametralladora.
 */
export function paintGunFlash(angleDeg: number, style: FlashStyle, stage: 0 | 1): PixelBuffer {
  const buf = new PixelBuffer(FLASH_CANVAS, FLASH_CANVAS);
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const px = Math.sin(a);
  const py = Math.cos(a);
  const at = (dist: number, side = 0): [number, number] => [
    FLASH_CENTRE + dx * dist + px * side + 0.5,
    FLASH_CENTRE + dy * dist + py * side + 0.5,
  ];
  const ray = (from: number, to: number, side: number, color: number, thickness = 1): void => {
    const [x0, y0] = at(from);
    const [x1, y1] = at(to, side);
    buf.line(x0, y0, x1, y1, color, thickness);
  };
  const blob = (dist: number, radius: number, color: number): void => {
    const [cx, cy] = at(dist);
    buf.ellipse(cx, cy, radius, radius, color);
  };

  const size = { small: 1, wide: 1.5, long: 1, heavy: 1.25 }[style];
  if (stage === 1) {
    blob(1 * size, Math.round(2 * size), P.org2);
    blob(1 * size, 1, P.light2);
    ray(1, 5 * size, 0, P.org1);
    if (style === 'wide') {
      ray(1, 6, -3, P.org2);
      ray(1, 6, 3, P.org2);
    }
    return buf;
  }

  // Los pétalos laterales salen en perpendicular desde la boca y la lengua
  // principal se estrecha hacia delante: así el destello «empuja» hacia
  // donde va la bala y nunca parece una flecha que vuelve hacia Alex.
  switch (style) {
    case 'small':
      blob(2, 3, P.org1);
      ray(2, 2, -4, P.light2);
      ray(2, 2, 4, P.light2);
      ray(2, 9, 0, P.light2, 2);
      blob(2, 2, P.light2);
      blob(2, 1, P.light1);
      ray(2, 6, 0, P.light1);
      break;
    case 'wide':
      // Bola ancha con un abanico corto: la escopeta escupe fuego hacia los lados.
      blob(3, 4, P.org1);
      for (const side of [-4, 4]) ray(2, 7, side, P.org1, 2);
      for (const side of [-5, 5]) ray(2, 2, side, P.org2);
      ray(2, 10, 0, P.light2, 2);
      for (const side of [-2, 2]) ray(2, 8, side, P.light2);
      blob(3, 2, P.light2);
      blob(2, 1, P.light1);
      break;
    case 'long':
      // Dardo estrecho y largo con dos pétalos cortos.
      blob(1, 2, P.org1);
      for (const side of [-3, 3]) ray(1, 1, side, P.light2);
      ray(1, 8, 0, P.light2, 2);
      ray(8, 13, 0, P.org1);
      ray(1, 6, 0, P.light1);
      break;
    case 'heavy':
      // Estrella de cuatro puntas con lengua larga.
      blob(2, 3, P.org1);
      for (const side of [-4, 4]) ray(2, 2, side, P.light2);
      for (const side of [-3, 3]) ray(2, 5, side, P.org1);
      ray(2, 9, 0, P.light2, 2);
      ray(9, 12, 0, P.org1);
      blob(2, 2, P.light2);
      blob(2, 1, P.light1);
      break;
  }
  return buf;
}

// ───────────────────────── Proyectiles y casquillos ─────────────────────────

/** Ángulos de las balas en vuelo: cada 5°, para que sigan al cursor sin rotar sprites. */
export const BULLET_ANGLES: readonly number[] = Array.from({ length: 37 }, (_, i) => -90 + i * 5);

/** Ángulo de bala dibujado más cercano a una dirección libre. */
export function bulletAngle(degrees: number): number {
  return Math.max(-90, Math.min(90, Math.round(degrees / 5) * 5));
}

/** Perdigón: punto claro de 2 px con estela anaranjada. */
export function paintPellet(): PixelBuffer {
  return PixelBuffer.fromRows(['oL', 'LW'], { o: P.org1, L: P.light2, W: P.light1 });
}

/** Cartucho de escopeta vacío: tubo rojo con culote de latón. */
export function paintShell(): PixelBuffer {
  return PixelBuffer.fromRows(['yrr', 'ybb'], { y: P.yel2, r: P.blood1, b: P.blood2 });
}

export const IMPACT_FRAMES = 3;

/** Destello de impacto contra algo duro: estrella que se cierra en 3 fotogramas. */
export function paintImpact(frame: number): PixelBuffer {
  const rows = [
    ['..w..', '.wWw.', 'wWWWw', '.wWw.', '..w..'],
    ['.....', '..w..', '.wWw.', '..w..', '.....'],
    ['.....', '.o.o.', '..o..', '.o.o.', '.....'],
  ][frame] as string[];
  return PixelBuffer.fromRows(rows, { w: P.light2, W: P.light1, o: P.org2 });
}
