import type Phaser from 'phaser';
import type { AudioDirector } from '../audio/AudioDirector';
import { audioState } from '../audio/audioState';
import type { Player } from '../entities/Player';
import type { SurvivalMode } from '../modes/SurvivalMode';
import type { AirdropSystem } from '../systems/AirdropSystem';
import type { BulletSystem } from '../systems/BulletSystem';
import type { BurnSystem } from '../systems/BurnSystem';
import type { CameraRig } from '../systems/CameraRig';
import type { DayNight } from '../systems/DayNight';
import type { ExplosionSystem } from '../systems/ExplosionSystem';
import type { FxSystem } from '../systems/FxSystem';
import type { NoiseSystem } from '../systems/NoiseSystem';
import type { PickupSystem } from '../systems/PickupSystem';
import type { ScrapSystem } from '../systems/ScrapSystem';
import type { ThrowableSystem } from '../systems/ThrowableSystem';
import type { ZombieDirector } from '../systems/ZombieDirector';
import type { BuiltLevel } from '../world/LevelBuilder';
import type { SimState } from './simState';

/** Lo que la escena de juego reúne para el estado de las pruebas. */
export interface SnapshotSources {
  time: number;
  worldWidth: number;
  zone: string;
  camera: Phaser.Cameras.Scene2D.Camera;
  cameraRig: CameraRig;
  player: Player;
  director: ZombieDirector;
  bullets: BulletSystem;
  fx: FxSystem;
  dayNight: DayNight;
  built: BuiltLevel;
  explosions: ExplosionSystem;
  pickups: PickupSystem;
  audio: AudioDirector;
  noise: NoiseSystem;
  airdrop: AirdropSystem;
  burns: BurnSystem;
  survival: SurvivalMode | null;
  throwables: ThrowableSystem;
  scrap: ScrapSystem;
}

/** Estado resumido del juego para las pruebas de navegador. */
export function buildSnapshot(src: SnapshotSources): SimState {
  const { player, camera, director } = src;
  const body = player.sprite.body as Phaser.Physics.Arcade.Body;
  const weapon = player.weapon;
  const arsenal = player.weapons.arsenal;
  return {
    time: src.time,
    worldWidth: src.worldWidth,
    cameraX: camera.scrollX,
    cameraOffset: { x: camera.x, y: camera.y },
    shake: src.cameraRig.shakeLevel,
    zone: src.zone,
    kills: director.kills,
    bullets: src.bullets.snapshot(),
    impacts: { ...src.fx.counts },
    night: src.dayNight.night,
    lampsOn: src.dayNight.lampsOn,
    lampCount: src.built.lamps.length,
    explosions: { total: src.explosions.total, remaining: src.explosions.remaining },
    pickups: src.pickups.remaining,
    audio: { ...audioState.settings, loops: src.audio.levels() },
    player: {
      x: player.x,
      y: player.sprite.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      onGround: player.onGround,
      facing: player.facing,
      aim: player.aimAngle,
      health: player.health.current,
      alive: player.alive,
      animation: player.sprite.anims.currentAnim?.key ?? '',
      recentAnimations: [...player.recent],
      skin: player.skin.id,
      armFrame: player.armFrame,
      flashFrame: player.flashFrame,
      aimDegrees: player.aimDegrees,
      bodyTop: body.top,
      bodyBottom: body.bottom,
      bodyLeft: body.left,
      bodyRight: body.right,
    },
    weapon: {
      id: weapon.def.id,
      name: weapon.def.name,
      slot: arsenal.slot,
      magazine: weapon.magazine,
      magazineSize: weapon.def.magazineSize,
      reserve: weapon.reserve,
      reloading: weapon.reloading,
      ready: arsenal.isReady(src.time),
      fired: weapon.fired,
    },
    arsenal: Array.from({ length: arsenal.slotCount }, (_, i) => {
      const slot = arsenal.weaponAt(i);
      return slot ? { id: slot.def.id, magazine: slot.magazine, reserve: slot.reserve, fired: slot.fired } : null;
    }),
    zombies: director.zombies.map((zombie) => ({
      kind: zombie.kind,
      x: zombie.x,
      y: zombie.y,
      health: zombie.health.current,
      state: zombie.brain.state,
      alive: zombie.alive,
      target: zombie.brain.target,
      animation: zombie.anims.currentAnim?.key ?? '',
    })),
    noise: { level: src.noise.level, emitted: src.noise.field.emitted, sneaking: player.sneaking },
    barricades: src.built.barricades.map((b) => ({ x: b.x, hits: b.hits, broken: b.broken })),
    airdrop: src.airdrop.snapshot(),
    medkits: { count: player.medkits.count, using: player.medkits.using },
    throwables: {
      grenade: player.throwables.count('grenade'),
      molotov: player.throwables.count('molotov'),
      flying: src.throwables.snapshot(),
      fires: src.throwables.counts.fires,
      thrown: src.throwables.counts.thrown,
      exploded: src.throwables.counts.exploded,
    },
    scrap: { total: player.scrap.total, onGround: src.scrap.onGround, dropped: src.scrap.totalDropped },
    burning: src.burns.count,
    pool: director.poolStats,
    alive: director.aliveCount,
    survival: src.survival ? survivalState(src.survival, src.time) : null,
  };
}

function survivalState(mode: SurvivalMode, now: number): NonNullable<SimState['survival']> {
  const run = mode.waves.run;
  return {
    wave: run.number,
    phase: run.phase,
    remaining: run.remaining,
    total: run.total,
    kills: run.kills,
    timeLeft: run.timeLeft(now),
    ...mode.state,
    bossRevealed: mode.bossRevealed,
  };
}
