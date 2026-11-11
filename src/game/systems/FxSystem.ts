import type Phaser from 'phaser';
import { ATLAS_KEY } from '../boot/registerArt';
import { DEPTH } from '../world/depths';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Máximo de manchas de sangre que deja el combate; las más antiguas se retiran. */
const MAX_DECALS = 24;

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

  casing(x: number, y: number, facing: 1 | -1): void {
    (facing === 1 ? this.casingsLeft : this.casingsRight).explode(1, x, y);
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
