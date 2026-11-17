import type Phaser from 'phaser';
import { SURVIVAL_WAVES, WAVE_TIMING, rewardLoot } from '../../content/waves';
import type { EnemyKind } from '../../content/enemies';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import { WaveRun, type WaveEvent } from '../../core/waves/WaveRun';
import { SFX, playSfx } from '../boot/registerAudio';
import type { Player } from '../entities/Player';
import type { BarricadeHandle } from '../world/LevelBuilder';
import type { AirdropSystem } from './AirdropSystem';
import type { ZombieDirector } from './ZombieDirector';

export interface WaveDeps {
  director: ZombieDirector;
  bus: EventBus<GameEvents>;
  airdrop: AirdropSystem;
  player: Player;
  barricades: BarricadeHandle[];
  rng: Rng;
  /** Centro del refugio: hacia ahí avanzan los ciegos y ahí caen las recompensas. */
  refugeX: number;
  /** Oleada con la que empieza (0 = la primera). */
  startWave: number;
  /** Sucesos que la escena convierte en ambiente (alarma, horda, jefe, fin). */
  onEvent(event: WaveEvent<EnemyKind>): void;
}

/** Cada cuánto se reenvía el estado al HUD aunque no cambie nada. */
const STATUS_EVERY_MS = 120;

/**
 * Oleadas en la capa de juego: hace llegar a los enemigos por los dos
 * extremos, cuenta las bajas, anuncia cada oleada, suelta la recompensa
 * al superarla y avisa a la escena de la alarma, la horda y el jefe.
 */
export class WaveSystem {
  readonly run: WaveRun<EnemyKind>;
  private lastKills: number;
  private nextStatusAt = 0;
  private readonly startedAt: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: WaveDeps,
  ) {
    const now = scene.time.now;
    this.run = new WaveRun(SURVIVAL_WAVES, WAVE_TIMING, deps.rng, now, deps.startWave);
    this.lastKills = deps.director.kills;
    this.startedAt = now;
  }

  /** Empieza: anuncia la primera oleada. */
  begin(): void {
    this.handle(this.run.begin(this.scene.time.now));
  }

  get elapsedMs(): number {
    return this.scene.time.now - this.startedAt;
  }

  update(now: number): void {
    const director = this.deps.director;
    // Bajas desde el último fotograma (las cuenta la escena al matar).
    while (this.lastKills < director.kills) {
      this.lastKills += 1;
      this.run.onKill();
    }
    this.handle(this.run.update(now, director.aliveCount));
    if (now >= this.nextStatusAt) {
      this.nextStatusAt = now + STATUS_EVERY_MS;
      this.emitStatus(now);
    }
  }

  /** Salta a una oleada (pruebas). */
  skipTo(index: number): void {
    this.deps.director.clear();
    this.handle(this.run.skipTo(index, this.scene.time.now));
  }

  private handle(events: WaveEvent<EnemyKind>[]): void {
    const { bus, director, refugeX } = this.deps;
    for (const event of events) {
      const wave = this.run.current;
      switch (event.type) {
        case 'intro':
          playSfx(this.scene, SFX.radioAlarm, 0.35, 0);
          bus.emit('announce', { title: wave.title, subtitle: wave.subtitle, tone: 'info' });
          break;
        case 'alarm':
          bus.emit('announce', { title: '¡ALARMA!', subtitle: 'EL RUIDO HA DESPERTADO A LA HORDA', tone: 'danger' });
          break;
        case 'fight':
          if (wave.final) bus.emit('announce', { title: wave.title, subtitle: wave.subtitle, tone: 'danger' });
          break;
        case 'spawn':
          director.spawnAtEdge(event.kind, event.side, refugeX);
          break;
        case 'cleared':
          playSfx(this.scene, SFX.pickup, 0.5, 0);
          if (!wave.final) {
            bus.emit('announce', { title: `${wave.title} SUPERADA`, subtitle: 'CONDOR 7 SUELTA SUMINISTROS', tone: 'success' });
            this.dropReward();
          }
          break;
        case 'boss':
        case 'done':
          break;
      }
      this.deps.onEvent(event);
    }
  }

  /** La recompensa cae en el refugio, junto a Alex pero no encima. */
  private dropReward(): void {
    const reward = (this.run.current as (typeof SURVIVAL_WAVES)[number]).reward;
    if (!reward) return;
    const { player, refugeX, airdrop } = this.deps;
    const side = player.x <= refugeX ? 1 : -1;
    const x = Math.round(refugeX + side * 34);
    airdrop.dropCrate(x, rewardLoot(reward, player.weapons.arsenal.ownedIds()), this.scene.time.now);
  }

  private emitStatus(now: number): void {
    const run = this.run;
    this.deps.bus.emit('wave', {
      wave: run.number,
      waves: run.waves.length,
      phase: run.phase,
      remaining: run.remaining,
      total: run.total,
      progress: run.progress,
      timeLeft: run.timeLeft(now),
      barricades: this.deps.barricades.map((b) => (b.broken ? 0 : 1 - b.hits / b.maxHits)),
    });
  }
}
