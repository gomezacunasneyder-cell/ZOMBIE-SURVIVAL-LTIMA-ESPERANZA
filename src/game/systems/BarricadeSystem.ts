import type Phaser from 'phaser';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { BarricadeHandle } from '../world/LevelBuilder';
import type { FxSystem } from './FxSystem';

/**
 * Golpes que cuentan como mucho: aunque una horda se amontone delante,
 * solo unos pocos caben para golpear a la vez.
 */
const MIN_HIT_GAP_MS = 350;

/**
 * Barricadas que el mutante derriba: cada golpe las hace temblar y soltar
 * astillas; al tercero se parten, desaparece su colisión y queda el paso libre.
 */
export class BarricadeSystem {
  private brokenCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: FxSystem,
    readonly barricades: BarricadeHandle[],
  ) {}

  get broken(): number {
    return this.brokenCount;
  }

  /** Golpe a una barricada. Devuelve `true` si la rompe. */
  hit(barricade: BarricadeHandle, now: number): boolean {
    if (barricade.broken || now - barricade.lastHitAt < MIN_HIT_GAP_MS) return false;
    barricade.lastHitAt = now;
    barricade.hits += 1;
    this.fx.debris(barricade.x, barricade.y, 6);
    if (barricade.stages.length > 0) {
      // Se va deteriorando a la vista a medida que encaja golpes.
      const stage = Math.min(barricade.stages.length - 1, Math.floor((barricade.hits / barricade.maxHits) * barricade.stages.length));
      barricade.sprite.setFrame(barricade.stages[stage] as string);
    }
    if (barricade.hits < barricade.maxHits) {
      this.scene.tweens.add({ targets: barricade.sprite, x: barricade.x + 1, duration: 40, yoyo: true, repeat: 2 });
      playSfxAt(this.scene, SFX.slam, barricade.x, barricade.maxHits > 10 ? 0.3 : 0.45);
      return false;
    }
    barricade.broken = true;
    this.brokenCount += 1;
    const body = barricade.zone.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;
    this.fx.debris(barricade.x, barricade.y, 16);
    playSfxAt(this.scene, SFX.barricadeBreak, barricade.x, 0.6);
    this.scene.tweens.add({
      targets: [barricade.sprite, barricade.shadow],
      alpha: 0,
      y: '+=3',
      duration: 260,
      onComplete: () => {
        barricade.sprite.setVisible(false);
        barricade.shadow.setVisible(false);
      },
    });
    return true;
  }
}
