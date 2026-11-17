import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';

type TextFactory = (x: number, y: number, content: string) => Phaser.GameObjects.BitmapText;

const SEGMENTS = 6;
const SEGMENT = { width: 6, height: 4, gap: 1 };

/**
 * Medidor de ruido: cuánto se oye a Alex ahora mismo. Gris si está en
 * silencio, amarillo al caminar, rojo al correr o disparar. Muestra
 * «SIGILO» mientras camina en silencio. Es la pista para esquivar al
 * Chasqueador: con el medidor vacío, no te oye.
 */
export class NoiseMeter {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly stealth: Phaser.GameObjects.BitmapText;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    text: TextFactory,
  ) {
    text(x, y, 'RUIDO').setTint(colorNumber('grey1'));
    this.bar = scene.add.graphics();
    this.stealth = text(x + 24 + SEGMENTS * (SEGMENT.width + SEGMENT.gap) + 3, y, 'SIGILO')
      .setTint(colorNumber('ui1'))
      .setVisible(false);
    this.show(0, false);
  }

  show(level: number, sneaking: boolean): void {
    const lit = Math.ceil(level * SEGMENTS);
    const g = this.bar.clear();
    const left = this.x + 24;
    for (let i = 0; i < SEGMENTS; i++) {
      const sx = left + i * (SEGMENT.width + SEGMENT.gap);
      const tone = i < lit ? (i < 2 ? 'yel2' : i < 4 ? 'org1' : 'blood1') : 'asph4';
      g.fillStyle(colorNumber('outline'), 1).fillRect(sx - 1, this.y - 1, SEGMENT.width + 2, SEGMENT.height + 2);
      g.fillStyle(colorNumber(tone), 1).fillRect(sx, this.y, SEGMENT.width, SEGMENT.height);
    }
    this.stealth.setVisible(sneaking);
  }
}
