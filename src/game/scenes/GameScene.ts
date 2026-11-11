import Phaser from 'phaser';
import { SKINS } from '../../art/skins';
import { CHAPTER_1 } from '../../content/chapters/chapter1';
import { WALKER } from '../../content/enemies';
import { EXPLOSION } from '../../content/hazards';
import { zoneAt, type LevelDef } from '../../content/level';
import { GRAVITY, PLAYER_TUNING } from '../../content/player';
import { EventBus, type GameEvents } from '../../core/events/EventBus';
import { TRAUMA, explosionTrauma } from '../../core/fx/shake';
import { Rng } from '../../core/math/Rng';
import { ambienceAt } from '../../core/world/dayCycle';
import { AudioDirector } from '../audio/AudioDirector';
import { audioState } from '../audio/audioState';
import { MASK } from '../boot/registerArt';
import { SFX, playSfx, playSfxAt } from '../boot/registerAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { SimState } from '../debug/simState';
import { installSimHook, updateTestHook, type LaunchOptions } from '../debug/testHook';
import { HelicopterView } from '../entities/HelicopterView';
import { Player, type ShotRequest } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import { PlayerInput } from '../input/PlayerInput';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { BulletSystem } from '../systems/BulletSystem';
import { CameraRig } from '../systems/CameraRig';
import { DayNight } from '../systems/DayNight';
import { ExplosionSystem, type Blast } from '../systems/ExplosionSystem';
import { FxSystem } from '../systems/FxSystem';
import { LightingSystem, type Light } from '../systems/LightingSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { ZombieDirector } from '../systems/ZombieDirector';
import { Backdrop } from '../world/Backdrop';
import { DEPTH } from '../world/depths';
import { buildLevel, type BuiltLevel, type ExplosiveHandle } from '../world/LevelBuilder';
import { BUS_KEY, SCENE } from './keys';

const WALL_TOP = 94;
const GROUND_TOP = 172;
/** Espera antes de poder reintentar tras morir. */
const RETRY_DELAY_MS = 900;

/**
 * Escena de juego: reúne el mundo, a Alex, los zombis y los sistemas, y
 * reparte el trabajo entre ellos. La lógica vive en `core/` y en cada
 * sistema; aquí solo se coordina el orden de cada fotograma.
 */
export class GameScene extends Phaser.Scene {
  private level: LevelDef = CHAPTER_1;
  private bus!: EventBus<GameEvents>;
  private controls!: PlayerInput;
  private player!: Player;
  private director!: ZombieDirector;
  private bullets!: BulletSystem;
  private fx!: FxSystem;
  private lighting!: LightingSystem;
  private backdrop!: Backdrop;
  private cameraRig!: CameraRig;
  private helicopter!: HelicopterView;
  private pickups!: PickupSystem;
  private atmosphere!: AtmosphereSystem;
  private explosions!: ExplosionSystem;
  private dayNight!: DayNight;
  private audio!: AudioDirector;
  private built!: BuiltLevel;
  private muzzleLight!: Light;
  private muzzleLightUntil = 0;
  private currentZone = '';
  private diedAt: number | null = null;

  constructor() {
    super(SCENE.game);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    const level = this.level;
    this.currentZone = '';
    this.diedAt = null;
    this.muzzleLightUntil = 0;

    this.bus = new EventBus<GameEvents>();
    this.registry.set(BUS_KEY, this.bus);

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, -200, level.width, GAME_HEIGHT + 200);

    this.lighting = new LightingSystem(this, ambienceAt(0).ambientColor);
    this.backdrop = new Backdrop(this, WALL_TOP, GROUND_TOP);
    this.built = buildLevel(this, level, this.lighting);

