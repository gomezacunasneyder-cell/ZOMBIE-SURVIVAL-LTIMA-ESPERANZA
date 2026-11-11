import type Phaser from 'phaser';
import { positional, type AudioBus } from '../../core/settings/audioSettings';
import { gustAt } from '../../core/world/wind';
import { LOOP, type LoopKey } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import { audioState } from './audioState';

type LoopSound = Phaser.Sound.WebAudioSound;

interface Channel {
  sound: LoopSound;
  bus: AudioBus;
  /** Volumen máximo de este bucle dentro de su canal. */
  gain: number;
  /** Nivel 0–1 al que tiende y nivel actual (se acercan con suavidad). */
  target: number;
  level: number;
}

/** Lo que el director necesita saber del mundo en cada fotograma. */
export interface AudioScene {
  timeMs: number;
  night: number;
  helicopterX: number;
  alarmXs: number[];
  /** Zombis persiguiendo a Alex: gobiernan la intensidad de la música. */
  chasing: number;
  playerAlive: boolean;
}

/** Velocidad a la que un bucle cambia de nivel, en unidades por segundo. */
const FADE_RATE = 0.9;

const SETUP: Record<LoopKey, { bus: AudioBus; gain: number }> = {
  [LOOP.wind]: { bus: 'sfx', gain: 0.5 },
  [LOOP.helicopter]: { bus: 'sfx', gain: 0.55 },
  [LOOP.alarm]: { bus: 'sfx', gain: 0.4 },
  [LOOP.night]: { bus: 'sfx', gain: 0.5 },
  [LOOP.tension]: { bus: 'music', gain: 0.6 },
  [LOOP.combat]: { bus: 'music', gain: 0.55 },
};

/**
 * Director de audio: mantiene los bucles de ambiente y música y decide su
 * volumen según lo que ocurre (rachas de viento, distancia al helicóptero
 * y a las alarmas, caída de la noche, zombis persiguiendo). Los cambios
 * son siempre graduales. Respeta los volúmenes de música y efectos.
 */
export class AudioDirector {
  private readonly channels = new Map<LoopKey, Channel>();
  private readonly unsubscribe: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    for (const key of Object.keys(SETUP) as LoopKey[]) {
      if (!scene.cache.audio.exists(key)) continue;
      const sound = scene.sound.add(key, { loop: true, volume: 0 }) as LoopSound;
      sound.play();
      this.channels.set(key, { sound, ...SETUP[key], target: 0, level: 0 });
    }
    this.unsubscribe = audioState.onChange(() => this.apply());
  }

  private setTarget(key: LoopKey, level: number): Channel | undefined {
    const channel = this.channels.get(key);
    if (channel) channel.target = Math.min(1, Math.max(0, level));
    return channel;
  }

  private apply(): void {
    const settings = audioState.settings;
    for (const channel of this.channels.values()) {
      channel.sound.setVolume(channel.level * channel.gain * settings[channel.bus]);
    }
  }

  update(deltaMs: number, world: AudioScene): void {
    const listener = this.scene.cameras.main.scrollX + GAME_WIDTH / 2;

    // Viento: siempre presente, con más cuerpo en las rachas.
    this.setTarget(LOOP.wind, 0.35 + gustAt(world.timeMs) * 0.65);
    this.setTarget(LOOP.night, world.night);

    const helicopter = positional(world.helicopterX, listener, 620);
    this.setTarget(LOOP.helicopter, helicopter.gain)?.sound.setPan(helicopter.pan);

    let alarmGain = 0;
    let alarmPan = 0;
    for (const x of world.alarmXs) {
      const p = positional(x, listener, 520);
      if (p.gain > alarmGain) {
        alarmGain = p.gain;
        alarmPan = p.pan;
      }
    }
    this.setTarget(LOOP.alarm, alarmGain)?.sound.setPan(alarmPan);

    // Música: tensión de fondo que crece de noche; combate cuando persiguen a Alex.
    const combat = world.playerAlive ? Math.min(1, world.chasing / 3) : 0;
    this.setTarget(LOOP.tension, world.playerAlive ? 0.55 + world.night * 0.3 + combat * 0.15 : 0.3);
    this.setTarget(LOOP.combat, combat);

    const step = (FADE_RATE * deltaMs) / 1000;
    for (const channel of this.channels.values()) {
      const gap = channel.target - channel.level;
      channel.level += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
    }
    this.apply();
  }

  /** Nivel actual de cada bucle (para pruebas). */
  levels(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, channel] of this.channels) out[key] = Math.round(channel.level * 100) / 100;
    return out;
  }

  /** Detiene y libera todos los bucles. Llamar al cerrar la escena. */
  destroy(): void {
    this.unsubscribe();
    for (const channel of this.channels.values()) {
      channel.sound.stop();
      channel.sound.destroy();
    }
    this.channels.clear();
  }
}
