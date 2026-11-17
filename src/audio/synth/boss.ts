import { Rng } from '../../core/math/Rng';
import type { SynthSound } from './gunshot';
import { click, render } from './sfx';

/**
 * Voz de EL DEVORADOR y de sus ataques: rugidos graves con varias capas
 * (diente de sierra desafinado, ruido filtrado y un gorgoteo), golpes que
 * hacen temblar el suelo, bilis y espinas. Funciones puras: devuelven muestras.
 */

const TAU = Math.PI * 2;

/** Rugido de criatura enorme: tres voces graves desafinadas, garganta húmeda y temblor. */
function bellow(sampleRate: number, seed: number, seconds: number, base: number, sweep: number, attack: number, decay: number): SynthSound {
  const rng = new Rng(seed);
  let low = 0;
  let wet = 0;
  const phases = [0, 0, 0];
  return render(sampleRate, seconds, (t) => {
    const k = t / seconds;
    const freq = base + sweep * Math.sin(Math.min(1, k * 1.6) * Math.PI);
    let saw = 0;
    [1, 1.013, 0.497].forEach((ratio, i) => {
      phases[i] = ((phases[i] as number) + (freq * ratio) / sampleRate) % 1;
      saw += ((phases[i] as number) * 2 - 1) * (i === 2 ? 0.6 : 0.35);
    });
    const n = rng.next() * 2 - 1;
    low += 0.04 * (n - low);
    wet += 0.3 * (n - wet);
    const gurgle = wet * Math.max(0, Math.sin(t * TAU * 11)) * 0.5;
    const tremble = 0.65 + 0.35 * Math.sin(t * TAU * 23);
    const envelope = Math.min(1, t / attack) * Math.exp(-t * decay);
    return Math.tanh((saw * tremble + low * 2.6 + gurgle) * 1.4) * envelope * 0.85;
  });
}

/** Rugido de presentación, de furia y de invocación: largo y que sube. */
export function synthBossRoar(sampleRate = 44100): SynthSound {
  return bellow(sampleRate, 71, 2.2, 52, 34, 0.18, 0.9);
}

/** Gruñido corto al preparar un ataque. */
export function synthBossGrowl(sampleRate = 44100): SynthSound {
  return bellow(sampleRate, 72, 0.7, 44, 12, 0.06, 3.2);
}

/** Bramido de dolor: más agudo y entrecortado. */
export function synthBossHurt(sampleRate = 44100): SynthSound {
  return bellow(sampleRate, 73, 0.55, 95, 40, 0.02, 4.5);
}

/** Muerte: un lamento largo que se hunde y el golpe del cuerpo contra el suelo. */
export function synthBossDeath(sampleRate = 44100): SynthSound {
  const voice = bellow(sampleRate, 74, 3.6, 70, -30, 0.1, 0.55);
  const rng = new Rng(75);
  let low = 0;
  return render(sampleRate, 3.6, (t, i) => {
    low += 0.05 * (rng.next() * 2 - 1 - low);
    const fall = t > 2.6 ? Math.sin(TAU * (34 + 30 * Math.exp(-(t - 2.6) * 12)) * (t - 2.6)) * Math.exp(-(t - 2.6) * 3) + low * 3 * Math.exp(-(t - 2.6) * 2) : 0;
    return (voice.samples[i] ?? 0) * 0.85 + fall * 0.8;
  });
}

/** Golpe contra el suelo: impacto enorme, crujido del asfalto y retumbar que se aleja. */
export function synthBossSlam(sampleRate = 44100): SynthSound {
  const rng = new Rng(76);
  let low = 0;
  return render(sampleRate, 1.4, (t) => {
    const n = rng.next() * 2 - 1;
    low += 0.03 * (n - low);
    const thump = Math.sin(TAU * (30 + 70 * Math.exp(-t * 18)) * t) * Math.exp(-t * 4);
    const crack = n * Math.exp(-t * 22) * 0.7 + click(t, 0.05, n, 700) * 0.4 + click(t, 0.11, n, 520) * 0.3;
    const rumble = low * 4 * Math.exp(-t * 1.8) * (0.7 + 0.3 * Math.sin(t * TAU * 7));
    return Math.tanh((thump * 1.1 + crack + rumble) * 1.2) * 0.9;
  });
}

/** Escupitajo de bilis: gorgoteo que sube y un chorro húmedo. */
export function synthBossSpit(sampleRate = 44100): SynthSound {
  const rng = new Rng(77);
  let wet = 0;
  return render(sampleRate, 0.6, (t) => {
    const n = rng.next() * 2 - 1;
    wet += 0.25 * (n - wet);
    const gurgle = t < 0.35 ? wet * Math.max(0, Math.sin(t * TAU * (14 + t * 30))) * 1.4 : 0;
    const spray = t > 0.3 ? n * Math.exp(-(t - 0.3) * 12) * 0.6 : 0;
    return (gurgle + spray) * 0.7;
  });
}

/** Bilis que cae y chisporrotea en el asfalto. */
export function synthBileSplat(sampleRate = 44100): SynthSound {
  const rng = new Rng(78);
  let wet = 0;
  return render(sampleRate, 0.5, (t) => {
    const n = rng.next() * 2 - 1;
    wet += 0.4 * (n - wet);
    const splat = wet * Math.exp(-t * 14) * 1.3;
    const sizzle = n * 0.18 * Math.exp(-t * 3) * (t > 0.05 ? 1 : 0);
    return (splat + sizzle) * 0.7;
  });
}

/** Espina de hueso que revienta el asfalto. */
export function synthSpike(sampleRate = 44100): SynthSound {
  const rng = new Rng(79);
  return render(sampleRate, 0.45, (t) => {
    const n = rng.next() * 2 - 1;
    const crack = click(t, 0, n, 900) * 0.9 + click(t, 0.03, n, 1400) * 0.5;
    const stone = n * Math.exp(-t * 16) * 0.5;
    const thud = Math.sin(TAU * (60 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9);
    return (crack + stone + thud * 0.7) * 0.75;
  });
}

/** Cinta de la grabación militar: siseo, chasquido de inicio y zumbido de red. */
export function synthTape(sampleRate = 44100): SynthSound {
  const rng = new Rng(80);
  let hiss = 0;
  return render(sampleRate, 1.2, (t) => {
    hiss += 0.6 * (rng.next() * 2 - 1 - hiss);
    const hum = Math.sin(TAU * 50 * t) * 0.08 + Math.sin(TAU * 100 * t) * 0.04;
    return click(t, 0, rng.next() * 2 - 1, 1600) * 0.6 + hiss * 0.12 + hum;
  });
}
