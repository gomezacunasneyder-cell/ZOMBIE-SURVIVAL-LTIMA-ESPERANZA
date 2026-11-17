import { PixelBuffer } from '../PixelBuffer';
import { P } from '../palette';

/**
 * EL DEVORADOR en combate: casi cuatro metros (el doble que Alex), una
 * mole encorvada de carne gris verdosa con el músculo al aire, costillas
 * y espinas de hueso en el lomo, brazos larguísimos acabados en garras,
 * un grillete roto con su cadena y un tubo de laboratorio arrancado de la
 * espalda: viene de «Origen». Cabeza baja con fauces que se abren y un
 * racimo de ojos.
 *
 * Se dibuja por partes a partir de una pose, como los humanoides, en un
 * lienzo de 96×96 (GDD §11). Enfurecido (fases 2 y 3) la piel se
 * oscurece, la carne se abre en grietas que brillan, las espinas crecen
 * con la punta roja y los ojos se encienden.
 */

export const DEVOURER_FRAME = 96;
/** Alto del lienzo: deja sitio a los brazos alzados del golpe contra el suelo. */
export const DEVOURER_FRAME_HEIGHT = 112;
/** Fila sobre la que apoyan las garras de los pies. */
export const DEVOURER_GROUND = 109;

/** Ángulo desde la vertical hacia abajo (positivo = hacia delante) y flexión del codo. */
export interface ArmPose {
  a: number;
  b: number;
}

export interface DevourerPose {
  /** Hundimiento del cuerpo (agacharse), en píxeles. */
  y?: number;
  /** Cuánto se adelanta el tronco. */
  lean?: number;
  /** −1…1: pierna delantera adelantada o atrasada. */
  stride?: number;
  /** 0…1: flexión de la rodilla que avanza. */
  lift?: number;
  front: ArmPose;
  back: ArmPose;
  /** 0…1: apertura de las fauces. */
  jaw?: number;
  /** Desplazamiento de la cabeza (negativo = arriba / atrás). */
  headY?: number;
  headX?: number;
  /** 0…1: de rodillas. */
  kneel?: number;
  /** Corazón al descubierto y encendido (agotado: el punto débil). */
  heart?: boolean;
}

interface Look {
  light: number;
  mid: number;
  dark: number;
  muscle: number;
  muscleDark: number;
  eye: number;
  eyeCore: number;
  mouth: number;
  spineTip: number;
  spineGrow: number;
}

const NORMAL: Look = {
  light: P.zom2,
  mid: P.zom3,
  dark: P.zom4,
  muscle: P.blood2,
  muscleDark: P.blood3,
  eye: P.blood1,
  eyeCore: P.org1,
  mouth: P.blood3,
  spineTip: P.grey1,
  spineGrow: 0,
};

const ENRAGED: Look = {
  light: P.zom3,
  mid: P.zom4,
  dark: P.shadow,
  muscle: P.blood1,
  muscleDark: P.blood2,
  eye: P.yel1,
  eyeCore: P.light1,
  mouth: P.org2,
  spineTip: P.blood1,
  spineGrow: 5,
};

interface Point {
  x: number;
  y: number;
}

function polar(origin: Point, angle: number, length: number): Point {
  return { x: origin.x + Math.sin(angle) * length, y: origin.y + Math.cos(angle) * length };
}

const THIGH = 15;
const SHIN = 17;
const UPPER_ARM = 21;
const FOREARM = 22;

function legAngles(pose: DevourerPose, front: boolean): { thigh: number; shin: number } {
  const stride = pose.stride ?? 0;
  const kneel = pose.kneel ?? 0;
  const lift = front ? Math.max(0, pose.lift ?? 0) : 0;
  // De rodillas: muslo casi vertical y espinilla tendida hacia atrás, rodilla y pie en el suelo.
  const thigh = (front ? 0.35 + stride * 0.45 : -0.15 - stride * 0.45) * (1 - kneel) + kneel * (front ? 0.5 : 0.2);
  const shin = thigh - (0.85 + lift * 0.6) * (1 - kneel) - kneel * (front ? 2.05 : 1.6);
  return { thigh, shin };
}

