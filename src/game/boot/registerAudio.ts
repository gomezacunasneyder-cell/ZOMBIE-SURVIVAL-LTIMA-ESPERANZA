import type Phaser from 'phaser';
import { synthGunshot, type SynthSound } from '../../audio/synth/gunshot';
import { synthDeathCry, synthExplosion, synthFootstep, synthSnarl, synthZap } from '../../audio/synth/impacts';
import {
  synthAlarmLoop,
  synthCombatLoop,
  synthHelicopterLoop,
  synthNightLoop,
  synthTensionLoop,
  synthWindLoop,
} from '../../audio/synth/loops';
import {
  synthDryFire,
  synthFleshHit,
  synthGroan,
  synthHurt,
  synthPickup,
  synthReload,
  synthRicochet,
} from '../../audio/synth/sfx';
import { positional } from '../../core/settings/audioSettings';
import { audioState } from '../audio/audioState';
import { GAME_WIDTH } from '../config';

/** Efectos puntuales. */
export const SFX = {
  gunshot: 'sfx/gunshot',
  dryFire: 'sfx/dry-fire',
  reload: 'sfx/reload',
  fleshHit: 'sfx/flesh-hit',
  ricochet: 'sfx/ricochet',
  groan: 'sfx/groan',
  hurt: 'sfx/hurt',
  pickup: 'sfx/pickup',
  stepLeft: 'sfx/step-left',
  stepRight: 'sfx/step-right',
  snarl: 'sfx/snarl',
  deathCry: 'sfx/death-cry',
  explosion: 'sfx/explosion',
  zap: 'sfx/zap',
} as const;

/** Sonidos en bucle: ambiente y música. */
export const LOOP = {
  wind: 'loop/wind',
  helicopter: 'loop/helicopter',
  alarm: 'loop/alarm',
  night: 'loop/night',
  tension: 'loop/tension',
  combat: 'loop/combat',
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];
export type LoopKey = (typeof LOOP)[keyof typeof LOOP];

const RECIPES: Record<SfxKey | LoopKey, (sampleRate: number) => SynthSound> = {
  [SFX.gunshot]: synthGunshot,
  [SFX.dryFire]: synthDryFire,
  [SFX.reload]: synthReload,
  [SFX.fleshHit]: synthFleshHit,
  [SFX.ricochet]: synthRicochet,
  [SFX.groan]: synthGroan,
  [SFX.hurt]: synthHurt,
  [SFX.pickup]: synthPickup,
  [SFX.stepLeft]: (rate) => synthFootstep(0, rate),
  [SFX.stepRight]: (rate) => synthFootstep(1, rate),
  [SFX.snarl]: synthSnarl,
  [SFX.deathCry]: synthDeathCry,
  [SFX.explosion]: synthExplosion,
  [SFX.zap]: synthZap,
  [LOOP.wind]: synthWindLoop,
  [LOOP.helicopter]: synthHelicopterLoop,
  [LOOP.alarm]: synthAlarmLoop,
  [LOOP.night]: synthNightLoop,
  [LOOP.tension]: synthTensionLoop,
  [LOOP.combat]: synthCombatLoop,
};

/**
 * Convierte los sonidos sintetizados en `AudioBuffer` y los registra en la
 * caché de audio de Phaser. Devuelve `false` si el navegador no ofrece
 * Web Audio (el juego sigue funcionando en silencio).
 */
export function registerAudio(scene: Phaser.Scene): boolean {
  const manager = scene.sound as Partial<Phaser.Sound.WebAudioSoundManager>;
  const context = manager.context;
  if (!context) return false;

  for (const key of Object.keys(RECIPES) as (SfxKey | LoopKey)[]) {
    const sound = RECIPES[key](context.sampleRate);
    const buffer = context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.getChannelData(0).set(sound.samples);
    scene.cache.audio.add(key, buffer);
  }
  return true;
}

/** Reproduce un efecto, con el volumen del canal de efectos y una ligera variación de tono. */
export function playSfx(scene: Phaser.Scene, key: SfxKey, volume = 0.5, detuneRange = 120, pan = 0): void {
  const level = volume * audioState.settings.sfx;
  if (level <= 0.001 || !scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: level, detune: (Math.random() * 2 - 1) * detuneRange, pan });
}

/**
 * Reproduce un efecto situado en el mundo: suena más flojo cuanto más
 * lejos está del centro de la pantalla y se desplaza al lado que toca.
 */
export function playSfxAt(scene: Phaser.Scene, key: SfxKey, worldX: number, volume = 0.5, reach = 460): void {
  const listener = scene.cameras.main.scrollX + GAME_WIDTH / 2;
  const { gain, pan } = positional(worldX, listener, reach);
  if (gain > 0.01) playSfx(scene, key, volume * gain, 120, pan);
}
