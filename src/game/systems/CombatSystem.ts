import type Phaser from 'phaser';
import { EXPLOSION } from '../../content/hazards';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { TRAUMA, explosionTrauma } from '../../core/fx/shake';
import { SFX, playSfxAt } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import type { CameraRig } from './CameraRig';
import type { Blast } from './ExplosionSystem';
import type { FxSystem } from './FxSystem';
import type { NoiseSystem } from './NoiseSystem';
import type { ScrapSystem } from './ScrapSystem';
import type { ZombieDirector } from './ZombieDirector';

export interface CombatDeps {
  player: Player;
  director: ZombieDirector;
  fx: FxSystem;
  cameraRig: CameraRig;
  noise: NoiseSystem;
  scrap: ScrapSystem;
  bus: EventBus<GameEvents>;
  groundY: number;
  /** Alex acaba de morir. */
  onPlayerDied: (now: number) => void;
}

/**
 * Reglas de daño de la escena: golpes a Alex, daño a los enemigos (con
 * las piezas que sueltan al morir) y los efectos de cada explosión.
 */
export class CombatSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: CombatDeps,
  ) {}

  /** Un enemigo alcanza a Alex con su golpe. */
  strike(zombie: Zombie, now: number): void {
    const attack = zombie.def.attack;
    this.hurtPlayer(attack.damage, zombie.x, now, attack.shove);
  }

  /** El mazazo del mutante sacude la pantalla y levanta polvo, alcance o no. */
  swing(zombie: Zombie): void {
    if (zombie.def.id !== 'mutant') return;
    this.deps.cameraRig.addTrauma(0.6);
    this.deps.fx.dustPuff(zombie.x + (zombie.flipX ? -14 : 14), this.deps.groundY, 14);
    playSfxAt(this.scene, SFX.slam, zombie.x, 0.6);
  }

  hurtPlayer(damage: number, fromX: number, now: number, shove = 1): void {
    const { player } = this.deps;
    if (!player.takeHit(damage, fromX, now, shove)) return;
    this.deps.fx.bloodBurst(player.x, player.centerY, 6);
    this.deps.cameraRig.addTrauma(TRAUMA.playerHit * Math.min(1.6, shove));
    if (!player.alive) {
      this.deps.onPlayerDied(now);
      this.deps.bus.emit('playerDied', { kills: this.deps.director.kills });
    }
  }

  damageZombie(zombie: Zombie, damage: number, pushX: number, now: number, fromX?: number, fire = false): void {
    const killed = zombie.hit(damage, pushX, now, fromX, fire);
    if (!killed) return;
    this.deps.director.registerKill();
    this.deps.fx.bloodDecal(zombie.x, this.deps.groundY + 4);
    this.deps.scrap.dropFrom(zombie.def.id, zombie.x, now);
    playSfxAt(this.scene, SFX.deathCry, zombie.x, 0.45);
  }

  /** Reparte los efectos de una explosión: daño por distancia, sacudida y alerta. */
  blast(blast: Blast): void {
    const now = this.scene.time.now;
    const { player } = this.deps;
    for (const zombie of this.deps.director.zombies) {
      if (!zombie.alive) continue;
      const distance = Math.hypot(zombie.x - blast.x, zombie.y - 12 - blast.y);
      const damage = blast.enemyDamageAt(distance);
      if (damage > 0) this.damageZombie(zombie, damage, Math.sign(zombie.x - blast.x || 1) * blast.knockback, now, blast.x);
    }
    const reach = Math.hypot(player.x - blast.x, player.centerY - blast.y);
    const damage = player.alive ? blast.playerDamageAt(reach) : 0;
    if (damage > 0) this.hurtPlayer(damage, blast.x, now);

    const cameraCentre = this.scene.cameras.main.scrollX + GAME_WIDTH / 2;
    this.deps.cameraRig.addTrauma(explosionTrauma(Math.abs(blast.x - cameraCentre)));
    // Una explosión se oye en media ciudad (la provoca Alex).
    this.deps.noise.emit(blast.x, EXPLOSION.noiseRadius, 'explosion', now, true);
  }
}
