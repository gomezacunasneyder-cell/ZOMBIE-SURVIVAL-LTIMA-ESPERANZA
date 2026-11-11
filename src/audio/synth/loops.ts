import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';

/**
 * Sonidos en bucle sintetizados: ambiente y música. Cada uno está
 * construido para repetirse sin costura (el final enlaza con el
 * principio). Se generan a 22 050 Hz, suficiente para ambiente y la
 * mitad de costoso que a calidad de CD.
 */

export const LOOP_RATE = 22050;
const TAU = Math.PI * 2;

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Hace que un tramo de ruido enlace consigo mismo: se generan `fade`
 * muestras de más y se funden con el principio a potencia constante.
 */
function seamless(source: Float32Array, length: number): Float32Array {
  const fade = source.length - length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    if (i < fade) {
      const k = i / fade;
      out[i] = (source[i] as number) * Math.sin((k * Math.PI) / 2) + (source[length + i] as number) * Math.cos((k * Math.PI) / 2);
    } else out[i] = source[i] as number;
  }
  return out;
}

/** Ajusta una frecuencia para que quepa un número entero de ciclos en el bucle. */
function fit(frequency: number, seconds: number): number {
  return Math.round(frequency * seconds) / seconds;
}

/** Viento: ruido filtrado cuyo timbre sube y baja con lentitud. */
export function synthWindLoop(): SynthSound {
  const seconds = 6;
  const length = LOOP_RATE * seconds;
  const fade = LOOP_RATE;
  const rng = new Rng(21);
  const raw = new Float32Array(length + fade);
  let a = 0;
  let b = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = (i % length) / LOOP_RATE;
    // El filtro se abre y se cierra con periodo igual al bucle.
    const cutoff = 0.035 + 0.03 * (Math.sin((TAU * t) / seconds) * 0.5 + 0.5) + 0.012 * Math.sin((TAU * 3 * t) / seconds);
    a += cutoff * (rng.next() * 2 - 1 - a);
    b += cutoff * (a - b);
    raw[i] = b * 5.5;
  }
  const samples = seamless(raw, length);
  for (let i = 0; i < length; i++) samples[i] = clamp(samples[i] as number) * 0.8;
  return { sampleRate: LOOP_RATE, samples };
}

/** Rotor de helicóptero: seis golpes de pala por segundo. */
export function synthHelicopterLoop(): SynthSound {
  const beat = 1 / 6;
  const seconds = beat * 6;
  const length = Math.round(LOOP_RATE * seconds);
  const samples = new Float32Array(length);
  const rng = new Rng(22);
  let low = 0;
  for (let i = 0; i < length; i++) {
    const t = i / LOOP_RATE;
    const local = (t % beat) / beat;
    const envelope = Math.exp(-local * 7);
    low += 0.09 * (rng.next() * 2 - 1 - low);
    const thump = Math.sin(TAU * 46 * (t % beat)) * envelope;
    const whine = Math.sin(TAU * fit(310, seconds) * t) * 0.05;
    samples[i] = clamp(low * 2.6 * envelope + thump * 0.55 + whine) * 0.75;
  }
  return { sampleRate: LOOP_RATE, samples };
}

/** Alarma de dos tonos, con el filo de una sirena vieja. */
export function synthAlarmLoop(): SynthSound {
  const half = 0.55;
  const seconds = half * 2;
  const length = Math.round(LOOP_RATE * seconds);
  const samples = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / LOOP_RATE;
    const high = t % seconds < half;
    const local = (t % half) / half;
    phase += (TAU * (high ? 740 : 560)) / LOOP_RATE;
    // Entrada y salida suaves en cada tono para que no chasquee.
    const envelope = Math.min(1, local * 14, (1 - local) * 14);
    const tone = Math.tanh(Math.sin(phase) * 2.4) * 0.6 + Math.sin(phase * 2) * 0.15;
    samples[i] = clamp(tone * envelope) * 0.5;
  }
  return { sampleRate: LOOP_RATE, samples };
}

/** Noche: grillos intermitentes sobre un zumbido lejano. */
export function synthNightLoop(): SynthSound {
  const seconds = 6;
  const length = LOOP_RATE * seconds;
  const samples = new Float32Array(length);
  const rng = new Rng(23);
  const hum = fit(58, seconds);
  // Cada grillo: una serie de trinos que empieza y acaba dentro del bucle.
  const crickets = Array.from({ length: 5 }, () => ({
    start: rng.next() * (seconds - 1.6),
    pitch: 3300 + rng.next() * 900,
    rate: 22 + rng.next() * 9,
    gain: 0.05 + rng.next() * 0.07,
    span: 0.7 + rng.next() * 0.8,
  }));
  for (let i = 0; i < length; i++) {
    const t = i / LOOP_RATE;
    let value = Math.sin(TAU * hum * t) * 0.05 + Math.sin(TAU * hum * 2 * t) * 0.02;
    for (const c of crickets) {
      const local = t - c.start;
      if (local < 0 || local > c.span) continue;
      const shape = Math.sin((Math.PI * local) / c.span);
      const trill = Math.max(0, Math.sin(TAU * c.rate * local));
      value += Math.sin(TAU * c.pitch * local) * trill * trill * shape * c.gain;
    }
    samples[i] = clamp(value);
  }
  return { sampleRate: LOOP_RATE, samples };
}

