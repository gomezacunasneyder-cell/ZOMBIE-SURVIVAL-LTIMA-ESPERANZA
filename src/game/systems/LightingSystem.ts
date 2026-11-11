import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { MASK } from '../boot/registerArt';

export const LIGHTING_DEPTH = 1000;
/** Los brillos aditivos van por encima de la oscuridad. */
export const GLOW_DEPTH = 1001;
/** Las luces más alejadas de la pantalla que esto no se dibujan. */
const CULL_MARGIN = 180;
/** Color de la oscuridad añadida en interiores abandonados. */
const SHADE_COLOR = 0x15131c;

export interface LightOptions {
  /** Punto de la máscara que se coloca en (x, y). Por defecto, el centro. */
  originX?: number;
  originY?: number;
  /** 0–1: cuánta oscuridad retira en su punto más intenso. */
  intensity?: number;
  /** 0–1: variación aleatoria de la intensidad (fuego, fluorescentes). */
  flicker?: number;
  flipX?: boolean;
}

export class Light {
  enabled = true;
  intensity: number;
  /** Multiplicador externo (encendido progresivo de farolas, apagado gradual). */
  power = 1;
  readonly flicker: number;
  private readonly phase = Math.random() * 100;

  constructor(
    readonly stamp: Phaser.GameObjects.Image,
    public x: number,
    public y: number,
    options: LightOptions,
  ) {
    this.intensity = options.intensity ?? 1;
    this.flicker = options.flicker ?? 0;
  }

  /** Intensidad en este instante, con parpadeo en escalones (no suave). */
  currentIntensity(timeMs: number): number {
    const base = this.intensity * this.power;
    if (this.flicker === 0 || base === 0) return Phaser.Math.Clamp(base, 0, 1);
    const t = timeMs / 1000 + this.phase;
    const noise = Math.sin(t * 11.3) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 5.1) * 0.2;
    const stepped = Math.round(noise * 4) / 4;
    return Phaser.Math.Clamp(base * (1 + stepped * this.flicker), 0, 1);
  }
}

interface Shade {
  stamp: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

/**
 * Iluminación: una textura del tamaño de la pantalla se rellena con la
 * oscuridad ambiente, se le añaden zonas de sombra (interiores) y cada
 * luz «borra» su máscara sobre ella. Se dibuja en modo multiplicar, de
 * forma que oscurece y tiñe el mundo. Trabaja a la resolución interna
 * (480 × 270), así que es muy barata.
 */
export class LightingSystem {
  private readonly target: Phaser.GameObjects.RenderTexture;
  private readonly ambient: Phaser.GameObjects.Image;
  private readonly lights: Light[] = [];
  private readonly shades: Shade[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    ambientColor: number,
  ) {
    this.target = scene.add
      .renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(LIGHTING_DEPTH)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.ambient = scene.make
      .image({ key: MASK.ambient, add: false })
      .setOrigin(0, 0)
      .setTint(ambientColor);
  }

  /** Cambia el color de la oscuridad ambiente (atardecer, noche…). */
  setAmbientColor(color: number): void {
    this.ambient.setTint(color);
  }

  addLight(maskKey: string, x: number, y: number, options: LightOptions = {}): Light {
    const stamp = this.scene.make
      .image({ key: maskKey, add: false })
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5)
      .setFlipX(options.flipX ?? false);
    const light = new Light(stamp, x, y, options);
    this.lights.push(light);
    return light;
  }

  removeLight(light: Light): void {
    const index = this.lights.indexOf(light);
    if (index >= 0) this.lights.splice(index, 1);
    light.stamp.destroy();
  }

  /** Zona de oscuridad añadida: el interior de un edificio abandonado. */
  addShade(maskKey: string, x: number, y: number, alpha: number): void {
    const stamp = this.scene.make.image({ key: maskKey, add: false }).setTint(SHADE_COLOR).setAlpha(alpha);
    this.shades.push({ stamp, x, y });
  }

  /** Brillo aditivo visible (halo de una bombilla, resplandor del fuego). */
  addGlow(maskKey: string, x: number, y: number, color: number, alpha: number): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x, y, maskKey)
      .setTint(color)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(GLOW_DEPTH);
  }

  get lightCount(): number {
    return this.lights.length;
  }

  update(timeMs: number): void {
    const camera = this.scene.cameras.main;
    const onScreen = (x: number): boolean => {
      const screenX = x - camera.scrollX;
      return screenX >= -CULL_MARGIN && screenX <= GAME_WIDTH + CULL_MARGIN;
    };
    this.target.clear();
    this.target.draw(this.ambient, 0, 0);
    for (const shade of this.shades) {
      if (!onScreen(shade.x)) continue;
      this.target.draw(shade.stamp, Math.round(shade.x - camera.scrollX), Math.round(shade.y - camera.scrollY));
    }
    for (const light of this.lights) {
      if (!light.enabled || !onScreen(light.x)) continue;
      const intensity = light.currentIntensity(timeMs);
      if (intensity <= 0) continue;
      light.stamp.setAlpha(intensity);
      this.target.erase(
        light.stamp,
        Math.round(light.x - camera.scrollX),
        Math.round(light.y - camera.scrollY),
      );
    }
  }
}
