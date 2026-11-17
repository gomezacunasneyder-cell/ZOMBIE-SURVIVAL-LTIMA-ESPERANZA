import type { PixelBuffer } from './PixelBuffer';
import {
  CHUTE_COLLAPSE_FRAMES,
  paintAirdropCrate,
  paintAirdropCrateOpen,
  paintCargoSling,
  paintChute,
  paintChuteCollapse,
  paintChuteDeploy,
  paintCrateArrow,
  paintHelicopterTilted,
} from './painters/airdrop';
import { BULLET_ANGLES } from './painters/guns';
import {
  FLAME_FRAMES,
  paintFlame,
  paintFlamerIcon,
  paintMedkitIcon,
  paintRocket,
  paintRocketIcon,
} from './painters/heavyFx';

type AddAnimation = (key: string, frames: PixelBuffer[], frameRate: number, repeat?: number) => void;

/** Fotograma del helicóptero según su actitud (-1 morro arriba, 0 nivelado, 1 morro abajo). */
export function heliBodyFrame(attitude: -1 | 0 | 1): string {
  return `heli/body/${attitude}`;
}

/** Cohete en vuelo para un ángulo de los de `BULLET_ANGLES`. */
export function rocketFrame(angle: number): string {
  return `fx/rocket/${angle}`;
}

export function flameFrame(age: number): string {
  return `fx/flame/${Math.max(0, Math.min(FLAME_FRAMES - 1, age))}`;
}

export { FLAME_FRAMES };

/** Arte del lanzamiento de suministros y de las armas pesadas. */
export function addSupplyArt(sprites: Map<string, PixelBuffer>, addAnimation: AddAnimation): void {
  for (const attitude of [-1, 0, 1] as const) sprites.set(heliBodyFrame(attitude), paintHelicopterTilted(attitude));
  for (let crates = 1; crates <= 3; crates++) sprites.set(`supply/sling/${crates}`, paintCargoSling(crates));
  sprites.set('supply/crate', paintAirdropCrate());
  sprites.set('supply/crate-open', paintAirdropCrateOpen());
  sprites.set('supply/chute-deploy', paintChuteDeploy());
  addAnimation('supply/chute', [paintChute(-1), paintChute(0), paintChute(1), paintChute(0)], 3);
  addAnimation(
    'supply/chute-collapse',
    Array.from({ length: CHUTE_COLLAPSE_FRAMES }, (_, i) => paintChuteCollapse(i)),
    8,
    0,
  );
  sprites.set('ui/crate-arrow', paintCrateArrow());

  for (let i = 0; i < FLAME_FRAMES; i++) sprites.set(flameFrame(i), paintFlame(i));
  for (const angle of BULLET_ANGLES) sprites.set(rocketFrame(angle), paintRocket(angle));
  sprites.set('ui/flamer', paintFlamerIcon());
  sprites.set('ui/rocket', paintRocketIcon());
  sprites.set('ui/medkit', paintMedkitIcon());
}
