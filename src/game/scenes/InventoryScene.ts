import Phaser from 'phaser';
import { colorNumber, type ColorName } from '../../art/palette';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { updateTestHook } from '../debug/testHook';
import type { InventoryView } from '../hud/inventoryView';
import { OVERLAY_CLOSED_KEY, SCENE } from './keys';

type InventoryAction = 'up' | 'down' | 'equip' | 'close';
const KEY_ACTIONS: Readonly<Record<string, InventoryAction>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Enter: 'equip',
  KeyE: 'equip',
  Tab: 'close',
  Escape: 'close',
};
const PANEL = { x: 36, y: 20, width: 408, height: 230 };
const ROW = { height: 23, width: 196 };
const LEFT = PANEL.x + 8;
const RIGHT = PANEL.x + 216;
const TOP = PANEL.y + 34;

/**
 * Inventario (Tab): el juego queda detenido y se ve todo lo que lleva
 * Alex: las seis ranuras de arma con su munición, botiquines,
 * arrojadizos, piezas y objetos de misión. Desde aquí también se puede
 * elegir el arma que se empuña al volver.
 */
export class InventoryScene extends Phaser.Scene {
  private view!: InventoryView;
  private selected = 0;
  private cursor!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE.inventory);
  }

  create(view: InventoryView): void {
    this.view = view;
    this.selected = Math.max(0, view.weapons.findIndex((w) => w?.active));

    const g = this.add.graphics();
    g.fillStyle(colorNumber('outline'), 0.65).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.frame(g, PANEL.x, PANEL.y, PANEL.width, PANEL.height);
    this.text(GAME_WIDTH / 2, PANEL.y + 8, 'INVENTARIO', 2).setOrigin(0.5, 0);
    this.text(PANEL.x + PANEL.width - 10, PANEL.y + 12, `VIDA ${Math.ceil(view.health.current)}/${view.health.max}`, 1, 'grey1').setOrigin(1, 0);

    this.buildWeapons(g);
    this.buildSupplies(g);
    this.cursor = this.add.graphics();
    this.text(GAME_WIDTH / 2, PANEL.y + PANEL.height - 12, 'ARRIBA/ABAJO ELEGIR   ENTER O E EQUIPAR   TAB O ESC VOLVER', 1, 'light2').setOrigin(0.5, 0);
    this.drawCursor();

    // Teclas del navegador: cada pulsación es una acción, con el juego en pausa debajo.
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const digit = /^Digit([1-6])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        this.selected = Number(digit[1]) - 1;
        this.equip();
        return;
      }
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault();
      if (action === 'close') this.close();
      else if (action === 'equip') this.equip();
      else this.move(action === 'up' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    playSfx(this, SFX.crateOpen, 0.25, 0);
    updateTestHook({ inventoryOpen: true });
  }

  private text(x: number, y: number, content: string, scale = 1, color: ColorName = 'white'): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, content).setScale(scale).setTint(colorNumber(color));
  }

  private frame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, inner: ColorName = 'shadow'): void {
    g.fillStyle(colorNumber('outline'), 1).fillRect(x, y, w, h);
    g.fillStyle(colorNumber('conc4'), 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(colorNumber(inner), 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  /** Seis ranuras: número, icono, nombre y munición (cargador y reserva). */
  private buildWeapons(g: Phaser.GameObjects.Graphics): void {
    this.text(LEFT, TOP, 'ARMAS', 1, 'grey1');
    this.view.weapons.forEach((weapon, i) => {
      const y = TOP + 10 + i * ROW.height;
      this.frame(g, LEFT, y, ROW.width, ROW.height - 2, weapon?.active ? 'asph3' : 'shadow');
      this.text(LEFT + 5, y + 7, String(i + 1), 1, weapon ? 'light2' : 'asph2');
      if (!weapon) {
        this.text(LEFT + 50, y + 7, `${this.view.missing[i] ?? ''} - SIN ENCONTRAR`, 1, 'asph2');
        return;
      }
      this.add.image(LEFT + 13, y + 4, ATLAS_KEY, weapon.icon).setOrigin(0, 0);
      this.text(LEFT + 50, y + 4, weapon.name, 1, weapon.active ? 'light2' : 'white');
      const dry = weapon.magazine + weapon.reserve === 0;
      this.text(LEFT + 50, y + 12, `${weapon.magazine}/${weapon.magazineSize}  RESERVA ${weapon.reserve}/${weapon.reserveMax}`, 1, dry ? 'blood1' : 'grey1');
      if (weapon.active) this.text(LEFT + ROW.width - 6, y + 4, 'EN MANO', 1, 'ui1').setOrigin(1, 0);
    });
  }

  /** Consumibles, piezas y objetos de misión. */
  private buildSupplies(g: Phaser.GameObjects.Graphics): void {
    const width = PANEL.x + PANEL.width - 8 - RIGHT;
    this.text(RIGHT, TOP, 'CONSUMIBLES', 1, 'grey1');
    const rows = [
      { name: 'BOTIQUIN', icon: 'ui/medkit', key: 'Q', count: this.view.medkits.count, max: this.view.medkits.max },
      ...this.view.throwables,
    ];
    rows.forEach((row, i) => {
      const y = TOP + 10 + i * 19;
      this.frame(g, RIGHT, y, width, 17);
      this.add.image(RIGHT + 12, y + 8, ATLAS_KEY, row.icon).setOrigin(0.5, 0.5);
      this.text(RIGHT + 26, y + 6, row.name);
      const tone: ColorName = row.count === 0 ? 'blood1' : row.count === row.max ? 'ui1' : 'white';
      this.text(RIGHT + width - 30, y + 6, `${row.count}/${row.max}`, 1, tone).setOrigin(1, 0);
      this.text(RIGHT + width - 8, y + 6, row.key, 1, 'light2').setOrigin(1, 0);
    });

    const scrapTop = TOP + 10 + rows.length * 19 + 6;
    this.text(RIGHT, scrapTop, 'PIEZAS', 1, 'grey1');
    this.frame(g, RIGHT, scrapTop + 10, width, 28);
    this.add.image(RIGHT + 12, scrapTop + 24, ATLAS_KEY, 'ui/scrap').setOrigin(0.5, 0.5);
    this.text(RIGHT + 26, scrapTop + 15, `x${this.view.scrap}`, 2, 'yel1');
    this.text(RIGHT + 26, scrapTop + 29, 'PARA MEJORAS EN EL BANCO DE TRABAJO', 1, 'grey2');

    const missionTop = scrapTop + 46;
    this.text(RIGHT, missionTop, 'OBJETOS DE MISION', 1, 'grey1');
    this.frame(g, RIGHT, missionTop + 10, width, 17);
    const mission = this.view.mission.length > 0 ? this.view.mission.join(', ') : 'NINGUNO';
    this.text(RIGHT + 8, missionTop + 16, mission, 1, this.view.mission.length > 0 ? 'white' : 'asph2');
  }

  private drawCursor(): void {
    const y = TOP + 10 + this.selected * ROW.height;
    const g = this.cursor.clear();
    g.lineStyle(1, colorNumber('light2'), 1).strokeRect(LEFT - 0.5, y - 0.5, ROW.width + 1, ROW.height - 1);
  }

  private move(direction: 1 | -1): void {
    const count = this.view.weapons.length;
    this.selected = (this.selected + direction + count) % count;
    playSfx(this, SFX.dryFire, 0.2, 0);
    this.drawCursor();
  }

  /** Equipa el arma elegida y vuelve al juego. Una ranura vacía solo avisa. */
  private equip(): void {
    if (!this.view.weapons[this.selected]) {
      this.drawCursor();
      playSfx(this, SFX.dryFire, 0.35, 0);
      return;
    }
    this.view.equip(this.selected);
    this.close();
  }

  private close(): void {
    updateTestHook({ inventoryOpen: false });
    this.registry.set(OVERLAY_CLOSED_KEY, performance.now());
    this.scene.stop();
    this.scene.resume(SCENE.game);
  }
}
