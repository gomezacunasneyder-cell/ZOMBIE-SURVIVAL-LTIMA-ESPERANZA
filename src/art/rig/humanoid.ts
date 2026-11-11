import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * Esqueleto de personaje por partes. Un personaje se describe con su
 * aspecto (`HumanoidLook`) y cada fotograma con una pose (`HumanoidPose`).
 * Así las animaciones salen de tablas de ángulos y no de dibujar cada
 * fotograma a mano, y todos los fotogramas de un personaje comparten
 * proporciones, punto de apoyo y posición del hombro.
 *
 * Los personajes miran a la derecha; Phaser los voltea con `flipX`.
 */

/** Medidas de un personaje. Cambiarlas no afecta a su física (ver `Player`). */
export interface Proportions {
  frameWidth: number;
  frameHeight: number;
  /** Fila sobre la que apoyan las suelas. */
  groundRow: number;
  thigh: number;
  shin: number;
  torsoHeight: number;
  /** Mitad del ancho del torso. */
  torsoHalf: number;
  upperArm: number;
  forearm: number;
}

/** Proporciones originales: fotograma de 32×32, figura de 27 px. */
export const CLASSIC_PROPORTIONS: Proportions = {
  frameWidth: 32,
  frameHeight: 32,
  groundRow: 30,
  thigh: 4,
  shin: 4,
  torsoHeight: 9,
  torsoHalf: 4,
  upperArm: 4,
  forearm: 3,
};

export const FRAME_SIZE = CLASSIC_PROPORTIONS.frameWidth;
export const GROUND_ROW = CLASSIC_PROPORTIONS.groundRow;
/** Columna del centro de la cadera. */
export const HIP_X = 14;

/** Tonos de un material: luz, medio y sombra. */
export type Ramp = readonly [light: number, mid: number, dark: number];

export interface HumanoidLook {
  /** Cabeza mirando a la derecha. Se apoya centrada sobre los hombros. */
  head: PixelBuffer;
  torso: Ramp;
  sleeve: Ramp;
  hand: number;
  legs: Ramp;
  boots: readonly [mid: number, dark: number];
  backpack?: Ramp;
  /** Si se omite, se usan las proporciones clásicas. */
  proportions?: Proportions;
  /** Botas de caña alta: una fila más por encima del tobillo. */
  tallBoots?: boolean;
  /** Dibuja lo que va a la espalda (mochila); sustituye a `backpack`. */
  paintBack?: (buf: PixelBuffer, torso: TorsoBox, pose: HumanoidPose) => void;
  /** Detalles sobre el torso (corbata, chaleco, pañuelo). */
  torsoDetail?: (buf: PixelBuffer, torso: TorsoBox, pose: HumanoidPose) => void;
}

export interface TorsoBox {
  /** Fila superior del torso. */
  top: number;
  /** Columna izquierda de la fila indicada (0 = hombros). */
  left: (row: number) => number;
  height: number;
  width: number;
}

/** Ángulos en radianes desde la vertical hacia abajo; positivo = hacia delante. */
export interface LimbPose {
  upper: number;
  /** Flexión de rodilla (hacia atrás) o de codo (hacia delante). */
  bend: number;
}

export interface HumanoidPose {
  frontLeg: LimbPose;
  backLeg: LimbPose;
  /** Brazo más cercano a cámara. `null` si lo dibuja otra capa (brazo que apunta). */
  frontArm: LimbPose | null;
  backArm: LimbPose | null;
  /** Píxeles que los hombros se adelantan respecto a la cadera. */
  lean?: number;
  headDx?: number;
  headDy?: number;
  /** Cuánto ondean las prendas sueltas: 0 en reposo, 2 a la carrera. */
  flutter?: number;
}

export interface HumanoidFrame {
  buffer: PixelBuffer;
  /** Punto del hombro, para acoplar capas como el brazo que apunta. */
  shoulder: { x: number; y: number };
}

interface Point {
  x: number;
  y: number;
}

function polar(origin: Point, angle: number, length: number): Point {
  return { x: origin.x + Math.sin(angle) * length, y: origin.y + Math.cos(angle) * length };
}

function legPoints(hip: Point, pose: LimbPose, p: Proportions): { knee: Point; ankle: Point } {
  const knee = polar(hip, pose.upper, p.thigh);
  const ankle = polar(knee, pose.upper - pose.bend, p.shin);
  return { knee, ankle };
}

interface LegStyle {
  brush: readonly number[];
  boot: number;
  sole: number;
  tall: boolean;
}

