import type Phaser from 'phaser';
import { BOSS_HAZARDS, BOSS_TEXT } from '../../content/boss';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { SFX, playSfx, playSfxAt } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import type { Player } from '../entities/Player';
import type { AtmosphereSystem } from '../systems/AtmosphereSystem';
import type { CameraRig } from '../systems/CameraRig';
import type { FxSystem } from '../systems/FxSystem';
import type { ZombieDirector } from '../systems/ZombieDirector';
import type { BossFight } from './BossFight';

export interface CinemaDeps {
  bus: EventBus<GameEvents>;
  director: ZombieDirector;
  player: Player;
  fx: FxSystem;
  cameraRig: CameraRig;
  atmosphere: AtmosphereSystem;
  groundY: number;
  refugeX: number;
  /** Duración de la presentación, hasta que empieza el combate. */
  introMs: number;
}

/** Lo que la secuencia pide a la escena: música, luz y peligro. */
export interface BossAmbience {
  hush: number;
  blackout: number;
  alert: number;
  danger: number;
  /** 0–1: velo oscuro sobre toda la pantalla. */
  dim: number;
}

export type CinemaStage = 'intro' | 'fight' | 'dying' | 'victory' | 'epilogue' | 'final' | 'done';

/** Desde que muere el jefe hasta la grabación militar. */
const EPILOGUE_AT = 8500;

/**
 * Presentación y final del jefe.
 *
 * Presentación (11 s): la horda cae · se apaga la luz y calla la música ·
 * aparecen rezagados que, al temblar el suelo, huyen · columna de humo ·
 * EL DEVORADOR surge del humo · ruge y se muestra su nombre · Cóndor 7
 * deja munición · empieza el combate.
 *
 * Final: muere a cámara lenta entre sangre y polvo · VICTORIA · grabación
 * militar (otra escena, con el juego detenido) · silencio · un chasquido
 * detrás de Alex · CONTINUARÁ.
 */
export class BossCinema {
  stage: CinemaStage = 'intro';
  private readonly fired = new Set<string>();
  private stageAt: number;
  private nextRumbleAt = 0;
  private nextSmokeAt = 0;
  private stopSmoke: (() => void) | null = null;
  private readonly entryX: number;
  /** Hacia dónde mira Alex en las escenas en que no se le controla, o `null`. */
  lookAt: 1 | -1 | null = null;
  /** Punto que encuadra la cámara en las escenas, o `null` para seguir a Alex. */
  get focus(): number | null {
    const t = this.scene.time.now - this.stageAt;
    const boss = this.fight.devourer.x;
    const player = this.deps.player.x;
    if (this.stage === 'intro' && t >= 4000) return (boss + player) / 2;
    if (this.stage === 'dying') return (boss * 2 + player) / 3;
    return null;
  }

