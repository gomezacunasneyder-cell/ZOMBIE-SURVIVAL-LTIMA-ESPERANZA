import Phaser from 'phaser';
import type { ImportReport } from '../../art/import/spritePack';
import { colorNumber } from '../../art/palette';
import { SKINS, skinAnimation, type BodyAnimation, type PlayerSkin } from '../../art/skins';
import { AIM_ANGLES, type AimAngle } from '../../core/combat/aim';
import { PISTOL } from '../../content/weapons';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { GAME_HEIGHT } from '../config';
import { downloadSpriteExport } from '../debug/exportSprites';
import { updateTestHook, type LaunchOptions } from '../debug/testHook';
import { AimRig } from '../entities/AimRig';
import { IMPORT_REPORTS_KEY, SCENE } from './keys';

type CellMode = 'aim' | 'shoot' | 'reload' | 'none';

interface Cell {
  rig: AimRig;
  aim: AimAngle;
  mode: CellMode;
}

const COLUMNS: { name: BodyAnimation; label: string; loopDelay: number; arm: boolean }[] = [
  { name: 'idle', label: 'REPOSO', loopDelay: 0, arm: true },
  { name: 'walk', label: 'CAMINAR', loopDelay: 0, arm: true },
  { name: 'run', label: 'CORRER', loopDelay: 0, arm: true },
  { name: 'jump', label: 'SALTO', loopDelay: 500, arm: true },
  { name: 'fall', label: 'CAIDA', loopDelay: 0, arm: true },
  { name: 'land', label: 'ATERRIZAJE', loopDelay: 500, arm: true },
  { name: 'hurt', label: 'GOLPE', loopDelay: 500, arm: true },
  { name: 'die', label: 'MUERTE', loopDelay: 900, arm: false },
];

const COLUMN_X = (i: number): number => 30 + i * 53;
const AIM_X = (i: number): number => 28 + i * 44;
const ROWS = {
  clasico: { label: 22, animations: 66, aimLabel: 136, aim: 180 },
  detallado: { label: 72, animations: 122, aimLabel: 188, aim: 236 },
} as const;

/**
 * Comparación del aspecto actual de Alex con el nuevo: las mismas
 * animaciones lado a lado, los siete ángulos de puntería, el disparo y la
 * recarga. Aquí se revisa el arte antes de sustituir nada en el juego.
 */
export class CompareScene extends Phaser.Scene {
  private cells: Cell[] = [];

  constructor() {
    super(SCENE.compare);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    this.cells = [];
    this.cameras.main.setBackgroundColor(colorNumber('asph4'));

    this.text(4, 3, 'ALEX: ASPECTO ACTUAL FRENTE AL NUEVO');
    COLUMNS.forEach((column, i) => this.text(COLUMN_X(i), 13, column.label).setOrigin(0.5, 0));
    this.text(450, 13, 'ZOMBI').setOrigin(0.5, 0);

    this.buildSkin(SKINS.clasico, 'ACTUAL  32x32  FIGURA 27 PX');
    this.buildSkin(SKINS.detallado, 'NUEVO  32x40  FIGURA 30 PX');
    this.text(4, 128, 'PUNTERIA 90 60 30 0 -30 -60 -90          DISPARO     RECARGA');

    this.showImportReports();
    this.text(4, GAME_HEIGHT - 9, 'N: JUGAR CON EL NUEVO   D: JUGAR CON EL ACTUAL   E: EXPORTAR PNG Y JSON   G: GALERIA');

    if (options.freeze) this.anims.pauseAll();
    this.bindKeys(options);
    this.syncCells(0);
    updateTestHook({ readyScene: SCENE.compare, lightCount: 0 });
  }

  override update(time: number): void {
    this.syncCells(time);
  }

