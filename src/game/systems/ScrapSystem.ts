import type Phaser from 'phaser';
import { SCRAP_VARIANTS } from '../../art/throwArt';
import type { EnemyKind } from '../../content/enemies';
import { SCRAP, SCRAP_DROPS } from '../../content/scrap';
import { rollScrap, splitScrap } from '../../core/economy/Scrap';
import type { Rng } from '../../core/math/Rng';
import { ATLAS_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import type { Player } from '../entities/Player';

interface Pile {
  sprite: Phaser.GameObjects.Image;
  amount: number;
  droppedAt: number;
}

/** Montoncitos a la vez en el suelo como mucho (en las hordas mueren decenas). */
const MAX_PILES = 40;
/** Velocidad a la que vuelan hacia Alex al acercarse, en px/s. */
const MAGNET_SPEED = 140;

/**
 * Piezas en el suelo: los enemigos las sueltan al morir en uno a tres
 * montoncitos que saltan un poco y caen. Alex las recoge al pasar cerca
 * (desde un poco más lejos, vuelan hacia él). Si nadie las recoge, al
 * rato se pierden.
 */
export class ScrapSystem {
  private readonly piles: Pile[] = [];
  private dropped = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
    private readonly groundY: number,
  ) {}

  get onGround(): number {
    return this.piles.length;
  }

  /** Piezas soltadas desde el inicio (para pruebas). */
  get totalDropped(): number {
    return this.dropped;
  }

  /** Un enemigo muere: quizá suelta piezas. Devuelve cuántas. */
  dropFrom(kind: EnemyKind, x: number, now: number): number {
    const amount = rollScrap(this.rng, SCRAP_DROPS[kind]);
    this.drop(x, amount, now);
    return amount;
  }

  /** Deja `amount` piezas en el suelo junto a `x`. */
  drop(x: number, amount: number, now: number): void {
    if (amount <= 0) return;
    this.dropped += amount;
    for (const [i, part] of splitScrap(amount, SCRAP.maxPiles).entries()) {
      if (this.piles.length >= MAX_PILES) this.expire(0);
      const restX = Math.round(x + (i - 1) * 6 + this.rng.int(-2, 2));
      const sprite = this.scene.add
        .image(Math.round(x), this.groundY - 10, ATLAS_KEY, `pickup/scrap/${this.rng.int(0, SCRAP_VARIANTS - 1)}`)
        .setOrigin(0.5, 1)
        .setDepth(this.groundY + 1.5);
      // Saltan del cadáver y caen al asfalto en escalones de píxel.
      this.scene.tweens.add({ targets: sprite, x: restX, duration: 260, ease: 'Linear' });
      this.scene.tweens.add({ targets: sprite, y: this.groundY + 2, duration: 260, ease: 'Bounce.easeOut' });
      this.piles.push({ sprite, amount: part, droppedAt: now });
    }
  }

  update(now: number, deltaMs: number, player: Player): void {
    const dt = deltaMs / 1000;
    for (let i = this.piles.length - 1; i >= 0; i--) {
      const pile = this.piles[i] as Pile;
      const age = now - pile.droppedAt;
      if (age > SCRAP.lifetimeMs) {
        this.expire(i);
        continue;
      }
      // Los últimos tres segundos parpadean antes de perderse.
      pile.sprite.setVisible(age < SCRAP.lifetimeMs - 3000 || Math.floor(now / 120) % 2 === 0);
      if (!player.alive || age < 300) continue;
      const distance = Math.abs(player.x - pile.sprite.x);
      if (distance <= SCRAP.reach) {
        player.addScrap(pile.amount);
        playSfx(this.scene, SFX.scrap, 0.35, 150);
        this.expire(i);
      } else if (distance <= SCRAP.magnet) {
        pile.sprite.x = Math.round(pile.sprite.x + Math.sign(player.x - pile.sprite.x) * MAGNET_SPEED * dt);
      }
    }
  }

  private expire(index: number): void {
    const pile = this.piles[index];
    if (!pile) return;
    this.scene.tweens.killTweensOf(pile.sprite);
    pile.sprite.destroy();
    this.piles.splice(index, 1);
  }
}
