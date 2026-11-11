import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import {
  paintCollapse,
  paintHumanoid,
  stridePose,
  type HumanoidFrame,
  type HumanoidLook,
  type HumanoidPose,
  type LimbPose,
  type Proportions,
  type TorsoBox,
} from '../rig/humanoid';

/**
 * Alex, versión detallada. Mismo personaje y misma identidad (chaqueta
 * azul, pañuelo rojo, mochila militar), con más altura, sombreado en
 * cuatro tonos, pelo despeinado, pantalón oscuro y botas de caña.
 *
 * Fotograma de 32×40 con una figura de 30 px: tres más que la versión
 * clásica, lo que lo acerca a la proporción real frente a los vehículos
 * sin dejar pequeños a los caminantes, que van encorvados.
 */
export const DETAILED_PROPORTIONS: Proportions = {
  frameWidth: 32,
  frameHeight: 40,
  groundRow: 38,
  thigh: 4,
  shin: 4,
  torsoHeight: 10,
  torsoHalf: 4,
  upperArm: 4,
  forearm: 4,
};

const HEAD = PixelBuffer.fromRows(
  [
    '....hhh....',
    '..hhHHHhh..',
    '.hHHLLHHHh.',
    'hHHLHHHLHHh',
    'hHHHhHHhHhh',
    'hhHhssshsss',
    'hhhSsddsdds',
    '.hhSsksskss',
    '.hhSssssssS',
    '..hSSssdds.',
    '...SSSSss..',
  ],
  {
    h: P.brown3,
    H: P.brown2,
    L: P.brown1,
    s: P.skin1,
    S: P.skin2,
    d: P.skin3,
    k: P.outline,
    r: P.skin3,
  },
);

/** Pañuelo: cuello, nudo al frente y punta que ondea a la espalda. */
function paintScarf(buf: PixelBuffer, torso: TorsoBox, flutter: number): void {
  const at = (row: number, col: number, color: number): void => {
    buf.set(torso.left(row) + col, torso.top + row, color);
  };
  for (let col = 1; col <= 6; col++) at(0, col, col >= 2 && col <= 4 ? P.scarf1 : P.blood1);
  for (let col = 0; col <= 7; col++) at(1, col, col === 0 ? P.blood2 : col >= 5 ? P.scarf1 : P.blood1);
  for (let col = 3; col <= 7; col++) at(2, col, col === 3 ? P.blood2 : P.blood1);
  at(3, 5, P.blood2);
  at(3, 6, P.blood1);
  at(4, 6, P.blood2);

  // Punta suelta: cuelga en reposo y se estira hacia atrás al correr.
  const tails: [dx: number, dy: number][][] = [
    [
      [-1, 1],
      [-1, 2],
    ],
    [
      [-1, 1],
      [-2, 1],
      [-2, 2],
    ],
    [
      [-1, 0],
      [-2, 0],
      [-3, -1],
    ],
  ];
  const tail = tails[Math.min(2, Math.max(0, Math.round(flutter)))] as [number, number][];
  tail.forEach(([dx, dy], i) => at(dy, dx, i === 0 ? P.blood1 : P.blood2));
}

function paintJacket(buf: PixelBuffer, torso: TorsoBox, pose: HumanoidPose): void {
  const at = (row: number, col: number, color: number): void => {
    buf.set(torso.left(row) + col, torso.top + row, color);
  };
  const last = torso.height - 1;

  // Sombra profunda en la espalda baja y bajo el brazo.
  for (let row = 5; row < last; row++) at(row, 0, P.blue4);
  for (let row = 6; row < last; row++) at(row, 1, P.blue3);
  // Solapa delantera iluminada y cremallera.
  for (let row = 3; row < last; row++) {
    at(row, 6, P.blue4);
    at(row, 7, row < 6 ? P.blue1 : P.blue2);
  }
  // Bolsillo del pecho con su sombra.
  at(4, 3, P.blue1);
  at(4, 4, P.blue1);
  at(5, 3, P.blue3);
  at(5, 4, P.blue3);
  // Correa de la mochila sobre el hombro.
  for (let row = 2; row < last - 1; row++) at(row, 2, row < 5 ? P.mil2 : P.mil3);
  at(last - 1, 2, P.mil4);
  // Bajo de la chaqueta.
  for (let col = 0; col < torso.width; col++) at(last - 1, col, col < 6 ? P.blue3 : P.blue2);
  at(last - 1, 6, P.blue4);
  // Cinturón con hebilla.
  for (let col = 0; col < torso.width; col++) at(last, col, col === 0 ? P.outline : P.brown3);
  at(last, 4, P.brown2);
  at(last, 5, P.yel2);
  at(last, 6, P.yel3);

  paintScarf(buf, torso, pose.flutter ?? 0);
}

/** Mochila militar: tapa, bolsillo, hebilla y antena de radio. */
function paintBackpack(buf: PixelBuffer, torso: TorsoBox): void {
  const x = torso.left(2) - 4;
  const y = torso.top + 1;
  buf.rect(x, y, 5, 8, P.mil3);
  // Tapa superior con luz.
  buf.rect(x, y, 5, 1, P.mil1);
  buf.rect(x, y + 1, 5, 2, P.mil2);
  buf.hline(x, y + 3, 5, P.mil4);
  // Bolsillo frontal.
  buf.rect(x + 1, y + 4, 3, 3, P.mil2);
  buf.hline(x + 1, y + 4, 3, P.mil1);
  // Sombra del lado lejano y de la base.
  buf.vline(x, y + 1, 7, P.mil4);
  buf.hline(x, y + 7, 5, P.mil4);
  // Antena corta de la radio.
  buf.vline(x + 1, y - 3, 3, P.grey3);
  buf.set(x + 1, y - 4, P.grey1);
}

