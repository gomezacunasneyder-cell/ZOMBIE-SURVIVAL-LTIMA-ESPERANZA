import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';

/** Efectos puntuales de la Fase 2: pasos, zombis, explosión y chispazo. */

const TAU = Math.PI * 2;

function render(sampleRate: number, seconds: number, sample: (t: number) => number): SynthSound {
  const length = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const tail = Math.min(1, (seconds - t) / 0.012);
    samples[i] = Math.max(-1, Math.min(1, sample(t) * tail));
  }
  return { sampleRate, samples };
}

/** Paso sobre asfalto. `variant` 0 o 1 alterna pie izquierdo y derecho. */
export function synthFootstep(variant: number, sampleRate = 44100): SynthSound {
  const rng = new Rng(40 + variant);
  let low = 0;
  const pitch = variant === 0 ? 95 : 82;
  return render(sampleRate, 0.11, (t) => {
    low += 0.18 * (rng.next() * 2 - 1 - low);
    const scuff = low * Math.exp(-t * 55);
    const thud = Math.sin(TAU * pitch * t) * Math.exp(-t * 48);
    return (scuff * 1.4 + thud * 0.6) * 0.6;
  });
}

/** Gruñido corto y áspero al lanzar el golpe. */
export function synthSnarl(sampleRate = 44100): SynthSound {
  const rng = new Rng(42);
  let low = 0;
  return render(sampleRate, 0.34, (t) => {
    const pitch = 130 + 60 * Math.sin(t * 30) - t * 120;
    const phase = TAU * pitch * t;
    const voice = Math.tanh((Math.sin(phase) + Math.sin(phase * 1.51) * 0.6) * 2.2);
    low += 0.3 * (rng.next() * 2 - 1 - low);
    return (voice * 0.5 + low * 0.9) * Math.min(1, t * 40) * Math.exp(-t * 7) * 0.6;
  });
}

/** Estertor al morir: la voz cae de tono y se ahoga. */
export function synthDeathCry(sampleRate = 44100): SynthSound {
  const rng = new Rng(43);
  let low = 0;
  return render(sampleRate, 0.62, (t) => {
    const pitch = 150 * Math.exp(-t * 2.4) + 45;
    const phase = TAU * pitch * t;
    const gurgle = 0.6 + 0.4 * Math.sin(TAU * 17 * t);
    const voice = (Math.sin(phase) * 0.6 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3.02) * 0.2) * gurgle;
    low += 0.12 * (rng.next() * 2 - 1 - low);
    return (voice + low * 1.6) * Math.min(1, t * 25) * Math.exp(-t * 4.2) * 0.55;
  });
}

/** Explosión: estampido, cuerpo grave largo y cola de escombros. */
export function synthExplosion(sampleRate = 44100): SynthSound {
  const rng = new Rng(44);
  let low = 0;
  let lower = 0;
  let phase = 0;
  return render(sampleRate, 1.5, (t) => {
    const noise = rng.next() * 2 - 1;
    low += (0.5 * Math.exp(-t * 5) + 0.03) * (noise - low);
    lower += 0.02 * (noise - lower);
    phase += (TAU * (38 + 70 * Math.exp(-t * 9))) / sampleRate;
    const crack = noise * Math.exp(-t * 60) * 0.7;
    const body = Math.sin(phase) * Math.exp(-t * 3.2) * 0.9;
    const rumble = lower * 9 * Math.exp(-t * 2.2);
    return Math.tanh((crack + low * 1.8 * Math.exp(-t * 6) + body + rumble) * 1.3) * 0.85;
  });
}

/** Chispazo eléctrico de un cable suelto. */
export function synthZap(sampleRate = 44100): SynthSound {
  const rng = new Rng(45);
  return render(sampleRate, 0.2, (t) => {
    // Ráfagas de 120 Hz, como un arco de corriente alterna.
    const gate = Math.sin(TAU * 120 * t) > 0.2 ? 1 : 0.1;
    const buzz = Math.sign(Math.sin(TAU * 2100 * t + Math.sin(TAU * 60 * t) * 4));
    return ((rng.next() * 2 - 1) * 0.6 + buzz * 0.25) * gate * Math.exp(-t * 16) * 0.5;
  });
}