function drawLeg(buf: PixelBuffer, hip: Point, pose: DevourerPose, front: boolean, look: Look): void {
  const { thigh, shin } = legAngles(pose, front);
  const knee = polar(hip, thigh, THIGH);
  const ankle = polar(knee, shin, SHIN);
  const flesh = front ? look.mid : look.dark;
  buf.line(hip.x - 4, hip.y - 3, knee.x - 3, knee.y - 3, flesh, 8);
  buf.line(knee.x - 3, knee.y - 3, ankle.x - 2, ankle.y - 3, flesh, 6);
  if (front) {
    // Volumen del muslo y rodilla huesuda.
    buf.line(hip.x - 1, hip.y - 2, knee.x, knee.y - 2, look.light, 2);
    buf.rect(Math.round(knee.x) - 1, Math.round(knee.y) - 2, 3, 2, P.grey1);
  }
  // Pie ancho con tres garras hacia delante, apoyado en el suelo.
  const ax = Math.round(ankle.x);
  const ay = Math.round(ankle.y);
  buf.rect(ax - 4, ay - 1, 11, 3, flesh);
  for (let i = 0; i < 3; i++) {
    buf.set(ax + 7, ay - 1 + i, P.white);
    buf.set(ax + 8, ay + i, P.grey1);
  }
}

function drawArm(buf: PixelBuffer, shoulder: Point, arm: ArmPose, front: boolean, look: Look, shackle: boolean): Point {
  const elbow = polar(shoulder, arm.a, UPPER_ARM);
  const wrist = polar(elbow, arm.a + arm.b, FOREARM);
  const flesh = front ? look.mid : look.dark;
  const width = front ? 7 : 6;
  const half = Math.floor(width / 2);
  buf.line(shoulder.x - half, shoulder.y - half, elbow.x - half, elbow.y - half, flesh, width);
  buf.line(elbow.x - half + 1, elbow.y - half + 1, wrist.x - half + 1, wrist.y - half + 1, flesh, width - 1);
  if (front) {
    // Bíceps con luz y músculo al aire en el antebrazo.
    buf.line(shoulder.x - 1, shoulder.y - 2, elbow.x - 1, elbow.y - 2, look.light, 2);
    const mid = { x: (elbow.x + wrist.x) / 2, y: (elbow.y + wrist.y) / 2 };
    buf.ellipse(mid.x, mid.y, 2, 3, look.muscle);
    buf.set(Math.round(mid.x), Math.round(mid.y), look.muscleDark);
  }
  buf.ellipse(elbow.x, elbow.y, 3, 3, front ? look.light : look.mid);
  // Mano con tres garras largas que siguen la dirección del antebrazo.
  const dir = { x: Math.sin(arm.a + arm.b), y: Math.cos(arm.a + arm.b) };
  buf.ellipse(wrist.x, wrist.y, 4, 4, flesh);
  for (let i = -1; i <= 1; i++) {
    const sx = wrist.x + dir.x * 3 + dir.y * i * 2;
    const sy = wrist.y + dir.y * 3 - dir.x * i * 2;
    buf.line(sx, sy, sx + dir.x * 6, sy + dir.y * 6, front ? P.white : P.grey1);
    buf.set(Math.round(sx + dir.x * 7), Math.round(sy + dir.y * 7), P.grey2);
  }
  if (shackle) {
    // Grillete roto de la contención, con tres eslabones colgando.
    const band = polar(elbow, arm.a + arm.b, FOREARM - 6);
    buf.rect(Math.round(band.x) - 4, Math.round(band.y) - 2, 8, 3, P.grey2);
    buf.hline(Math.round(band.x) - 4, Math.round(band.y) - 2, 8, P.grey1);
    for (let i = 0; i < 3; i++) buf.rect(Math.round(band.x) - 1 + (i % 2), Math.round(band.y) + 2 + i * 2, 2, 2, i % 2 ? P.grey3 : P.grey2);
  }
  return wrist;
}

