import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';
import { click, render } from './sfx';

/**
 * Sonidos de los arrojadizos y de las piezas. Funciones puras como el
 * resto de recetas: devuelven muestras.
 */

const TAU = Math.PI * 2;

/** Lanzamiento: un silbido de aire que pasa deprisa. */
export function synthThrowSwish(sampleRate = 44100): SynthSound {
  const rng = new Rng(61);
  let band = 0;
  let low = 0;
  return render(sampleRate, 0.28, (t) => {
    const n = rng.next() * 2 - 1;
    band += (0.2 + t * 2) * (n - band);
    low += 0.05 * (band - low);
    const envelope = Math.sin(Math.PI * Math.min(1, t / 0.28)) ** 2;
    return (band - low) * envelope * 0.9;
  });
}

/** Rebote de la granada: golpe metálico corto contra el asfalto. */
export function synthGrenadeBounce(sampleRate = 44100): SynthSound {
  const rng = new Rng(62);
  return render(sampleRate, 0.16, (t) => {
    const n = rng.next() * 2 - 1;
    const ring = Math.sin(TAU * 1850 * t) * 0.3 + Math.sin(TAU * 2730 * t) * 0.2;
    return (click(t, 0, n, 900) * 0.6 + ring * Math.exp(-t * 40)) * 0.7;
  });
}

/** Botella que estalla y combustible que prende con un soplido. */
export function synthGlassBreak(sampleRate = 44100): SynthSound {
  const rng = new Rng(63);
  let soft = 0;
  return render(sampleRate, 0.9, (t) => {
    const n = rng.next() * 2 - 1;
    soft += 0.08 * (n - soft);
    // Cristales: chasquidos agudos que se reparten en el primer quinto de segundo.
    let shards = 0;
    for (let i = 0; i < 7; i++) shards += click(t, i * 0.025 + (i % 3) * 0.008, n, 3200 + i * 450) * (1 - i * 0.1);
    const whoomp = t > 0.05 ? soft * 3.2 * Math.min(1, (t - 0.05) * 12) * Math.exp(-(t - 0.05) * 3.5) : 0;
    return (shards * 0.45 + whoomp) * 0.7;
  });
}

/** Piezas recogidas: tintineo metálico de tuercas. */
export function synthScrapPickup(sampleRate = 44100): SynthSound {
  const rng = new Rng(64);
  return render(sampleRate, 0.22, (t) => {
    const n = rng.next() * 2 - 1;
    const tink = (at: number, f: number): number => (t < at ? 0 : Math.sin(TAU * f * (t - at)) * Math.exp(-(t - at) * 38));
    return (tink(0, 2400) * 0.4 + tink(0.06, 3100) * 0.35 + tink(0.11, 2750) * 0.25 + click(t, 0, n, 1200) * 0.15) * 0.7;
  });
}
