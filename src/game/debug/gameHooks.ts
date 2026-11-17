import type { EnemyKind } from '../../content/enemies';
import type { LevelDef } from '../../content/level';
import { weaponById } from '../../content/weapons';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import type { SurvivalMode } from '../modes/SurvivalMode';
import type { AirdropSystem } from '../systems/AirdropSystem';
import type { CameraRig } from '../systems/CameraRig';
import type { DayNight } from '../systems/DayNight';
import type { ExplosionSystem } from '../systems/ExplosionSystem';
import type { ZombieDirector } from '../systems/ZombieDirector';
import type { SimState } from './simState';
import { installSimHook } from './testHook';

/** Lo que la escena de juego ofrece a los ganchos de prueba. */
export interface GameHookSources {
  level: LevelDef;
  now(): number;
  state(): SimState;
  player: Player;
  director: ZombieDirector;
  cameraRig: CameraRig;
  dayNight: DayNight;
  explosions: ExplosionSystem;
  airdrop: AirdropSystem;
  survival: SurvivalMode | null;
  hurtPlayer(amount: number): void;
  kill(zombie: Zombie): void;
}

/** Instala las órdenes de prueba de la escena de juego (solo en desarrollo). */
export function installGameHooks(src: GameHookSources): void {
  const { player, director, level } = src;
  installSimHook({
    state: () => src.state(),
    spawnZombie: (x, kind) => void director.spawn(x, (kind ?? 'walker') as EnemyKind),
    clearZombies: () => director.clear(),
    teleport: (x) => {
      player.teleport(x, level.playLine);
      src.cameraRig.snap(x, player.facing);
    },
    setNight: (night) => src.dayNight.setFixed(night),
    detonate: (x) => src.explosions.detonateNear(x),
    setAmmo: (slot, magazine, reserve) => player.weapons.arsenal.weaponAt(slot)?.debugSetAmmo(magazine, reserve),
    airdrop: () => src.airdrop.call(src.now()),
    hurtPlayer: (amount) => src.hurtPlayer(amount),
    giveWeapon: (id) => {
      const def = weaponById(id);
      if (def) player.weapons.grant(def, src.now());
    },
    skipToWave: (wave) => src.survival?.waves.skipTo(wave - 1),
    killAll: () => {
      for (const zombie of [...director.zombies]) if (zombie.alive) src.kill(zombie);
    },
    stress: (count) => {
      // Prueba de rendimiento: muchos enemigos repartidos alrededor de Alex, todos a por él.
      for (let i = 0; i < count; i++) {
        const offset = (i % 2 === 0 ? 1 : -1) * (60 + ((i * 37) % 400));
        const x = Math.max(20, Math.min(level.width - 20, player.x + offset));
        director.spawn(x, i % 10 === 0 ? 'runner' : 'walker').brain.alert();
      }
    },
  });
}
