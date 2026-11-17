import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';
import { click, render } from './sfx';

/**
 * Sonidos del lanzamiento de suministros y de los botiquines. Funciones
 * puras como el resto de recetas: devuelven muestras.
 */

const TAU = Math.PI * 2;

/** Alarma de radio: estática que se abre y tres pitidos dobles de aviso. */
export function synthRadioAlarm(sampleRate = 44100): SynthSound {
  const rng = new Rng(41);
  let hiss = 0;
  return render(sampleRate, 1.7, (t) => {
    hiss += 0.5 * (rng.next() * 2 - 1 - hiss);
    const staticGain = 0.12 + 0.1 * Math.exp(-t * 3);
    let beep = 0;
    for (let i = 0; i < 3; i++) {
      const start = 0.12 + i * 0.5;
      const local = t - start;
      if (local < 0 || local > 0.36) continue;
      const freq = local < 0.18 ? 1320 : 990;
      const gate = Math.min(1, local * 200) * Math.min(1, (0.36 - local) * 200);
      // Onda cuadrada suavizada: suena a altavoz de radio.
      beep += Math.tanh(Math.sin(TAU * freq * t) * 3) * 0.32 * gate;
    }
    return hiss * staticGain + beep;
  });
}

/** Transmisión de radio: chasquido de apertura, voz ininteligible filtrada y corte. */
export function synthRadioChatter(sampleRate = 44100): SynthSound {
  const rng = new Rng(42);
  let band = 0;
  let low = 0;
  return render(sampleRate, 1.1, (t) => {
    const n = rng.next() * 2 - 1;
    band += 0.35 * (n - band);
    low += 0.08 * (band - low);
    const voiceBand = band - low;
    // Sílabas: la voz se abre y se cierra a ritmo de habla.
    const syllables = Math.max(0, Math.sin(t * 23) * 0.6 + Math.sin(t * 37 + 1) * 0.4);
    const pitch = Math.sin(TAU * (180 + Math.sin(t * 9) * 30) * t) * 0.3;
    const body = t > 0.06 && t < 1.0 ? (voiceBand * 1.4 + pitch * voiceBand * 2) * syllables : 0;
    return click(t, 0, n, 2200) * 0.6 + click(t, 1.02, n, 1800) * 0.5 + body * 0.55 + n * 0.03;
  });
}

/** Paracaídas que se abre: latigazo de tela y un golpe sordo al tensarse. */
export function synthChute(sampleRate = 44100): SynthSound {
  const rng = new Rng(43);
  let soft = 0;
  return render(sampleRate, 0.45, (t) => {
    soft += 0.18 * (rng.next() * 2 - 1 - soft);
    const flap = soft * Math.exp(-t * 9) * 1.6 * (1 + Math.sin(t * 90) * 0.4);
    const snap = t > 0.12 ? Math.sin(TAU * 70 * (t - 0.12)) * Math.exp(-(t - 0.12) * 18) * 0.7 : 0;
    return (flap + snap) * 0.7;
  });
}

/** Caja que golpea el asfalto: impacto grave, crujido de madera y traqueteo. */
export function synthCrateLand(sampleRate = 44100): SynthSound {
  const rng = new Rng(44);
  let low = 0;
  return render(sampleRate, 0.6, (t) => {
    const n = rng.next() * 2 - 1;
    low += 0.07 * (n - low);
    const thump = Math.sin(TAU * (48 + 60 * Math.exp(-t * 25)) * t) * Math.exp(-t * 9);
    const crunch = n * Math.exp(-t * 26) * 0.5;
    const rattle = click(t, 0.09, n, 820) * 0.5 + click(t, 0.17, n, 640) * 0.35 + click(t, 0.26, n, 900) * 0.2;
    return (thump * 0.9 + low * 2.4 * Math.exp(-t * 6) + crunch + rattle) * 0.75;
  });
}

/** Apertura de la caja: dos cierres metálicos y la tapa que chirría. */
export function synthCrateOpen(sampleRate = 44100): SynthSound {
  const rng = new Rng(45);
  return render(sampleRate, 0.7, (t) => {
    const n = rng.next() * 2 - 1;
    const latches = click(t, 0.02, n, 1500) + click(t, 0.14, n, 1300);
    const creakT = t - 0.24;
    const creak = creakT > 0 && creakT < 0.36 ? Math.sin(TAU * (240 + creakT * 260) * t) * Math.sin(t * 160) * 0.3 : 0;
    const thud = click(t, 0.6, n, 300) * 0.8;
    return (latches * 0.6 + creak + thud) * 0.65;
  });
}

/** Bengala que se enciende: chispazo y siseo que se asienta. */
export function synthFlare(sampleRate = 44100): SynthSound {
  const rng = new Rng(46);
  let hiss = 0;
  return render(sampleRate, 0.9, (t) => {
    hiss += 0.6 * (rng.next() * 2 - 1 - hiss);
    const envelope = Math.min(1, t * 30) * (0.35 + 0.65 * Math.exp(-t * 4));
    return (hiss * 0.5 * envelope + click(t, 0, rng.next() * 2 - 1, 2600) * 0.5) * 0.6;
  });
}

/** Botiquín: cremallera, venda y cinta que se arranca. */
export function synthMedkit(sampleRate = 44100): SynthSound {
  const rng = new Rng(47);
  let soft = 0;
  return render(sampleRate, 0.8, (t) => {
    const n = rng.next() * 2 - 1;
    soft += 0.25 * (n - soft);
    const zip = t < 0.28 ? soft * (0.5 + 0.5 * Math.sin(t * 700)) * 0.8 : 0;
    const tapeT = t - 0.45;
    const tape = tapeT > 0 && tapeT < 0.22 ? n * (1 - tapeT / 0.22) * 0.6 : 0;
    return (zip + tape) * 0.6;
  });
}
