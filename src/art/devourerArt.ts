import type { PixelBuffer } from './PixelBuffer';
import { SHOCKWAVE_FRAMES, SPIKE_FRAMES, paintBile, paintBilePuddle, paintShockwave, paintSpike, paintSpikeWarning } from './painters/bossFx';
import { DEVOURER_POSES, paintDevourerCorpse, paintDevourerPose } from './painters/devourer';

type AddAnimation = (key: string, frames: PixelBuffer[], frameRate: number, repeat?: number) => void;

export type DevourerLook = 'normal' | 'enraged';
export const DEVOURER_LOOKS: readonly DevourerLook[] = ['normal', 'enraged'];

/** Animaciones en bucle o de una pasada que reproduce Phaser. */
export const DEVOURER_ANIMS = { idle: 6, walk: 8, roar: 6, kneel: 3, die: 3 } as const;
/** Fotogramas sueltos que la escena elige según el tramo del ataque. */
export const DEVOURER_STILLS = ['slam', 'charge', 'spit', 'hurt'] as const;

/** Clave de una animación o de un grupo de fotogramas: `boss/devourer/<aspecto>/<accion>`. */
export function devourerKey(look: DevourerLook, action: string): string {
  return `boss/devourer/${look}/${action}`;
}

/** EL DEVORADOR en combate, con su aspecto normal y enfurecido. */
export function addDevourerArt(sprites: Map<string, PixelBuffer>, addAnimation: AddAnimation): void {
  for (const look of DEVOURER_LOOKS) {
    const enraged = look === 'enraged';
    const paint = (action: string): PixelBuffer[] => (DEVOURER_POSES[action] ?? []).map((pose) => paintDevourerPose(pose, enraged));
    addAnimation(devourerKey(look, 'idle'), paint('idle'), DEVOURER_ANIMS.idle);
    addAnimation(devourerKey(look, 'walk'), paint('walk'), DEVOURER_ANIMS.walk);
    addAnimation(devourerKey(look, 'roar'), paint('roar'), DEVOURER_ANIMS.roar);
    addAnimation(devourerKey(look, 'kneel'), paint('kneel'), DEVOURER_ANIMS.kneel);
    const corpse = [0, 1, 2].map((stage) => paintDevourerCorpse(stage, enraged));
    addAnimation(devourerKey(look, 'die'), [...paint('die'), ...corpse], DEVOURER_ANIMS.die, 0);
    for (const action of DEVOURER_STILLS) {
      paint(action).forEach((frame, i) => sprites.set(`${devourerKey(look, action)}/${i}`, frame));
    }
  }

  // Ataques.
  addAnimation('boss/bile', [paintBile(0), paintBile(1)], 8);
  sprites.set('boss/bile-puddle', paintBilePuddle());
  addAnimation('boss/spike-warning', [paintSpikeWarning(true), paintSpikeWarning(false)], 10);
  addAnimation('boss/spike', Array.from({ length: SPIKE_FRAMES }, (_, i) => paintSpike(i)), 24, 0);
  addAnimation('boss/shockwave', Array.from({ length: SHOCKWAVE_FRAMES }, (_, i) => paintShockwave(i)), 12);
}
