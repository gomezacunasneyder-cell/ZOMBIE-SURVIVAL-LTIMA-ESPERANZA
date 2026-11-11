import Phaser from 'phaser';
import type { WalkerVariant } from '../../art/painters/zombies';
import type { WalkerDef } from '../../content/enemies';
import { WalkerBrain, type WalkerState } from '../../core/ai/WalkerBrain';
import { Health } from '../../core/combat/Health';
import { ATLAS_KEY } from '../boot/registerArt';
import { DEPTH } from '../world/depths';

const BODY = { width: 10, height: 24, offsetX: 11, offsetY: 7 };
/** Tiempo que el cadáver permanece antes de desvanecerse. */
const CORPSE_MS = 6000;

export interface ZombieTarget {
  x: number;
  centerY: number;
  alive: boolean;
}

/**
 * Caminante: cuerpo con física dirigido por `WalkerBrain`. El cerebro
 * decide (deambular, perseguir, atacar); esta clase mueve y anima.
 */
export class Zombie extends Phaser.Physics.Arcade.Sprite {
  readonly brain: WalkerBrain;
  readonly health: Health;
  private readonly shadow: Phaser.GameObjects.Image;
  private shownState: WalkerState | 'idle' | null = null;
  private flashUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    readonly variant: WalkerVariant,
    readonly def: WalkerDef,
    random: () => number,
  ) {
    super(scene, x, groundY, ATLAS_KEY, `walker/${variant}/walk/0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(DEPTH.zombie + random() * 0.4);

    const body = this.arcadeBody;
    body.setSize(BODY.width, BODY.height).setOffset(BODY.offsetX, BODY.offsetY);
    body.setCollideWorldBounds(true);
    // Alex no puede empujar a un zombi; el zombi sí puede empujarlo a él.
    body.pushable = false;

    this.brain = new WalkerBrain(def, x, random);
    this.health = new Health(def.maxHealth);
    this.shadow = scene.add.image(x, groundY + 1, ATLAS_KEY, 'fx/shadow').setAlpha(0.4).setDepth(DEPTH.zombie - 0.2);
  }

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get alive(): boolean {
    return !this.health.dead;
  }

  /**
   * Avanza un fotograma. Devuelve `true` si en este instante descarga un
   * golpe que alcanza al objetivo.
   */
  step(now: number, target: ZombieTarget): boolean {
    if (!this.alive) return false;
    const body = this.arcadeBody;
    const dx = target.x - this.x;
    const dy = target.centerY - body.center.y;
    const intent = this.brain.update({ now, selfX: this.x, dx, dy, playerAlive: target.alive });
    const state = this.brain.state;

    if (state === 'stagger') {
      // Conserva el empujón del impacto, que se va frenando.
      body.setVelocityX(body.velocity.x * 0.86);
    } else {
      body.setVelocityX(intent.move * intent.speed);
      // Trepa los obstáculos bajos que le cierran el paso.
      const blocked = intent.move < 0 ? body.blocked.left : intent.move > 0 ? body.blocked.right : false;
      if (blocked && body.blocked.down && state === 'chase') body.setVelocityY(-this.def.hopSpeed);
    }

    this.setFlipX(intent.facing === -1);
    this.showState(state, intent.move !== 0);
    if (this.isTinted && now >= this.flashUntil) this.clearTint();

    return intent.strike && Math.abs(dx) <= this.def.attackReach && Math.abs(dy) <= 28;
  }

  private showState(state: WalkerState, moving: boolean): void {
    const shown: WalkerState | 'idle' = (state === 'wander' || state === 'chase') && !moving ? 'idle' : state;
    if (shown === this.shownState) return;
    this.shownState = shown;
    const prefix = `walker/${this.variant}`;
    switch (shown) {
      case 'wander':
      case 'chase':
        this.anims.play(`${prefix}/walk`, true);
        break;
      case 'windup':
        this.anims.play(`${prefix}/attack`);
        break;
      case 'stagger':
        this.anims.play(`${prefix}/hurt`);
        break;
      case 'idle':
      case 'recover':
        this.anims.stop();
        this.setFrame(`${prefix}/walk/0`);
        break;
      case 'dead':
        break;
    }
  }

  /** Recibe un disparo. Devuelve `true` si lo mata. */
  hit(damage: number, pushX: number, now: number): boolean {
    if (!this.health.damage(damage, now)) return false;
    this.setTintFill(0xffffff);
    this.flashUntil = now + 60;

    if (this.health.dead) {
      this.die();
      return true;
    }
    this.brain.onHit(now);
    this.arcadeBody.setVelocityX(pushX);
    return false;
  }

  private die(): void {
    this.brain.kill();
    this.shownState = 'dead';
    this.arcadeBody.enable = false;
    this.setVelocity(0, 0);
    this.setDepth(DEPTH.corpse);
    this.anims.play(`walker/${this.variant}/die`);
    this.scene.time.delayedCall(80, () => this.clearTint());
    this.scene.time.delayedCall(CORPSE_MS, () => {
      this.scene.tweens.add({
        targets: [this, this.shadow],
        alpha: 0,
        duration: 900,
        onComplete: () => this.destroy(),
      });
    });
  }

  /** Mantiene la sombra bajo los pies. Se llama después de la física. */
  syncShadow(groundY: number): void {
    this.shadow.setPosition(this.x, groundY + 1).setVisible(this.alive);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
