import Phaser from 'phaser';
import { devourerKey, type DevourerLook } from '../../art/devourerArt';
import { DEVOURER_FRAME_HEIGHT, DEVOURER_GROUND } from '../../art/painters/devourer';
import { colorNumber } from '../../art/palette';
import type { DevourerBrain } from '../../core/boss/DevourerBrain';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import type { Light, LightingSystem } from '../systems/LightingSystem';
import { DEPTH } from '../world/depths';

/** Caja de colisión: el tronco, sin los brazos ni las espinas. */
const BODY = { width: 34, height: 62 };
/** Filas del lienzo por debajo de las suelas. */
const BELOW_FEET = DEVOURER_FRAME_HEIGHT - 1 - DEVOURER_GROUND;
const HIT_FLASH_MS = 70;

/** Lo que muestra la escena cuando el cerebro aún no manda (presentación y final). */
export type DevourerOverride = 'walk' | 'roar' | 'idle' | null;

/**
 * EL DEVORADOR en el mundo: sprite con su cuerpo de Arcade (solo para que
 * le alcancen las balas), sombra, ojos que brillan y una luz tenue que lo
 * recorta en la oscuridad. El cerebro decide; esta clase elige el dibujo
 * según el estado y el tramo del ataque, y lo mueve.
 */
export class Devourer {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly aura: Light;
  private readonly eyes: Phaser.GameObjects.Image;
  private flashUntil = 0;
  private shownKey = '';
  override: DevourerOverride = null;
  /** Arde (lanzallamas, molotov) hasta este instante. */
  burningUntil = 0;
  /** La escena indica si se ha movido en este fotograma. */
  moving = false;
  /** 0–1: oscurecido (surge del humo). */
  private dark = 0;
  private readonly flame: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    private readonly lighting: LightingSystem,
    x: number,
    private readonly groundY: number,
  ) {
    this.shadow = scene.add.image(x, groundY + 1, ATLAS_KEY, 'fx/ground-shadow/62').setAlpha(0.55).setDepth(DEPTH.zombie - 0.5);
    this.sprite = scene.physics.add
      .sprite(x, groundY + 1 + BELOW_FEET, ATLAS_KEY, `${devourerKey('normal', 'idle')}/0`)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.zombie - 0.3);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    body.setSize(BODY.width, BODY.height).setOffset(34, DEVOURER_FRAME_HEIGHT - 1 - BELOW_FEET - BODY.height);
    this.aura = lighting.addLight(MASK.radialLarge, x, groundY - 40, { intensity: 0.45, flicker: 0.1 });
    this.eyes = lighting.addGlow(MASK.radialTiny, x, groundY - 60, colorNumber('blood1'), 0.45);
    this.flame = scene.add.sprite(x, groundY, ATLAS_KEY, 'fx/fire/0').setOrigin(0.5, 1).setVisible(false).setDepth(DEPTH.zombie);
  }

  get x(): number {
    return this.sprite.x;
  }

  /** Centro del tronco, para medir distancias a las explosiones. */
  get centerY(): number {
    return this.groundY - 34;
  }

  /** Altura de la boca, de donde sale la bilis. */
  mouth(facing: 1 | -1): { x: number; y: number } {
    return { x: this.sprite.x + facing * 30, y: this.groundY - 54 };
  }

  setX(x: number): void {
    this.sprite.setX(Math.round(x));
    (this.sprite.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
  }

  /** Destello breve al recibir un impacto (sin volverlo blanco: se tiñe). */
  flash(now: number): void {
    this.flashUntil = now + HIT_FLASH_MS;
  }

  /** Visible y opaco (la presentación lo hace surgir del humo). */
  setShade(alpha: number, dark: number): void {
    this.sprite.setAlpha(alpha);
    this.dark = dark;
  }

  /** Elige el dibujo según lo que hace el cerebro, y coloca sombra, luces y llamas. */
  update(now: number, brain: DevourerBrain | null): void {
    const look: DevourerLook = brain && brain.phase > 1 ? 'enraged' : 'normal';
    const facing = brain?.facing ?? -1;
    this.sprite.setFlipX(facing === -1);
    this.show(look, brain, now);

    if (this.dark > 0) {
      const k = Math.round(255 * (1 - this.dark));
      this.sprite.setTint(Phaser.Display.Color.GetColor(k, k, k));
    } else if (now < this.flashUntil) this.sprite.setTint(colorNumber('light1'));
    else if (now < this.burningUntil) this.sprite.setTint(colorNumber('org1'));
    else if (this.sprite.isTinted) this.sprite.clearTint();

    const x = this.sprite.x;
    this.shadow.setPosition(x, this.groundY + 1).setVisible(this.sprite.visible && this.sprite.alpha > 0.3);
    this.aura.x = x;
    this.aura.y = this.groundY - 40;
    const alive = !brain || brain.alive;
    this.eyes.setPosition(x + facing * 28, this.groundY - 58).setVisible(alive && this.sprite.alpha > 0.3);
    this.eyes.setAlpha(0.35 + Math.sin(now / 160) * 0.1);
    const burning = now < this.burningUntil && alive;
    this.flame.setVisible(burning).setPosition(x - facing * 6, this.groundY - 30);
    if (burning && !this.flame.anims.isPlaying) this.flame.play('fx/fire');
  }

  private show(look: DevourerLook, brain: DevourerBrain | null, now: number): void {
    if (this.override || !brain) {
      this.play(look, this.override ?? 'idle');
      return;
    }
    const step = brain.step;
    switch (brain.state) {
      case 'emerging':
      case 'enrage':
        this.play(look, 'roar');
        break;
      case 'stalk':
        this.play(look, this.moving ? 'walk' : 'idle');
        break;
      case 'flinch':
        this.still(look, 'hurt', 0);
        break;
      case 'slam':
        this.still(look, 'slam', step === 'windup' ? (now % 400 < 200 ? 0 : 1) : step === 'active' ? 2 : 3);
        break;
      case 'smash':
        this.still(look, 'slam', step === 'windup' ? 1 : step === 'active' ? 2 : 3);
        break;
      case 'charge':
        this.still(look, 'charge', step === 'windup' ? (now % 160 < 80 ? 0 : 1) : step === 'active' ? 2 : 3);
        break;
      case 'spit':
        this.still(look, 'spit', step === 'windup' ? 0 : step === 'active' ? 1 : 2);
        break;
      case 'summon':
        if (step === 'recover') this.play(look, 'idle');
        else this.play(look, 'roar');
        break;
      case 'eruption':
        // Golpea el suelo una y otra vez mientras brotan las espinas.
        this.still(look, 'slam', Math.floor(now / 260) % 2 === 0 ? 1 : 2);
        break;
      case 'exhausted':
        this.play(look, 'kneel');
        break;
      case 'dying':
      case 'dead':
        this.play(look, 'die');
        break;
    }
  }

  private play(look: DevourerLook, action: string): void {
    const key = devourerKey(look, action);
    if (this.shownKey === key) return;
    this.shownKey = key;
    this.sprite.anims.play(key);
  }

  private still(look: DevourerLook, action: string, frame: number): void {
    const key = `${devourerKey(look, action)}/${frame}`;
    if (this.shownKey === key) return;
    this.shownKey = key;
    this.sprite.anims.stop();
    this.sprite.setFrame(key);
  }

  destroy(): void {
    this.lighting.removeLight(this.aura);
    this.eyes.destroy();
    this.shadow.destroy();
    this.flame.destroy();
    this.sprite.destroy();
  }
}