  /** La escena abre la grabación militar. */
  onEpilogue: (() => void) | null = null;
  /** Fin de todo: la escena lo comunica a las oleadas. */
  onFinished: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: CinemaDeps,
    private readonly fight: BossFight,
    entryX: number,
    now: number,
  ) {
    this.entryX = entryX;
    this.stageAt = now;
    fight.onDied = () => this.enter('dying', this.scene.time.now);
  }

  /** Durante la presentación y el final no se controla a Alex. */
  get cinematic(): boolean {
    return this.stage === 'intro' || this.stage === 'dying' || this.stage === 'victory' || this.stage === 'final';
  }

  private enter(stage: CinemaStage, now: number): void {
    this.stage = stage;
    this.stageAt = now;
    this.fired.clear();
  }

  private once(key: string, at: number, elapsed: number, action: () => void): void {
    if (elapsed < at || this.fired.has(key)) return;
    this.fired.add(key);
    action();
  }

  /** La grabación ha terminado: el último momento. */
  epilogueDone(): void {
    // El juego estuvo detenido: la escena final empieza a contar en su primer fotograma.
    if (this.stage === 'epilogue') this.enter('final', Number.NaN);
  }

  update(now: number): BossAmbience {
    if (Number.isNaN(this.stageAt)) this.stageAt = now;
    const t = now - this.stageAt;
    switch (this.stage) {
      case 'intro':
        return this.intro(now, t);
      case 'fight': {
        const phase = this.fight.phase;
        // Fase 2 y 3: luz de emergencia que late; la música no afloja.
        const alert = phase === 1 ? 0 : (phase === 2 ? 0.35 : 0.55) + 0.2 * Math.max(0, Math.sin(now * 0.008));
        return { hush: 0, blackout: 0.35, alert, danger: phase === 1 ? 0.6 : 1, dim: 0 };
      }
      case 'dying':
      case 'victory':
        return this.dying(now, t);
      case 'epilogue':
        return { hush: 1, blackout: 0.5, alert: 0, danger: 0, dim: 0 };
      case 'final':
        return this.final(now, t);
      case 'done':
        return { hush: 1, blackout: 1, alert: 0, danger: 0, dim: 1 };
    }
  }

  private intro(now: number, t: number): BossAmbience {
    const { bus, director, refugeX, fx, cameraRig, groundY } = this.deps;
    this.once('fallen', 0, t, () => bus.emit('announce', { ...BOSS_TEXT.fallen, tone: 'success' }));
    // Rezagados que se acercan… y huyen al temblar el suelo.
    this.once('stragglers', 600, t, () => {
      for (let i = 0; i < BOSS_HAZARDS.stragglers; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        director.spawn(refugeX + side * (190 + (i % 3) * 22), i % 3 === 0 ? 'runner' : 'walker');
      }
    });
    this.once('flee', 3000, t, () => {
      // Huyen hacia fuera, lejos del refugio y de lo que se acerca.
      director.scatter(refugeX);
      playSfxAt(this.scene, SFX.screech, refugeX, 0.4);
      bus.emit('announce', { ...BOSS_TEXT.flee, tone: 'danger' });
    });
    this.once('smoke', 4500, t, () => {
      this.stopSmoke = this.deps.atmosphere.addFire({ x: this.entryX, y: groundY - 10 });
      fx.dustPuff(this.entryX, groundY, 18);
      playSfxAt(this.scene, SFX.bossGrowl, this.entryX, 0.8);
    });
    this.once('emerge', 6000, t, () => {
      this.fight.devourer.override = 'walk';
      this.fight.devourer.setShade(0.4, 0.85);
    });
    // Columna de humo y polvo de la que va a salir.
    if (t >= 4500 && t < 9000 && now >= this.nextSmokeAt) {
      this.nextSmokeAt = now + 90;
      fx.dustPuff(this.entryX + (Math.random() - 0.5) * 50, groundY - Math.random() * 40, 3);
    }
    // Sale del humo caminando hacia Alex, aclarándose poco a poco.
    if (t >= 6000 && t < 8200) {
      const k = (t - 6000) / 2200;
      const dir = this.entryX > refugeX ? -1 : 1;
      this.fight.devourer.setX(this.entryX + dir * Math.round(k * 50));
      this.fight.devourer.setShade(Math.min(1, 0.4 + k), Math.max(0, 0.85 - k));
      fx.dustPuff(this.fight.devourer.x + dir * 10, groundY, 1);
    }
    this.once('roar', 8200, t, () => {
      this.fight.devourer.override = 'roar';
      this.fight.devourer.setShade(1, 0);
      playSfx(this.scene, SFX.bossRoar, 1, 0);
      cameraRig.addTrauma(1);
      bus.emit('announce', { title: BOSS_TEXT.name, subtitle: BOSS_TEXT.title, tone: 'boss' });
      this.fight.emitBar(now, true);
    });
    this.once('fight', this.deps.introMs, t, () => {
      this.fight.devourer.override = null;
      this.stopSmoke?.();
      this.stopSmoke = null;
      this.fight.begin(now);
      this.enter('fight', now);
      // Cuando ya se ha leído su nombre, Cóndor 7 deja munición.
      this.scene.time.delayedCall(1800, () => this.fight.dropSupplies('start', this.scene.time.now));
    });
    // Temblores cada vez más fuertes hasta que ruge.
    if (t >= 2500 && t < 8200 && now >= this.nextRumbleAt) {
      this.nextRumbleAt = now + 550;
      cameraRig.addTrauma(0.08 + ((t - 2500) / 5700) * 0.3);
      fx.dustPuff(this.scene.cameras.main.scrollX + Math.random() * GAME_WIDTH, groundY, 3);
    }
    return {
      hush: Math.min(1, t / 1800),
      // La pantalla se oscurece y vuelve algo de luz cuando empieza el combate.
      blackout: Math.min(0.85, t / 2500) - (t > 8200 ? Math.min(0.5, (t - 8200) / 2000) : 0),
      alert: 0,
      danger: t > 8200 ? 0.6 : 0,
      // La pantalla se oscurece; al rugir vuelve la luz para el combate.
      dim: t < 8200 ? Math.min(0.55, t / 3000) : Math.max(0, 0.55 - (t - 8200) / 1500),
    };
  }

  private dying(now: number, t: number): BossAmbience {
    const { bus, fx, cameraRig, groundY } = this.deps;
    const x = this.fight.devourer.x;
    if (this.stage === 'dying') {
      this.once('cinema', 0, t, () => {
        bus.emit('cinematic', { on: true });
        cameraRig.addTrauma(0.7);
      });
      for (const [key, at] of [
        ['b1', 500],
        ['b2', 1200],
        ['b3', 1900],
      ] as const) {
        this.once(key, at, t, () => {
          fx.bloodBurst(x + (Math.random() - 0.5) * 30, groundY - 40, 14);
          fx.debris(x, groundY - 30, 6);
          cameraRig.addTrauma(0.3);
        });
      }
      // El cuerpo se derrumba contra el asfalto.
      this.once('fall', 2700, t, () => {
        cameraRig.addTrauma(1);
        fx.dustPuff(x, groundY, 24);
        playSfx(this.scene, SFX.bossSlam, 0.9, 0);
      });
      this.once('victory', 5200, t, () => {
        bus.emit('announce', { ...BOSS_TEXT.victory, tone: 'success' });
        playSfx(this.scene, SFX.pickup, 0.6, 0);
        this.enter('victory', now);
      });
    } else {
      this.once('epilogue', EPILOGUE_AT - 5200, t, () => {
        this.enter('epilogue', now);
        this.onEpilogue?.();
      });
    }
    const total = this.stage === 'dying' ? t : t + 5200;
    return { hush: 1, blackout: Math.max(0.15, 0.35 - total / 20000), alert: 0, danger: 0, dim: 0 };
  }

  /** Silencio, oscuridad… y un chasquido detrás de Alex. */
  private final(now: number, t: number): BossAmbience {
    const { player, bus } = this.deps;
    this.once('silence', 0, t, () => {
      this.lookAt = player.facing;
      bus.emit('announce', { title: '', subtitle: '...', tone: 'info' });
    });
    const behind = (): number => player.x - (this.lookAt ?? player.facing) * 110;
    this.once('click1', 2200, t, () => playSfxAt(this.scene, SFX.clicks, behind(), 0.7));
    this.once('turn', 3000, t, () => {
      this.lookAt = this.lookAt === 1 ? -1 : 1;
    });
    this.once('click2', 3500, t, () => {
      playSfx(this.scene, SFX.clicks, 0.95, 0);
      playSfx(this.scene, SFX.screech, 0.35, 0);
    });
    this.once('end', 4200, t, () => {
      this.enter('done', now);
      this.onFinished?.();
    });
    return { hush: 1, blackout: Math.min(1, 0.5 + t / 3000), alert: 0, danger: 0, dim: Math.min(0.7, t / 3000) };
  }
}
