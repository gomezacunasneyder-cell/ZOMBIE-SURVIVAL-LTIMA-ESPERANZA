import type { PixelBuffer } from './PixelBuffer';
import { FORTIFICATION_STAGES, paintDevourer, paintFortification } from './painters/survival';

/** Fotogramas de deterioro de la barricada reforzada, de entera a casi rota. */
export const FORTIFICATION_FRAMES: string[] = Array.from({ length: FORTIFICATION_STAGES }, (_, i) => `prop/fortification/${i}`);

/** Silueta de EL DEVORADOR con los ojos cerrados y abiertos. */
export const DEVOURER_FRAMES = { dark: 'boss/devourer/0', eyes: 'boss/devourer/1' } as const;

/** Arte del modo supervivencia. */
export function addSurvivalArt(sprites: Map<string, PixelBuffer>): void {
  sprites.set('prop/fortification', paintFortification(0));
  FORTIFICATION_FRAMES.forEach((name, stage) => sprites.set(name, paintFortification(stage)));
  sprites.set(DEVOURER_FRAMES.dark, paintDevourer(false));
  sprites.set(DEVOURER_FRAMES.eyes, paintDevourer(true));
}
