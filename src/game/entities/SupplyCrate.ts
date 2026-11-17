import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { CRATE_FALL, RARITY_COLOR } from '../../content/supplies';
import { crateFall, type ChuteState } from '../../core/supply/airdrop';
import type { CrateLoot, LootItem } from '../../core/supply/loot';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { FxSystem } from '../systems/FxSystem';
import type { Light, LightingSystem } from '../systems/LightingSystem';
import { DEPTH } from '../world/depths';

export type CrateState = 'falling' | 'landed' | 'opened';

/** Alto del dibujo de la caja cerrada. */
const CRATE_HEIGHT = 15;
/** Lo que dura la bengala encendida antes de apagarse poco a poco. */
const FLARE_FADE_MS = 1400;

/**
 * Una caja de suministros: cae en paracaídas desde el helicóptero, golpea
 * el suelo levantando polvo, se queda con una baliza del color de su
 * rareza y se abre manteniendo E. Si algo no le cabe a Alex, la caja lo
 * guarda y se puede volver a abrir.
 */
export class SupplyCrate {
  state: CrateState = 'falling';
  /** Lo que queda dentro. */
  items: LootItem[];
  readonly rarity: CrateLoot['rarity'];
  private readonly crate: Phaser.GameObjects.Image;
  private readonly chute: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly marker: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly light: Light;
  private readonly releasedAt: number;
  private chuteState: ChuteState = 'none';
  private landedAt = 0;
  private openedAt = 0;
  y: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lighting: LightingSystem,
    private readonly fx: FxSystem,
    readonly x: number,
    private readonly startY: number,
    private readonly groundY: number,
    loot: CrateLoot,
    now: number,
  ) {
    this.items = [...loot.items];
    this.rarity = loot.rarity;
    this.releasedAt = now;
    this.y = startY;
    const color = colorNumber(RARITY_COLOR[loot.rarity]);
    this.crate = scene.add.image(x, startY, ATLAS_KEY, 'supply/crate').setOrigin(0.5, 1).setDepth(DEPTH.helicopter - 1);
    this.chute = scene.add.sprite(x, startY, ATLAS_KEY, 'supply/chute-deploy').setOrigin(0.5, 1).setDepth(DEPTH.helicopter - 1.1).setVisible(false);
    this.shadow = scene.add.image(x, groundY + 1, ATLAS_KEY, 'fx/shadow').setAlpha(0).setDepth(DEPTH.groundShadow);
    this.marker = scene.add.image(x, groundY - 26, ATLAS_KEY, 'ui/pickup').setDepth(DEPTH.fx).setVisible(false);
    this.bar = scene.add.graphics().setDepth(DEPTH.fx + 0.1);
    // Baliza de la caja: brilla del color de su rareza, también mientras cae.
    this.glow = lighting.addGlow(MASK.radialSmall, x, startY, color, 0.55);
    this.light = lighting.addLight(MASK.radialMedium, x, startY, { intensity: 0.75, flicker: 0.15 });
  }

  /** Avanza la caída. Devuelve `true` en el instante en que toca el suelo. */
  update(now: number): boolean {
    if (this.state === 'falling') return this.fall(now);
    if (this.state === 'landed') this.pulse(now);
    if (this.state === 'opened') this.fadeFlare(now);
    return false;
  }

  private fall(now: number): boolean {
    const pose = crateFall(now - this.releasedAt, this.startY, this.groundY + 1, CRATE_FALL);
    const x = this.x + pose.sway;
    this.y = pose.y;
    this.crate.setPosition(x, pose.y);
    this.glow.setPosition(x, pose.y - CRATE_HEIGHT + 2);
    this.light.x = x;
    this.light.y = pose.y - 8;
    // La sombra se marca más a medida que la caja se acerca al suelo.
    const height = this.groundY - pose.y;
    this.shadow.setAlpha(Math.max(0, 0.4 - height / 400));

    if (pose.chute !== this.chuteState) {
      if (pose.chute === 'deploying') {
        this.chute.setVisible(true).setFrame('supply/chute-deploy');
        playSfxAt(this.scene, SFX.chute, this.x, 0.5);
      } else if (pose.chute === 'open') this.chute.play('supply/chute');
      this.chuteState = pose.chute;
    }
    // El gancho del paracaídas queda sobre la tapa de la caja.
    this.chute.setPosition(Math.round(this.x + pose.sway * 2), Math.round(pose.y - CRATE_HEIGHT + 1));
    if (pose.chute !== 'landed') return false;
    this.land(now);
    return true;
  }

  private land(now: number): void {
    this.state = 'landed';
    this.landedAt = now;
    this.y = this.groundY + 1;
    this.crate.setPosition(this.x, this.y).setDepth(this.y);
    this.shadow.setAlpha(0.45);
    this.fx.dustPuff(this.x - 6, this.groundY, 7);
    this.fx.dustPuff(this.x + 6, this.groundY, 7);
    playSfxAt(this.scene, SFX.crateLand, this.x, 0.8, 700);
    playSfxAt(this.scene, SFX.flare, this.x, 0.35);
    // El paracaídas se desinfla y cae a un lado; al rato desaparece.
    this.chute.stop();
    this.chute.setOrigin(0.5, 1).setPosition(this.x, this.groundY + 1).setDepth(this.y - 0.5);
    this.chute.play('supply/chute-collapse');
    this.scene.tweens.add({ targets: this.chute, alpha: 0, delay: 6000, duration: 1200, onComplete: () => this.chute.destroy() });
    this.marker.setVisible(true);
    this.scene.tweens.add({ targets: this.marker, y: this.marker.y - 3, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  }

  /** La baliza late en escalones, para leerse de lejos. */
  private pulse(now: number): void {
    const beat = Math.floor(((now - this.landedAt) % 900) / 225);
    const alpha = [0.65, 0.45, 0.3, 0.45][beat] ?? 0.45;
    this.glow.setAlpha(alpha);
    this.light.power = 0.7 + alpha * 0.4;
  }

  private fadeFlare(now: number): void {
    const k = Math.max(0, 1 - (now - this.openedAt) / FLARE_FADE_MS);
    this.glow.setAlpha(0.5 * k);
    this.light.power = k;
    if (k === 0) this.light.enabled = false;
  }

  /** Dibuja el progreso de apertura sobre la caja (`null` lo oculta). */
  showProgress(progress: number | null): void {
    const g = this.bar.clear();
    if (progress === null) return;
    const width = 16;
    const left = Math.round(this.x - width / 2);
    const top = this.groundY - 44;
    g.fillStyle(colorNumber('outline'), 1).fillRect(left - 1, top - 1, width + 2, 4);
    g.fillStyle(colorNumber('ui1'), 1).fillRect(left, top, Math.round(width * progress), 2);
  }

  /** Abre la caja y se queda con lo que no se ha podido llevar Alex. */
  open(now: number, leftovers: LootItem[]): void {
    this.items = leftovers;
    this.showProgress(null);
    playSfxAt(this.scene, SFX.crateOpen, this.x, 0.6);
    this.fx.dustPuff(this.x, this.groundY - 10, 4);
    if (leftovers.length > 0) return;
    this.state = 'opened';
    this.openedAt = now;
    this.crate.setFrame('supply/crate-open');
    this.scene.tweens.killTweensOf(this.marker);
    this.marker.destroy();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.marker, this.chute]);
    for (const part of [this.crate, this.chute, this.shadow, this.marker, this.bar, this.glow]) part.destroy();
    this.lighting.removeLight(this.light);
  }
}