/** Pinta a EL DEVORADOR mirando a la derecha. */
export function paintDevourerPose(pose: DevourerPose, enraged = false): PixelBuffer {
  const look = enraged ? ENRAGED : NORMAL;
  const buf = new PixelBuffer(DEVOURER_FRAME, DEVOURER_FRAME_HEIGHT);
  const lean = pose.lean ?? 0;

  // La cadera se coloca para que el pie más bajo toque el suelo.
  const origin: Point = { x: 0, y: 0 };
  const lowest = Math.max(
    ...[true, false].map((front) => {
      const { thigh, shin } = legAngles(pose, front);
      return polar(polar(origin, thigh, THIGH), shin, SHIN).y;
    }),
  );
  const hip: Point = { x: 38, y: DEVOURER_GROUND - 1 - Math.round(lowest) + (pose.y ?? 0) };
  const shoulder: Point = { x: hip.x + 16 + lean, y: hip.y - 33 };
  const head: Point = { x: shoulder.x + 15 + (pose.headX ?? 0), y: shoulder.y + 8 + (pose.headY ?? 0) };

  // 1. Brazo y pierna lejanos, en sombra.
  drawArm(buf, { x: shoulder.x - 3, y: shoulder.y + 1 }, pose.back, false, look, false);
  drawLeg(buf, { x: hip.x - 3, y: hip.y }, pose, false, look);

  // 2. Tubo de laboratorio arrancado y espinas del lomo.
  const back: Point = { x: hip.x - 6 + Math.round(lean * 0.4), y: hip.y - 32 };
  buf.line(back.x - 4, back.y - 2, back.x - 16, back.y + 8, P.glass2, 2);
  buf.rect(back.x - 6, back.y - 3, 3, 3, P.grey3);
  buf.set(back.x - 17, back.y + 9, P.glass1);
  const spines: [number, number, number][] = [
    [-12, 10, 9],
    [-7, 3, 12],
    [0, -1, 14],
    [7, 0, 12],
    [13, 4, 9],
  ];
  for (const [dx, dy, length] of spines) {
    const baseX = back.x + dx + Math.round(lean * 0.3);
    const baseY = back.y + dy;
    const tipX = baseX - 3;
    const tipY = baseY - length - look.spineGrow;
    buf.line(baseX, baseY, tipX, tipY, P.white, 2);
    buf.set(tipX, tipY, look.spineTip);
    buf.set(tipX + 1, tipY, look.spineTip);
  }

  // 3. Tronco: pelvis, joroba, vientre y pecho, con luz arriba y sombra abajo.
  buf.ellipse(hip.x, hip.y - 3, 11, 8, look.dark);
  buf.ellipse(back.x + 2, back.y + 6, 19, 15, look.mid);
  buf.ellipse(back.x + 4, back.y + 2, 14, 9, look.light);
  buf.ellipse(hip.x + 5 + lean * 0.4, hip.y - 14, 15, 11, look.mid);
  buf.ellipse(shoulder.x - 2, shoulder.y + 7, 14, 13, look.mid);
  buf.ellipse(shoulder.x - 1, shoulder.y + 4, 10, 8, look.light);
  // Sombra del vientre y piel arrancada con el músculo al aire.
  buf.ellipse(hip.x + 6 + lean * 0.4, hip.y - 8, 11, 4, look.dark);
  buf.ellipse(hip.x + 8 + lean * 0.5, hip.y - 17, 6, 5, look.muscle);
  for (let i = 0; i < 3; i++) buf.hline(hip.x + 4 + Math.round(lean * 0.5), hip.y - 19 + i * 2, 8, look.muscleDark);
  // Costillas asomando por el costado.
  for (let i = 0; i < 4; i++) {
    const rx = shoulder.x - 9 + i;
    const ry = shoulder.y + 9 + i * 3;
    buf.line(rx, ry, rx + 7, ry + 1, P.white);
    buf.set(rx + 7, ry + 1, P.grey1);
  }
  if (enraged) {
    // Grietas que brillan sobre la carne.
    const cracks: [number, number, number, number][] = [
      [shoulder.x - 6, shoulder.y + 2, shoulder.x + 4, shoulder.y + 12],
      [hip.x - 2, hip.y - 22, hip.x + 8, hip.y - 12],
      [back.x - 8, back.y + 4, back.x + 6, back.y + 10],
    ];
    for (const [x0, y0, x1, y1] of cracks) {
      buf.line(x0, y0, x1, y1, P.org1);
      buf.set(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), P.yel1);
    }
  }
  if (pose.heart) {
    // El corazón al descubierto: su punto débil.
    buf.ellipse(shoulder.x - 3, shoulder.y + 10, 4, 4, P.blood1);
    buf.ellipse(shoulder.x - 3, shoulder.y + 10, 2, 2, P.org1);
    buf.set(shoulder.x - 3, shoulder.y + 9, P.light2);
  }

  // 4. Pierna cercana.
  drawLeg(buf, { x: hip.x + 3, y: hip.y }, pose, true, look);

  // 5. Cuello grueso y cabeza baja: cráneo con cresta, hocico afilado y fauces que se abren.
  const jaw = pose.jaw ?? 0;
  buf.line(shoulder.x + 2, shoulder.y + 2, head.x - 5, head.y + 1, look.mid, 7);
  buf.line(shoulder.x + 3, shoulder.y, head.x - 5, head.y - 2, look.light, 2);
  buf.ellipse(head.x - 1, head.y, 8, 6, look.mid);
  buf.ellipse(head.x - 1, head.y - 2, 6, 3, look.light);
  // Cresta de hueso sobre los ojos.
  buf.hline(head.x - 6, head.y - 6, 10, P.grey1);
  buf.hline(head.x - 5, head.y - 7, 6, P.white);
  // Hocico superior que se estrecha hacia delante, con colmillos.
  buf.trapezoid(head.y - 3, head.x + 3, head.x + 10, head.y + 3, head.x + 3, head.x + 14, look.mid);
  buf.hline(head.x + 4, head.y - 3, 6, look.light);
  buf.set(head.x + 13, head.y + 1, look.dark);
  for (let x = head.x + 4; x <= head.x + 13; x += 2) buf.set(x, head.y + 4, P.white);
  // Mandíbula inferior: baja al abrirse y deja ver la garganta.
  const open = Math.round(jaw * 9);
  buf.trapezoid(head.y + 4, head.x - 2, head.x + 13, head.y + 4 + open, head.x - 1, head.x + 12, look.mouth);
  if (jaw > 0.4) buf.ellipse(head.x + 4, head.y + 4 + open / 2, 3, Math.max(1, open / 2 - 1), enraged ? P.org1 : P.blood2);
  buf.trapezoid(head.y + 5 + open, head.x - 3, head.x + 12, head.y + 8 + open, head.x - 1, head.x + 9, look.dark);
  buf.hline(head.x - 2, head.y + 5 + open, 14, look.mid);
  for (let x = head.x; x <= head.x + 11; x += 2) buf.set(x, head.y + 4 + open, P.white);
  // Ojos: cuatro, en racimo bajo la cresta, como heridas que brillan.
  for (const [dx, dy] of [
    [-3, -4],
    [1, -5],
    [4, -3],
    [0, -2],
  ] as const) {
    buf.rect(head.x + dx, head.y + dy, 2, 1, look.eye);
    buf.set(head.x + dx + 1, head.y + dy, look.eyeCore);
  }

  // 6. Brazo cercano, con el grillete roto.
  drawArm(buf, shoulder, pose.front, true, look, true);

  buf.outline(P.outline);
  return buf;
}

