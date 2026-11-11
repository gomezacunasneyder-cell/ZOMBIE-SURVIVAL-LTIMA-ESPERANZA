import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import {
  paintCollapse,
  paintHumanoid,
  stridePose,
  type HumanoidFrame,
  type HumanoidLook,
} from '../rig/humanoid';

/**
 * Caminantes: el infectado común. Cuatro variantes de ropa comparten
 * esqueleto y animaciones; solo cambia el aspecto.
 */

export const WALKER_VARIANTS = ['civil', 'office', 'worker', 'hazmat'] as const;
export type WalkerVariant = (typeof WALKER_VARIANTS)[number];

const FACE_LEGEND = {
  z: P.zom2,
  Z: P.zom1,
  d: P.zom3,
  k: P.shadow,
  w: P.white,
  b: P.blood3,
  B: P.blood1,
  h: P.brown3,
  y: P.yel2,
  Y: P.yel1,
  n: P.yel3,
  g: P.glass2,
  G: P.glass1,
} as const;

const FACE_ROWS = [
  'zdzzzzzzz',
  'zdzkkzkkz',
  'zdzkwzkwz',
  '.ddzzzzzz',
  '..dzbbbb.',
  '...dbBwb.',
] as const;

const HEADS: Record<WalkerVariant, PixelBuffer> = {
  civil: PixelBuffer.fromRows(
    ['..zzzzz..', '.zZZZZzz.', 'zzZZZzzzz', 'zzzzBzzzz', ...FACE_ROWS],
    FACE_LEGEND,
  ),
  office: PixelBuffer.fromRows(
    ['..hhhhh..', '.hhhhhhh.', 'hhhhhhzzz', 'hhzzzzzzz', ...FACE_ROWS],
    FACE_LEGEND,
  ),
  worker: PixelBuffer.fromRows(
    ['..yyyyy..', '.yYYYYYy.', 'yyYYyyyyy', 'nnnnnnnnn', ...FACE_ROWS],
    FACE_LEGEND,
  ),
  hazmat: PixelBuffer.fromRows(
    [
      '..yyyyy..',
      '.yYYYYYy.',
      'yyYYYyyyy',
      'yyynnnnnn',
      'yyynGgggg',
      'yyyngkgkg',
      'yyyngggBg',
      'yyyynnnnn',
      '.yyyykky.',
      '..nnkkn..',
    ],
    FACE_LEGEND,
  ),
};

const LOOKS: Record<WalkerVariant, HumanoidLook> = {
  civil: {
    head: HEADS.civil,
    torso: [P.grey1, P.grey2, P.grey3],
    sleeve: [P.zom1, P.zom2, P.zom3],
    hand: P.zom1,
    legs: [P.conc2, P.conc3, P.conc4],
    boots: [P.brown2, P.brown3],
    torsoDetail(buf, torso) {
      // Camiseta rota y manchada.
      buf.rect(torso.left(3) + 4, torso.top + 3, 3, 2, P.blood2);
      buf.set(torso.left(5) + 5, torso.top + 5, P.blood3);
      buf.set(torso.left(7) + 2, torso.top + 7, P.zom3);
    },
  },
  office: {
    head: HEADS.office,
    torso: [P.white, P.grey1, P.grey2],
    sleeve: [P.white, P.grey1, P.grey2],
    hand: P.zom1,
    legs: [P.asph2, P.asph3, P.asph4],
    boots: [P.shadow, P.outline],
    torsoDetail(buf, torso) {
      // Corbata suelta y sangre en la camisa.
      for (let row = 1; row < 6; row++) buf.set(torso.left(row) + 6, torso.top + row, P.blood1);
      buf.set(torso.left(6) + 6, torso.top + 6, P.blood2);
      buf.rect(torso.left(4) + 2, torso.top + 4, 2, 2, P.blood2);
    },
  },
  worker: {
    head: HEADS.worker,
    torso: [P.org1, P.org2, P.org3],
    sleeve: [P.conc1, P.conc2, P.conc3],
    hand: P.zom1,
    legs: [P.conc2, P.conc3, P.conc4],
    boots: [P.brown2, P.brown3],
    torsoDetail(buf, torso) {
      // Bandas reflectantes del chaleco.
      buf.rect(torso.left(3) + 1, torso.top + 3, 7, 1, P.yel1);
      buf.rect(torso.left(6) + 1, torso.top + 6, 7, 1, P.yel1);
    },
  },
  hazmat: {
    head: HEADS.hazmat,
    torso: [P.yel1, P.yel2, P.yel3],
    sleeve: [P.yel1, P.yel2, P.yel3],
    hand: P.grey3,
    legs: [P.yel1, P.yel2, P.yel3],
    boots: [P.grey3, P.shadow],
    torsoDetail(buf, torso) {
      // Cremallera, símbolo de riesgo y desgarrón con sangre.
      buf.rect(torso.left(2) + 5, torso.top + 1, 1, 7, P.yel3);
      buf.rect(torso.left(3) + 2, torso.top + 3, 2, 2, P.outline);
      buf.rect(torso.left(6) + 3, torso.top + 6, 3, 1, P.blood2);
    },
  },
};

/** Caminar: 8 fotogramas, paso corto y arrastrado con los brazos por delante. */
export function paintWalkerWalk(variant: WalkerVariant): HumanoidFrame[] {
  const look = LOOKS[variant];
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.42, 0.7);
    const sway = Math.sin(phase * Math.PI * 2);
    return paintHumanoid(look, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: { upper: 1.2 + sway * 0.14, bend: 0.3 },
      backArm: { upper: 1.42 - sway * 0.14, bend: 0.15 },
      lean: 2,
      headDx: 1,
      headDy: i % 4 === 1 ? 2 : 1,
    });
  });
}

/** Ataque: 5 fotogramas; alza los brazos y se abalanza. */
export function paintWalkerAttack(variant: WalkerVariant): HumanoidFrame[] {
  const look = LOOKS[variant];
  const keys = [
    { lean: 2, arm: 1.3, head: 1 },
    { lean: 1, arm: 2.3, head: 0 },
    { lean: 3, arm: 1.7, head: 2 },
    { lean: 4, arm: 1.15, head: 2 },
    { lean: 3, arm: 1.3, head: 1 },
  ];
  return keys.map((k) =>
    paintHumanoid(look, {
      frontLeg: { upper: 0.4, bend: 0 },
      backLeg: { upper: -0.4, bend: 0 },
      frontArm: { upper: k.arm, bend: 0.25 },
      backArm: { upper: k.arm + 0.2, bend: 0.15 },
      lean: k.lean,
      headDx: k.head,
      headDy: 1,
    }),
  );
}

/** Impacto: 2 fotogramas, sacudida hacia atrás con los brazos abiertos. */
export function paintWalkerHurt(variant: WalkerVariant): HumanoidFrame[] {
  const look = LOOKS[variant];
  return [-2, -1].map((lean, i) =>
    paintHumanoid(look, {
      frontLeg: { upper: 0.3, bend: 0.3 },
      backLeg: { upper: -0.35, bend: 0.2 },
      frontArm: { upper: 2.0 - i * 0.4, bend: 0.3 },
      backArm: { upper: 0.6 + i * 0.3, bend: 0.4 },
      lean,
      headDx: -1,
    }),
  );
}

/** Muerte: 5 fotogramas; se desploma y queda tendido en un charco. */
export function paintWalkerDie(variant: WalkerVariant): HumanoidFrame[] {
  return paintCollapse(LOOKS[variant], P.blood2, P.blood3);
}
