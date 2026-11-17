import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { RADIO } from '../../content/supplies';
import type { GameEvents } from '../../core/events/EventBus';
import { GAME_WIDTH } from '../config';

type TextFactory = (x: number, y: number, content: string, scale?: number) => Phaser.GameObjects.BitmapText;

const BANNER_Y = 44;
const RADIO_Y = 64;
const BANNER_MS = 4200;
const RADIO_MS = 4200;

/**
 * Parte del HUD del lanzamiento de suministros: el aviso parpadeante
 * «¡SUMINISTROS DETECTADOS!» con franjas de alerta, los mensajes de radio
 * de Cóndor 7. Lo que sale de cada caja se muestra sobre la propia caja.
 */
export class AirdropHud {
  private readonly banner: Phaser.GameObjects.BitmapText;
  private readonly stripes: Phaser.GameObjects.Graphics;
  private readonly radioTag: Phaser.GameObjects.BitmapText;
  private readonly radio: Phaser.GameObjects.BitmapText;
  private bannerUntil = 0;
  private radioUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    text: TextFactory,
  ) {
    this.stripes = scene.add.graphics().setVisible(false);
    this.banner = text(GAME_WIDTH / 2, BANNER_Y, RADIO.warning, 2).setOrigin(0.5, 0).setVisible(false);
    this.radioTag = text(0, RADIO_Y, 'RADIO').setOrigin(0, 0).setTint(colorNumber('ui1')).setVisible(false);
    this.radio = text(0, RADIO_Y, '').setOrigin(0, 0).setVisible(false);
  }

  onAirdrop(event: GameEvents['airdrop']): void {
    const now = this.scene.time.now;
    if (event.phase === 'warning') {
      this.bannerUntil = now + BANNER_MS;
      this.banner.setVisible(true);
      this.stripes.setVisible(true);
    }
    if (event.radio) this.showRadio(event.radio, now);
  }

  private showRadio(message: string, now: number): void {
    this.radio.setText(message);
    const tagWidth = 24;
    const left = Math.round(GAME_WIDTH / 2 - (this.radio.width + tagWidth) / 2);
    this.radioTag.setPosition(left, RADIO_Y).setVisible(true);
    this.radio.setPosition(left + tagWidth, RADIO_Y).setVisible(true);
    this.radioUntil = now + RADIO_MS;
  }

  update(time: number): void {
    if (this.banner.visible) {
      if (time >= this.bannerUntil) {
        this.banner.setVisible(false);
        this.stripes.setVisible(false);
      } else {
        // Parpadeo de alarma: blanco cálido y rojo.
        const on = Math.floor(time / 260) % 2 === 0;
        this.banner.setTint(colorNumber(on ? 'light2' : 'blood1'));
        this.drawStripes(time);
      }
    }
    if (this.radio.visible && time >= this.radioUntil) {
      this.radio.setVisible(false);
      this.radioTag.setVisible(false);
    }
  }

  /** Franjas de aviso amarillas y negras que se desplazan bajo el cartel. */
  private drawStripes(time: number): void {
    const g = this.stripes.clear();
    const top = BANNER_Y - 5;
    const height = 20;
    const offset = Math.floor(time / 60) % 8;
    g.fillStyle(colorNumber('outline'), 0.85).fillRect(0, top, GAME_WIDTH, height);
    g.fillStyle(colorNumber('yel2'), 1);
    for (let x = -8 + offset; x < GAME_WIDTH; x += 8) {
      g.fillRect(x, top, 4, 2);
      g.fillRect(x + 2, top + height - 2, 4, 2);
    }
  }
}