/**
 * Cadáver: la mole tendida boca abajo, con las espinas hacia arriba, un
 * brazo estirado y las fauces abiertas sobre el asfalto. `stage` 0–2: la
 * sangre se extiende y el cuerpo se apaga.
 */
export function paintDevourerCorpse(stage: number, enraged: boolean): PixelBuffer {
  const look = enraged ? ENRAGED : NORMAL;
  const buf = new PixelBuffer(DEVOURER_FRAME, DEVOURER_FRAME_HEIGHT);
  const ground = DEVOURER_GROUND;
  if (stage > 0) {
    const half = 26 + stage * 9;
    buf.hline(48 - half, ground, half * 2, P.blood3);
    buf.hline(48 - half + 4, ground - 1, half * 2 - 8, P.blood3);
    buf.hline(48 - half + 8, ground, half, P.blood2);
  }
  const dim = stage >= 2;
  const mid = dim ? look.dark : look.mid;
  const light = dim ? look.mid : look.light;
  // Cuerpo tendido y joroba.
  buf.ellipse(44, ground - 8, 30, 8, mid);
  buf.ellipse(40, ground - 13, 20, 7, mid);
  buf.ellipse(42, ground - 15, 14, 4, light);
  for (let i = 0; i < 5; i++) {
    const x = 26 + i * 8;
    const h = 8 + (i % 2) * 4;
    buf.line(x, ground - 16, x - 2, ground - 16 - h, P.white, 2);
    buf.set(x - 2, ground - 16 - h, look.spineTip);
  }
  // Pierna recogida detrás.
  buf.line(16, ground - 6, 6, ground - 2, look.dark, 6);
  // Brazo estirado con las garras abiertas.
  buf.line(60, ground - 6, 84, ground - 3, mid, 6);
  for (let i = 0; i < 3; i++) buf.line(86, ground - 5 + i * 2, 91, ground - 4 + i * 2, P.white);
  // Cabeza de lado con las fauces abiertas.
  buf.ellipse(70, ground - 10, 8, 6, mid);
  buf.rect(74, ground - 8, 10, 4, look.mouth);
  for (let x = 74; x < 84; x += 2) buf.set(x, ground - 8, P.white);
  buf.rect(68, ground - 13, 2, 1, dim ? P.blood3 : look.eye);
  buf.outline(P.outline);
  return buf;
}

