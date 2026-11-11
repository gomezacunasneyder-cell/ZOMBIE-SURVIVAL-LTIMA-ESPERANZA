import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import type { Light, LightingSystem } from '../systems/LightingSystem';

/** Puntos dentro del sprite del fuselaje (morro a la izquierda). */
const SEARCHLIGHT = { x: 15, y: 25 };
const ROTOR = { x: 34, y: -1 };
const TAIL_ROTOR = { x: 79, y: 7 };
const TAIL_BEACON = { x: 82, y: 3 };
const NOSE_LIGHT = { x: 6, y: 16 };
/** Amplitud de la patrulla: el foco barre la calle de un lado a otro. */
const PATROL = 70;

/**
 * Helicóptero Cóndor 7 patrullando: fuselaje, rotores animados, foco de
 * búsqueda que barre el suelo, baliza roja intermitente en la cola y luz
 * verde de posición en el morro.
 */
export class HelicopterView {
  private readonly body: Phaser.GameObjects.Image;
  private readonly rotor: Phaser.GameObjects.Sprite;
  private readonly tail: Phaser.GameObjects.Sprite;
  private readonly beamGlow: Phaser.GameObjects.Image;
  private readonly beacon: Phaser.GameObjects.Image;
  private readonly noseLight: Phaser.GameObjects.Image;
  private readonly beamLight: Light;
  private readonly spotLight: Light;
  private currentX: number;

  constructor(
    scene: Phaser.Scene,
    lighting: LightingSystem,
    private readonly homeX: number,
    private readonly homeY: number,
    private readonly groundY: number,
    depth: number,
  ) {
    this.currentX = homeX;
    this.body = scene.add.image(homeX, homeY, ATLAS_KEY, 'heli/body').setOrigin(0, 0).setDepth(depth);
    this.rotor = scene.add.sprite(homeX, homeY, ATLAS_KEY, 'heli/rotor/0').setDepth(depth + 0.1);
    this.tail = scene.add.sprite(homeX, homeY, ATLAS_KEY, 'heli/tail/0').setDepth(depth + 0.1);
    this.rotor.play('heli/rotor');
    this.tail.play('heli/tail');

    this.beamGlow = lighting
      .addGlow(MASK.searchlight, homeX, homeY, colorNumber('light1'), 0.22)
      .setOrigin(0.5, 0);
    this.beamLight = lighting.addLight(MASK.searchlight, homeX, homeY, { originY: 0, intensity: 0.55 });
    this.spotLight = lighting.addLight(MASK.radialMedium, homeX, groundY, { intensity: 0.9 });
    this.beacon = lighting.addGlow(MASK.radialTiny, homeX, homeY, colorNumber('blood1'), 0);
    this.noseLight = lighting.addGlow(MASK.radialTiny, homeX, homeY, colorNumber('ui1'), 0.2);
  }

  /** Centro del helicóptero en el mundo, para situar su sonido. */
  get x(): number {
    return this.currentX + 40;
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const x = Math.round(this.homeX + Math.sin(t * 0.22) * PATROL);
    const y = Math.round(this.homeY + Math.sin(t * 1.1) * 2);
    this.currentX = x;

    this.body.setPosition(x, y);
    this.rotor.setPosition(x + ROTOR.x, y + ROTOR.y);
    this.tail.setPosition(x + TAIL_ROTOR.x, y + TAIL_ROTOR.y);

    const lampX = x + SEARCHLIGHT.x;
    const lampY = y + SEARCHLIGHT.y;
    this.beamGlow.setPosition(lampX, lampY);
    this.beamLight.x = lampX;
    this.beamLight.y = lampY;
    this.spotLight.x = lampX;
    this.spotLight.y = this.groundY;

    // Baliza anticolisión: un destello corto cada 1,2 s.
    const blink = timeMs % 1200 < 130;
    this.beacon.setPosition(x + TAIL_BEACON.x, y + TAIL_BEACON.y).setAlpha(blink ? 0.9 : 0);
    this.noseLight.setPosition(x + NOSE_LIGHT.x, y + NOSE_LIGHT.y);
  }
}
