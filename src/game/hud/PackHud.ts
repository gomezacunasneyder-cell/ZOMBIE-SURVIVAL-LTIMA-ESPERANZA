import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import type { GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY } from '../boot/registerArt';

type MakeText = (x: number, y: number, content: string, scale?: number) => Phaser.GameObjects.BitmapText;

interface Counter {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
}

/**
 * Mochila en el HUD: granadas y molotov junto a los botiquines, y las
 * piezas bajo el contador de bajas. Las piezas recogidas destellan un
 * momento con lo que se acaba de sumar.
 */
export class PackHud {
  private readonly counters = new Map<string, Counter>();
  private readonly scrapText: Phaser.GameObjects.BitmapText;
  private readonly scrapIcon: Phaser.GameObjects.Image;
  private readonly scrapGain: Phaser.GameObjects.BitmapText;
  private gainUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    left: number,
    top: number,
    right: number,
    scrapTop: number,
    text: MakeText,
  ) {
    [
      ['grenade', 'ui/grenade'],
      ['molotov', 'ui/molotov'],
    ].forEach(([id, frame], i) => {
      const x = left + i * 30;
      const icon = scene.add.image(x, top + 4, ATLAS_KEY, frame as string).setOrigin(0, 0.5);
      this.counters.set(id as string, { icon, text: text(x + icon.width + 2, top + 2, 'x0') });
    });
    this.scrapText = text(right, scrapTop, 'x0').setOrigin(1, 0).setTint(colorNumber('yel1'));
    this.scrapIcon = scene.add.image(right - 12, scrapTop + 2, ATLAS_KEY, 'ui/scrap').setOrigin(1, 0.5);
    this.scrapGain = text(right, scrapTop + 8, '').setOrigin(1, 0).setTint(colorNumber('ui1')).setVisible(false);
  }

  showThrowables(e: GameEvents['throwables']): void {
    for (const item of e.items) {
      const counter = this.counters.get(item.id);
      if (!counter) continue;
      counter.text.setText(`x${item.count}`).setTint(colorNumber(item.count === 0 ? 'asph2' : item.count === item.max ? 'ui1' : 'white'));
      counter.icon.setAlpha(item.count === 0 ? 0.4 : 1);
    }
  }

  showScrap(e: GameEvents['scrap']): void {
    this.scrapText.setText(`x${e.total}`);
    // El engranaje se aparta a medida que el número gana cifras.
    this.scrapIcon.setX(this.scrapText.x - this.scrapText.width - 2);
    if (e.gained <= 0) return;
    this.scrapGain.setText(`+${e.gained}`).setVisible(true);
    this.gainUntil = this.scene.time.now + 1200;
  }

  update(time: number): void {
    if (this.scrapGain.visible && time >= this.gainUntil) this.scrapGain.setVisible(false);
  }
}
