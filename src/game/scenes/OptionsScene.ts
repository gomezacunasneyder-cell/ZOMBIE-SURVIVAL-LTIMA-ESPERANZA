import Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import type { AudioBus } from '../../core/settings/audioSettings';
import { audioState } from '../audio/audioState';
import { FONT_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { updateTestHook } from '../debug/testHook';
import { SCENE } from './keys';

const ROWS: { bus: AudioBus; label: string }[] = [
  { bus: 'music', label: 'MUSICA' },
  { bus: 'sfx', label: 'EFECTOS' },
];
type OptionAction = 'up' | 'down' | 'left' | 'right' | 'close';
/** Teclas de la pausa. A y D no se usan: siguen siendo las de movimiento. */
const KEY_ACTIONS: Readonly<Record<string, OptionAction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Escape: 'close',
  KeyP: 'close',
  Enter: 'close',
};
const PANEL = { width: 200, height: 96 };
const BAR = { width: 80, height: 7, segments: 10 };

/**
 * Pausa y ajustes de sonido. Se abre sobre el juego (que queda detenido)
 * y permite regular por separado el volumen de la música y el de los
 * efectos. Los cambios se oyen al momento y se guardan.
 */
export class OptionsScene extends Phaser.Scene {
  private selected = 0;
  private bars!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private values: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super(SCENE.options);
  }

  create(): void {
    this.selected = 0;
    this.labels = [];
    this.values = [];
    const x = (GAME_WIDTH - PANEL.width) / 2;
    const y = (GAME_HEIGHT - PANEL.height) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(colorNumber('outline'), 0.6).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    panel.fillStyle(colorNumber('outline'), 1).fillRect(x, y, PANEL.width, PANEL.height);
    panel.fillStyle(colorNumber('conc4'), 1).fillRect(x + 1, y + 1, PANEL.width - 2, PANEL.height - 2);
    panel.fillStyle(colorNumber('shadow'), 1).fillRect(x + 2, y + 2, PANEL.width - 4, PANEL.height - 4);

    this.add.bitmapText(GAME_WIDTH / 2, y + 9, FONT_KEY, 'PAUSA').setScale(2).setOrigin(0.5, 0);
    ROWS.forEach((row, i) => {
      this.labels.push(this.add.bitmapText(x + 18, y + 34 + i * 18, FONT_KEY, row.label));
      this.values.push(this.add.bitmapText(x + PANEL.width - 14, y + 34 + i * 18, FONT_KEY, '').setOrigin(1, 0));
    });
    this.bars = this.add.graphics();
    this.add
      .bitmapText(GAME_WIDTH / 2, y + PANEL.height - 22, FONT_KEY, 'ARRIBA/ABAJO: ELEGIR   IZQ/DER: VOLUMEN')
      .setOrigin(0.5, 0)
      .setTint(colorNumber('grey1'));
    this.add
      .bitmapText(GAME_WIDTH / 2, y + PANEL.height - 12, FONT_KEY, 'ESC O P: VOLVER AL JUEGO')
      .setOrigin(0.5, 0)
      .setTint(colorNumber('light2'));

    // Se escuchan los eventos de teclado del navegador: cada pulsación es
    // exactamente una acción, sin depender del procesado por fotogramas
    // del teclado de Phaser en una escena superpuesta a otra en pausa.
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault();
      if (action === 'close') this.close();
      else if (action === 'up') this.move(-1);
      else if (action === 'down') this.move(1);
      else this.change(action === 'right' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    this.draw();
    updateTestHook({ optionsOpen: true });
  }

  private move(direction: 1 | -1): void {
    this.selected = (this.selected + direction + ROWS.length) % ROWS.length;
    this.draw();
  }

  private change(direction: 1 | -1): void {
    const row = ROWS[this.selected] as (typeof ROWS)[number];
    audioState.step(row.bus, direction);
    // Un efecto de muestra permite oír el nuevo volumen de efectos.
    if (row.bus === 'sfx') playSfx(this, SFX.pickup, 0.5, 0);
    this.draw();
  }

  private draw(): void {
    const x = (GAME_WIDTH - PANEL.width) / 2 + 66;
    const y = (GAME_HEIGHT - PANEL.height) / 2 + 33;
    const g = this.bars.clear();
    const cell = BAR.width / BAR.segments;
    ROWS.forEach((row, i) => {
      const active = i === this.selected;
      const value = audioState.settings[row.bus];
      const top = y + i * 18;
      this.labels[i]?.setTint(colorNumber(active ? 'light2' : 'grey2'));
      this.values[i]?.setText(`${Math.round(value * 100)}`).setTint(colorNumber(active ? 'light2' : 'grey2'));
      g.fillStyle(colorNumber('outline'), 1).fillRect(x - 1, top - 1, BAR.width + 1, BAR.height + 2);
      for (let s = 0; s < BAR.segments; s++) {
        const filled = s < Math.round(value * BAR.segments);
        g.fillStyle(colorNumber(filled ? (active ? 'ui1' : 'ui2') : 'asph4'), 1).fillRect(x + s * cell, top, cell - 1, BAR.height);
      }
    });
  }

  private close(): void {
    updateTestHook({ optionsOpen: false });
    this.scene.stop();
    this.scene.resume(SCENE.game);
  }
}
