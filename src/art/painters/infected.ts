import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';
import {
  CLASSIC_PROPORTIONS,
  paintCollapse,
  paintHumanoid,
  stridePose,
  type HumanoidFrame,
  type HumanoidLook,
  type Proportions,
} from '../rig/humanoid';

/**
 * Infectados especiales con silueta propia, para distinguirlos de un
 * vistazo aunque estén a contraluz:
 *  - Corredor: delgado, encorvado hacia delante, brazos atrás al correr.
 *  - Chasqueador: cabeza reventada por un hongo en placas, sin ojos,
 *    encogido y con las manos en garra.
 */

// ───────────────────────── Corredor ─────────────────────────

export const RUNNER_VARIANTS = ['pale', 'hoodie'] as const;
export type RunnerVariant = (typeof RUNNER_VARIANTS)[number];

const RUNNER_FACE = { z: P.zom3, Z: P.zom2, d: P.zom4, k: P.outline, r: P.blood1, R: P.blood3, w: P.white, h: P.asph2, s: P.scarf1, S: P.blood2 } as const;

const RUNNER_HEADS: Record<RunnerVariant, PixelBuffer> = {
  // Calvo, demacrado, ojos rojos y boca desencajada.
  pale: PixelBuffer.fromRows(
    ['.zZZZzz.', 'zZZZZzzz', 'zzZzzzzz', 'dzzkrzkr', 'dzzzzzzz', '.dzzkwkw', '..dzRRRR', '...dRRR.'],
    RUNNER_FACE,
  ),
  // Capucha roja hecha jirones.
  hoodie: PixelBuffer.fromRows(
    ['.ssssss.', 'ssSsssss', 'sSzZzzzz', 'Szzkrzkr', 'Szzzzzzz', 'S.zzkwkw', 'S.dzRRRR', '...dRRR.'],
    RUNNER_FACE,
  ),
};

/** Más estrecho que un humano normal: se nota la delgadez. */
const RUNNER_PROPORTIONS: Proportions = { ...CLASSIC_PROPORTIONS, torsoHalf: 3, thigh: 5, shin: 4, torsoHeight: 8 };

const RUNNER_LOOKS: Record<RunnerVariant, HumanoidLook> = {
  pale: {
    head: RUNNER_HEADS.pale,
    torso: [P.zom2, P.zom3, P.zom4],
    sleeve: [P.zom2, P.zom3, P.zom4],
    hand: P.zom2,
    legs: [P.conc3, P.conc4, P.asph1],
    boots: [P.asph2, P.outline],
    proportions: RUNNER_PROPORTIONS,
    torsoDetail(buf, torso) {
      // Costillas marcadas y camiseta de tirantes hecha jirones.
      for (const row of [2, 4]) buf.rect(torso.left(row) + 2, torso.top + row, 3, 1, P.zom4);
      buf.rect(torso.left(5) + 1, torso.top + 5, 5, 3, P.grey3);
      buf.set(torso.left(5) + 3, torso.top + 5, P.blood2);
    },
  },
  hoodie: {
    head: RUNNER_HEADS.hoodie,
    torso: [P.scarf1, P.blood1, P.blood2],
    sleeve: [P.scarf1, P.blood1, P.blood2],
    hand: P.zom2,
    legs: [P.blue3, P.blue4, P.asph1],
    boots: [P.grey2, P.grey3],
    proportions: RUNNER_PROPORTIONS,
    torsoDetail(buf, torso) {
      buf.rect(torso.left(3) + 2, torso.top + 3, 2, 3, P.zom3);
      buf.set(torso.left(6) + 4, torso.top + 6, P.outline);
    },
  },
};

/** Carrera: 8 fotogramas, zancada muy larga, cuerpo volcado y brazos hacia atrás. */
export function paintRunnerRun(variant: RunnerVariant): HumanoidFrame[] {
  const look = RUNNER_LOOKS[variant];
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.95, 1.5);
    const swing = Math.sin(phase * Math.PI * 2);
    return paintHumanoid(look, {
      frontLeg: legs.front,
      backLeg: legs.back,
      frontArm: { upper: -0.9 - swing * 0.5, bend: 1.2 },
      backArm: { upper: -0.6 + swing * 0.5, bend: 1.1 },
      lean: 4,
      headDx: 2,
      headDy: i % 4 === 0 ? 2 : 1,
    });
  });
}

