import Phaser from 'phaser';
import { ATLAS_KEY } from '../boot/registerArt';
import { DEPTH } from '../world/depths';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Máximo de manchas de sangre que deja el combate; las más antiguas se retiran. */
const MAX_DECALS = 24;
/** Destellos de impacto simultáneos; se reutilizan en rueda. */
const MAX_IMPACTS = 10;

/**
 * Efectos de impacto: sangre, chispas, polvo y casquillos. Son partículas
 * de un píxel con gravedad, emitidas a ráfagas desde emisores fijos.
 */
export class FxSystem {
  private readonly blood: Emitter;
  private readonly sparks: Emitter;
  private readonly dust: Emitter;
  private readonly casingsLeft: Emitter;
  private readonly casingsRight: Emitter;
  private readonly shellsLeft: Emitter;
  private readonly shellsRight: Emitter;
  private readonly impacts: Phaser.GameObjects.Sprite[] = [];
  private impactCount = 0;
  /** Contadores para las pruebas. */
  readonly counts = { hard: 0, flesh: 0 };
  private readonly decals: Phaser.GameObjects.Image[] = [];
  private decalCount = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const make = (frame: string | string[], config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Emitter =>
      scene.add.particles(0, 0, ATLAS_KEY, { frame, emitting: false, ...config }).setDepth(DEPTH.fx);

    this.blood = make(['fx/blood', 'fx/blood', 'fx/blood-dark'], {
      lifespan: { min: 260, max: 520 },
      speed: { min: 30, max: 110 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
    });
    this.sparks = make(['fx/spark', 'fx/ember'], {
      lifespan: { min: 120, max: 300 },
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      gravityY: 300,
    });
    this.dust = make('fx/dust', {
      lifespan: { min: 180, max: 380 },
      speed: { min: 8, max: 34 },
      angle: { min: 180, max: 360 },
      gravityY: -20,
      alpha: { start: 0.8, end: 0 },
    });
    const casing = { lifespan: 520, speed: { min: 55, max: 90 }, gravityY: 520 };
    // El casquillo salta hacia atrás respecto a donde apunta el arma.
    this.casingsLeft = make('fx/casing', { ...casing, angle: { min: 215, max: 250 } });
    this.casingsRight = make('fx/casing', { ...casing, angle: { min: 290, max: 325 } });
    const shell = { lifespan: 700, speed: { min: 45, max: 75 }, gravityY: 480, rotate: 0 };
    this.shellsLeft = make('fx/shell', { ...shell, angle: { min: 225, max: 255 } });
    this.shellsRight = make('fx/shell', { ...shell, angle: { min: 285, max: 315 } });

    for (let i = 0; i < MAX_IMPACTS; i++) {
      const sprite = scene.add.sprite(0, 0, ATLAS_KEY, 'fx/impact/0').setDepth(DEPTH.fx).setVisible(false);
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setVisible(false));
      this.impacts.push(sprite);
    }
  }

  /** Bala contra algo duro: destello en estrella, chispas y polvo. */
  hardImpact(x: number, y: number): void {
    this.counts.hard += 1;
    const sprite = this.impacts[this.impactCount % MAX_IMPACTS] as Phaser.GameObjects.Sprite;
    this.impactCount += 1;
    sprite.setPosition(Math.round(x), Math.round(y)).setVisible(true).play('fx/impact');
    this.sparks.explode(5, x, y);
    this.dust.explode(3, x, y);
  }

  /** Bala contra un zombi: salpicadura proporcional al daño. */
  fleshImpact(x: number, y: number, damage: number): void {
    this.counts.flesh += 1;
    this.blood.explode(Math.max(3, Math.min(10, Math.round(damage / 4))), x, y);
  }

  bloodBurst(x: number, y: number, count = 9): void {
    this.blood.explode(count, x, y);
  }

  sparkBurst(x: number, y: number): void {
    this.sparks.explode(7, x, y);
  }

  dustPuff(x: number, y: number): void {
    this.dust.explode(5, x, y);
  }

  casing(x: number, y: number, facing: 1 | -1, kind: 'casing' | 'shell' = 'casing'): void {
    const emitters = kind === 'shell' ? [this.shellsLeft, this.shellsRight] : [this.casingsLeft, this.casingsRight];
    (facing === 1 ? emitters[0] : emitters[1])?.explode(1, x, y);
  }

  /** Deja una mancha permanente en el asfalto, con un tope total. */
  bloodDecal(x: number, y: number): void {
    const frame = `decal/blood/${this.decalCount % 3}`;
    this.decalCount += 1;
    const decal = this.scene.add.image(Math.round(x), Math.round(y), ATLAS_KEY, frame).setDepth(DEPTH.decal);
    this.decals.push(decal);
    if (this.decals.length > MAX_DECALS) this.decals.shift()?.destroy();
  }
}
