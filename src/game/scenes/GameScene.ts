import Phaser from 'phaser';
import { SKINS } from '../../art/skins';
import { CHAPTER_1 } from '../../content/chapters/chapter1';
import { SURVIVAL_ARENA } from '../../content/chapters/survival';
import { EXPLOSION } from '../../content/hazards';
import { zoneAt, type LevelDef } from '../../content/level';
import { GRAVITY, PLAYER_TUNING } from '../../content/player';
import { LOADOUTS } from '../../content/weapons';
import { EventBus, type GameEvents } from '../../core/events/EventBus';
import { TRAUMA, explosionTrauma } from '../../core/fx/shake';
import { Rng } from '../../core/math/Rng';
import { ambienceAt } from '../../core/world/dayCycle';
import { AudioDirector } from '../audio/AudioDirector';
import { MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { buildSnapshot } from '../debug/snapshot';
import { installGameHooks } from '../debug/gameHooks';
import { updateTestHook, type LaunchOptions } from '../debug/testHook';
import { Player } from '../entities/Player';
import { SurvivalMode, type SurvivalAudio } from '../modes/SurvivalMode';
import type { Zombie } from '../entities/Zombie';
import { PlayerInput } from '../input/PlayerInput';
import { AirdropSystem } from '../systems/AirdropSystem';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { BulletSystem } from '../systems/BulletSystem';
import { BurnSystem } from '../systems/BurnSystem';
import { CameraRig } from '../systems/CameraRig';
import { DayNight } from '../systems/DayNight';
import { ExplosionSystem, type Blast } from '../systems/ExplosionSystem';
import { FxSystem } from '../systems/FxSystem';
import { GunfireSystem } from '../systems/GunfireSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { BarricadeSystem } from '../systems/BarricadeSystem';
import { NoiseSystem } from '../systems/NoiseSystem';
import { ZombieDirector } from '../systems/ZombieDirector';
import { Backdrop } from '../world/Backdrop';
import { buildLevel, type BuiltLevel } from '../world/LevelBuilder';
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
  private noise!: NoiseSystem;
  private barricades!: BarricadeSystem;
  private bullets!: BulletSystem;
  private fx!: FxSystem;
  private lighting!: LightingSystem;
  private backdrop!: Backdrop;
  private cameraRig!: CameraRig;
  private airdrop!: AirdropSystem;
  private burns!: BurnSystem;
  private pickups!: PickupSystem;
  private atmosphere!: AtmosphereSystem;
  private explosions!: ExplosionSystem;
  private dayNight!: DayNight;
  private audio!: AudioDirector;
  private built!: BuiltLevel;
  private gunfire!: GunfireSystem;
  private currentZone = '';
  private diedAt: number | null = null;
  /** Modo supervivencia (`?modo=oleadas`), o `null` en la campaña. */
  private survival: SurvivalMode | null = null;
  private survivalAudio: SurvivalAudio = { danger: 0, hush: 0 };

  constructor() {
    super(SCENE.game);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    const survival = options.mode === 'survival';
    this.level = survival ? SURVIVAL_ARENA : CHAPTER_1;
    const level = this.level;
    this.survivalAudio = { danger: 0, hush: 0 };
    this.currentZone = '';
    this.diedAt = null;

    this.bus = new EventBus<GameEvents>();
    this.registry.set(BUS_KEY, this.bus);

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, -200, level.width, GAME_HEIGHT + 200);

    this.lighting = new LightingSystem(this, ambienceAt(0).ambientColor);
    this.backdrop = new Backdrop(this, WALL_TOP, GROUND_TOP);
    this.built = buildLevel(this, level, this.lighting);

    this.fx = new FxSystem(this);
    this.bullets = new BulletSystem(this, {
      groundY: level.playLine,
      rocketSpent: (x, y, data) => data.blast && this.explosions.blastAt(x, y, data.blast),
      rocketTrail: (x, y) => this.fx.dustPuff(x, y, 1),
    });
    this.controls = new PlayerInput(this);
    this.player = new Player(this, level.spawnX, level.playLine, this.bus, PLAYER_TUNING, SKINS[options.skin], LOADOUTS[options.loadout]);
    this.noise = new NoiseSystem(this.bus);
    this.barricades = new BarricadeSystem(this, this.fx, this.built.barricades);
    this.director = new ZombieDirector(
      this,
      level.playLine,
      level.width,
      this.bus,
      new Rng(20261110),
      !options.test && !survival,
      this.noise.field,
      this.built.barricades,
      () => level.reinforcements[this.currentZone] ?? { walker: 1 },
      survival,
    );
    if (!options.test) for (const enemy of level.enemies) this.director.spawn(enemy.x, enemy.kind);

    this.burns = new BurnSystem(this, this.lighting, (zombie, damage, now) => this.damageZombie(zombie, damage, 0, now, undefined, true));
    // Sin semilla en la URL, cada partida es distinta: unas tienen suministros al azar y otras no.
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.airdrop = new AirdropSystem(this, {
      lighting: this.lighting,
      fx: this.fx,
      noise: this.noise,
      director: this.director,
      bus: this.bus,
      player: this.player,
      level,
      rng: new Rng(seed),
      automatic: !options.test && !survival,
      onLanded: (x) => this.cameraRig.addTrauma(Math.max(0, 0.35 - Math.abs(x - this.player.x) / 600)),
    });

    this.pickups = new PickupSystem(this, level.pickups, level.playLine, this.bus);
    this.atmosphere = new AtmosphereSystem(this, this.fx, this.lighting, this.built.fires, this.built.sparkers, this.built.alarms, level.playLine);
    this.explosions = new ExplosionSystem(this, this.lighting, this.fx, this.atmosphere, this.built.explosives, level.playLine, (blast) =>
      this.handleBlast(blast),
    );
    this.dayNight = new DayNight(this.lighting, this.backdrop, this.built.lamps, this.bus);
    this.dayNight.setFixed(options.night);
    this.audio = new AudioDirector(this);
    this.cameraRig = new CameraRig(this.cameras.main, level.width);
    this.gunfire = new GunfireSystem(this, {
      bullets: this.bullets,
      fx: this.fx,
      cameraRig: this.cameraRig,
      director: this.director,
      explosions: this.explosions,
      muzzleLight: this.lighting.addLight(MASK.radialMedium, 0, 0, { intensity: 1 }),
      noise: this.noise,
      burns: this.burns,
      damageZombie: (zombie, damage, pushX, now, fire) => this.damageZombie(zombie, damage, pushX, now, this.player.x, fire),
    });

    this.survival = survival
      ? new SurvivalMode(this, {
          director: this.director,
          bus: this.bus,
          airdrop: this.airdrop,
          player: this.player,
          built: this.built,
          dayNight: this.dayNight,
          cameraRig: this.cameraRig,
          fx: this.fx,
          lighting: this.lighting,
          noise: this.noise,
          rng: new Rng(seed + 1),
          groundY: level.playLine,
          refugeX: level.spawnX,
          startWave: options.startWave,
        })
      : null;

    this.wireCollisions(this.built.solids);
    this.cameraRig.snap(this.player.x, this.player.facing);
    this.bindSceneEvents();

    this.scene.launch(SCENE.hud);
    // La interfaz se suscribe al crearse; el estado inicial se envía después.
    this.time.delayedCall(0, () => {
      this.player.announce();
      this.dayNight.announce();
      this.bus.emit('kills', { total: 0 });
      this.survival?.begin();
    });

    installGameHooks({
      level,
      now: () => this.time.now,
      state: () => this.snapshot(),
      player: this.player,
      director: this.director,
      cameraRig: this.cameraRig,
      dayNight: this.dayNight,
      explosions: this.explosions,
      airdrop: this.airdrop,
      survival: this.survival,
      hurtPlayer: (amount) => this.hurtPlayer(amount, this.player.x + 1, this.time.now, 0),
      kill: (zombie) => this.damageZombie(zombie, 1e6, 0, this.time.now),
    });
    if (options.airdropNow) this.time.delayedCall(400, () => this.airdrop.call(this.time.now));
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
      if (shot) this.gunfire.fire(shot, time);
      if (this.player.landed) this.fx.dustPuff(this.player.x, this.level.playLine);

      this.noise.update(time, delta, this.player.x, this.player.movementNoise, this.player.sneaking);
      this.director.update(
        time,
        { x: this.player.x, centerY: this.player.centerY, alive: this.player.alive },
        {
          strike: (zombie) => this.handleStrike(zombie, time),
          swing: (zombie) => this.handleSwing(zombie),
          smash: (zombie, barricade) => {
            // Solo el mazazo del mutante sacude la pantalla: en la horda golpean decenas a la vez.
            this.cameraRig.addTrauma(zombie.def.id === 'mutant' ? 0.35 : 0.03);
            this.noise.emit(barricade.x, zombie.def.voice, 'creature', time, false);
            this.barricades.hit(barricade, time);
          },
        },
      );
      this.pickups.update(this.player);
      this.airdrop.update(time, delta, input.interactHeld);
      if (this.survival) {
        this.survivalAudio = this.survival.update(time, delta);
        if (this.survival.state.finished && input.reloadPressed) this.scene.restart();
      }
      this.updateZone();
    }
    this.bullets.update(time);
    this.burns.update(time);
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
    this.dayNight.update(delta, time, this.player.x, this.player.sprite.y);
    this.gunfire.update(time);
    this.lighting.update(time);
    this.audio.update(delta, {
      timeMs: time,
      night: this.dayNight.night,
      helicopterX: this.airdrop.helicopter.x,
      alarmXs: this.built.alarms.filter((alarm) => alarm.armed).map((alarm) => alarm.x),
      chasing: this.director.chasingCount,
      playerAlive: this.player.alive,
      airdrop: this.airdrop.active,
      danger: this.survivalAudio.danger,
      hush: this.survivalAudio.hush,
    });
  }

  // ───────────────────────── Combate ─────────────────────────

  private handleStrike(zombie: Zombie, now: number): void {
    const attack = zombie.def.attack;
    this.hurtPlayer(attack.damage, zombie.x, now, attack.shove);
  }

  /** El mazazo del mutante sacude la pantalla y levanta polvo, alcance o no. */
  private handleSwing(zombie: Zombie): void {
    if (zombie.def.id !== 'mutant') return;
    this.cameraRig.addTrauma(0.6);
    this.fx.dustPuff(zombie.x + (zombie.flipX ? -14 : 14), this.level.playLine, 14);
    playSfxAt(this, SFX.slam, zombie.x, 0.6);
  }

  private hurtPlayer(damage: number, fromX: number, now: number, shove = 1): void {
    if (!this.player.takeHit(damage, fromX, now, shove)) return;
    this.fx.bloodBurst(this.player.x, this.player.centerY, 6);
    this.cameraRig.addTrauma(TRAUMA.playerHit * Math.min(1.6, shove));
    if (!this.player.alive) {
      this.diedAt = now;
      this.bus.emit('playerDied', { kills: this.director.kills });
    }
  }

  private damageZombie(zombie: Zombie, damage: number, pushX: number, now: number, fromX?: number, fire = false): void {
    const killed = zombie.hit(damage, pushX, now, fromX, fire);
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
      if (damage > 0) this.damageZombie(zombie, damage, Math.sign(zombie.x - blast.x || 1) * blast.knockback, now, blast.x);
    }
    const reach = Math.hypot(this.player.x - blast.x, this.player.centerY - blast.y);
    const damage = this.player.alive ? blast.playerDamageAt(reach) : 0;
    if (damage > 0) this.hurtPlayer(damage, blast.x, now);

    const cameraCentre = this.cameras.main.scrollX + GAME_WIDTH / 2;
    this.cameraRig.addTrauma(explosionTrauma(Math.abs(blast.x - cameraCentre)));
    // Una explosión se oye en media ciudad (la provoca Alex con sus disparos).
    this.noise.emit(blast.x, EXPLOSION.noiseRadius, 'explosion', now, true);
  }

  private wireCollisions(solids: Phaser.GameObjects.Zone[]): void {
    const physics = this.physics;
    physics.add.collider(this.player.sprite, solids);
    physics.add.collider(this.director.group, solids);
    // Colisión real entre Alex y los zombis: no se atraviesan.
    physics.add.collider(this.player.sprite, this.director.group);

    this.gunfire.wire(solids);
  }

  private updateZone(): void {
    const zone = zoneAt(this.level, this.player.x).name;
    if (zone === this.currentZone) return;
    this.currentZone = zone;
    // En supervivencia el panel de oleadas ocupa el sitio del rótulo de zona.
    if (!this.survival) this.bus.emit('zone', { name: zone });
    this.airdrop.enterZone(zone);
  }

  /** Estado resumido para las pruebas de navegador. */
  private snapshot(): ReturnType<typeof buildSnapshot> {
    return buildSnapshot({
      time: this.time.now,
      worldWidth: this.level.width,
      zone: this.currentZone,
      camera: this.cameras.main,
      cameraRig: this.cameraRig,
      player: this.player,
      director: this.director,
      bullets: this.bullets,
      fx: this.fx,
      dayNight: this.dayNight,
      built: this.built,
      explosions: this.explosions,
      pickups: this.pickups,
      audio: this.audio,
      noise: this.noise,
      airdrop: this.airdrop,
      burns: this.burns,
      survival: this.survival,
    });
  }
}
