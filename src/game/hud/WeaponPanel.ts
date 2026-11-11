import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { WEAPON_SLOTS } from '../../content/weapons';
import type { GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY } from '../boot/registerArt';

type TextFactory = (x: number, y: number, content: string, scale?: number) => Phaser.GameObjects.BitmapText;

export const PANEL = { width: 156, height: 42 };
/** Zona de la fila de balas: hasta 12 balas grandes, 40 finas o una barra. */
const ROUNDS = { dx: 40, dy: 15, width: 76 };
const BIG_PIPS = 12;
const THIN_PIPS = 36;
const SLOT = { dx: 5, dy: 29, size: 9, gap: 2 };
const RELOAD_BAR = { dx: 112, dy: 32, width: 38 };

/**
 * Panel de arma del HUD, abajo a la derecha:
 *
 *   [icono]  NOMBRE DEL ARMA          12 /36
 *            ▮▮▮▮▮▮▮▮▮▮▮▮               RES
 *   [1][2][3][4]  RECARGANDO     [██████    ]
 *
 * El cargador se dibuja bala a bala (grandes hasta 12, finas hasta 36) o
 * como barra en la ametralladora. Las ranuras se iluminan la activa y se
 * tiñen de rojo las que se han quedado sin ninguna bala.
 */
