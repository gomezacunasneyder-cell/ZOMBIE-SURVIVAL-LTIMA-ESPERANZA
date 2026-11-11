import type Phaser from 'phaser';
import type { Ambience } from '../../core/world/dayCycle';
import { mixColor } from '../../core/world/dayCycle';
import { windSpeed } from '../../core/world/wind';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { DEPTH } from './depths';

interface ParallaxLayer {
  sprite: Phaser.GameObjects.TileSprite;
  /** 0 = inmóvil (cielo), 1 = se mueve con el mundo. */
  factor: number;
  /** Deriva propia acumulada (nubes y niebla que arrastra el viento). */
  drift: number;
  driftScale: number;
}

/**
 * Fondo por capas con paralaje. Nueve planos de profundidad: cielo,
 * nubes, tres filas de ciudad con sus ventanas, muro, calzada, niebla y
 * primer plano. Cada capa es una textura repetible fija a la pantalla
 * cuyo desplazamiento interno sigue a la cámara según su factor.
 */
export class Backdrop {
  private readonly layers: ParallaxLayer[] = [];
  private readonly nightSky: Phaser.GameObjects.Image;
  private readonly cityLayers: { sprite: Phaser.GameObjects.TileSprite; haze: number }[] = [];
  private readonly lightLayers: Phaser.GameObjects.TileSprite[] = [];
  private readonly fogLayers: Phaser.GameObjects.TileSprite[] = [];
  private clouds!: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene, wallTop: number, groundTop: number) {
    scene.add.image(0, 0, 'layer/sky').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky);
    this.nightSky = scene.add
      .image(0, 0, 'layer/sky-night')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.sky + 0.1)
      .setAlpha(0);

    const add = (
      key: string,
      y: number,
      height: number,
      depth: number,
      factor: number,
      driftScale = 0,
    ): Phaser.GameObjects.TileSprite => {
      const sprite = scene.add
        .tileSprite(0, y, GAME_WIDTH, height, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth);
      this.layers.push({ sprite, factor, drift: 0, driftScale });
      return sprite;
    };

    this.clouds = add('layer/clouds', 4, 70, DEPTH.clouds, 0.04, 0.12);

    // Ciudad en tres profundidades; cuanto más lejos, más velada por la bruma.
    this.cityLayers.push({ sprite: add('layer/city-far', 34, 80, DEPTH.cityFar, 0.1), haze: 0.35 });
    this.cityLayers.push({ sprite: add('layer/city-mid', 6, 112, DEPTH.cityMid, 0.28), haze: 0.15 });
    this.lightLayers.push(add('layer/city-mid-lights', 6, 112, DEPTH.cityMid + 0.1, 0.28));
    this.cityLayers.push({ sprite: add('layer/city-near', -6, 124, DEPTH.cityNear, 0.55), haze: 0 });
    this.lightLayers.push(add('layer/city-near-lights', -6, 124, DEPTH.cityNear + 0.1, 0.55));

    add('layer/wall', wallTop, 78, DEPTH.wall, 1);
    add('layer/ground', groundTop, 100, DEPTH.ground, 1);

    // Niebla: una banda tras los personajes y otra, más tenue, por delante.
    this.fogLayers.push(add('layer/fog', 150, 48, DEPTH.fogBack, 0.9, 0.5));
    this.fogLayers.push(add('layer/fog', 212, 48, DEPTH.fogFront, 1.12, 0.8).setFlipX(true));
    add('layer/foreground', GAME_HEIGHT - 38, 40, DEPTH.foreground, 1.25);

    for (const light of this.lightLayers) light.setAlpha(0);
  }

  /** Alinea las capas con la cámara y deja que el viento arrastre nubes y niebla. */
  sync(scrollX: number, timeMs: number, deltaMs: number): void {
    const wind = windSpeed(timeMs);
    for (const layer of this.layers) {
      if (layer.driftScale !== 0) layer.drift -= (wind * layer.driftScale * deltaMs) / 1000;
      layer.sprite.tilePositionX = Math.round(scrollX * layer.factor + layer.drift);
    }
  }

  /** Aplica el momento del día: cielo, tinte de la ciudad, ventanas y niebla. */
  applyAmbience(ambience: Ambience): void {
    this.nightSky.setAlpha(ambience.nightSkyAlpha);
    for (const { sprite, haze } of this.cityLayers) {
      // Las capas lejanas se oscurecen menos: la bruma las aclara.
      sprite.setTint(mixColor(ambience.cityTint, 0xffffff, haze * (1 - ambience.night * 0.5)));
    }
    this.clouds.setTint(mixColor(0xffffff, 0x4a5078, ambience.night));
    for (const light of this.lightLayers) light.setAlpha(ambience.cityLightsAlpha);
    this.fogLayers.forEach((fog, i) => fog.setAlpha(ambience.fogAlpha * (i === 0 ? 1 : 0.55)));
  }
}