function drawLeg(buf: PixelBuffer, hip: Point, pose: LimbPose, p: Proportions, style: LegStyle): void {
  const { knee, ankle } = legPoints(hip, pose, p);
  buf.brushLine(hip.x, hip.y, knee.x, knee.y, style.brush);
  buf.brushLine(knee.x, knee.y, ankle.x, ankle.y - 1, style.brush);
  const ax = Math.round(ankle.x);
  const ay = Math.round(ankle.y);
  if (style.tall) buf.rect(ax - 1, ay - 1, 3, 1, style.boot);
  buf.rect(ax - 1, ay, 4, 1, style.boot);
  buf.rect(ax - 1, ay + 1, 4, 1, style.sole);
  // Rodilla marcada con el tono claro para dar volumen.
  buf.set(Math.round(knee.x) + 1, Math.round(knee.y), style.brush[style.brush.length - 1] as number);
}

function drawArm(
  buf: PixelBuffer,
  shoulder: Point,
  pose: LimbPose,
  p: Proportions,
  sleeve: number,
  hand: number,
): void {
  const elbow = polar(shoulder, pose.upper, p.upperArm);
  const wrist = polar(elbow, pose.upper + pose.bend, p.forearm);
  buf.line(shoulder.x, shoulder.y, elbow.x, elbow.y, sleeve, 2);
  buf.line(elbow.x, elbow.y, wrist.x, wrist.y, sleeve, 2);
  buf.rect(Math.round(wrist.x), Math.round(wrist.y), 2, 2, hand);
}

/** Pinta un fotograma con el personaje en la pose indicada. */
export function paintHumanoid(look: HumanoidLook, pose: HumanoidPose): HumanoidFrame {
  const p = look.proportions ?? CLASSIC_PROPORTIONS;
  const buf = new PixelBuffer(p.frameWidth, p.frameHeight);
  const lean = pose.lean ?? 0;

  // La cadera se coloca de modo que el pie más bajo toque siempre el suelo:
  // el balanceo vertical del paso sale solo de la geometría de las piernas.
  const origin: Point = { x: 0, y: 0 };
  const lowest = Math.max(
    legPoints(origin, pose.frontLeg, p).ankle.y,
    legPoints(origin, pose.backLeg, p).ankle.y,
  );
  const hipY = p.groundRow - 1 - Math.round(lowest);

  const torsoTop = hipY - p.torsoHeight;
  const shift = (row: number): number => Math.round(lean * (1 - row / (p.torsoHeight - 1)));
  const torsoLeft = (row: number): number => HIP_X - p.torsoHalf + shift(row);
  const shoulder: Point = { x: HIP_X + shift(0), y: torsoTop + 2 };
  const torsoBox: TorsoBox = {
    top: torsoTop,
    left: torsoLeft,
    height: p.torsoHeight,
    width: p.torsoHalf * 2,
  };
  const tall = look.tallBoots ?? false;

  // 1. Brazo y pierna del lado lejano, en tonos de sombra.
  if (pose.backArm) {
    drawArm(buf, { x: shoulder.x + 1, y: shoulder.y }, pose.backArm, p, look.sleeve[2], look.hand);
  }
  drawLeg(buf, { x: HIP_X - 1, y: hipY }, pose.backLeg, p, {
    brush: [look.legs[2], look.legs[2], look.legs[2]],
    boot: look.boots[1],
    sole: look.boots[1],
    tall,
  });

  // 2. Lo que va a la espalda.
  if (look.paintBack) look.paintBack(buf, torsoBox, pose);
  else if (look.backpack) {
    const bx = torsoLeft(2) - 2;
    buf.rect(bx, torsoTop + 1, 3, 6, look.backpack[1]);
    buf.rect(bx, torsoTop + 1, 3, 1, look.backpack[0]);
    buf.rect(bx, torsoTop + 6, 3, 1, look.backpack[2]);
  }

  // 3. Torso con volumen: luz arriba y al frente, sombra en la espalda.
  for (let row = 0; row < p.torsoHeight; row++) {
    const inset = row === 0 ? 1 : 0;
    const left = torsoLeft(row) + inset;
    const width = p.torsoHalf * 2 - inset * 2;
    const y = torsoTop + row;
    buf.rect(left, y, width, 1, look.torso[1]);
    if (row === 0) buf.rect(left, y, width, 1, look.torso[0]);
    else {
      buf.set(left, y, look.torso[2]);
      if (row < 5) buf.set(left + width - 1, y, look.torso[0]);
      // Sombra de la espalda más ancha hacia la cintura.
      if (row >= 5) buf.set(left + 1, y, look.torso[2]);
      if (row === 1) buf.rect(left + 2, y, 3, 1, look.torso[0]);
    }
    if (row === p.torsoHeight - 1) buf.rect(left, y, width, 1, look.torso[2]);
  }
  look.torsoDetail?.(buf, torsoBox, pose);

  // 4. Pierna cercana.
  drawLeg(buf, { x: HIP_X + 1, y: hipY }, pose.frontLeg, p, {
    brush: [look.legs[2], look.legs[1], look.legs[0]],
    boot: look.boots[0],
    sole: look.boots[1],
    tall,
  });

  // 5. Cabeza, algo adelantada hacia donde mira.
  const headX = shoulder.x - Math.floor(look.head.width / 2) + 1 + (pose.headDx ?? 0);
  const headY = torsoTop - look.head.height + 1 + (pose.headDy ?? 0);
  buf.blit(look.head, headX, headY);

  // 6. Brazo cercano.
  if (pose.frontArm) {
    drawArm(buf, { x: shoulder.x - 1, y: shoulder.y }, pose.frontArm, p, look.sleeve[1], look.hand);
  }

  buf.outline(P.outline);
  return { buffer: buf, shoulder: { x: Math.round(shoulder.x), y: Math.round(shoulder.y) } };
}