const LOOK: HumanoidLook = {
  head: HEAD,
  proportions: DETAILED_PROPORTIONS,
  torso: [P.blue1, P.blue2, P.blue3],
  sleeve: [P.blue1, P.blue2, P.blue3],
  hand: P.skin1,
  // Pantalón oscuro azulado y botas de cuero de caña alta.
  legs: [P.conc3, P.conc4, P.shadow],
  boots: [P.brown2, P.brown3],
  tallBoots: true,
  paintBack: paintBackpack,
  torsoDetail: paintJacket,
};

/** Brazo lejano doblado, como sujetando el arma con las dos manos. */
const SUPPORT_ARM: LimbPose = { upper: 0.55, bend: 0.9 };

/** Reposo: 6 fotogramas de respiración. */
export function paintDetailedIdle(): HumanoidFrame[] {
  const breath = [0, 0, 0, 1, 1, 1];
  const flutter = [0, 0, 1, 1, 0, 0];
  return breath.map((headDy, i) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.14, bend: 0 },
      backLeg: { upper: -0.22, bend: 0 },
      frontArm: null,
      backArm: SUPPORT_ARM,
      headDy,
      flutter: flutter[i] as number,
    }),
  );
}

/** Caminar: 8 fotogramas. */
export function paintDetailedWalk(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.52, 0.9);
    return paintHumanoid(LOOK, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: null,
      backArm: { upper: 0.55 + Math.sin(phase * Math.PI * 2) * 0.22, bend: 0.9 },
      lean: 1,
      flutter: i % 4 < 2 ? 1 : 0,
    });
  });
}

/** Carrera: 8 fotogramas, inclinado y con el pañuelo al viento. */
export function paintDetailedRun(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.92, 1.45);
    const swing = Math.sin(phase * Math.PI * 2);
    return paintHumanoid(LOOK, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: null,
      backArm: { upper: swing * 0.9, bend: 1.1 },
      lean: 2,
      headDx: 1,
      flutter: i % 2 === 0 ? 2 : 1,
    });
  });
}

/** Salto: impulso, piernas recogidas y punto alto. */
export function paintDetailedJump(): HumanoidFrame[] {
  return [
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.5, bend: 0.9 },
      backLeg: { upper: -0.3, bend: 0.4 },
      frontArm: null,
      backArm: { upper: -0.2, bend: 0.8 },
      lean: 1,
      flutter: 1,
    }),
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.8, bend: 1.3 },
      backLeg: { upper: -0.1, bend: 0.8 },
      frontArm: null,
      backArm: { upper: -0.5, bend: 0.8 },
      lean: 1,
      flutter: 0,
    }),
    paintHumanoid(LOOK, {
      frontLeg: { upper: 1.05, bend: 1.7 },
      backLeg: { upper: 0.15, bend: 1.1 },
      frontArm: null,
      backArm: { upper: -0.8, bend: 0.7 },
      lean: 1,
      headDy: -1,
      flutter: 0,
    }),
  ];
}

/** Caída: piernas extendidas buscando el suelo, pañuelo hacia arriba. */
export function paintDetailedFall(): HumanoidFrame[] {
  return [0, 1].map((i) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.45 - i * 0.1, bend: 0.35 },
      backLeg: { upper: -0.42 + i * 0.1, bend: 0.25 },
      frontArm: null,
      backArm: { upper: -1.1 + i * 0.2, bend: 0.5 },
      headDy: i,
      flutter: 2,
    }),
  );
}

/** Aterrizaje: flexión profunda, media y vuelta a erguirse. */
export function paintDetailedLand(): HumanoidFrame[] {
  const keys: { front: LimbPose; back: LimbPose; lean: number; headDy: number }[] = [
    { front: { upper: 0.95, bend: 1.9 }, back: { upper: 0.45, bend: 1.7 }, lean: 2, headDy: 1 },
    { front: { upper: 0.6, bend: 1.2 }, back: { upper: 0.2, bend: 1.0 }, lean: 1, headDy: 1 },
    { front: { upper: 0.25, bend: 0.4 }, back: { upper: -0.15, bend: 0.3 }, lean: 0, headDy: 0 },
  ];
  return keys.map((k, i) =>
    paintHumanoid(LOOK, {
      frontLeg: k.front,
      backLeg: k.back,
      frontArm: null,
      backArm: SUPPORT_ARM,
      lean: k.lean,
      headDy: k.headDy,
      flutter: i === 0 ? 2 : 1,
    }),
  );
}

/** Daño: 3 fotogramas de sacudida hacia atrás. */
export function paintDetailedHurt(): HumanoidFrame[] {
  const keys = [
    { lean: -2, arm: 1.3, head: -1 },
    { lean: -3, arm: 1.0, head: -1 },
    { lean: -1, arm: 0.8, head: 0 },
  ];
  return keys.map((k) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.3, bend: 0.4 },
      backLeg: { upper: -0.35, bend: 0.2 },
      frontArm: null,
      backArm: { upper: k.arm, bend: 0.6 },
      lean: k.lean,
      headDx: k.head,
      flutter: 1,
    }),
  );
}

/** Muerte: 6 fotogramas (golpe, tambaleo, rodillas y cuerpo tendido). */
export function paintDetailedDie(): HumanoidFrame[] {
  const hit = paintHumanoid(LOOK, {
    frontLeg: { upper: 0.3, bend: 0.4 },
    backLeg: { upper: -0.35, bend: 0.2 },
    frontArm: { upper: 0.9, bend: 0.5 },
    backArm: { upper: 1.3, bend: 0.6 },
    lean: -1,
    headDx: -1,
    flutter: 1,
  });
  return [hit, ...paintCollapse(LOOK, P.blood1, P.blood2)];
}
