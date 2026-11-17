import type { PixelBuffer } from './PixelBuffer';
import {
  paintGrenade,
  paintGrenadeIcon,
  paintMolotov,
  paintMolotovIcon,
  paintScrap,
  paintScrapIcon,
  spinFrames,
} from './painters/throwables';

/** Dibujos de giro de un objeto lanzado: `throw/<id>/0…3`. */
export const THROW_SPIN_FRAMES = 4;
/** Variantes del montoncito de piezas en el suelo: `pickup/scrap/0…2`. */
export const SCRAP_VARIANTS = 3;

/** Arte de los arrojadizos y de las piezas. */
export function addThrowArt(sprites: Map<string, PixelBuffer>): void {
  spinFrames(paintGrenade()).forEach((frame, i) => sprites.set(`throw/grenade/${i}`, frame));
  spinFrames(paintMolotov()).forEach((frame, i) => sprites.set(`throw/molotov/${i}`, frame));
  for (let i = 0; i < SCRAP_VARIANTS; i++) sprites.set(`pickup/scrap/${i}`, paintScrap(i));
  sprites.set('ui/grenade', paintGrenadeIcon());
  sprites.set('ui/molotov', paintMolotovIcon());
  sprites.set('ui/scrap', paintScrapIcon());
}
