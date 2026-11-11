import Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { updateTestHook, type TextBounds } from '../debug/testHook';
import { BUS_KEY, SCENE } from '../scenes/keys';
import { PANEL, WeaponPanel } from './WeaponPanel';

/** Margen mínimo entre cualquier elemento del HUD y el borde de la pantalla. */
const MARGIN = 5;
const BAR = { x: MARGIN + 14, y: MARGIN + 1, width: 72, height: 7 };
const PANEL_X = GAME_WIDTH - MARGIN - PANEL.width;
const PANEL_Y = GAME_HEIGHT - MARGIN - PANEL.height;
/** Barra de recarga bajo el punto de mira. */
const CURSOR_BAR = { width: 13, dy: 8 };
/** Alto de las franjas de la transición de zona. */
const LETTERBOX = 11;

/**
 * Interfaz en una escena propia, superpuesta al juego y con cámara fija.
 * Solo escucha el bus de eventos: no conoce al jugador ni a los zombis.
 * Todo se dibuja con la paleta y la tipografía de píxel del juego.
 */
export class HudScene extends Phaser.Scene {
  private texts: Phaser.GameObjects.BitmapText[] = [];
  private healthFill!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.BitmapText;
  private phaseText!: Phaser.GameObjects.BitmapText;
  private barTop!: Phaser.GameObjects.Rectangle;
  private barBottom!: Phaser.GameObjects.Rectangle;
  private panel!: WeaponPanel;
  private crosshair!: Phaser.GameObjects.Image;
  private cursorBar!: Phaser.GameObjects.Graphics;
  private reloadProgress: number | null = null;
  private killsText!: Phaser.GameObjects.BitmapText;
  private notice!: Phaser.GameObjects.BitmapText;
  private zoneTitle!: Phaser.GameObjects.BitmapText;
  private noticeUntil = 0;
  private zoneUntil = 0;
  private magazineEmpty = false;
  private dead = false;

  constructor() {
    super(SCENE.hud);
  }

  create(): void {
    this.texts = [];
    this.noticeUntil = 0;
    this.zoneUntil = 0;
    this.magazineEmpty = false;
    this.reloadProgress = null;
    this.dead = false;

    this.buildLetterbox();
    this.buildHealth();
    this.buildKills();
    this.panel = new WeaponPanel(this, PANEL_X, PANEL_Y, (x, y, content, scale) => this.text(x, y, content, scale));
    this.buildMessages();
    this.buildCrosshair();

    const bus = this.registry.get(BUS_KEY) as EventBus<GameEvents>;
    const off = [
      bus.on('health', (e) => this.showHealth(e.current, e.max)),
      bus.on('ammo', (e) => {
        this.magazineEmpty = e.magazine === 0;
        this.panel.showAmmo(e.magazine, e.magazineSize, e.reserve);
      }),
      bus.on('reload', (e) => {
        this.reloadProgress = e.progress;
        this.panel.showReload(e.progress);
      }),
      bus.on('weapon', (e) => this.panel.showWeapon(e.icon, e.name)),
      bus.on('arsenal', (e) => this.panel.showSlots(e)),
      bus.on('kills', (e) => this.killsText.setText(`x${e.total}`)),
      bus.on('notice', (e) => this.showNotice(e.text)),
      bus.on('zone', (e) => this.showZone(e.name)),
      bus.on('daytime', (e) => this.phaseText.setText(e.phase)),
      bus.on('playerDied', (e) => this.showGameOver(e.kills)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off.forEach((unsubscribe) => unsubscribe()));

    updateTestHook({ hudTexts: () => this.visibleTextBounds() });
  }

  override update(time: number): void {
    if (this.notice.visible && time >= this.noticeUntil) this.notice.setVisible(false);
    if (this.zoneTitle.visible && time >= this.zoneUntil) this.zoneTitle.setVisible(false);
    this.panel.update(time);
    this.updateCrosshair();
  }

  // ───────────────────────── Construcción ─────────────────────────

  private text(x: number, y: number, content: string, scale = 1): Phaser.GameObjects.BitmapText {
    const text = this.add.bitmapText(x, y, FONT_KEY, content).setScale(scale);
    this.texts.push(text);
    return text;
  }

  /** Franjas de cine que entran al cambiar de zona; quedan bajo el resto del HUD. */
  private buildLetterbox(): void {
    const color = colorNumber('outline');
    this.barTop = this.add.rectangle(0, -LETTERBOX, GAME_WIDTH, LETTERBOX, color).setOrigin(0, 0);
    this.barBottom = this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, LETTERBOX, color).setOrigin(0, 0);
  }

  private buildHealth(): void {
    this.add.image(MARGIN, MARGIN, ATLAS_KEY, 'ui/health').setOrigin(0, 0);
    const frame = this.add.graphics();
    frame.fillStyle(colorNumber('outline'), 1).fillRect(BAR.x - 2, BAR.y - 2, BAR.width + 4, BAR.height + 4);
    frame.fillStyle(colorNumber('conc4'), 1).fillRect(BAR.x - 1, BAR.y - 1, BAR.width + 2, BAR.height + 2);
    frame.fillStyle(colorNumber('shadow'), 1).fillRect(BAR.x, BAR.y, BAR.width, BAR.height);
    this.healthFill = this.add.graphics();
    this.healthText = this.text(BAR.x + BAR.width + 6, BAR.y + 1, '100');
    this.phaseText = this.text(MARGIN, MARGIN + 13, 'ATARDECER').setTint(colorNumber('grey1'));
  }

