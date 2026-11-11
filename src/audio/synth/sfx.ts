import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';

/**
 * Efectos de sonido sintetizados. Cada receta es una función pura que
 * devuelve muestras; el adaptador las convierte en `AudioBuffer`.
 */

function render(
  sampleRate: number,
  seconds: number,
  sample: (t: number, i: number) => number,
): SynthSound {
  const length = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Desvanecido final corto para evitar chasquidos.
    const tail = Math.min(1, (seconds - t) / 0.01);
    samples[i] = Math.max(-1, Math.min(1, sample(t, i) * tail));
  }
  return { sampleRate, samples };
}

/** Golpe metálico breve en el instante `at`. */
function click(t: number, at: number, noise: number, pitch: number): number {
  const local = t - at;
  if (local < 0) return 0;
  const envelope = Math.exp(-local * 90);
  return (noise * 0.6 + Math.sin(local * Math.PI * 2 * pitch) * 0.5) * envelope;
}

/** Percutor sobre recámara vacía. */
export function synthDryFire(sampleRate = 44100): SynthSound {
  const rng = new Rng(11);
  return render(sampleRate, 0.09, (t) => click(t, 0, rng.next() * 2 - 1, 1900) * 0.5);
}

/** Recarga: extraer cargador, insertar y montar. */
export function synthReload(sampleRate = 44100): SynthSound {
  const rng = new Rng(12);
  return render(sampleRate, 0.62, (t) => {
    const n = rng.next() * 2 - 1;
    return (click(t, 0.02, n, 900) + click(t, 0.3, n, 650) * 1.1 + click(t, 0.5, n, 1500) * 0.9) * 0.55;
  });
}

/** Impacto de bala en carne. */
export function synthFleshHit(sampleRate = 44100): SynthSound {
  const rng = new Rng(13);
  let low = 0;
  return render(sampleRate, 0.14, (t) => {
    low += 0.12 * (rng.next() * 2 - 1 - low);
    const thump = Math.sin(Math.PI * 2 * (70 + 90 * Math.exp(-t * 40)) * t);
    return (low * 2.2 + thump * 0.7) * Math.exp(-t * 28) * 0.7;
  });
}

/** Impacto de bala en metal u hormigón. */
export function synthRicochet(sampleRate = 44100): SynthSound {
  const rng = new Rng(14);
  return render(sampleRate, 0.16, (t) => {
    const ping = Math.sin(Math.PI * 2 * (2400 - 6000 * t) * t);
    return ((rng.next() * 2 - 1) * Math.exp(-t * 80) * 0.6 + ping * Math.exp(-t * 30) * 0.35) * 0.6;
  });
}

/** Gemido grave del caminante al detectar a Alex. */
export function synthGroan(sampleRate = 44100): SynthSound {
  const rng = new Rng(15);
  let low = 0;
  return render(sampleRate, 0.7, (t) => {
    const pitch = 82 + Math.sin(t * 9) * 7 - t * 18;
    const phase = Math.PI * 2 * pitch * t;
    const voice = Math.sin(phase) * 0.6 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.15;
    low += 0.05 * (rng.next() * 2 - 1 - low);
    const envelope = Math.min(1, t * 12) * Math.exp(-t * 2.6);
    return (voice + low * 2) * envelope * 0.5;
  });
}

/** Quejido de Alex al recibir daño. */
export function synthHurt(sampleRate = 44100): SynthSound {
  const rng = new Rng(16);
  return render(sampleRate, 0.2, (t) => {
    const phase = Math.PI * 2 * (210 - 420 * t) * t;
    return (Math.sign(Math.sin(phase)) * 0.25 + Math.sin(phase) * 0.4 + (rng.next() - 0.5) * 0.3) * Math.exp(-t * 14) * 0.7;
  });
}

/** Aviso de suministro recogido: dos notas ascendentes. */
export function synthPickup(sampleRate = 44100): SynthSound {
  return render(sampleRate, 0.22, (t) => {
    const freq = t < 0.09 ? 660 : 990;
    const local = t < 0.09 ? t : t - 0.09;
    return Math.sin(Math.PI * 2 * freq * t) * Math.exp(-local * 18) * 0.4;
  });
}

/** Corredera de la escopeta: atrás y adelante, dos golpes graves de madera y metal. */
export function synthPump(sampleRate = 44100): SynthSound {
  const rng = new Rng(21);
  return render(sampleRate, 0.32, (t) => {
    const n = rng.next() * 2 - 1;
    return (click(t, 0, n, 420) * 1.1 + click(t, 0.15, n, 520) * 1.2) * 0.6;
  });
}

/** Cambio de arma: roce de tela y un clic de seguro. */
export function synthEquip(sampleRate = 44100): SynthSound {
  const rng = new Rng(22);
  let soft = 0;
  return render(sampleRate, 0.2, (t) => {
    soft += 0.08 * (rng.next() * 2 - 1 - soft);
    const rustle = soft * Math.exp(-t * 18) * 1.4;
    return (rustle + click(t, 0.12, rng.next() * 2 - 1, 1300) * 0.7) * 0.6;
  });
}

/** Recarga de un arma larga: soltar el cargador, encajar el nuevo y tirar del cerrojo. */
export function synthRifleReload(sampleRate = 44100): SynthSound {
  const rng = new Rng(23);
  return render(sampleRate, 0.9, (t) => {
    const n = rng.next() * 2 - 1;
    return (click(t, 0.02, n, 700) + click(t, 0.42, n, 560) * 1.2 + click(t, 0.7, n, 1100) + click(t, 0.78, n, 900) * 0.9) * 0.55;
  });
}

/** Cartucho que entra en el depósito de la escopeta. */
export function synthShellInsert(sampleRate = 44100): SynthSound {
  const rng = new Rng(24);
  return render(sampleRate, 0.12, (t) => click(t, 0, rng.next() * 2 - 1, 760) * 0.6);
}
