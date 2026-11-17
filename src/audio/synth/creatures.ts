import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';

/**
 * Voces de los infectados especiales. Funciones puras: devuelven muestras
 * que el adaptador convierte en `AudioBuffer`.
 */

function render(sampleRate: number, seconds: number, sample: (t: number) => number): SynthSound {
  const length = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const tail = Math.min(1, (seconds - t) / 0.015);
    samples[i] = Math.max(-1, Math.min(1, sample(t) * tail));
  }
  return { sampleRate, samples };
}

/**
 * Chasquidos del Chasqueador: una ráfaga irregular de golpes de garganta
 * secos y resonantes, como una lengua contra el paladar, sobre un zumbido
 * gutural. Es su firma sonora: se reconoce sin verlo.
 */
export function synthClicks(sampleRate = 44100): SynthSound {
  const rng = new Rng(31);
  const clicks: { at: number; pitch: number; gain: number }[] = [];
  let at = 0.01;
  while (at < 0.5) {
    clicks.push({ at, pitch: 1100 + rng.next() * 900, gain: 0.6 + rng.next() * 0.4 });
    at += 0.035 + rng.next() * 0.05;
  }
  let buzz = 0;
  return render(sampleRate, 0.6, (t) => {
    let v = 0;
    for (const c of clicks) {
      const local = t - c.at;
      if (local < 0 || local > 0.03) continue;
      v += Math.sin(local * Math.PI * 2 * c.pitch) * Math.exp(-local * 260) * c.gain;
    }
    // Zumbido de garganta a 90 Hz, ronco.
    buzz += 0.2 * (rng.next() * 2 - 1 - buzz);
    const throat = Math.sign(Math.sin(t * Math.PI * 2 * 90)) * 0.06 * Math.exp(-t * 3) + buzz * 0.12;
    return (v * 0.8 + throat) * 0.7;
  });
}

/** Chillido agudo del corredor y del Chasqueador al lanzarse. */
export function synthScreech(sampleRate = 44100): SynthSound {
  const rng = new Rng(32);
  let band = 0;
  let phase = 0;
  return render(sampleRate, 0.42, (t) => {
    const freq = 900 + 1400 * Math.sin(Math.min(1, t / 0.3) * Math.PI * 0.5);
    phase += (Math.PI * 2 * freq) / sampleRate;
    band += 0.35 * (rng.next() * 2 - 1 - band);
    const envelope = Math.min(1, t / 0.03) * Math.exp(-t * 4);
    return (Math.sin(phase) * 0.35 + band * 0.9) * envelope * (0.8 + 0.2 * Math.sin(t * 190));
  });
}

/** Rugido grave del mutante: diente de sierra a 70–110 Hz con ruido modulado. */
export function synthRoar(sampleRate = 44100): SynthSound {
  const rng = new Rng(33);
  let low = 0;
  let phase = 0;
  return render(sampleRate, 1.0, (t) => {
    const freq = 70 + 40 * Math.sin(Math.min(1, t / 0.5) * Math.PI);
    phase = (phase + freq / sampleRate) % 1;
    low += 0.05 * (rng.next() * 2 - 1 - low);
    const envelope = Math.min(1, t / 0.12) * Math.exp(-t * 1.6);
    const growl = (phase * 2 - 1) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 18));
    return (growl * 0.55 + low * 2.2) * envelope;
  });
}

/** Mazazo del mutante contra el suelo: golpe muy grave y polvo. */
export function synthSlam(sampleRate = 44100): SynthSound {
  const rng = new Rng(34);
  let low = 0;
  let phase = 0;
  return render(sampleRate, 0.6, (t) => {
    const freq = 30 + 70 * Math.exp(-t * 18);
    phase += (Math.PI * 2 * freq) / sampleRate;
    low += 0.15 * (rng.next() * 2 - 1 - low);
    return (Math.sin(phase) * Math.exp(-t * 7) * 1.1 + low * Math.exp(-t * 10) * 1.6) * 0.8;
  });
}

/** Barricada que se parte: crujidos de madera y metal y un golpe sordo. */
export function synthBarricadeBreak(sampleRate = 44100): SynthSound {
  const rng = new Rng(35);
  const cracks = [0, 0.06, 0.13, 0.22, 0.31].map((at) => ({ at, pitch: 300 + rng.next() * 500 }));
  let low = 0;
  return render(sampleRate, 0.7, (t) => {
    let v = 0;
    for (const c of cracks) {
      const local = t - c.at;
      if (local < 0) continue;
      v += ((rng.next() * 2 - 1) * 0.7 + Math.sin(local * Math.PI * 2 * c.pitch) * 0.4) * Math.exp(-local * 30);
    }
    low += 0.06 * (rng.next() * 2 - 1 - low);
    return (v * 0.5 + low * 2 * Math.exp(-t * 5)) * 0.75;
  });
}