  private buildKills(): void {
    this.killsText = this.text(GAME_WIDTH - MARGIN, MARGIN + 2, 'x0', 2).setOrigin(1, 0);
    this.add.image(GAME_WIDTH - MARGIN - 40, MARGIN, ATLAS_KEY, 'ui/skull').setOrigin(0, 0);
  }

  /**
   * Punto de mira que sigue al ratón (el cursor del sistema se oculta).
   * Blanco normal, rojo con el cargador vacío y ámbar con una barra de
   * progreso mientras se recarga.
   */
  private buildCrosshair(): void {
    this.input.setDefaultCursor('none');
    this.crosshair = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ATLAS_KEY, 'ui/crosshair');
    this.cursorBar = this.add.graphics();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
  }

  private updateCrosshair(): void {
    const pointer = this.input.activePointer;
    const x = Math.round(pointer.x);
    const y = Math.round(pointer.y);
    this.crosshair.setPosition(x, y).setVisible(!this.dead);
    const reloading = this.reloadProgress !== null;
    this.crosshair.setTint(reloading ? colorNumber('light2') : this.magazineEmpty ? colorNumber('blood1') : 0xffffff);
    const g = this.cursorBar.clear();
    if (!reloading || this.dead) return;
    const left = x - Math.floor(CURSOR_BAR.width / 2);
    const top = y + CURSOR_BAR.dy;
    g.fillStyle(colorNumber('outline'), 1).fillRect(left - 1, top - 1, CURSOR_BAR.width + 2, 4);
    g.fillStyle(colorNumber('light2'), 1).fillRect(left, top, Math.round(CURSOR_BAR.width * (this.reloadProgress ?? 0)), 2);
  }

  private buildMessages(): void {
    this.zoneTitle = this.text(GAME_WIDTH / 2, 26, '', 2).setOrigin(0.5, 0).setVisible(false);
    this.notice = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 58, '')
      .setOrigin(0.5, 0)
      .setTint(colorNumber('light2'))
      .setVisible(false);
    // Dos líneas para no invadir el panel de armas.
    const hints = [
      this.text(MARGIN, GAME_HEIGHT - MARGIN - 12, 'A/D MOVER  SHIFT CORRER  ESPACIO SALTAR  ESC PAUSA'),
      this.text(MARGIN, GAME_HEIGHT - MARGIN - 5, 'CLIC DISPARAR  R RECARGAR  1-4 O RUEDA: ARMA'),
    ];
    this.time.delayedCall(14000, () => hints.forEach((hint) => hint.setVisible(false)));
  }

  // ───────────────────────── Actualización ─────────────────────────

  private showHealth(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    const width = Math.round(BAR.width * ratio);
    const tone = ratio > 0.5 ? (['ui1', 'ui2'] as const) : ratio > 0.25 ? (['yel2', 'yel3'] as const) : (['blood1', 'blood2'] as const);
    const g = this.healthFill.clear();
    if (width > 0) {
      g.fillStyle(colorNumber(tone[0]), 1).fillRect(BAR.x, BAR.y, width, BAR.height);
      g.fillStyle(colorNumber(tone[1]), 1).fillRect(BAR.x, BAR.y + BAR.height - 2, width, 2);
      g.fillStyle(colorNumber('light1'), 1).fillRect(BAR.x, BAR.y, width, 1);
    }
    // Divisiones cada 25 %.
    g.fillStyle(colorNumber('outline'), 1);
    for (let i = 1; i < 4; i++) g.fillRect(BAR.x + (BAR.width / 4) * i, BAR.y, 1, BAR.height);
    this.healthText.setText(String(Math.ceil(current)));
  }

  private showNotice(content: string): void {
    this.notice.setText(content).setVisible(true);
    this.noticeUntil = this.time.now + 1500;
  }

  /** Transición de zona: las franjas entran con suavidad, aparece el nombre y se retiran. */
  private showZone(name: string): void {
    this.zoneTitle.setText(name).setVisible(true);
    this.zoneUntil = this.time.now + 2600;
    this.tweens.killTweensOf([this.barTop, this.barBottom]);
    this.barTop.y = -LETTERBOX;
    this.barBottom.y = GAME_HEIGHT;
    const slide = { duration: 420, ease: 'Sine.easeInOut', yoyo: true, hold: 1800 };
    this.tweens.add({ targets: this.barTop, y: 0, ...slide });
    this.tweens.add({ targets: this.barBottom, y: GAME_HEIGHT - LETTERBOX, ...slide });
  }

  private showGameOver(kills: number): void {
    this.dead = true;
    this.input.setDefaultCursor('default');
    const veil = this.add.graphics();
    veil.fillStyle(colorNumber('outline'), 0.7).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const centre = GAME_WIDTH / 2;
    this.text(centre, 96, 'HAS MUERTO', 4).setOrigin(0.5, 0).setTint(colorNumber('blood1'));
    this.text(centre, 130, `ZOMBIS ELIMINADOS: ${kills}`, 2).setOrigin(0.5, 0);
    this.text(centre, 156, 'PULSA R O HAZ CLIC PARA REINTENTAR').setOrigin(0.5, 0).setTint(colorNumber('light2'));
  }

  /** Rectángulos de los textos visibles, para comprobar que ninguno se corta. */
  private visibleTextBounds(): TextBounds[] {
    return this.texts
      .filter((text) => text.visible && text.text.length > 0)
      .map((text) => {
        const bounds = text.getTextBounds(true).global;
        return { text: text.text, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      });
  }
}
