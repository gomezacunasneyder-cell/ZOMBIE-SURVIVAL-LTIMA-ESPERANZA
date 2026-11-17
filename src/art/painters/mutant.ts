import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import {
  paintCollapse,
  paintHumanoid,
  stridePose,
  type HumanoidFrame,
  type HumanoidLook,
  type Proportions,
} from '../rig/humanoid';

/**
 * Mutante: casi el doble de alto que Alex, hinchado, con la piel abierta
 * por pústulas, huesos asomando en la espalda y brazos como mazas. La
 * cabeza es pequeña para su cuerpo: se lee como «enorme» incluso de lejos.
 */

export const MUTANT_VARIANTS = ['brute'] as const;
export type MutantVariant = (typeof MUTANT_VARIANTS)[number];

/** Lienzo de 64×56 para que quepa tendido al morir. Cintura estrecha: la masa la ponen los hombros. */
export const MUTANT_PROPORTIONS: Proportions = {
  frameWidth: 64,
  frameHeight: 56,
  groundRow: 54,
  thigh: 8,
  shin: 8,
  torsoHeight: 17,
  torsoHalf: 6,
  upperArm: 10,
  forearm: 11,
  hipX: 30,
  armWidth: 4,
  legWidth: 5,
};

const HEAD = PixelBuffer.fromRows(
  [
    '..zzzzzz..',
    '.zZZzBzzd.',
    'zzzzzzkkzd',
    'zzBzzzkrzd',
    'dzzzzzzzzd',
    '.zkwkwkwz.',
    '..zRRRRz..',
    '...dddd...',
  ],
  { z: P.zom2, Z: P.zom1, d: P.zom3, B: P.blood1, k: P.outline, r: P.blood1, w: P.light1, R: P.blood2 },
);

const LOOK: HumanoidLook = {
  head: HEAD,
  torso: [P.zom1, P.zom2, P.zom3],
  // Brazos un tono más oscuros que el pecho para que no se fundan con él.
  sleeve: [P.zom2, P.zom3, P.zom4],
  hand: P.zom4,
  legs: [P.mil2, P.mil3, P.mil4],
  boots: [P.zom3, P.zom4],
  proportions: MUTANT_PROPORTIONS,
  paintBack(buf, torso) {
    // Joroba con espolones de hueso que asoman por detrás de los hombros.
    const x = torso.left(0) - 2;
    buf.ellipse(x + 4, torso.top + 4, 6, 6, P.zom3);
    for (const [dx, dy] of [
      [-1, 0],
      [-4, 4],
      [-3, 8],
    ] as const) {
      buf.line(x + 2, torso.top + dy + 3, x + dx - 1, torso.top + dy, P.white);
      buf.set(x + dx - 1, torso.top + dy, P.grey1);
    }
  },
  torsoDetail(buf, torso) {
    const cx = torso.left(0) + torso.width / 2;
    // Hombros y pecho enormes sobre una cintura estrecha: silueta en V.
    buf.ellipse(cx - 1, torso.top + 5, 11, 6, P.zom2);
    buf.ellipse(cx, torso.top + 4, 9, 4, P.zom1);
    buf.ellipse(cx + 3, torso.top + 7, 5, 3, P.zom2);
    buf.hline(cx - 8, torso.top + 9, 16, P.zom3);
    // Pústulas y una vena.
    for (const [dx, dy] of [
      [-6, 2],
      [4, 1],
      [7, 5],
      [-2, 12],
    ] as const) {
      buf.rect(cx + dx, torso.top + dy, 2, 2, P.blood1);
      buf.set(cx + dx, torso.top + dy, P.org1);
    }
    buf.line(cx - 3, torso.top + 6, cx + 1, torso.top + 13, P.zom3);
    // Pantalón militar reventado en la cintura.
    const waist = torso.top + torso.height - 3;
    buf.rect(torso.left(torso.height - 3), waist, torso.width, 3, P.mil3);
    buf.hline(torso.left(torso.height - 3), waist, torso.width, P.mil2);
  },
};

const HEAD_LOW = { headDx: 5, headDy: 3 } as const;

/** Caminar: 8 fotogramas, pasos cortos y pesados, balanceo de hombros. */
export function paintMutantWalk(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.32, 0.6);
    const sway = Math.sin(phase * Math.PI * 2);
    return paintHumanoid(LOOK, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: { upper: 0.35 + sway * 0.18, bend: 0.25 },
      backArm: { upper: 0.2 - sway * 0.18, bend: 0.3 },
      lean: 3 + (i % 4 === 0 ? 1 : 0),
      ...HEAD_LOW,
    });
  });
}

/** Mazazo: 6 fotogramas. Alza los dos brazos sobre la cabeza y los descarga contra el suelo. */
export function paintMutantAttack(): HumanoidFrame[] {
  return [
    { arm: 1.2, lean: 2 },
    { arm: 2.6, lean: 0 },
    { arm: 3.0, lean: -1 },
    { arm: 1.6, lean: 5 },
    { arm: 0.9, lean: 7 },
    { arm: 0.7, lean: 6 },
  ].map((k) =>
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.45, bend: 0.4 },
      backLeg: { upper: -0.45, bend: 0.2 },
      frontArm: { upper: k.arm, bend: 0.2 },
      backArm: { upper: k.arm - 0.2, bend: 0.3 },
      lean: k.lean,
      ...HEAD_LOW,
    }),
  );
}

export function paintMutantHurt(): HumanoidFrame[] {
  return [
    paintHumanoid(LOOK, {
      frontLeg: { upper: 0.25, bend: 0.3 },
      backLeg: { upper: -0.3, bend: 0.2 },
      frontArm: { upper: 1.4, bend: 0.6 },
      backArm: { upper: 0.3, bend: 0.4 },
      lean: 0,
      headDx: 3,
      headDy: 2,
    }),
  ];
}

export function paintMutantDie(): HumanoidFrame[] {
  return paintCollapse(LOOK, P.blood2, P.blood3);
}
