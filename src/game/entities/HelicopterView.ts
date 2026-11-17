import type Phaser from 'phaser';
import { HELI_TILT_PAD, heliTiltShift } from '../../art/painters/airdrop';
import { colorNumber } from '../../art/palette';
import { heliBodyFrame } from '../../art/supplyArt';
import type { Attitude } from '../../core/supply/airdrop';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import type { Light, LightingSystem } from '../systems/LightingSystem';

/** Ancho del fuselaje; los puntos se miden con el morro a la izquierda. */
const WIDTH = 86;
const SEARCHLIGHT = { x: 15, y: 25 };
const ROTOR = { x: 34, y: -1 };
const TAIL_ROTOR = { x: 79, y: 7 };
const TAIL_BEACON = { x: 82, y: 3 };
const NOSE_LIGHT = { x: 6, y: 16 };
/** Gancho de la carga, bajo el centro del fuselaje. */
const HOOK = { x: 30, y: 29 };
/** El foco barre el suelo de un lado a otro mientras está en estacionario. */
const SWEEP_PX = 26;

export interface HelicopterPose {
  /** Centro del fuselaje en el mundo. */
  x: number;
  y: number;
  /** Sentido del vuelo: 1 hacia la derecha (morro a la derecha). */
  facing: 1 | -1;
  attitude: Attitude;
  /** Cajas que aún lleva colgadas (0 = ninguna). */
  cargo: number;
  hovering: boolean;
}

/**
 * Helicóptero Cóndor 7: fuselaje que se inclina al acelerar y al frenar,
 * rotores animados, carga colgada, foco de búsqueda que ilumina la calle
 * (y barre el suelo en estacionario), baliza roja en la cola y luz verde
 * en el morro. Solo dibuja: el vuelo lo decide `AirdropFlight`.
 */
export class HelicopterView {
  private readonly body: Phaser.GameObjects.Image;
  private readonly rotor: Phaser.GameObjects.Sprite;
  private readonly tail: Phaser.GameObjects.Sprite;
  private readonly sling: Phaser.GameObjects.Image;
  private readonly beamGlow: Phaser.GameObjects.Image;
  private readonly beacon: Phaser.GameObjects.Image;
  private readonly noseLight: Phaser.GameObjects.Image;
  private readonly beamLight: Light;
  private readonly spotLight: Light;
  private readonly parts: Phaser.GameObjects.GameObject[];
  private shown = true;
  private worldX = -10_000;
  private hookPoint = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    lighting: LightingSystem,
    private readonly groundY: number,
    depth: number,
  ) {
    this.body = scene.add.image(0, 0, ATLAS_KEY, heliBodyFrame(0)).setOrigin(0, 0).setDepth(depth);
    this.rotor = scene.add.sprite(0, 0, ATLAS_KEY, 'heli/rotor/0').setDepth(depth + 0.1);
    this.tail = scene.add.sprite(0, 0, ATLAS_KEY, 'heli/tail/0').setDepth(depth + 0.1);
    this.sling = scene.add.image(0, 0, ATLAS_KEY, 'supply/sling/3').setOrigin(0.5, 0).setDepth(depth - 0.1);
    this.rotor.play('heli/rotor');
    this.tail.play('heli/tail');

    this.beamGlow = lighting.addGlow(MASK.searchlight, 0, 0, colorNumber('light1'), 0.22).setOrigin(0.5, 0);
    this.beamLight = lighting.addLight(MASK.searchlight, 0, 0, { originY: 0, intensity: 0.6 });
    this.spotLight = lighting.addLight(MASK.radialLarge, 0, groundY, { intensity: 0.95 });
    this.beacon = lighting.addGlow(MASK.radialTiny, 0, 0, colorNumber('blood1'), 0);
    this.noseLight = lighting.addGlow(MASK.radialTiny, 0, 0, colorNumber('ui1'), 0.2);
    this.parts = [this.body, this.rotor, this.tail, this.sling, this.beamGlow, this.beacon, this.noseLight];
    this.setVisible(false);
  }

  /** Centro del helicóptero en el mundo, para situar su sonido (muy lejos si no vuela). */
  get x(): number {
    return this.shown ? this.worldX : -10_000;
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Punto del que cuelga la carga: de ahí salen las cajas. */
  get hook(): { x: number; y: number } {
    return this.hookPoint;
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    for (const part of this.parts) (part as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    this.beamLight.enabled = visible;
    this.spotLight.enabled = visible;
  }

  update(timeMs: number, pose: HelicopterPose): void {
    if (!this.shown) return;
    this.worldX = pose.x;
    const flip = pose.facing === 1;
    // Un ligero cabeceo vertical, también en estacionario.
    const bob = Math.round(Math.sin(timeMs / 1000 * 2.2) * 1.5);
    const left = Math.round(pose.x - WIDTH / 2);
    const top = Math.round(pose.y) + bob - HELI_TILT_PAD;
    // Punto del dibujo (morro a la izquierda) → punto del mundo, con inclinación y volteo.
    const at = (p: { x: number; y: number }): { x: number; y: number } => {
      const px = flip ? WIDTH - 1 - p.x : p.x;
      return { x: left + px, y: top + HELI_TILT_PAD + p.y + heliTiltShift(p.x, pose.attitude) };
    };

    this.body.setFrame(heliBodyFrame(pose.attitude)).setFlipX(flip).setPosition(left, top);
    const rotor = at(ROTOR);
    this.rotor.setPosition(rotor.x, rotor.y);
    const tail = at(TAIL_ROTOR);
    this.tail.setPosition(tail.x, tail.y).setFlipX(flip);

    const hook = at(HOOK);
    this.hookPoint = { x: hook.x, y: hook.y + 4 };
    this.sling.setVisible(pose.cargo > 0);
    if (pose.cargo > 0) this.sling.setFrame(`supply/sling/${Math.min(3, pose.cargo)}`).setPosition(hook.x, hook.y);

    // Foco: bajo el morro; en estacionario barre el suelo buscando la zona de caída.
    const lamp = at(SEARCHLIGHT);
    const sweep = pose.hovering ? Math.round(Math.sin(timeMs / 1000 * 1.6) * SWEEP_PX) : 0;
    this.beamGlow.setPosition(lamp.x, lamp.y).setFlipX(sweep < 0);
    this.beamLight.x = lamp.x;
    this.beamLight.y = lamp.y;
    this.spotLight.x = lamp.x + sweep;
    this.spotLight.y = this.groundY;

    // Baliza anticolisión: un destello corto cada 1,2 s.
    const blink = timeMs % 1200 < 130;
    const beacon = at(TAIL_BEACON);
    this.beacon.setPosition(beacon.x, beacon.y).setAlpha(blink ? 0.9 : 0);
    const nose = at(NOSE_LIGHT);
    this.noseLight.setPosition(nose.x, nose.y);
  }
}
