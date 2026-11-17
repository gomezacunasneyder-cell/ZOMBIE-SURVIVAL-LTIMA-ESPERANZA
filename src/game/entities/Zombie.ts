import Phaser from 'phaser';
import { enemyAnimation } from '../../art/enemyArt';
import { colorNumber } from '../../art/palette';
import type { EnemyDef } from '../../content/enemies';
import { EnemyBrain, type EnemyState } from '../../core/ai/EnemyBrain';
import type { HeardNoise } from '../../core/ai/noise';
import { Health } from '../../core/combat/Health';
import { ATLAS_KEY } from '../boot/registerArt';
import type { BarricadeHandle } from '../world/LevelBuilder';
import { DEPTH } from '../world/depths';

/** Tiempo que el cadáver permanece antes de desvanecerse. */
const CORPSE_MS = 6000;
/** Tinte de un enemigo alcanzado por las llamas. */
const FIRE_TINT = colorNumber('org1');
/** Diferencia de altura máxima para que un golpe alcance. */
const STRIKE_HEIGHT = 28;

export interface ZombieTarget {
  x: number;
  centerY: number;
  alive: boolean;
}

/** Lo que el mundo le cuenta a un enemigo cada fotograma. */
export interface ZombieSenses {
  noise: HeardNoise | null;
  /** Barricada pegada a él en la dirección `facing`, si la hay. */
  barricadeAhead(x: number, facing: 1 | -1, reach: number): BarricadeHandle | null;
}

/** Lo que ha pasado en este fotograma y la escena tiene que resolver. */
export interface StepResult {
  /** Descarga un golpe que alcanza a Alex. */
  hit: boolean;
  /** Descarga un golpe (alcance o no): para el sonido y la sacudida. */
  swung: boolean;
  smashed: BarricadeHandle | null;
  clicked: boolean;
  leaped: boolean;
}

const NOTHING: StepResult = { hit: false, swung: false, smashed: null, clicked: false, leaped: false };

/**
 * Enemigo: cuerpo con física dirigido por `EnemyBrain`. El cerebro decide
 * (deambular, investigar, perseguir, rodear, atacar, romper); esta clase
 * mueve, anima y avisa a la escena. Sirve para los cuatro tipos: lo que
 * cambia son los datos (`EnemyDef`) y el juego de animaciones.
 */
