import type { PixelBuffer } from './PixelBuffer';
import { FORTIFICATION_STAGES, paintFortification } from './painters/survival';

/** Fotogramas de deterioro de la barricada reforzada, de entera a casi rota. */
export const FORTIFICATION_FRAMES: string[] = Array.from({ length: FORTIFICATION_STAGES }, (_, i) => `prop/fortification/${i}`);

/** Arte del modo supervivencia. */
export function addSurvivalArt(sprites: Map<string, PixelBuffer>): void {
  sprites.set('prop/fortification', paintFortification(0));
  FORTIFICATION_FRAMES.forEach((name, stage) => sprites.set(name, paintFortification(stage)));
}