    this.fx = new FxSystem(this);
    this.bullets = new BulletSystem(this);
    this.controls = new PlayerInput(this);
    this.player = new Player(this, level.spawnX, level.playLine, this.bus, PLAYER_TUNING, SKINS[options.skin]);
    this.director = new ZombieDirector(this, WALKER, level.playLine, level.width, this.bus, new Rng(20261110), !options.test);
    if (!options.test) for (const x of level.walkers) this.director.spawn(x);

    this.helicopter = new HelicopterView(this, this.lighting, level.helicopter.x, level.helicopter.y, level.playLine, DEPTH.helicopter);
    this.muzzleLight = this.lighting.addLight(MASK.radialMedium, 0, 0, { intensity: 1 });
    this.muzzleLight.enabled = false;

    this.pickups = new PickupSystem(this, level.pickups, level.playLine, this.bus);
    this.atmosphere = new AtmosphereSystem(this, this.fx, this.lighting, this.built.fires, this.built.sparkers, this.built.alarms, level.playLine);
    this.explosions = new ExplosionSystem(this, this.lighting, this.fx, this.atmosphere, this.built.explosives, level.playLine, (blast) =>
      this.handleBlast(blast),
    );
    this.dayNight = new DayNight(this.lighting, this.backdrop, this.built.lamps, this.bus);
    this.dayNight.setFixed(options.night);
    this.audio = new AudioDirector(this);

    this.wireCollisions(this.built.solids);
    this.cameraRig = new CameraRig(this.cameras.main, level.width);
    this.cameraRig.snap(this.player.x, this.player.facing);
    this.bindSceneEvents();

    this.scene.launch(SCENE.hud);
    // La interfaz se suscribe al crearse; el estado inicial se envía después.
    this.time.delayedCall(0, () => {
      this.player.announce();
      this.dayNight.announce();
      this.bus.emit('kills', { total: 0 });
    });