export class Zombie extends Phaser.Physics.Arcade.Sprite {
  brain: EnemyBrain;
  health: Health;
  /** Tiempo que dura el cadáver; en las hordas se acorta. */
  corpseMs = CORPSE_MS;
  private recycler: ((zombie: Zombie) => void) | null = null;
  private readonly shadow: Phaser.GameObjects.Image;
  private shownState: EnemyState | 'idle' | null = null;
  private flashUntil = 0;
  private faced: 1 | -1 = -1;
  /** Huye hacia un lado (llega EL DEVORADOR); 0 = no huye. */
  fleeing: -1 | 0 | 1 = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    readonly def: EnemyDef,
    private variantName: string,
    random: () => number,
  ) {
    super(scene, x, groundY, ATLAS_KEY, `${def.art}/${variantName}/walk/0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(DEPTH.zombie + random() * 0.4);

    // Caja de colisión centrada y apoyada en los pies, sea cual sea el lienzo.
    const body = this.arcadeBody;
    body
      .setSize(def.body.width, def.body.height)
      .setOffset((def.frame.width - def.body.width) / 2, def.frame.height - 1 - def.body.height);
    body.setCollideWorldBounds(true);
    // Alex no puede empujar a un enemigo; el enemigo sí puede empujarlo a él.
    body.pushable = false;

    this.brain = new EnemyBrain(def, x, random);
    this.health = new Health(def.maxHealth);
    const shadow = def.id === 'mutant' ? 'fx/ground-shadow/30' : 'fx/shadow';
    this.shadow = scene.add.image(x, groundY + 1, ATLAS_KEY, shadow).setAlpha(0.4).setDepth(DEPTH.zombie - 0.2);
  }

  private get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get alive(): boolean {
    return !this.health.dead;
  }

  get variant(): string {
    return this.variantName;
  }

  get kind(): string {
    return this.def.id;
  }

  private anim(action: string): string {
    return enemyAnimation(this.def.art, this.variant, action);
  }

  /** Avanza un fotograma y devuelve lo que la escena debe resolver. */
  step(now: number, target: ZombieTarget, senses: ZombieSenses): StepResult {
    if (!this.alive) return NOTHING;
    const body = this.arcadeBody;
    if (this.fleeing !== 0) {
      // Despavorido: corre hacia el borde sin hacer caso a nada.
      body.setVelocityX(this.fleeing * this.def.chaseSpeed * 1.8);
      // Salta lo que le corte el paso (bidones, coches).
      const stuck = this.fleeing < 0 ? body.blocked.left : body.blocked.right;
      if (stuck && body.blocked.down) body.setVelocityY(-Math.max(this.def.hopSpeed, 220));
      this.setFlipX(this.fleeing === -1);
      this.anims.play(this.anim('walk'), true);
      this.anims.timeScale = 1.5;
      this.shownState = null;
      return NOTHING;
    }
    const dx = target.x - this.x;
    const dy = target.centerY - body.center.y;

    // Qué le cierra el paso hacia donde mira.
    const blockedSide = this.faced < 0 ? body.blocked.left : body.blocked.right;
    const barricade = senses.barricadeAhead(this.x, this.faced, this.def.body.width / 2 + 4);
    const blocked = barricade ? 'breakable' : blockedSide ? 'solid' : null;

    const intent = this.brain.update({
      now,
      selfX: this.x,
      dx,
      dy,
      playerAlive: target.alive,
      noise: senses.noise,
      blocked,
      onGround: body.blocked.down,
    });
    const state = this.brain.state;
    this.faced = intent.facing;

    if (intent.leap) body.setVelocity(intent.leap.vx, intent.leap.vy);
    else if (state === 'stagger') body.setVelocityX(body.velocity.x * 0.86);
    else {
      body.setVelocityX(intent.move * intent.speed);
      // Trepa los obstáculos bajos; el que rompe barricadas no las salta: las derriba.
      const climbing = intent.move !== 0 && blockedSide && body.blocked.down && this.def.hopSpeed > 0 && !(barricade && this.def.breaker);
      if (climbing && (state === 'chase' || state === 'investigate')) body.setVelocityY(-this.def.hopSpeed);
    }

    this.setFlipX(intent.facing === -1);
    this.showState(state, intent.move !== 0, intent.click || intent.smash || intent.strike);
    if (this.isTinted && now >= this.flashUntil) this.clearTint();

    const reaches = Math.abs(dx) <= this.def.attack.reach && Math.abs(dy) <= STRIKE_HEIGHT;
    return {
      hit: intent.strike && reaches && target.alive,
      swung: intent.strike,
      smashed: intent.smash ? barricade : null,
      clicked: intent.click,
      leaped: intent.leap !== null,
    };
  }

  private showState(state: EnemyState, moving: boolean, pulse: boolean): void {
    const calm = state === 'wander' || state === 'investigate' || state === 'chase';
    const shown: EnemyState | 'idle' = calm && !moving ? 'idle' : state;
    // Las acciones puntuales (chasquido, mazazo) se repiten aunque el estado no cambie.
    if (shown === this.shownState && !pulse) return;
    this.shownState = shown;
    switch (shown) {
      case 'wander':
      case 'investigate':
      case 'chase':
        this.anims.play(this.anim('walk'), true);
        // Al deambular van más despacio que al perseguir: también la animación.
        this.anims.timeScale = shown === 'chase' ? 1 : 0.7;
        break;
      case 'windup':
      case 'smash':
        if (pulse || shown === 'windup') this.anims.play(this.anim('attack'));
        break;
      case 'flank':
        this.anims.play(this.anim('leap'));
        break;
      case 'listen':
        // El Chasqueador chasquea; los demás se quedan mirando alrededor.
        if (this.def.echo) {
          if (pulse) this.anims.play(this.anim('click'));
        } else {
          this.anims.stop();
          this.setFrame(`${this.anim('walk')}/0`);
        }
        break;
      case 'stagger':
        this.anims.play(this.anim('hurt'));
        break;
      case 'idle':
      case 'recover':
        this.anims.stop();
        this.setFrame(`${this.anim('walk')}/0`);
        break;
      case 'dead':
        break;
    }
  }

  /**
   * Recibe un disparo desde `fromX`. Devuelve `true` si lo mata. El fuego
   * no da el destello blanco de impacto: tiñe al enemigo del color de las llamas.
   */
  hit(damage: number, pushX: number, now: number, fromX?: number, fire = false): boolean {
    if (!this.health.damage(damage, now)) return false;
    if (fire) this.setTint(FIRE_TINT);
    else this.setTintFill(0xffffff);
    this.flashUntil = now + (fire ? 140 : 60);

    if (this.health.dead) {
      this.die();
      return true;
    }
    const before = this.brain.state;
    this.brain.onHit(now, damage, fromX);
    // Los pesados apenas se mueven con las balas.
    if (this.brain.state === 'stagger' || before !== 'stagger') {
      this.arcadeBody.setVelocityX(pushX * this.def.knockbackTaken);
    }
    return false;
  }

  private die(): void {
    this.brain.kill();
    this.shownState = 'dead';
    this.arcadeBody.enable = false;
    this.setVelocity(0, 0);
    this.setDepth(DEPTH.corpse);
    this.anims.timeScale = 1;
    this.anims.play(this.anim('die'));
    // Los temporizadores pueden llegar con el cadáver ya retirado (al limpiar
    // la calle en las pruebas): sin esta comprobación, el error detendría el juego.
    this.scene.time.delayedCall(80, () => this.active && this.clearTint());
    this.scene.time.delayedCall(this.corpseMs, () => {
      if (!this.active) return;
      this.scene.tweens.add({
        targets: [this, this.shadow],
        alpha: 0,
        duration: 900,
        onComplete: () => (this.recycler ? this.retire() : this.destroy()),
      });
    });
  }

  /**
   * Reutilización: en vez de destruirse, el cadáver ya desvanecido vuelve
   * al depósito del director. Así una horda de cientos de zombis no crea
   * cientos de objetos ni carga al recolector de basura.
   */
  setRecycler(recycler: (zombie: Zombie) => void): void {
    this.recycler = recycler;
  }

  /** Guarda en el depósito un enemigo recién creado sin llegar a jugar (precalentado). */
  stash(): void {
    this.health.damage(this.health.max, 0);
    this.brain.kill();
    this.retire();
  }

  private retire(): void {
    this.setActive(false).setVisible(false);
    this.shadow.setVisible(false);
    this.arcadeBody.enable = false;
    this.recycler?.(this);
  }

  /** Vuelve a la vida un enemigo del depósito, como recién creado. */
  revive(x: number, groundY: number, variant: string, random: () => number): void {
    this.variantName = variant;
    this.brain = new EnemyBrain(this.def, x, random);
    this.health = new Health(this.def.maxHealth);
    this.shownState = null;
    this.flashUntil = 0;
    this.faced = -1;
    this.fleeing = 0;
    this.corpseMs = CORPSE_MS;
    this.setActive(true).setVisible(true).setAlpha(1).clearTint().setFlipX(false);
    this.setDepth(DEPTH.zombie + random() * 0.4);
    this.anims.stop();
    this.anims.timeScale = 1;
    this.setFrame(`${this.anim('walk')}/0`);
    this.arcadeBody.enable = true;
    this.arcadeBody.reset(x, groundY);
    this.shadow.setAlpha(0.4).setVisible(true).setPosition(x, groundY + 1);
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
