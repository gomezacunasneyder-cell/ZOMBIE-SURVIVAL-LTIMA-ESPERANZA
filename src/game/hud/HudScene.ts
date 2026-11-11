import Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { WEAPON_SLOTS } from '../../content/weapons';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { updateTestHook, type TextBounds } from '../debug/testHook';
import { BUS_KEY, SCENE } from '../scenes/keys';

/** Margen mínimo entre cualquier elemento del HUD y el borde de la pantalla. */
const MARGIN = 5;
const BAR = { x: MARGIN + 14, y: MARGIN + 1, width: 72, height: 7 };
const PANEL = { width: 112, height: 34 };
const PANEL_X = GAME_WIDTH - MARGIN - PANEL.width;
const PANEL_Y = GAME_HEIGHT - MARGIN - PANEL.height;
const MAX_PIPS = 12;
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
  private ammoText!: Phaser.GameObjects.BitmapText;
  private weaponName!: Phaser.GameObjects.BitmapText;
  private weaponIcon!: Phaser.GameObjects.Image;
  private pips: Phaser.GameObjects.Image[] = [];
  private slotTexts: Phaser.GameObjects.BitmapText[] = [];
  private reloadBar!: Phaser.GameObjects.Graphics;
  private reloadLabel!: Phaser.GameObjects.BitmapText;
  private killsText!: Phaser.GameObjects.BitmapText;
  private notice!: Phaser.GameObjects.BitmapText;
  private zoneTitle!: Phaser.GameObjects.BitmapText;
  private noticeUntil = 0;
  private zoneUntil = 0;
  private magazineEmpty = false;
  private reloading = false;

  constructor() {
    super(SCENE.hud);
  }

  create(): void {
    this.texts = [];
    this.pips = [];
    this.slotTexts = [];
    this.noticeUntil = 0;
    this.zoneUntil = 0;
    this.magazineEmpty = false;
    this.reloading = false;

    this.buildLetterbox();
    this.buildHealth();
    this.buildKills();
    this.buildWeaponPanel();
    this.buildMessages();

    const bus = this.registry.get(BUS_KEY) as EventBus<GameEvents>;
    const off = [
      bus.on('health', (e) => this.showHealth(e.current, e.max)),
      bus.on('ammo', (e) => this.showAmmo(e.magazine, e.magazineSize, e.reserve)),
      bus.on('reload', (e) => this.showReload(e.progress)),
      bus.on('weapon', (e) => this.showWeapon(e.name, e.icon, e.slot)),
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
    // Aviso intermitente mientras el cargador esté vacío.
    const prompt = this.magazineEmpty && !this.reloading;
    this.reloadLabel.setVisible(this.reloading || (prompt && Math.floor(time / 350) % 2 === 0));
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

  private buildWeaponPanel(): void {
    const panel = this.add.graphics();
    panel.fillStyle(colorNumber('outline'), 1).fillRect(PANEL_X, PANEL_Y, PANEL.width, PANEL.height);
    panel.fillStyle(colorNumber('conc4'), 1).fillRect(PANEL_X + 1, PANEL_Y + 1, PANEL.width - 2, PANEL.height - 2);
    panel.fillStyle(colorNumber('shadow'), 1).fillRect(PANEL_X + 2, PANEL_Y + 2, PANEL.width - 4, PANEL.height - 4);

    this.weaponIcon = this.add.image(PANEL_X + 5, PANEL_Y + 5, ATLAS_KEY, 'ui/pistol').setOrigin(0, 0);
    this.weaponName = this.text(PANEL_X + 30, PANEL_Y + 5, '');
    this.ammoText = this.text(PANEL_X + PANEL.width - 5, PANEL_Y + 5, '', 1).setOrigin(1, 0);

    for (let i = 0; i < MAX_PIPS; i++) {
      this.pips.push(this.add.image(PANEL_X + 30 + i * 4, PANEL_Y + 13, ATLAS_KEY, 'ui/round').setOrigin(0, 0));
    }
    for (let i = 0; i < WEAPON_SLOTS; i++) {
      this.slotTexts.push(this.text(PANEL_X + 6 + i * 6, PANEL_Y + 24, String(i + 1)));
    }
    this.reloadBar = this.add.graphics();
    this.reloadLabel = this.text(PANEL_X + 30, PANEL_Y + 24, 'R: RECARGAR').setVisible(false);
  }

  private buildMessages(): void {
    this.zoneTitle = this.text(GAME_WIDTH / 2, 26, '', 2).setOrigin(0.5, 0).setVisible(false);
    this.notice = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 58, '')
      .setOrigin(0.5, 0)
      .setTint(colorNumber('light2'))
      .setVisible(false);
    const hint = this.text(
      MARGIN,
      GAME_HEIGHT - MARGIN - 5,
      'A/D MOVER  SHIFT CORRER  ESPACIO SALTAR  CLIC DISPARAR  R RECARGAR  ESC PAUSA',
    );
    this.time.delayedCall(14000, () => hint.setVisible(false));
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

  private showAmmo(magazine: number, magazineSize: number, reserve: number): void {
    this.magazineEmpty = magazine === 0;
    this.ammoText.setText(`${magazine}/${reserve}`);
    this.ammoText.setTint(magazine === 0 ? colorNumber('blood1') : 0xffffff);
    this.pips.forEach((pip, i) => {
      pip.setVisible(i < Math.min(magazineSize, MAX_PIPS));
      pip.setFrame(i < magazine ? 'ui/round' : 'ui/round-empty');
    });
  }

  private showReload(progress: number | null): void {
    this.reloading = progress !== null;
    this.reloadLabel.setText(this.reloading ? 'RECARGANDO' : 'R: RECARGAR');
    this.reloadLabel.setTint(this.reloading ? colorNumber('light2') : colorNumber('blood1'));
    const g = this.reloadBar.clear();
    if (progress === null) return;
    const x = PANEL_X + 76;
    const y = PANEL_Y + 25;
    const width = 30;
    g.fillStyle(colorNumber('outline'), 1).fillRect(x - 1, y - 1, width + 2, 5);
    g.fillStyle(colorNumber('asph4'), 1).fillRect(x, y, width, 3);
    g.fillStyle(colorNumber('light2'), 1).fillRect(x, y, Math.round(width * progress), 3);
  }

  private showWeapon(name: string, icon: string, slot: number): void {
    this.weaponName.setText(name);
    this.weaponIcon.setFrame(icon);
    this.slotTexts.forEach((text, i) => text.setTint(i === slot ? colorNumber('light2') : colorNumber('grey3')));
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
