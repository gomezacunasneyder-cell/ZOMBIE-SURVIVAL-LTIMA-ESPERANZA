import type Phaser from 'phaser';
import type { EnemyKind } from '../../content/enemies';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import type { WaveEvent } from '../../core/waves/WaveRun';
import { SFX, playSfx } from '../boot/registerAudio';
import type { Player } from '../entities/Player';
import type { AirdropSystem } from '../systems/AirdropSystem';
import type { CameraRig } from '../systems/CameraRig';
import type { DayNight } from '../systems/DayNight';
import type { FxSystem } from '../systems/FxSystem';
import type { LightingSystem } from '../systems/LightingSystem';
import type { NoiseSystem } from '../systems/NoiseSystem';
import { WaveSystem } from '../systems/WaveSystem';
import type { ZombieDirector } from '../systems/ZombieDirector';
import type { BuiltLevel } from '../world/LevelBuilder';
import { BossIntro } from './BossIntro';

export interface SurvivalDeps {
  director: ZombieDirector;
  bus: EventBus<GameEvents>;
  airdrop: AirdropSystem;
  player: Player;
  built: BuiltLevel;
  dayNight: DayNight;
  cameraRig: CameraRig;
  fx: FxSystem;
  lighting: LightingSystem;
  noise: NoiseSystem;
  rng: Rng;
  groundY: number;
  refugeX: number;
  startWave: number;
}

/** Lo que la escena pasa al director de audio. */
export interface SurvivalAudio {
  danger: number;
  hush: number;
}

/** Por debajo de esta integridad, una barricada «cede» y salta el aviso. */
const BARRICADE_WARNING = 0.35;
const ALARM_NOISE_EVERY_MS = 1500;
/** El estruendo de las alarmas se oye en todo el nivel. */
const ALARM_NOISE_RADIUS = 900;

/**
 * Modo supervivencia: oleadas, ambiente de la horda final (alarmas,
 * luz roja que late, temblores, música al máximo, avisos de peligro) y
 * la llegada del jefe. La escena solo tiene que llamar a `update`.
 */
