import { ARM_CANVAS, ARM_PIVOT, gunArt, type GunPose } from './guns';
import { AIM_ANGLES } from '../../core/combat/aim';
import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import {
  paintCollapse,
  paintHumanoid,
  stridePose,
  type HumanoidFrame,
  type HumanoidLook,
} from '../rig/humanoid';

export { AIM_ANGLES };

/**
 * Alex, el protagonista. Diseño propio: chaqueta azul (único azul saturado
 * del juego, para localizarlo entre la multitud), pañuelo rojo y mochila.
 */

const HEAD = PixelBuffer.fromRows(
  [
    '..hhhhh..',
    '.hHHHHhh.',
    'hHHHhhhhh',
    'hhhhhhsss',
    'hhhssssss',
    'hhdssksks',
    'hhSssksks',
    '.hSssssss',
    '..SSsdds.',
    '...SSSs..',
  ],
  { h: P.brown3, H: P.brown2, s: P.skin1, S: P.skin2, d: P.skin3, k: P.outline },
);

const LOOK: HumanoidLook = {
  head: HEAD,
  torso: [P.blue1, P.blue2, P.blue3],
  sleeve: [P.blue1, P.blue2, P.blue3],
  hand: P.skin1,
  legs: [P.brown1, P.brown2, P.brown3],
  boots: [P.grey3, P.shadow],
  backpack: [P.mil2, P.mil3, P.mil4],
  torsoDetail(buf, torso) {
    const left = torso.left(0);
    // Pañuelo rojo al cuello, con la punta colgando por la espalda.
    buf.rect(left + 2, torso.top, 5, 1, P.blood1);
    buf.set(left + 6, torso.top + 1, P.blood2);
    buf.set(left + 1, torso.top + 1, P.blood1);
    buf.set(left + 1, torso.top + 2, P.blood2);
    // Correa de la mochila cruzando el pecho.
    for (let row = 2; row < 7; row++) buf.set(torso.left(row) + row, torso.top + row, P.mil4);
    // Cremallera, bolsillo y cinturón con hebilla.
    buf.rect(torso.left(4) + 6, torso.top + 2, 1, 5, P.blue3);
    buf.rect(torso.left(5) + 2, torso.top + 5, 2, 1, P.blue1);
    const beltY = torso.top + torso.height - 1;
    buf.rect(torso.left(8), beltY, torso.width, 1, P.brown3);
    buf.set(torso.left(8) + 5, beltY, P.yel2);
    // Funda de la pistola en la cadera.
    buf.rect(torso.left(8) + 1, beltY + 1, 2, 2, P.shadow);
  },
};

/** Brazo lejano doblado, como sujetando el arma con las dos manos. */
const SUPPORT_ARM = { upper: 0.55, bend: 0.9 };

/** Reposo: respiración de 4 fotogramas. El brazo cercano lo pone la capa de puntería. */
export function paintAlexIdle(): HumanoidFrame[] {
  return [0, 0, 1, 1].map((breath) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.12, bend: 0 },
      backLeg: { upper: -0.2, bend: 0 },
      frontArm: null,
      backArm: SUPPORT_ARM,
      headDy: breath,
    }),
  );
}

/** Caminar: 8 fotogramas, paso corto y erguido. */
export function paintAlexWalk(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.5, 0.85);
    return paintHumanoid(LOOK, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: null,
      backArm: { upper: 0.55 + Math.sin(phase * Math.PI * 2) * 0.2, bend: 0.9 },
      lean: 1,
    });
  });
}

/** Carrera: 8 fotogramas, zancada amplia e inclinado hacia delante. */
export function paintAlexRun(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.9, 1.4);
    const swing = Math.sin(phase * Math.PI * 2);
    return paintHumanoid(LOOK, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: null,
      backArm: { upper: swing * 0.9, bend: 1.1 },
      lean: 2,
      headDx: 1,
    });
  });
}