const IDLE_ARMS = { front: { a: 0.45, b: 0.35 }, back: { a: 0.3, b: 0.4 } };

/** Poses de cada animación. */
export const DEVOURER_POSES: Readonly<Record<string, readonly DevourerPose[]>> = {
  idle: [0, 1, 2, 1].map((k) => ({ ...IDLE_ARMS, y: k > 0 ? 1 : 0, jaw: 0.1 + k * 0.08, lean: 4 })),
  walk: Array.from({ length: 6 }, (_, i) => {
    const phase = (i / 6) * Math.PI * 2;
    const stride = Math.sin(phase);
    return {
      stride,
      lift: Math.max(0, Math.cos(phase)),
      y: Math.round(Math.abs(Math.sin(phase)) * 2),
      lean: 6,
      jaw: 0.15,
      front: { a: 0.55 - stride * 0.35, b: 0.3 },
      back: { a: 0.35 + stride * 0.35, b: 0.35 },
    };
  }),
  // Golpe contra el suelo: alza los brazos y los descarga.
  slam: [
    { front: { a: 2.1, b: 0.5 }, back: { a: 1.9, b: 0.6 }, headY: -3, jaw: 0.4, lean: 1 },
    { front: { a: 2.85, b: 0.25 }, back: { a: 2.7, b: 0.3 }, headY: -5, jaw: 0.7, lean: -3 },
    { front: { a: 0.75, b: 0.05 }, back: { a: 0.6, b: 0.1 }, y: 6, jaw: 0.9, lean: 12 },
    { front: { a: 0.5, b: 0.15 }, back: { a: 0.4, b: 0.2 }, y: 5, jaw: 0.3, lean: 10 },
  ],
  // Embestida: se agacha, se lanza y descarga el zarpazo.
  charge: [
    { front: { a: -0.5, b: 1.3 }, back: { a: 0.2, b: 0.8 }, y: 6, lean: 8, jaw: 0.3, stride: -0.4 },
    { front: { a: -0.8, b: 1.4 }, back: { a: 0.1, b: 0.8 }, y: 8, lean: 12, jaw: 0.5, stride: -0.6 },
    { front: { a: -0.9, b: 0.6 }, back: { a: 0.9, b: 0.3 }, y: 3, lean: 15, jaw: 0.7, stride: 0.9, lift: 0.8 },
    { front: { a: 1.75, b: 0.15 }, back: { a: 0.2, b: 0.4 }, y: 3, lean: 14, jaw: 0.9, stride: 0.6 },
  ],
  // Escupitajo: echa la cabeza atrás y lanza la bilis.
  spit: [
    { ...IDLE_ARMS, headY: -6, headX: -5, jaw: 0.2, lean: -2 },
    { ...IDLE_ARMS, headY: 1, headX: 4, jaw: 1, lean: 8 },
    { ...IDLE_ARMS, headX: 2, jaw: 0.35, lean: 6 },
  ],
  // Rugido: cabeza alta, fauces abiertas, brazos abiertos.
  roar: [
    { front: { a: 1.25, b: 0.8 }, back: { a: 1.1, b: 0.9 }, headY: -8, headX: 1, jaw: 1, lean: -3 },
    { front: { a: 1.45, b: 0.7 }, back: { a: 1.3, b: 0.8 }, headY: -9, headX: 2, jaw: 0.85, lean: -4 },
  ],
  hurt: [{ front: { a: 0.9, b: 1.1 }, back: { a: 0.6, b: 1.0 }, headY: -2, headX: -4, jaw: 0.6, lean: -6 }],
  // Agotado tras la erupción: de rodillas, jadeando, con el corazón al descubierto.
  kneel: [0, 1].map((k) => ({ front: { a: 0.15, b: 0.25 }, back: { a: 0.1, b: 0.3 }, kneel: 1, lean: 7, headY: 4 + k, jaw: 0.5 + k * 0.2, heart: true })),
  // Muerte: se tambalea, cae de rodillas y se derrumba hacia delante.
  die: [
    { front: { a: 1.6, b: 1.0 }, back: { a: 1.2, b: 1.2 }, headY: -7, headX: -3, jaw: 1, lean: -6 },
    { front: { a: 0.2, b: 0.2 }, back: { a: 0.1, b: 0.2 }, kneel: 1, headY: 5, jaw: 0.8, lean: 3 },
    { front: { a: 0.35, b: -0.1 }, back: { a: 0.3, b: 0 }, kneel: 1, headY: 9, headX: 4, jaw: 1, lean: 14 },
  ],
};