/** Zarpazo rápido: 3 fotogramas. */
export function paintRunnerAttack(variant: RunnerVariant): HumanoidFrame[] {
  const look = RUNNER_LOOKS[variant];
  return [
    { arm: 2.6, lean: 2 },
    { arm: 1.5, lean: 5 },
    { arm: 0.9, lean: 4 },
  ].map((k) =>
    paintHumanoid(look, {
      frontLeg: { upper: 0.6, bend: 0.6 },
      backLeg: { upper: -0.6, bend: 0.4 },
      frontArm: { upper: k.arm, bend: 0.2 },
      backArm: { upper: k.arm - 0.5, bend: 0.4 },
      lean: k.lean,
      headDx: 2,
      headDy: 2,
    }),
  );
}

/** Salto para rodear: agazapado y luego estirado en el aire. */
export function paintRunnerLeap(variant: RunnerVariant): HumanoidFrame[] {
  const look = RUNNER_LOOKS[variant];
  return [
    paintHumanoid(look, {
      frontLeg: { upper: 0.9, bend: 1.9 },
      backLeg: { upper: -0.2, bend: 1.5 },
      frontArm: { upper: 2.2, bend: 0.3 },
      backArm: { upper: 1.8, bend: 0.4 },
      lean: 4,
      headDx: 2,
      headDy: 1,
    }),
    paintHumanoid(look, {
      frontLeg: { upper: 1.1, bend: 1.4 },
      backLeg: { upper: -0.9, bend: 0.6 },
      frontArm: { upper: 2.4, bend: 0.1 },
      backArm: { upper: 2.1, bend: 0.2 },
      lean: 5,
      headDx: 2,
    }),
  ];
}

export function paintRunnerHurt(variant: RunnerVariant): HumanoidFrame[] {
  const look = RUNNER_LOOKS[variant];
  return [-2, 0].map((lean, i) =>
    paintHumanoid(look, {
      frontLeg: { upper: 0.4, bend: 0.4 },
      backLeg: { upper: -0.4, bend: 0.3 },
      frontArm: { upper: 2.2 - i * 0.5, bend: 0.4 },
      backArm: { upper: 0.4, bend: 0.6 },
      lean,
      headDx: -1,
    }),
  );
}

export function paintRunnerDie(variant: RunnerVariant): HumanoidFrame[] {
  return paintCollapse(RUNNER_LOOKS[variant], P.blood1, P.blood2);
}

// ───────────────────────── Chasqueador ─────────────────────────

export const CLICKER_VARIANTS = ['fungus'] as const;
export type ClickerVariant = (typeof CLICKER_VARIANTS)[number];

/**
 * Cabeza partida por el hongo: placas que crecen como un abanico en lugar
 * de cara, sin ojos, y la mandíbula abierta debajo.
 */
const CLICKER_HEAD = PixelBuffer.fromRows(
  [
    '..o.O..o...',
    '.oOyoOoyO..',
    'oyOoyyOoyo.',
    'OoyOooyOoyo',
    'oOoybyoOyo.',
    '.bOoOObbo..',
    '..zbbbbz...',
    '..zkwkwzz..',
    '...zRRRz...',
    '....zRz....',
  ],
  { o: P.org3, O: P.brown1, y: P.yel3, b: P.brown3, z: P.zom3, k: P.outline, w: P.light1, R: P.blood2 },
);

/** Más alto que el lienzo normal para que quepa la cabeza deformada. */
const CLICKER_PROPORTIONS: Proportions = { ...CLASSIC_PROPORTIONS, frameHeight: 34, groundRow: 32 };

