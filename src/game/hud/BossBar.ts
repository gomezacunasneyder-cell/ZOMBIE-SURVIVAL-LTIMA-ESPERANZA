import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { DEVOURER } from '../../content/boss';
import type { GameEvents } from '../../core/events/EventBus';
import { GAME_WIDTH } from '../config';

type TextFactory = (x: number, y: number, content: string, scale?: number) => Phaser.GameObjects.BitmapText;

const CENTRE = GAME_WIDTH / 2;
/** Por debajo de los contadores de la esquina: no los tapa. */
const BAR = { width: 200, height: 5, y: 33 };

/**
 * Barra de vida de EL DEVORADOR, arriba en el centro (ocupa el sitio del
 * panel de oleadas). Marca los umbrales de las fases, se tiñe al
 * enfurecerse y destella cuando está agotado y expuesto.
 */
export class BossBar {
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly phase: Phaser.GameObjects.BitmapText;
  private readonly g: Phaser.GameObjects.Graphics;
  private state: GameEvents['boss'] | null = null;
  /** Vida mostrada: baja con un rastro claro detrás del daño. */
  private trail = 1;

  constructor(scene: Phaser.Scene, text: TextFactory) {
    this.g = scene.add.graphics();
    this.name = text(CENTRE, 23, '').setOrigin(0.5, 0).setTint(colorNumber('blood1')).setVisible(false);
    this.phase = text(CENTRE + BAR.width / 2, 23, '').setOrigin(1, 0).setVisible(false);
  }

  get visible(): boolean {
    return this.state?.visible ?? false;
  }

  show(state: GameEvents['boss']): void {
    this.state = state;
    this.name.setText(state.name).setVisible(state.visible);
    this.phase.setText(state.exposed ? '¡PUNTO DEBIL!' : `FASE ${state.phase}`).setVisible(state.visible);
    this.phase.setTint(colorNumber(state.exposed ? 'yel1' : state.phase > 1 ? 'org1' : 'grey1'));
  }

  update(time: number): void {
    const g = this.g.clear();
    const state = this.state;
    if (!state?.visible) return;
    const ratio = Math.max(0, state.health / state.max);
    this.trail = Math.max(ratio, this.trail - 0.004);
    const left = Math.round(CENTRE - BAR.width / 2);
    g.fillStyle(colorNumber('outline'), 1).fillRect(left - 2, BAR.y - 2, BAR.width + 4, BAR.height + 4);
    g.fillStyle(colorNumber('shadow'), 1).fillRect(left, BAR.y, BAR.width, BAR.height);
    g.fillStyle(colorNumber('light1'), 1).fillRect(left, BAR.y, Math.round(BAR.width * this.trail), BAR.height);
    const blink = state.exposed && Math.floor(time / 150) % 2 === 0;
    const fill = blink ? 'yel1' : state.phase === 1 ? 'blood1' : 'org2';
    const width = Math.round(BAR.width * ratio);
    g.fillStyle(colorNumber(fill), 1).fillRect(left, BAR.y, width, BAR.height);
    g.fillStyle(colorNumber('blood2'), 1).fillRect(left, BAR.y + BAR.height - 1, width, 1);
    // Umbrales de las fases.
    g.fillStyle(colorNumber('white'), 1);
    for (const at of [DEVOURER.phase2At, DEVOURER.phase3At]) g.fillRect(left + Math.round(BAR.width * at), BAR.y - 1, 1, BAR.height + 2);
  }
}