  private text(x: number, y: number, content: string): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(x, y, FONT_KEY, content);
  }

  private buildSkin(skin: PlayerSkin, title: string): void {
    const rows = ROWS[skin.id];
    this.text(4, rows.label, title).setTint(colorNumber('light2'));

    // Animaciones de cuerpo con el brazo acoplado al hombro de cada fotograma.
    COLUMNS.forEach((column, i) => {
      const key = skinAnimation(skin, column.name);
      if (!this.anims.exists(key)) {
        this.text(COLUMN_X(i), rows.animations - 18, '-').setOrigin(0.5, 0);
        return;
      }
      const body = this.body(skin, COLUMN_X(i), rows.animations);
      body.play(column.loopDelay > 0 ? { key, repeat: -1, repeatDelay: column.loopDelay } : key);
      if (column.arm) this.cells.push({ rig: new AimRig(this, body, 1, skin), aim: 0, mode: 'none' });
    });
    // Referencia de escala: un caminante a la misma altura de suelo.
    this.add.sprite(450, rows.animations, ATLAS_KEY, 'walker/civil/walk/0').setOrigin(0.5, 1).setFlipX(true).play('walker/civil/walk');

    // Los siete ángulos, el disparo y la recarga.
    this.text(4, rows.aimLabel, skin.label);
    AIM_ANGLES.forEach((angle, i) => {
      const body = this.body(skin, AIM_X(i), rows.aim);
      this.cells.push({ rig: new AimRig(this, body, 1, skin), aim: angle, mode: 'aim' });
    });
    const shooter = this.body(skin, AIM_X(7) + 16, rows.aim);
    this.cells.push({ rig: new AimRig(this, shooter, 1, skin), aim: 0, mode: 'shoot' });

    if (skin.reloadFrames > 0) {
      const reloader = this.body(skin, AIM_X(8) + 34, rows.aim);
      this.cells.push({ rig: new AimRig(this, reloader, 1, skin), aim: 0, mode: 'reload' });
    } else {
      this.text(AIM_X(8) + 34, rows.aim - 20, 'SIN ANIMACION').setOrigin(0.5, 0).setTint(colorNumber('grey2'));
    }
  }

  private body(skin: PlayerSkin, x: number, feetY: number): Phaser.GameObjects.Sprite {
    return this.add.sprite(x, feetY, ATLAS_KEY, `${skinAnimation(skin, 'idle')}/0`).setOrigin(0.5, 1);
  }

  private lastShot = 0;

  private syncCells(time: number): void {
    const fire = time - this.lastShot >= 700;
    if (fire) this.lastShot = time;
    // La recarga se repite con su duración real y una pausa apuntando.
    const cycle = PISTOL.reloadMs + 700;
    const phase = time % cycle;
    const progress = phase < PISTOL.reloadMs ? phase / PISTOL.reloadMs : null;

    for (const cell of this.cells) {
      if (cell.mode === 'shoot' && fire) cell.rig.fire(time);
      cell.rig.sync(1, cell.aim, time, cell.mode === 'reload' ? progress : null);
    }
  }

  private showImportReports(): void {
    const reports = (this.registry.get(IMPORT_REPORTS_KEY) as ImportReport[] | undefined) ?? [];
    if (reports.length === 0) return;
    const applied = reports.reduce((n, r) => n + r.applied.length, 0);
    const errors = reports.reduce((n, r) => n + r.errors.length, 0);
    this.text(4, GAME_HEIGHT - 18, `SPRITES EXTERNOS: ${applied} FOTOGRAMAS APLICADOS  ${errors} ERRORES`).setTint(
      colorNumber(errors > 0 ? 'blood1' : 'ui1'),
    );
  }

  private bindKeys(options: LaunchOptions): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const play = (skin: LaunchOptions['skin']): void => {
      this.registry.set('launch', { ...options, scene: 'game', skin });
      this.scene.start(SCENE.game);
    };
    keyboard.on('keydown-N', () => play('detallado'));
    keyboard.on('keydown-D', () => play('clasico'));
    keyboard.on('keydown-G', () => this.scene.start(SCENE.gallery));
    keyboard.on('keydown-E', () => {
      downloadSpriteExport(this, SKINS.detallado.prefix, 'alex-nuevo');
      downloadSpriteExport(this, SKINS.clasico.prefix, 'alex-actual');
    });
  }
}