    installSimHook({
      state: () => this.snapshot(),
      spawnZombie: (x) => void this.director.spawn(x),
      clearZombies: () => this.director.clear(),
      teleport: (x) => {
        this.player.teleport(x, this.level.playLine);
        this.cameraRig.snap(x, this.player.facing);
      },
      setNight: (night) => this.dayNight.setFixed(night),
      detonate: (x) => this.explosions.detonateNear(x),
    });
    this.afterPhysics(this.time.now, 0);
    updateTestHook({ readyScene: SCENE.game, lightCount: this.lighting.lightCount });
  }

  private bindSceneEvents(): void {
    // Tras la física: capas que dependen de la posición final de los cuerpos.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
    const resume = (): void => this.controls.reset();
    this.events.on(Phaser.Scenes.Events.RESUME, resume);
    const pause = (): void => this.openOptions();
    this.input.keyboard?.on('keydown-ESC', pause);
    this.input.keyboard?.on('keydown-P', pause);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
      this.events.off(Phaser.Scenes.Events.RESUME, resume);
      this.input.keyboard?.off('keydown-ESC', pause);
      this.input.keyboard?.off('keydown-P', pause);
      this.audio.destroy();
      this.scene.stop(SCENE.hud);
      this.bus.clear();
    });
  }

  /** Detiene el juego y abre la pausa con los ajustes de sonido. */
  private openOptions(): void {
    if (this.diedAt !== null || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch(SCENE.options);
  }

  override update(time: number, delta: number): void {
    const input = this.controls.read();

    if (this.diedAt !== null) {
      this.player.update(time, delta, input, this.controls.aimPoint());
      if (time - this.diedAt > RETRY_DELAY_MS && input.confirmPressed) this.scene.restart();
    } else {
      const shot = this.player.update(time, delta, input, this.controls.aimPoint());
      if (shot) this.handleShot(shot, time);
      if (this.player.landed) this.fx.dustPuff(this.player.x, this.level.playLine);

      this.director.update(
        time,
        { x: this.player.x, centerY: this.player.centerY, alive: this.player.alive },
        (zombie) => this.handleStrike(zombie, time),
      );
      this.pickups.update(this.player);
      this.updateZone();
    }
    this.bullets.update(time);
    this.explosions.update(time);
    this.atmosphere.update(time, delta);
  }

  /** Se ejecuta después de que la física haya movido los cuerpos. */
  private afterPhysics(time: number, delta: number): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    this.player.postUpdate(time, this.level.playLine);
    this.director.syncShadows();
    this.cameraRig.update(this.player.x, this.player.facing, body.velocity.x, delta, time);
    this.backdrop.sync(this.cameras.main.scrollX, time, delta);
    this.helicopter.update(time);
    this.dayNight.update(delta, time, this.player.x, this.player.sprite.y);
    if (this.muzzleLight.enabled && time >= this.muzzleLightUntil) this.muzzleLight.enabled = false;
    this.lighting.update(time);
    this.audio.update(delta, {
      timeMs: time,
      night: this.dayNight.night,
      helicopterX: this.helicopter.x,
      alarmXs: this.built.alarms.map((alarm) => alarm.x),
      chasing: this.director.chasingCount,
      playerAlive: this.player.alive,
    });
  }

  // ───────────────────────── Combate ─────────────────────────

  private handleShot(shot: ShotRequest, now: number): void {
    this.bullets.fire(shot, now);
    this.fx.casing(shot.x - shot.dirX * 6, shot.y, shot.facing);
    playSfx(this, SFX.gunshot, 0.5, 150);
    this.cameraRig.addTrauma(TRAUMA.shot);
    // El fogonazo ilumina un instante lo que hay alrededor.
    this.muzzleLight.x = shot.x;
    this.muzzleLight.y = shot.y;
    this.muzzleLight.enabled = true;
    this.muzzleLightUntil = now + 80;
    // El ruido del disparo atrae a los caminantes cercanos.
    this.director.alertNear(shot.x, shot.weapon.noiseRadius);
  }

  private handleStrike(zombie: Zombie, now: number): void {
    this.hurtPlayer(zombie.def.attackDamage, zombie.x, now);
  }

  private hurtPlayer(damage: number, fromX: number, now: number): void {
    if (!this.player.takeHit(damage, fromX, now)) return;
    this.fx.bloodBurst(this.player.x, this.player.centerY, 6);
    this.cameraRig.addTrauma(TRAUMA.playerHit);
    if (!this.player.alive) {
      this.diedAt = now;
      this.bus.emit('playerDied', { kills: this.director.kills });
    }
  }

  private damageZombie(zombie: Zombie, damage: number, pushX: number, now: number): void {
    const killed = zombie.hit(damage, pushX, now);
    if (!killed) return;
    this.director.registerKill();
    this.fx.bloodDecal(zombie.x, this.level.playLine + 4);
    playSfxAt(this, SFX.deathCry, zombie.x, 0.45);
  }

  /** Reparte los efectos de una explosión: daño por distancia, sacudida y alerta. */
  private handleBlast(blast: Blast): void {
    const now = this.time.now;
    for (const zombie of this.director.zombies) {
      if (!zombie.alive) continue;
      const distance = Math.hypot(zombie.x - blast.x, zombie.y - 12 - blast.y);
      const damage = blast.enemyDamageAt(distance);
      if (damage > 0) this.damageZombie(zombie, damage, Math.sign(zombie.x - blast.x || 1) * EXPLOSION.knockback, now);
    }
    const reach = Math.hypot(this.player.x - blast.x, this.player.centerY - blast.y);
    const damage = this.player.alive ? blast.playerDamageAt(reach) : 0;
    if (damage > 0) this.hurtPlayer(damage, blast.x, now);

    const cameraCentre = this.cameras.main.scrollX + GAME_WIDTH / 2;
    this.cameraRig.addTrauma(explosionTrauma(Math.abs(blast.x - cameraCentre)));
    this.director.alertNear(blast.x, EXPLOSION.noiseRadius);
  }

  private wireCollisions(solids: Phaser.GameObjects.Zone[]): void {
    const physics = this.physics;
    physics.add.collider(this.player.sprite, solids);
    physics.add.collider(this.director.group, solids);
    // Colisión real entre Alex y los zombis: no se atraviesan.
    physics.add.collider(this.player.sprite, this.director.group);

    // Phaser no garantiza el orden de los dos objetos en estas llamadas:
    // se identifica cuál es la bala en lugar de suponerlo.
    physics.add.overlap(this.bullets.group, this.director.group, (first, second) => {
      const firstIsBullet = BulletSystem.isBullet(first as Phaser.GameObjects.GameObject);
      const bullet = (firstIsBullet ? first : second) as Phaser.Physics.Arcade.Image;
      const zombie = (firstIsBullet ? second : first) as Zombie;
      if (!bullet.active || !zombie.alive) return;
      const data = BulletSystem.dataOf(bullet);
      this.fx.bloodBurst(bullet.x, bullet.y);
      playSfxAt(this, SFX.fleshHit, zombie.x, 0.4);
      this.bullets.remove(bullet);
      this.damageZombie(zombie, data.damage, data.dirX * data.knockback, this.time.now);
    });

    physics.add.overlap(this.bullets.group, solids, (first, second) => {
      const firstIsBullet = BulletSystem.isBullet(first as Phaser.GameObjects.GameObject);
      const bullet = (firstIsBullet ? first : second) as Phaser.Physics.Arcade.Image;
      const solid = (firstIsBullet ? second : first) as Phaser.GameObjects.Zone;
      if (!bullet.active) return;
      this.fx.sparkBurst(bullet.x, bullet.y);
      this.bullets.remove(bullet);
      const explosive = solid.data?.get('explosive') as ExplosiveHandle | undefined;
      if (explosive) this.explosions.hit(explosive);
      playSfxAt(this, SFX.ricochet, bullet.x, 0.25);
    });
  }

  private updateZone(): void {
    const zone = zoneAt(this.level, this.player.x).name;
    if (zone === this.currentZone) return;
    this.currentZone = zone;
    this.bus.emit('zone', { name: zone });
  }

  /** Estado resumido para las pruebas de navegador. */
  private snapshot(): SimState {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const weapon = this.player.weapon;
    const camera = this.cameras.main;
    return {
      time: this.time.now,
      worldWidth: this.level.width,
      cameraX: camera.scrollX,
      cameraOffset: { x: camera.x, y: camera.y },
      shake: this.cameraRig.shakeLevel,
      zone: this.currentZone,
      kills: this.director.kills,
      bullets: this.bullets.snapshot(),
      night: this.dayNight.night,
      lampsOn: this.dayNight.lampsOn,
      lampCount: this.built.lamps.length,
      explosions: { total: this.explosions.total, remaining: this.explosions.remaining },
      pickups: this.pickups.remaining,
      audio: { ...audioState.settings, loops: this.audio.levels() },
      player: {
        x: this.player.x,
        y: this.player.sprite.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        onGround: this.player.onGround,
        facing: this.player.facing,
        aim: this.player.aimAngle,
        health: this.player.health.current,
        alive: this.player.alive,
        animation: this.player.sprite.anims.currentAnim?.key ?? '',
        recentAnimations: [...this.player.recent],
        skin: this.player.skin.id,
        armFrame: this.player.armFrame,
        bodyTop: body.top,
        bodyBottom: body.bottom,
        bodyLeft: body.left,
        bodyRight: body.right,
      },
      weapon: { name: weapon.def.name, magazine: weapon.magazine, reserve: weapon.reserve, reloading: weapon.reloading },
      zombies: this.director.zombies.map((zombie) => ({
        x: zombie.x,
        health: zombie.health.current,
        state: zombie.brain.state,
        alive: zombie.alive,
      })),
    };
  }
}