/** Salto: impulso y subida con las piernas recogidas. */
export function paintAlexJump(): HumanoidFrame[] {
  return [
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.7, bend: 1.2 },
      backLeg: { upper: -0.25, bend: 0.5 },
      frontArm: null,
      backArm: { upper: -0.4, bend: 0.8 },
      lean: 1,
    }),
    paintHumanoid(LOOK, {
      frontLeg: { upper: 1.0, bend: 1.6 },
      backLeg: { upper: 0.1, bend: 1.0 },
      frontArm: null,
      backArm: { upper: -0.7, bend: 0.7 },
      lean: 1,
      headDy: -1,
    }),
  ];
}

/** Caída: piernas extendidas buscando el suelo. */
export function paintAlexFall(): HumanoidFrame[] {
  return [0, 1].map((i) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.45 - i * 0.1, bend: 0.35 },
      backLeg: { upper: -0.4 + i * 0.1, bend: 0.25 },
      frontArm: null,
      backArm: { upper: -1.1 + i * 0.2, bend: 0.5 },
      headDy: i,
    }),
  );
}

/** Daño: sacudida hacia atrás. */
export function paintAlexHurt(): HumanoidFrame[] {
  return [-2, -1].map((lean) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.3, bend: 0.4 },
      backLeg: { upper: -0.35, bend: 0.2 },
      frontArm: null,
      backArm: { upper: 1.1, bend: 0.6 },
      lean,
      headDx: -1,
    }),
  );
}

/** Muerte: 5 fotogramas. */
export function paintAlexDie(): HumanoidFrame[] {
  return paintCollapse(LOOK, P.blood1, P.blood2);
}

/** Lienzo de las capas de brazo y fogonazo; el hombro queda en su centro. */
export { ARM_CANVAS, ARM_PIVOT };
/** Distancia del hombro a la boca del cañón, en píxeles. */
export const MUZZLE_DISTANCE = 13;

function aimVectors(angleDeg: number): { dx: number; dy: number; px: number; py: number } {
  const a = (angleDeg * Math.PI) / 180;
  // (dx, dy): hacia donde apunta. (px, py): perpendicular «hacia abajo» del arma.
  return { dx: Math.cos(a), dy: -Math.sin(a), px: Math.sin(a), py: Math.cos(a) };
}

/** Brazo de Alex con pistola para un ángulo de puntería. */
export function paintAlexArm(angleDeg: number): PixelBuffer {
  const buf = new PixelBuffer(ARM_CANVAS, ARM_CANVAS);
  const { dx, dy, px, py } = aimVectors(angleDeg);
  const at = (dist: number, side = 0): [number, number] => [
    ARM_PIVOT + dx * dist + px * side,
    ARM_PIVOT + dy * dist + py * side,
  ];

  // Manga con sombra por debajo y luz por encima; puño más claro.
  const [sx, sy] = at(0);
  const [hx, hy] = at(6);
  buf.line(sx, sy, hx, hy, P.blue2, 2);
  const [u0x, u0y] = at(1, 1);
  const [u1x, u1y] = at(4, 1);
  buf.line(u0x, u0y, u1x, u1y, P.blue3, 1);
  const [ex, ey] = at(3);
  buf.line(sx, sy, ex, ey, P.blue1, 1);
  const [cx, cy] = at(5);
  buf.set(cx, cy, P.blue1);

  // Empuñadura, corredera, cañón y guardamonte.
  const [g0x, g0y] = at(7, 1);
  const [g1x, g1y] = at(7, 3);
  buf.line(g0x, g0y, g1x, g1y, P.brown3, 2);
  const [b0x, b0y] = at(7);
  const [b1x, b1y] = at(11);
  buf.line(b0x, b0y, b1x, b1y, P.grey3, 2);
  const [t0x, t0y] = at(8);
  const [t1x, t1y] = at(11);
  buf.line(t0x, t0y, t1x, t1y, P.grey2, 1);
  const [mx, my] = at(11);
  buf.set(mx, my, P.grey1);
  const [tgx, tgy] = at(9, 2);
  buf.set(tgx, tgy, P.shadow);

  // Mano sobre la empuñadura.
  buf.rect(Math.round(hx), Math.round(hy), 2, 2, P.skin1);
  const [kx, ky] = at(6, 1);
  buf.set(kx, ky, P.skin2);

  return buf.outline(P.outline);
}