const CLICKER_LOOK: HumanoidLook = {
  head: CLICKER_HEAD,
  torso: [P.brown2, P.brown3, P.asph1],
  sleeve: [P.asph2, P.asph3, P.asph4],
  hand: P.zom3,
  legs: [P.asph2, P.asph3, P.asph4],
  boots: [P.brown3, P.outline],
  proportions: CLICKER_PROPORTIONS,
  torsoDetail(buf, torso) {
    // El hongo le baja por el cuello y la espalda.
    buf.rect(torso.left(0) + 1, torso.top, 3, 2, P.org3);
    buf.set(torso.left(2) + 1, torso.top + 2, P.brown1);
    buf.set(torso.left(4) + 1, torso.top + 4, P.org3);
    buf.rect(torso.left(6) + 4, torso.top + 6, 2, 1, P.blood2);
  },
};

const HUNCH = { lean: 3, headDx: 2, headDy: 3 } as const;

/** Caminar: arrastra los pies, encogido, con espasmos de la cabeza. */
export function paintClickerWalk(): HumanoidFrame[] {
  return Array.from({ length: 8 }, (_, i) => {
    const phase = i / 8;
    const legs = stridePose(phase, 0.35, 0.9);
    const twitch = i === 3 || i === 6 ? 1 : 0;
    return paintHumanoid(CLICKER_LOOK, {
      frontLeg: { upper: legs.front.upper, bend: legs.front.bend + 0.25 },
      backLeg: { upper: legs.back.upper, bend: legs.back.bend + 0.25 },
      frontArm: { upper: 0.9 + Math.sin(phase * Math.PI * 2) * 0.1, bend: 1.3 },
      backArm: { upper: 1.1, bend: 1.4 },
      ...HUNCH,
      headDx: HUNCH.headDx + twitch,
      headDy: HUNCH.headDy - twitch,
    });
  });
}

/**
 * Chasquido: 4 fotogramas. Echa la cabeza atrás, la sacude de golpe hacia
 * delante y tiembla con las manos crispadas: es su firma visual.
 */
export function paintClickerClick(): HumanoidFrame[] {
  return [
    { headDx: 0, headDy: 1, arm: 1.6, lean: 1 },
    { headDx: 3, headDy: 4, arm: 1.0, lean: 4 },
    { headDx: 1, headDy: 2, arm: 1.9, lean: 2 },
    { headDx: 3, headDy: 3, arm: 1.2, lean: 3 },
  ].map((k) =>
    paintHumanoid(CLICKER_LOOK, {
      frontLeg: { upper: 0.25, bend: 0.4 },
      backLeg: { upper: -0.25, bend: 0.4 },
      frontArm: { upper: k.arm, bend: 1.5 },
      backArm: { upper: k.arm - 0.3, bend: 1.6 },
      lean: k.lean,
      headDx: k.headDx,
      headDy: k.headDy,
    }),
  );
}

/** Agarre: se lanza con los brazos abiertos y muerde. */
export function paintClickerAttack(): HumanoidFrame[] {
  return [
    { arm: 2.4, lean: 2, head: 1 },
    { arm: 1.9, lean: 5, head: 3 },
    { arm: 1.4, lean: 6, head: 4 },
    { arm: 1.6, lean: 5, head: 3 },
  ].map((k) =>
    paintHumanoid(CLICKER_LOOK, {
      frontLeg: { upper: 0.7, bend: 0.5 },
      backLeg: { upper: -0.6, bend: 0.3 },
      frontArm: { upper: k.arm, bend: 0.5 },
      backArm: { upper: k.arm + 0.3, bend: 0.5 },
      lean: k.lean,
      headDx: k.head,
      headDy: 2,
    }),
  );
}

export function paintClickerHurt(): HumanoidFrame[] {
  return [-1, 1].map((lean, i) =>
    paintHumanoid(CLICKER_LOOK, {
      frontLeg: { upper: 0.3, bend: 0.5 },
      backLeg: { upper: -0.3, bend: 0.4 },
      frontArm: { upper: 2.3 - i * 0.6, bend: 0.9 },
      backArm: { upper: 0.5, bend: 1.0 },
      lean,
      headDx: -1 + i,
      headDy: 2,
    }),
  );
}

/** Muerte: se desploma y el charco es de esporas oscuras además de sangre. */
export function paintClickerDie(): HumanoidFrame[] {
  return paintCollapse(CLICKER_LOOK, P.org3, P.brown3);
}