export class SurvivalMode {
  readonly waves: WaveSystem;
  private horde: 'off' | 'alarm' | 'fighting' = 'off';
  private boss: BossIntro | null = null;
  private finished = false;
  private alert = 0;
  private danger = 0;
  private shownDanger = -1;
  private nextAlarmNoiseAt = 0;
  private nextRumbleAt = 0;
  private readonly warned = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: SurvivalDeps,
  ) {
    // Las alarmas callan hasta que llega la horda.
    for (const alarm of deps.built.alarms) alarm.armed = false;
    this.waves = new WaveSystem(scene, {
      director: deps.director,
      bus: deps.bus,
      airdrop: deps.airdrop,
      player: deps.player,
      barricades: deps.built.barricades,
      rng: deps.rng,
      refugeX: deps.refugeX,
      startWave: deps.startWave,
      onEvent: (event) => this.onWaveEvent(event),
    });
  }

  begin(): void {
    this.waves.begin();
  }

  get bossRevealed(): boolean {
    return this.boss?.revealed ?? false;
  }

  get state(): { horde: string; alert: number; danger: number; finished: boolean; boss: boolean } {
    return { horde: this.horde, alert: this.alert, danger: this.danger, finished: this.finished, boss: this.boss !== null };
  }

  private onWaveEvent(event: WaveEvent<EnemyKind>): void {
    const now = this.scene.time.now;
    switch (event.type) {
      case 'alarm': {
        this.horde = 'alarm';
        // Mientras suena la alarma se preparan los enemigos de la horda (los que caben a la vez).
        const wave = this.waves.run.current;
        const total = wave.groups.reduce((sum, g) => sum + g.count, 0);
        const plan: Partial<Record<EnemyKind, number>> = {};
        for (const g of wave.groups) plan[g.kind] = Math.ceil((g.count / total) * wave.maxAlive) + 2;
        this.deps.director.prewarm(plan);
        for (const alarm of this.deps.built.alarms) alarm.armed = true;
        playSfx(this.scene, SFX.radioAlarm, 0.7, 0);
        break;
      }
      case 'fight':
        if (this.horde === 'alarm') {
          this.horde = 'fighting';
          this.deps.bus.emit('announce', { title: '¡VIENEN POR LOS DOS LADOS!', subtitle: 'DEFIENDE LA BARRICADA', tone: 'danger' });
        }
        break;
      case 'boss':
        this.horde = 'off';
        for (const alarm of this.deps.built.alarms) alarm.armed = false;
        this.boss = new BossIntro(this.scene, this.deps.bus, this.deps.lighting, this.deps.fx, this.deps.cameraRig, this.deps.groundY, now);
        break;
      case 'done':
        this.finished = true;
        this.deps.bus.emit('survivalEnd', { waves: this.waves.run.waves.length, kills: this.deps.director.kills, timeMs: this.waves.elapsedMs });
        break;
      default:
        break;
    }
  }

  update(now: number, deltaMs: number): SurvivalAudio {
    this.waves.update(now);
    this.watchBarricades();
    let hush = 0;
    let blackout = 0;
    if (this.boss) {
      const ambience = this.boss.update(now);
      hush = ambience.hush;
      blackout = ambience.blackout;
      this.alert = Math.max(0, this.alert - deltaMs / 1500);
      this.danger = 0;
    } else if (this.horde !== 'off') {
      this.updateHorde(now, deltaMs);
    } else {
      this.alert = Math.max(0, this.alert - deltaMs / 1500);
      this.danger = this.weakestBarricade() < BARRICADE_WARNING ? 0.5 : 0;
    }
    this.deps.dayNight.setEmergency(this.alert, blackout);
    const shown = Math.round(this.danger * 10) / 10;
    if (shown !== this.shownDanger) {
      this.shownDanger = shown;
      this.deps.bus.emit('danger', { level: shown });
    }
    return { danger: this.horde === 'off' ? this.danger * 0.6 : 1, hush };
  }

  /** Alarma y horda: luz roja que late con la sirena, temblores y estruendo. */
  private updateHorde(now: number, deltaMs: number): void {
    const target = this.horde === 'alarm' ? 0.75 : 0.6;
    const pulse = 0.25 * Math.max(0, Math.sin(now * 0.0125));
    this.alert = Math.min(target + pulse, this.alert + deltaMs / 2500 + pulse * 0.1);
    this.danger = this.horde === 'alarm' ? 0.7 : 0.6 + 0.4 * (1 - this.weakestBarricade());
    if (now >= this.nextAlarmNoiseAt) {
      this.nextAlarmNoiseAt = now + ALARM_NOISE_EVERY_MS;
      for (const alarm of this.deps.built.alarms) this.deps.noise.emit(alarm.x, ALARM_NOISE_RADIUS, 'machine', now, false);
    }
    // La horda que se acerca hace temblar el suelo.
    if (now >= this.nextRumbleAt) {
      this.nextRumbleAt = now + 1300;
      const crowd = Math.min(1, this.deps.director.aliveCount / 40);
      this.deps.cameraRig.addTrauma((this.horde === 'alarm' ? 0.12 : 0.05) + crowd * 0.1);
    }
  }

  private weakestBarricade(): number {
    let weakest = 1;
    for (const b of this.deps.built.barricades) weakest = Math.min(weakest, b.broken ? 0 : 1 - b.hits / b.maxHits);
    return weakest;
  }

  /** Avisos de peligro: una barricada cede o cae. */
  private watchBarricades(): void {
    this.deps.built.barricades.forEach((b, i) => {
      const side = b.x < this.deps.refugeX ? 'IZQUIERDA' : 'DERECHA';
      const integrity = b.broken ? 0 : 1 - b.hits / b.maxHits;
      if (integrity < BARRICADE_WARNING && !this.warned.has(`cede${i}`)) {
        this.warned.add(`cede${i}`);
        this.deps.bus.emit('announce', { title: '¡LA BARRICADA CEDE!', subtitle: `LADO ${side}`, tone: 'danger' });
      }
      if (b.broken && !this.warned.has(`rota${i}`)) {
        this.warned.add(`rota${i}`);
        this.deps.bus.emit('announce', { title: '¡HAN ROTO LA BARRICADA!', subtitle: `ENTRAN POR LA ${side}`, tone: 'danger' });
      }
    });
  }
}