/**
 * Brazo clásico con un arma larga (o la pistola en otra pose): la misma
 * manga del aspecto clásico y el arma común de `guns.ts`.
 */
export function paintAlexArmWith(angleDeg: number, weapon: string, pose: GunPose = {}): PixelBuffer {
  if (weapon === 'pistol' && !pose.pumpBack && pose.magazine !== false) return paintAlexArm(angleDeg);
  const buf = new PixelBuffer(ARM_CANVAS, ARM_CANVAS);
  const gun = gunArt(weapon);
  const { dx, dy, px, py } = aimVectors(angleDeg);
  const at = (dist: number, side = 0): [number, number] => [
    ARM_PIVOT + dx * dist + px * side,
    ARM_PIVOT + dy * dist + py * side,
  ];
  gun.back?.(buf, angleDeg, pose);
  const [sx, sy] = at(0);
  const [hx, hy] = at(6);
  buf.line(sx, sy, hx, hy, P.blue2, 2);
  const [ex, ey] = at(3);
  buf.line(sx, sy, ex, ey, P.blue1, 1);
  gun.front(buf, angleDeg, pose);
  buf.rect(Math.round(hx), Math.round(hy), 2, 2, P.skin1);
  const support = gun.supportHand(pose);
  if (support) {
    const [fx, fy] = at(support[0], support[1] + 0.5);
    buf.rect(Math.round(fx), Math.round(fy), 2, 2, P.skin1);
  }
  return buf.outline(P.outline);
}

/** Fogonazo de disparo (2 fotogramas) alineado con el brazo del mismo ángulo. */
export function paintMuzzleFlash(angleDeg: number, frame: 0 | 1): PixelBuffer {
  const buf = new PixelBuffer(ARM_CANVAS, ARM_CANVAS);
  const { dx, dy, px, py } = aimVectors(angleDeg);
  const at = (dist: number, side = 0): [number, number] => [
    ARM_PIVOT + dx * dist + px * side + 0.5,
    ARM_PIVOT + dy * dist + py * side + 0.5,
  ];
  const base = MUZZLE_DISTANCE;

  if (frame === 0) {
    const [cx, cy] = at(base + 2);
    buf.ellipse(cx, cy, 3, 3, P.org1);
    for (const side of [-4, 4]) {
      const [rx, ry] = at(base + 2, side);
      buf.line(cx, cy, rx, ry, P.light2);
    }
    const [tx, ty] = at(base + 9);
    buf.line(cx, cy, tx, ty, P.light2, 2);
    buf.ellipse(cx, cy, 2, 2, P.light2);
    buf.ellipse(cx, cy, 1, 1, P.light1);
    const [mx, my] = at(base + 6);
    buf.line(cx, cy, mx, my, P.light1);
  } else {
    const [cx, cy] = at(base + 1);
    buf.ellipse(cx, cy, 2, 2, P.org2);
    buf.ellipse(cx, cy, 1, 1, P.light2);
    const [tx, ty] = at(base + 5);
    buf.line(cx, cy, tx, ty, P.org1);
  }
  return buf;
}

/** Bala en vuelo para un ángulo: trazo corto, claro en la punta. */
export function paintBullet(angleDeg: number): PixelBuffer {
  const size = 9;
  const buf = new PixelBuffer(size, size);
  const { dx, dy } = aimVectors(angleDeg);
  const c = (size - 1) / 2;
  buf.line(c - dx * 3, c - dy * 3, c + dx * 3, c + dy * 3, P.org1);
  buf.line(c - dx, c - dy, c + dx * 3, c + dy * 3, P.light2);
  buf.set(c + dx * 3, c + dy * 3, P.light1);
  return buf;
}