/**
 * Ciclo de paso: devuelve las poses de ambas piernas para una fase 0–1.
 * `stride` es la amplitud del muslo y `lift` cuánto se dobla la rodilla
 * de la pierna que avanza.
 */
export function stridePose(phase: number, stride: number, lift: number): { front: LimbPose; back: LimbPose } {
  const leg = (p: number): LimbPose => {
    const a = p * Math.PI * 2;
    return { upper: Math.sin(a) * stride, bend: Math.max(0, Math.cos(a)) * lift };
  };
  return { front: leg(phase), back: leg(phase + 0.5) };
}

/** Brazos caídos a los lados, para poses sin arma. */
const ARMS_DOWN: LimbPose = { upper: 0.15, bend: 0.2 };

/**
 * Animación de caída: tambaleo, rodillas dobladas y cuerpo tendido boca
 * arriba con un charco de sangre que crece. El cuerpo tendido es el
 * fotograma de pie girado 90° exactos, que no deforma el pixel art.
 */
export function paintCollapse(look: HumanoidLook, bloodColor: number, bloodDark: number): HumanoidFrame[] {
  const p = look.proportions ?? CLASSIC_PROPORTIONS;
  const stagger = paintHumanoid(look, {
    frontLeg: { upper: 0.25, bend: 0.3 },
    backLeg: { upper: -0.3, bend: 0.2 },
    frontArm: { upper: -0.6, bend: 0.4 },
    backArm: { upper: 0.9, bend: 0.5 },
    lean: -2,
    headDx: -1,
  });
  const kneel = paintHumanoid(look, {
    frontLeg: { upper: 1.0, bend: 2.0 },
    backLeg: { upper: 0.5, bend: 1.9 },
    frontArm: { upper: -0.9, bend: 0.3 },
    backArm: { upper: 0.4, bend: 0.3 },
    lean: -3,
    headDx: -1,
    headDy: 1,
  });
  const standing = paintHumanoid(look, {
    frontLeg: { upper: 0.2, bend: 0.15 },
    backLeg: { upper: -0.15, bend: 0 },
    frontArm: ARMS_DOWN,
    backArm: ARMS_DOWN,
  });
  const lying = standing.buffer.rotatedCCW();
  const box = lying.bounds();
  const dx = Math.round((p.frameWidth - (box.right - box.left + 1)) / 2) - box.left;
  const dy = p.frameHeight - 1 - box.bottom + (p.groundRow + 1 - (p.frameHeight - 1));
  const centre = Math.floor(p.frameWidth / 2) - 1;

  const lyingFrames = [0, 1, 2].map((stage) => {
    const buf = new PixelBuffer(p.frameWidth, p.frameHeight);
    if (stage > 0) {
      // Charco en la fila del suelo; asoma a los lados del cuerpo.
      const half = 5 + stage * 5;
      buf.hline(centre - half, p.groundRow, half * 2, bloodDark);
      buf.hline(centre - half + 2, p.groundRow - 1, half * 2 - 4, bloodDark);
      buf.hline(centre - half + 3, p.groundRow, half, bloodColor);
    }
    buf.blit(lying, dx, dy);
    return buf;
  });

  const frames = [stagger.buffer, kneel.buffer, ...lyingFrames];
  return frames.map((buffer) => ({ buffer, shoulder: stagger.shoulder }));
}