export class WeaponPanel {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly magazineText: Phaser.GameObjects.BitmapText;
  private readonly reserveText: Phaser.GameObjects.BitmapText;
  private readonly bigPips: Phaser.GameObjects.Image[] = [];
  private readonly thinPips: Phaser.GameObjects.Image[] = [];
  private readonly roundsBar: Phaser.GameObjects.Graphics;
  private readonly slotBoxes: Phaser.GameObjects.Graphics;
  private readonly slotTexts: Phaser.GameObjects.BitmapText[] = [];
  private readonly reloadBar: Phaser.GameObjects.Graphics;
  private readonly reloadLabel: Phaser.GameObjects.BitmapText;
  private magazineEmpty = false;
  private reserveEmpty = false;
  private reloading = false;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    text: TextFactory,
  ) {
    const frame = scene.add.graphics();
    frame.fillStyle(colorNumber('outline'), 1).fillRect(x, y, PANEL.width, PANEL.height);
    frame.fillStyle(colorNumber('conc4'), 1).fillRect(x + 1, y + 1, PANEL.width - 2, PANEL.height - 2);
    frame.fillStyle(colorNumber('shadow'), 1).fillRect(x + 2, y + 2, PANEL.width - 4, PANEL.height - 4);
    // Separador entre la fila del arma y la de ranuras.
    frame.fillStyle(colorNumber('conc4'), 1).fillRect(x + 3, y + SLOT.dy - 3, PANEL.width - 6, 1);

    this.icon = scene.add.image(x + 5, y + 6, ATLAS_KEY, 'ui/pistol').setOrigin(0, 0);
    this.name = text(x + ROUNDS.dx, y + 6, '');
    this.magazineText = text(x + PANEL.width - 26, y + 5, '', 2).setOrigin(1, 0);
    this.reserveText = text(x + PANEL.width - 5, y + 6, '').setOrigin(1, 0).setTint(colorNumber('grey1'));
    text(x + PANEL.width - 5, y + 14, 'RES').setOrigin(1, 0).setTint(colorNumber('grey3'));

    for (let i = 0; i < BIG_PIPS; i++) {
      this.bigPips.push(scene.add.image(x + ROUNDS.dx + i * 4, y + ROUNDS.dy, ATLAS_KEY, 'ui/round').setOrigin(0, 0));
    }
    for (let i = 0; i < THIN_PIPS; i++) {
      this.thinPips.push(
        scene.add.image(x + ROUNDS.dx + i * 2, y + ROUNDS.dy + 1, ATLAS_KEY, 'ui/round-thin').setOrigin(0, 0),
      );
    }
    this.roundsBar = scene.add.graphics();

    this.slotBoxes = scene.add.graphics();
    for (let i = 0; i < WEAPON_SLOTS; i++) {
      const left = x + SLOT.dx + i * (SLOT.size + SLOT.gap);
      this.slotTexts.push(text(left + 3, y + SLOT.dy + 2, String(i + 1)));
    }
    this.reloadBar = scene.add.graphics();
    this.reloadLabel = text(x + SLOT.dx + WEAPON_SLOTS * (SLOT.size + SLOT.gap) + 4, y + SLOT.dy + 2, '').setVisible(false);
  }

  /** Parpadeo del aviso de recarga; se llama cada fotograma. */
  update(time: number): void {
    const prompt = this.magazineEmpty && !this.reloading;
    this.reloadLabel.setVisible(this.reloading || (prompt && Math.floor(time / 350) % 2 === 0));
  }

  showWeapon(icon: string, name: string): void {
    this.icon.setFrame(icon);
    this.name.setText(name);
  }

  showAmmo(magazine: number, magazineSize: number, reserve: number): void {
    this.magazineEmpty = magazine === 0;
    this.reserveEmpty = reserve === 0;
    this.magazineText.setText(String(magazine));
    this.reserveText.setText(`/${reserve}`);
    const low = magazine <= Math.ceil(magazineSize / 4);
    this.magazineText.setTint(magazine === 0 ? colorNumber('blood1') : low ? colorNumber('yel2') : 0xffffff);
    this.reserveText.setTint(reserve === 0 ? colorNumber('blood1') : colorNumber('grey1'));
    this.showRounds(magazine, magazineSize);
    this.refreshLabel();
  }

  private showRounds(magazine: number, magazineSize: number): void {
    const big = magazineSize <= BIG_PIPS;
    const thin = !big && magazineSize <= THIN_PIPS;
    this.bigPips.forEach((pip, i) => {
      pip.setVisible(big && i < magazineSize);
      pip.setFrame(i < magazine ? 'ui/round' : 'ui/round-empty');
    });
    this.thinPips.forEach((pip, i) => {
      pip.setVisible(thin && i < magazineSize);
      pip.setFrame(i < magazine ? 'ui/round-thin' : 'ui/round-thin-empty');
    });
    const g = this.roundsBar.clear();
    if (big || thin) return;
    // Cargador grande: barra con una marca cada 10 balas.
    const left = this.x + ROUNDS.dx;
    const top = this.y + ROUNDS.dy + 1;
    const fill = Math.round((ROUNDS.width * magazine) / magazineSize);
    g.fillStyle(colorNumber('asph4'), 1).fillRect(left, top, ROUNDS.width, 5);
    g.fillStyle(colorNumber('yel2'), 1).fillRect(left, top, fill, 5);
    g.fillStyle(colorNumber('yel1'), 1).fillRect(left, top, fill, 1);
    g.fillStyle(colorNumber('shadow'), 1);
    for (let i = 10; i < magazineSize; i += 10) g.fillRect(left + Math.round((ROUNDS.width * i) / magazineSize), top, 1, 5);
  }

  showSlots(state: GameEvents['arsenal']): void {
    const g = this.slotBoxes.clear();
    state.slots.forEach((slot, i) => {
      const left = this.x + SLOT.dx + i * (SLOT.size + SLOT.gap);
      const top = this.y + SLOT.dy;
      const active = i === state.active;
      const dry = slot !== null && slot.magazine + slot.reserve === 0;
      g.fillStyle(colorNumber(active ? 'light2' : 'conc4'), 1).fillRect(left, top, SLOT.size, SLOT.size);
      g.fillStyle(colorNumber(active ? 'asph3' : 'shadow'), 1).fillRect(left + 1, top + 1, SLOT.size - 2, SLOT.size - 2);
      const tint = slot === null ? 'asph4' : dry ? 'blood1' : active ? 'light2' : 'grey2';
      this.slotTexts[i]?.setTint(colorNumber(tint));
    });
  }

  showReload(progress: number | null): void {
    this.reloading = progress !== null;
    this.refreshLabel();
    const g = this.reloadBar.clear();
    if (progress === null) return;
    const x = this.x + RELOAD_BAR.dx;
    const y = this.y + RELOAD_BAR.dy;
    g.fillStyle(colorNumber('outline'), 1).fillRect(x - 1, y - 1, RELOAD_BAR.width + 2, 5);
    g.fillStyle(colorNumber('asph4'), 1).fillRect(x, y, RELOAD_BAR.width, 3);
    g.fillStyle(colorNumber('light2'), 1).fillRect(x, y, Math.round(RELOAD_BAR.width * progress), 3);
  }

  private refreshLabel(): void {
    if (this.reloading) this.reloadLabel.setText('RECARGANDO').setTint(colorNumber('light2'));
    else if (this.reserveEmpty) this.reloadLabel.setText('SIN MUNICION').setTint(colorNumber('blood1'));
    else this.reloadLabel.setText('R: RECARGAR').setTint(colorNumber('blood1'));
  }
}
