import Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { SKINS, skinAnimation, type PlayerSkin } from '../../art/skins';
import { WEAPONS, type WeaponDef } from '../../content/weapons';
import { AIM_ANGLES, type AimAngle } from '../../core/combat/aim';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { updateTestHook, type LaunchOptions } from '../debug/testHook';
import { AimRig } from '../entities/AimRig';
import { SCENE } from './keys';

interface Cell {
  rig: AimRig;
  aim: AimAngle;
  weapon: WeaponDef;
  mode: 'shoot' | 'reload';
}

const ROW_HEIGHT = 62;
const FIRST_FEET = 74;
const AIM_X = (i: number): number => 22 + i * 38;
const RELOAD_X = AIM_X(7) + 14;
const INFO_X = 330;

/**
 * Revisión del arsenal (`?scene=arsenal`): cada arma en manos de Alex en
 * los 7 ángulos, disparando con su fogonazo y su retroceso, su recarga
 * animada y su ficha de datos. Sirve para revisar el arte y como captura.
 */
export class ArsenalScene extends Phaser.Scene {
  private cells: Cell[] = [];
  private freeze = false;

  constructor() {
    super(SCENE.arsenal);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    this.freeze = options.freeze;
    this.cells = [];
    this.cameras.main.setBackgroundColor(colorNumber('asph4'));
    const skin = SKINS[options.skin];

    this.text(4, 3, `ARSENAL: CUATRO ARMAS EN LOS 7 ANGULOS       J: JUGAR   G: GALERIA`);
    this.text(RELOAD_X, 12, 'RECARGA').setOrigin(0.5, 0).setTint(colorNumber('grey2'));
    WEAPONS.forEach((weapon, row) => this.buildRow(skin, weapon, row));

    this.bindKeys(options);
    // La primera pasada dispara todas las armas: con `freeze=1` queda fijo el fogonazo.
    this.syncCells(0);
    updateTestHook({ readyScene: SCENE.arsenal });
  }

  private buildRow(skin: PlayerSkin, weapon: WeaponDef, row: number): void {
    const feet = FIRST_FEET + row * ROW_HEIGHT;
    AIM_ANGLES.forEach((aim, i) => {
      this.cells.push({ rig: new AimRig(this, this.body(skin, AIM_X(i), feet), 1, skin), aim, weapon, mode: 'shoot' });
    });
    if (skin.reloadFrames > 0) {
      this.cells.push({ rig: new AimRig(this, this.body(skin, RELOAD_X, feet), 1, skin), aim: 0, weapon, mode: 'reload' });
    }

    const top = feet - 44;
    this.add.image(INFO_X, top, ATLAS_KEY, weapon.icon).setOrigin(0, 0);
    this.text(INFO_X + 34, top + 1, `${row + 1}  ${weapon.name}`).setTint(colorNumber('light2'));
    const perMinute = Math.round(60000 / weapon.fireIntervalMs);
    const damage = weapon.pellets > 1 ? `${weapon.damage}X${weapon.pellets}` : String(weapon.damage);
    const lines = [
      `CARGADOR ${weapon.magazineSize}  RESERVA ${weapon.reserveStart}/${weapon.reserveMax}`,
      `DANO ${damage}  ALCANCE ${weapon.rangePx}`,
      `CADENCIA ${perMinute}/MIN  ${weapon.automatic ? 'AUTOMATICA' : 'SEMIAUTO'}`,
      `RECARGA ${(weapon.reloadMs / 1000).toFixed(1)} S  RUIDO ${weapon.noiseRadius}`,
    ];
    lines.forEach((line, i) => this.text(INFO_X, top + 16 + i * 7, line).setTint(colorNumber('grey1')));
  }

  private body(skin: PlayerSkin, x: number, feetY: number): Phaser.GameObjects.Sprite {
    return this.add.sprite(x, feetY, ATLAS_KEY, `${skinAnimation(skin, 'idle')}/0`).setOrigin(0.5, 1);
  }

  private text(x: number, y: number, content: string): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(x, y, FONT_KEY, content);
  }

  override update(time: number): void {
    if (!this.freeze) this.syncCells(time);
  }

  private readonly lastShot = new Map<string, number>();

  /** Cada arma dispara a su ritmo (la escopeta más despacio) y recarga con su duración real. */
  private syncCells(time: number): void {
    const fired = new Set<string>();
    for (const weapon of WEAPONS) {
      const every = Math.max(500, weapon.fireIntervalMs * 3);
      if (time - (this.lastShot.get(weapon.id) ?? -Infinity) >= every) {
        this.lastShot.set(weapon.id, time);
        fired.add(weapon.id);
      }
    }
    for (const cell of this.cells) {
      const weapon = cell.weapon;
      cell.rig.setWeapon(weapon.id);
      if (cell.mode === 'shoot') {
        if (fired.has(weapon.id)) cell.rig.fire(time, weapon.recoil);
        cell.rig.sync(1, cell.aim, time);
      } else {
        const cycle = weapon.reloadMs + 600;
        const phase = time % cycle;
        cell.rig.sync(1, 0, time, phase < weapon.reloadMs ? phase / weapon.reloadMs : null);
      }
    }
  }

  private bindKeys(options: LaunchOptions): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-J', () => {
      this.registry.set('launch', { ...options, scene: 'game' });
      this.scene.start(SCENE.game);
    });
    keyboard.on('keydown-G', () => this.scene.start(SCENE.gallery));
  }
}