const BEAT = 0.6;
const MUSIC_BEATS = 16;
const MUSIC_SECONDS = BEAT * MUSIC_BEATS;

/** Nota con ataque rápido y caída exponencial. */
function pluck(t: number, at: number, frequency: number, decay: number): number {
  const local = t - at;
  if (local < 0) return 0;
  return Math.sin(TAU * frequency * local) * Math.exp(-local * decay) * Math.min(1, local * 200);
}

/** Música de tensión: pedal grave en re menor, latido lento y notas sueltas. */
export function synthTensionLoop(): SynthSound {
  const seconds = MUSIC_SECONDS;
  const length = Math.round(LOOP_RATE * seconds);
  const samples = new Float32Array(length);
  const d2 = fit(73.42, seconds);
  const a2 = fit(110, seconds);
  const f3 = fit(174.61, seconds);
  // Motivo disperso en re menor: [pulso, frecuencia].
  const motif: [beat: number, frequency: number][] = [
    [0, 293.66],
    [3, 349.23],
    [5.5, 329.63],
    [8, 220],
    [11, 261.63],
    [13, 233.08],
  ];
  for (let i = 0; i < length; i++) {
    const t = i / LOOP_RATE;
    const swell = 0.6 + 0.4 * Math.sin((TAU * t) / seconds - Math.PI / 2);
    const drone =
      (Math.sin(TAU * d2 * t) * 0.5 + Math.sin(TAU * d2 * 2.004 * t) * 0.16 + Math.sin(TAU * a2 * t) * 0.22) * swell +
      Math.sin(TAU * f3 * t) * 0.07 * (1 - swell * 0.5);
    // Latido: dos golpes cada cuatro pulsos.
    let heart = 0;
    for (const offset of [0, 0.32]) {
      const local = (t % (BEAT * 4)) - offset;
      if (local >= 0) heart += Math.sin(TAU * (48 + 60 * Math.exp(-local * 30)) * local) * Math.exp(-local * 11);
    }
    let melody = 0;
    for (const [beat, frequency] of motif) {
      // Las notas que suenan al final del bucle continúan al principio.
      melody += pluck(t, beat * BEAT, frequency, 2.6) + pluck(t + seconds, beat * BEAT, frequency, 2.6);
    }
    samples[i] = clamp(drone * 0.42 + heart * 0.3 + melody * 0.13);
  }
  return { sampleRate: LOOP_RATE, samples };
}

/** Capa de combate: bajo en corcheas y percusión seca, sincronizada con la tensión. */
export function synthCombatLoop(): SynthSound {
  const seconds = MUSIC_SECONDS;
  const length = Math.round(LOOP_RATE * seconds);
  const samples = new Float32Array(length);
  const rng = new Rng(24);
  const step = BEAT / 2;
  const bassLine = [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 98, 87.31];
  let noiseLow = 0;
  for (let i = 0; i < length; i++) {
    const t = i / LOOP_RATE;
    const index = Math.floor(t / step);
    const local = t - index * step;
    const frequency = bassLine[index % bassLine.length] as number;
    const phase = TAU * frequency * local;
    // Bajo con algo de filo: fundamental más dos armónicos.
    const bass = (Math.sin(phase) + Math.sin(phase * 2) * 0.4 + Math.sin(phase * 3) * 0.18) * Math.exp(-local * 9) * Math.min(1, local * 300);
    const noise = rng.next() * 2 - 1;
    noiseLow += 0.25 * (noise - noiseLow);
    // Contratiempo agudo y caja en los pulsos 2 y 4 de cada compás.
    const hat = index % 2 === 1 ? (noise - noiseLow) * Math.exp(-local * 60) * 0.5 : 0;
    const beatIndex = Math.floor(t / BEAT);
    const beatLocal = t - beatIndex * BEAT;
    const snare = beatIndex % 4 === 2 ? (noiseLow * 1.6 + Math.sin(TAU * 190 * beatLocal) * 0.5) * Math.exp(-beatLocal * 22) : 0;
    const kick = beatIndex % 2 === 0 ? Math.sin(TAU * (45 + 90 * Math.exp(-beatLocal * 35)) * beatLocal) * Math.exp(-beatLocal * 12) : 0;
    samples[i] = clamp(bass * 0.38 + hat * 0.22 + snare * 0.3 + kick * 0.45);
  }
  return { sampleRate: LOOP_RATE, samples };
}
