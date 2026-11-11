import { Rng } from '../../core/math/Rng';

export interface SynthSound {
  sampleRate: number;
  samples: Float32Array;
}

/**
 * Timbre de un disparo. Todos se construyen igual (chasquido de ruido
 * filtrado + golpe grave que cae de tono + eco de calle), pero con
 * proporciones distintas, de modo que cada arma se reconoce de oído.
 */
export interface GunVoice {
  seconds: number;
  /** Apertura inicial del filtro de ruido (0–1) y lo rápido que se cierra. */
  cutoff: number;
  cutoffDecay: number;
  /** Duración y fuerza del chasquido. */
  crackDecay: number;
  crackGain: number;
  /** Golpe grave: tono inicial y final en Hz, caída y fuerza. */
  thumpFrom: number;
  thumpTo: number;
  thumpDecay: number;
  thumpGain: number;
  /** Eco de los edificios: retardo en s y volumen. */
  echoDelay: number;
  echoGain: number;
  gain: number;
}

export const GUN_VOICES: Readonly<Record<string, GunVoice>> = {
  // Pistola: seca y media.
  pistol: {
    seconds: 0.32,
    cutoff: 0.75,
    cutoffDecay: 22,
    crackDecay: 16,
    crackGain: 1.6,
    thumpFrom: 150,
    thumpTo: 45,
    thumpDecay: 20,
    thumpGain: 0.7,
    echoDelay: 0,
    echoGain: 0,
    gain: 0.8,
  },
  // Escopeta: estampido grave y largo con mucho cuerpo y eco.
  shotgun: {
    seconds: 0.62,
    cutoff: 0.55,
    cutoffDecay: 9,
    crackDecay: 7,
    crackGain: 1.9,
    thumpFrom: 110,
    thumpTo: 32,
    thumpDecay: 9,
    thumpGain: 1.1,
    echoDelay: 0.11,
    echoGain: 0.32,
    gain: 0.85,
  },
  // Fusil: restallido agudo y corto, con eco.
  rifle: {
    seconds: 0.36,
    cutoff: 0.95,
    cutoffDecay: 30,
    crackDecay: 24,
    crackGain: 1.7,
    thumpFrom: 190,
    thumpTo: 60,
    thumpDecay: 32,
    thumpGain: 0.5,
    echoDelay: 0.085,
    echoGain: 0.22,
    gain: 0.75,
  },
  // Ametralladora: golpe corto y pesado para que la ráfaga no emborrone.
  mg: {
    seconds: 0.24,
    cutoff: 0.7,
    cutoffDecay: 26,
    crackDecay: 26,
    crackGain: 1.4,
    thumpFrom: 130,
    thumpTo: 40,
    thumpDecay: 26,
    thumpGain: 0.95,
    echoDelay: 0.07,
    echoGain: 0.18,
    gain: 0.8,
  },
};

/**
 * Disparo sintetizado. Función pura; devuelve las muestras para que el
 * adaptador las convierta en un `AudioBuffer`.
 */
export function synthGunshot(sampleRate = 44100, seed = 1, voice: GunVoice = GUN_VOICES.pistol as GunVoice): SynthSound {
  const length = Math.floor(sampleRate * voice.seconds);
  const dry = new Float32Array(length);
  const rng = new Rng(seed);
  let filtered = 0;
  let phase = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Ruido con filtro paso bajo que se cierra con el tiempo.
    const cutoff = voice.cutoff * Math.exp(-t * voice.cutoffDecay) + 0.04;
    filtered += cutoff * (rng.next() * 2 - 1 - filtered);
    const crack = filtered * Math.exp(-t * voice.crackDecay);
    const freq = voice.thumpTo + (voice.thumpFrom - voice.thumpTo) * Math.exp(-t * 28);
    phase += (2 * Math.PI * freq) / sampleRate;
    const thump = Math.sin(phase) * Math.exp(-t * voice.thumpDecay) * voice.thumpGain;
    dry[i] = crack * voice.crackGain + thump;
  }

  const samples = new Float32Array(length);
  const echo = Math.floor(voice.echoDelay * sampleRate);
  for (let i = 0; i < length; i++) {
    const wet = echo > 0 && i >= echo ? (dry[i - echo] as number) * voice.echoGain : 0;
    // Desvanecido final corto para evitar chasquidos.
    const tail = Math.min(1, (length - i) / (sampleRate * 0.01));
    samples[i] = Math.max(-1, Math.min(1, ((dry[i] as number) + wet) * voice.gain * tail));
  }
  return { sampleRate, samples };
}
