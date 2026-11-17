import type Phaser from 'phaser';
import { colorNumber, type ColorName } from '../../art/palette';
import type { GameEvents } from '../../core/events/EventBus';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

type TextFactory = (x: number, y: number, content: string, scale?: number) => Phaser.GameObjects.BitmapText;
type Tone = GameEvents['announce']['tone'];

const CENTRE = GAME_WIDTH / 2;
const PANEL_Y = 4;
const BAR = { width: 110, height: 4, y: PANEL_Y + 8 };
const BARRICADE_BAR = { width: 34, height: 3, y: PANEL_Y + 23 };
const ANNOUNCE_Y = 68;
const TONE_COLOR: Record<Tone, ColorName> = { info: 'light2', danger: 'blood1', success: 'ui1', boss: 'blood1' };

/**
 * HUD del modo supervivencia, arriba en el centro:
 *
 *              OLEADA 3/5     ENEMIGOS 12
 *          [█████████████░░░░░░░░░░░░░░░]
 *          IZQ [██████]      [████░░] DER
 *
 * Avisos grandes en mitad de la pantalla (oleada nueva, alarma, oleada
 * superada, el jefe), marco rojo que late con el peligro y pantalla final.
 */
export class WaveHud {
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly enemies: Phaser.GameObjects.BitmapText;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.BitmapText[];
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly bigTitle: Phaser.GameObjects.BitmapText;
  private readonly subtitle: Phaser.GameObjects.BitmapText;
  private announceUntil = 0;
  private announceTone: Tone = 'info';
  private danger = 0;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly text: TextFactory,
  ) {
    this.frame = scene.add.graphics();
    this.bars = scene.add.graphics();
    this.title = text(CENTRE - 4, PANEL_Y, '').setOrigin(1, 0).setVisible(false);
    this.enemies = text(CENTRE + 4, PANEL_Y, '').setOrigin(0, 0).setTint(colorNumber('grey1')).setVisible(false);
    this.labels = [
      text(CENTRE - BAR.width / 2, BARRICADE_BAR.y - 2, 'IZQ').setVisible(false),
      text(CENTRE + BAR.width / 2, BARRICADE_BAR.y - 2, 'DER').setOrigin(1, 0).setVisible(false),
    ];
    this.bigTitle = text(CENTRE, ANNOUNCE_Y, '', 3).setOrigin(0.5, 0).setVisible(false);
    this.subtitle = text(CENTRE, ANNOUNCE_Y + 21, '').setOrigin(0.5, 0).setVisible(false);
  }

  onWave(state: GameEvents['wave']): void {
    if (!this.shown) {
      this.shown = true;
      for (const part of [this.title, this.enemies, ...this.labels]) part.setVisible(true);
    }
    const resting = state.phase === 'rest' || state.phase === 'intro' || state.phase === 'alarm';
    const seconds = Math.ceil(state.timeLeft / 1000);
    this.title.setText(state.wave === state.waves ? 'HORDA FINAL' : `OLEADA ${state.wave}/${state.waves}`);
    if (state.phase === 'rest') this.enemies.setText(`DESCANSO ${seconds}`).setTint(colorNumber('ui1'));
    else if (state.phase === 'alarm') this.enemies.setText(`LLEGAN EN ${seconds}`).setTint(colorNumber('blood1'));
    else if (state.phase === 'intro') this.enemies.setText(`PREPARATE ${seconds}`).setTint(colorNumber('light2'));
    else if (state.phase === 'boss' || state.phase === 'done') this.enemies.setText('...').setTint(colorNumber('blood1'));
    else this.enemies.setText(`ENEMIGOS ${state.remaining}`).setTint(colorNumber('grey1'));

    const g = this.bars.clear();
    const left = Math.round(CENTRE - BAR.width / 2);
    // Barra de progreso de la oleada; en el descanso, cuenta atrás.
    const fill = resting ? 1 - Math.min(1, state.timeLeft / 15000) : state.progress;
    g.fillStyle(colorNumber('outline'), 1).fillRect(left - 1, BAR.y - 1, BAR.width + 2, BAR.height + 2);
    g.fillStyle(colorNumber('asph4'), 1).fillRect(left, BAR.y, BAR.width, BAR.height);
    g.fillStyle(colorNumber(resting ? 'ui2' : 'blood1'), 1).fillRect(left, BAR.y, Math.round(BAR.width * fill), BAR.height);
    g.fillStyle(colorNumber(resting ? 'ui1' : 'scarf1'), 1).fillRect(left, BAR.y, Math.round(BAR.width * fill), 1);
    // Integridad de cada barricada.
    state.barricades.slice(0, 2).forEach((integrity, i) => {
      const x = i === 0 ? left + 14 : left + BAR.width - 14 - BARRICADE_BAR.width;
      const tone: ColorName = integrity > 0.6 ? 'mil1' : integrity > 0.3 ? 'yel2' : 'blood1';
      g.fillStyle(colorNumber('outline'), 1).fillRect(x - 1, BARRICADE_BAR.y - 1, BARRICADE_BAR.width + 2, BARRICADE_BAR.height + 2);
      g.fillStyle(colorNumber('asph4'), 1).fillRect(x, BARRICADE_BAR.y, BARRICADE_BAR.width, BARRICADE_BAR.height);
      g.fillStyle(colorNumber(tone), 1).fillRect(x, BARRICADE_BAR.y, Math.round(BARRICADE_BAR.width * integrity), BARRICADE_BAR.height);
      this.labels[i]?.setTint(colorNumber(integrity === 0 ? 'blood1' : 'grey2'));
    });
  }

  onAnnounce(event: GameEvents['announce']): void {
    this.announceTone = event.tone;
    this.bigTitle.setText(event.title).setScale(event.tone === 'boss' ? 4 : 3).setVisible(true);
    this.subtitle.setText(event.subtitle).setY(ANNOUNCE_Y + (event.tone === 'boss' ? 26 : 21)).setVisible(true);
    this.subtitle.setTint(colorNumber(event.tone === 'boss' ? 'grey1' : 'white'));
    this.announceUntil = this.scene.time.now + (event.tone === 'boss' ? 4500 : 3000);
  }

  onDanger(level: number): void {
    this.danger = level;
  }

  /** Pantalla final del modo supervivencia. */
  showEnd(event: GameEvents['survivalEnd']): void {
    const veil = this.scene.add.graphics();
    veil.fillStyle(colorNumber('outline'), 0.75).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const minutes = Math.floor(event.timeMs / 60000);
    const seconds = String(Math.floor((event.timeMs % 60000) / 1000)).padStart(2, '0');
    this.text(CENTRE, 74, 'HAS SOBREVIVIDO', 3).setOrigin(0.5, 0).setTint(colorNumber('ui1'));
    this.text(CENTRE, 104, `OLEADAS ${event.waves}/${event.waves}   ZOMBIS ELIMINADOS ${event.kills}   TIEMPO ${minutes}:${seconds}`).setOrigin(0.5, 0);
    this.text(CENTRE, 124, 'PERO EL DEVORADOR YA ESTA AQUI. CONTINUARA...', 1).setOrigin(0.5, 0).setTint(colorNumber('blood1'));
    this.text(CENTRE, 150, 'PULSA R PARA JUGAR DE NUEVO').setOrigin(0.5, 0).setTint(colorNumber('light2'));
    this.bigTitle.setVisible(false);
    this.subtitle.setVisible(false);
    this.danger = 0;
  }

  update(time: number): void {
    if (this.bigTitle.visible) {
      if (time >= this.announceUntil) {
        this.bigTitle.setVisible(false);
        this.subtitle.setVisible(false);
      } else {
        const blink = this.announceTone === 'danger' && Math.floor(time / 220) % 2 === 1;
        this.bigTitle.setTint(colorNumber(blink ? 'light2' : TONE_COLOR[this.announceTone]));
      }
    }
    this.drawDangerFrame(time);
  }

  /** Marco rojo en los bordes de la pantalla que late con el peligro. */
  private drawDangerFrame(time: number): void {
    const g = this.frame.clear();
    if (this.danger <= 0) return;
    const beat = 0.5 + 0.5 * Math.sin(time / 160);
    const thickness = 2 + Math.round(this.danger * 3);
    g.fillStyle(colorNumber('blood1'), 0.25 + 0.45 * this.danger * beat);
    g.fillRect(0, 0, GAME_WIDTH, thickness);
    g.fillRect(0, GAME_HEIGHT - thickness, GAME_WIDTH, thickness);
    g.fillRect(0, 0, thickness, GAME_HEIGHT);
    g.fillRect(GAME_WIDTH - thickness, 0, thickness, GAME_HEIGHT);
  }
}
