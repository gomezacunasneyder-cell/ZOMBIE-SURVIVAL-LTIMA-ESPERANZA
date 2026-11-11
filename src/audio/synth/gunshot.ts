import { Rng } from '../../core/math/Rng';

export interface SynthSound {
  sampleRate: number;
  samples: Float32Array;
}

/**
 * Disparo de pistola sintetizado: chasquido de ruido filtrado más un golpe
 * grave que cae de tono. Función pura; devuelve las muestras para que el
 * adaptador las convierta en un `AudioBuffer`.
 */
export function synthGunshot(sampleRate = 44100, seed = 1): SynthSound {
  const duration = 0.32;
  const length = Math.floor(sampleRate * duration);
  const samples = new Float32Array(length);
  const rng = new Rng(seed);
  let filtered = 0;
  let phase = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Ruido con filtro paso bajo que se cierra con el tiempo.
    const cutoff = 0.75 * Math.exp(-t * 22) + 0.04;
    filtered += cutoff * (rng.next() * 2 - 1 - filtered);
    const crack = filtered * Math.exp(-t * 16);
    // Golpe grave de 150 Hz a 45 Hz.
    const freq = 45 + 105 * Math.exp(-t * 28);
    phase += (2 * Math.PI * freq) / sampleRate;
    const thump = Math.sin(phase) * Math.exp(-t * 20) * 0.7;
    samples[i] = Math.max(-1, Math.min(1, (crack * 1.6 + thump) * 0.8));
  }
  return { sampleRate, samples };
}
