import Phaser from 'phaser';
import { skinAnimation, type BodyAnimation, type PlayerSkin } from '../../art/skins';
import { MEDKIT, MEDKIT_WALK_FACTOR, STARTING_MEDKITS, type PlayerTuning } from '../../content/player';
import type { WeaponDef } from '../../content/weapons';
import { aimDegreesTowards, snapAimAngle, type AimAngle } from '../../core/combat/aim';
import type { Resupply } from '../../core/combat/Arsenal';
import { Health } from '../../core/combat/Health';
import { Medkits } from '../../core/combat/Medkits';
import { Throwables } from '../../core/combat/Throwables';
import { ScrapWallet } from '../../core/economy/Scrap';
import { THROWABLES, THROW_COOLDOWN_MS } from '../../content/throwables';
import type { WeaponState } from '../../core/combat/WeaponState';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { movementNoise } from '../../core/ai/noise';
import { JumpController, stepHorizontalVelocity } from '../../core/player/motion';
import { ATLAS_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import type { InputFrame } from '../input/PlayerInput';
import { DEPTH } from '../world/depths';
import { AimRig, type Point } from './AimRig';
import { WeaponHandler, type ShotRequest } from './WeaponHandler';

export type { ShotRequest };

/**
 * Caja de colisión, siempre la misma sea cual sea el aspecto: 10×24 px,
 * centrada y apoyada en los pies. Su desplazamiento dentro del fotograma
 * se calcula a partir del tamaño de este, de modo que cambiar el dibujo
 * no mueve la colisión ni un píxel.
 */
const BODY = { width: 10, height: 24 };
/** Duración de la pose de aterrizaje. */
const LAND_MS = 190;
/** Tiempo mínimo en el aire para que la llegada al suelo cuente como aterrizaje. */
const MIN_AIR_MS = 120;

/**
 * Alex jugable: cuerpo con física de Arcade gobernado por las reglas puras
 * de `core/` (movimiento, salto, vida y arma). Esta clase solo traduce
 * decisiones a velocidades, animaciones y eventos.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly health: Health;
  readonly medkits = new Medkits(MEDKIT, STARTING_MEDKITS);
  readonly throwables: Throwables;
  readonly scrap = new ScrapWallet();
  facing: 1 | -1 = 1;

  private readonly rig: AimRig;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly jump: JumpController;
  private readonly arms: WeaponHandler;
  private aim: AimAngle = 0;
  private aimFree = 0;
  private hurtUntil = 0;
  // Falso al aparecer: el asentamiento inicial no cuenta como aterrizaje.
  private wasOnGround = false;
  private landUntil = 0;
  private stepCount = 0;
  /** Últimas animaciones mostradas, en orden (para pruebas). */
  readonly recent: string[] = [];
  private leftGroundAt = Infinity;
  /** Se pone a verdadero en el fotograma en que aterriza; la escena lo consume. */
  landed = false;
  /** Radio del ruido que hace al moverse en este fotograma (0 = en silencio). */
  movementNoise = 0;
  sneaking = false;
  private lastMedkitProgress: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    groundY: number,
    private readonly bus: EventBus<GameEvents>,
    private readonly tuning: PlayerTuning,
    readonly skin: PlayerSkin,
    loadout?: readonly (WeaponDef | null)[],
    throwables: Readonly<Record<string, number>> = {},
  ) {
    this.throwables = new Throwables(THROWABLES, THROW_COOLDOWN_MS, throwables);
    this.health = new Health(tuning.maxHealth, tuning.invulnerableMs);
    this.jump = new JumpController(tuning);
    this.arms = new WeaponHandler(scene, bus, loadout);

    this.shadow = scene.add.image(x, groundY + 1, ATLAS_KEY, 'fx/shadow').setAlpha(0.4).setDepth(DEPTH.player - 0.2);
    this.sprite = scene.physics.add
      .sprite(x, groundY, ATLAS_KEY, `${this.anim('idle')}/0`)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.player);
    const body = this.body;
    const frame = this.sprite.frame;
    body
      .setSize(BODY.width, BODY.height)
      .setOffset((frame.width - BODY.width) / 2, frame.height - 1 - BODY.height);
    body.setCollideWorldBounds(true);
    this.rig = new AimRig(scene, this.sprite, DEPTH.player, skin);
    this.sprite.play(this.anim('idle'));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimationFrame, this);
  }

  /** Pasos: suenan cuando un pie toca el suelo, dos veces por ciclo. */
  private onAnimationFrame(animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (!this.alive || !this.onGround || frame.index % 4 !== 2) return;
    const running = animation.key === this.anim('run');
    if (!running && animation.key !== this.anim('walk') && animation.key !== this.anim('walk-back')) return;
    this.stepCount += 1;
    const volume = running ? 0.3 : this.sneaking ? 0.05 : 0.18;
    playSfx(this.scene, this.stepCount % 2 === 0 ? SFX.stepLeft : SFX.stepRight, volume, 180);
  }

  private anim(name: BodyAnimation): string {
    return skinAnimation(this.skin, name);
  }

  /** Fotograma actual del brazo (para pruebas). */
  get armFrame(): string {
    return this.rig.armFrame;
  }

  private get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  get alive(): boolean {
    return !this.health.dead;
  }

  get x(): number {
    return this.sprite.x;
  }

  /** Centro del cuerpo, para medir distancias con los enemigos. */
  get centerY(): number {
    return this.body.center.y;
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  get weapon(): WeaponState<WeaponDef> {
    return this.arms.weapon;
  }

  get weapons(): WeaponHandler {
    return this.arms;
  }

  get aimAngle(): AimAngle {
    return this.aim;
  }

  /** Ángulo libre hacia el cursor, por el que salen las balas. */
  get aimDegrees(): number {
    return this.aimFree;
  }

  /** Fotograma del fogonazo visible, o `null` (para pruebas). */
  get flashFrame(): string | null {
    return this.rig.flashFrame;
  }

  muzzle(): Point {
    return this.rig.muzzle(this.facing, this.aim);
  }

  /** Envía a la interfaz el estado inicial. */
  announce(): void {
    this.bus.emit('health', { current: this.health.current, max: this.health.max });
    this.arms.announce();
    this.emitMedkit();
    this.emitThrowables();
    this.bus.emit('scrap', { total: this.scrap.total, gained: 0 });
  }

  private emitThrowables(): void {
    this.bus.emit('throwables', {
      items: THROWABLES.map((def) => ({ id: def.id, name: def.name, icon: def.icon, count: this.throwables.count(def.id), max: def.max })),
    });
  }

  /** Recoge arrojadizos. Devuelve cuántos cupieron. */
  addThrowable(id: string, count: number): number {
    const added = this.throwables.add(id, count);
    if (added > 0) this.emitThrowables();
    return added;
  }

  /** Recoge piezas. Devuelve cuántas. */
  addScrap(amount: number): number {
    const added = this.scrap.add(amount);
    if (added > 0) this.bus.emit('scrap', { total: this.scrap.total, gained: added });
    return added;
  }

  /**
   * Intenta lanzar un arrojadizo. No se puede mientras se cura, cambia de
   * arma o está aturdido; lanzar interrumpe la recarga. Devuelve si salió.
   */
  tryThrow(id: string, now: number): boolean {
    if (!this.alive || this.medkits.using || now < this.hurtUntil || this.arms.isSwitching(now)) return false;
    const result = this.throwables.throw(id, now);
    if (result === 'none') {
      const def = THROWABLES.find((d) => d.id === id);
      this.bus.emit('notice', { text: `SIN ${def?.name ?? 'ARROJADIZOS'}` });
      return false;
    }
    if (result !== 'thrown') return false;
    this.arms.cancelReload();
    this.rig.nudge(now, { kickPx: 4, durationMs: 220 });
    this.emitThrowables();
    return true;
  }

  /** Hombro desde el que sale lo que lanza. */
  get throwOrigin(): Point {
    return this.rig.shoulder(this.facing);
  }

  private emitMedkit(): void {
    const progress = this.medkits.progress(this.scene.time.now);
    this.lastMedkitProgress = progress;
    this.bus.emit('medkit', { count: this.medkits.count, max: this.medkits.rules.max, progress });
  }

  /** Botiquín: Q empieza a usarlo; al terminar cura. Devuelve si está curándose. */
  private updateMedkit(now: number, pressed: boolean): boolean {
    if (pressed) {
      const result = this.medkits.start(now, this.health.max - this.health.current);
      if (result === 'started') {
        this.arms.cancelReload();
        playSfx(this.scene, SFX.medkit, 0.5, 60);
      } else if (result === 'none') this.bus.emit('notice', { text: 'SIN BOTIQUINES' });
      else if (result === 'full-health') this.bus.emit('notice', { text: 'VIDA AL MAXIMO' });
    }
    const healed = this.medkits.update(now);
    if (healed > 0) {
      const gained = this.health.heal(healed);
      this.bus.emit('health', { current: this.health.current, max: this.health.max });
      this.bus.emit('notice', { text: `VIDA +${Math.round(gained)}` });
      playSfx(this.scene, SFX.pickup, 0.4, 0);
    }
    const progress = this.medkits.progress(now);
    if (healed > 0 || (progress === null) !== (this.lastMedkitProgress === null) || (progress !== null && progress - (this.lastMedkitProgress ?? 0) >= 0.05)) {
      this.emitMedkit();
    }
    return this.medkits.using;
  }

  /** Recoge botiquines de una caja. Devuelve cuántos cupieron. */
  addMedkits(count: number): number {
    const added = this.medkits.add(count);
    if (added > 0) this.emitMedkit();
    return added;
  }

  /** Aplica las acciones del jugador. Devuelve un disparo si se ha producido. */
  update(now: number, deltaMs: number, input: InputFrame, aimPoint: Point): ShotRequest | null {
    const body = this.body;
    const dt = deltaMs / 1000;
    const onGround = this.onGround;
    // Solo cuenta como aterrizaje una caída de verdad, no el asentarse al aparecer.
    if (!onGround && this.wasOnGround) this.leftGroundAt = now;
    this.landed = onGround && !this.wasOnGround && now - this.leftGroundAt > MIN_AIR_MS;
    this.wasOnGround = onGround;
    if (this.landed) this.landUntil = now + LAND_MS;

    if (!this.alive) {
      body.setVelocityX(stepHorizontalVelocity(body.velocity.x, { direction: 0, running: false, facing: this.facing, onGround }, dt, this.tuning));
      return null;
    }

    // Puntería: Alex mira hacia el lado del ratón, con un margen para no oscilar.
    if (Math.abs(aimPoint.x - this.sprite.x) > 3) this.facing = aimPoint.x < this.sprite.x ? -1 : 1;
    const pivot = this.rig.shoulder(this.facing);
    this.aimFree = aimDegreesTowards(pivot.x, pivot.y, aimPoint.x, aimPoint.y, this.facing);
    this.aim = snapAimAngle(this.aimFree);

    // Movimiento con aceleración; aturdido tras un golpe no responde.
    const stunned = now < this.hurtUntil;
    const direction = stunned ? 0 : input.direction;
    const healing = this.updateMedkit(now, input.medkitPressed);
    // Caminar en silencio: la misma física con la velocidad de sigilo.
    this.sneaking = input.sneak && onGround;
    let tuning = this.sneaking ? { ...this.tuning, walkSpeed: this.tuning.sneakSpeed } : this.tuning;
    // Curándose, Alex solo puede caminar despacio.
    if (healing) tuning = { ...tuning, walkSpeed: this.tuning.walkSpeed * MEDKIT_WALK_FACTOR, runSpeed: this.tuning.walkSpeed * MEDKIT_WALK_FACTOR };
    if (!stunned) {
      body.setVelocityX(
        stepHorizontalVelocity(body.velocity.x, { direction, running: input.run, facing: this.facing, onGround }, dt, tuning),
      );
    }
    const speed = Math.abs(body.velocity.x);
    this.movementNoise = movementNoise(speed, speed > this.tuning.walkSpeed + 12, this.sneaking, onGround);

    const decision = this.jump.update(now, onGround, input.jumpPressed && !stunned, input.jumpHeld, body.velocity.y);
    if (decision.jump) body.setVelocityY(-this.tuning.jumpSpeed);
    else if (decision.cut) body.setVelocityY(body.velocity.y * this.tuning.jumpCutFactor);

    const shot = this.updateWeapon(now, input, healing);
    this.updateAnimation(now, direction, onGround);
    return shot;
  }

  private updateWeapon(now: number, input: InputFrame, busy: boolean): ShotRequest | null {
    const shot = this.arms.update(now, input, {
      aim: this.aim,
      angle: this.aimFree,
      facing: this.facing,
      muzzle: this.muzzle(),
      shoulder: this.rig.shoulder(this.facing),
    }, busy);
    this.rig.setWeapon(this.weapon.def.id);
    if (!shot) return null;
    const recoil = shot.weapon.recoil;
    this.rig.fire(now, recoil);
    // El retroceso de las armas pesadas empuja a Alex hacia atrás.
    if (recoil.pushBack > 0) this.body.setVelocityX(this.body.velocity.x - this.facing * recoil.pushBack);
    return shot;
  }

  private updateAnimation(now: number, direction: number, onGround: boolean): void {
    const body = this.body;
    const speed = Math.abs(body.velocity.x);
    let name: BodyAnimation;
    if (now < this.hurtUntil) name = 'hurt';
    else if (!onGround) name = body.velocity.y < 0 ? 'jump' : 'fall';
    else if (this.skin.hasLanding && now < this.landUntil && speed < 24) name = 'land';
    else if (speed < 6) name = 'idle';
    else if (direction !== 0 && Math.sign(body.velocity.x) !== this.facing) name = 'walk-back';
    else name = speed > this.tuning.walkSpeed + 12 ? 'run' : 'walk';
    const key = this.anim(name);
    if (this.recent[this.recent.length - 1] !== key) {
      this.recent.push(key);
      if (this.recent.length > 12) this.recent.shift();
    }
    this.sprite.anims.play(key, true);
    // En sigilo el paso es más lento y cuidadoso.
    this.sprite.anims.timeScale = this.sneaking && name === 'walk' ? 0.55 : 1;
    this.sprite.setFlipX(this.facing === -1);
  }

  /**
   * Coloca las capas que dependen de la posición final del cuerpo (brazo,
   * fogonazo, sombra) y avisa a la interfaz de los cambios.
   */
  postUpdate(now: number, groundY: number): void {
    const progress = this.arms.sync(now, this.alive);
    this.rig.setWeapon(this.weapon.def.id);
    this.rig.sync(this.facing, this.aim, now, progress, this.alive && this.arms.isSwitching(now));
    this.shadow.setPosition(this.sprite.x, groundY + 1);
    // Parpadeo mientras dura la invulnerabilidad.
    const blinking = this.alive && this.health.isInvulnerable(now);
    this.sprite.setAlpha(blinking && Math.floor(now / 70) % 2 === 0 ? 0.45 : 1);

  }

  /** Recibe un golpe desde `fromX`. Devuelve `true` si hizo daño. */
  takeHit(amount: number, fromX: number, now: number, shove = 1): boolean {
    if (!this.health.damage(amount, now)) return false;
    // Un golpe interrumpe la cura sin gastar el botiquín.
    if (this.medkits.cancel()) {
      this.emitMedkit();
      this.bus.emit('notice', { text: 'CURA INTERRUMPIDA' });
    }
    this.bus.emit('health', { current: this.health.current, max: this.health.max });
    playSfx(this.scene, SFX.hurt, 0.5);

    const away = this.sprite.x >= fromX ? 1 : -1;
    this.body.setVelocity(away * this.tuning.knockbackSpeed * shove, -90 * Math.min(1.8, shove));
    this.hurtUntil = now + this.tuning.hurtStunMs;

    if (this.health.dead) this.die();
    return true;
  }

  private die(): void {
    this.arms.cancelReload();
    this.medkits.cancel();
    this.rig.setVisible(false);
    this.sprite.setAlpha(1);
    this.sprite.anims.play(this.anim('die'), true);
    this.hurtUntil = 0;
  }

  /** Recoge la munición de una caja. Devuelve a qué arma fue y cuánta, o `null` si no cabe. */
  resupply(): Resupply<WeaponDef> | null {
    return this.arms.resupply();
  }

  /** Mueve a Alex de golpe (pruebas y puntos de control). */
  teleport(x: number, groundY: number): void {
    this.sprite.setPosition(x, groundY);
    this.body.reset(x, groundY);
  }
}
