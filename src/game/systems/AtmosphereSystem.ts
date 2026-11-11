import type Phaser from 'phaser';
import { Rng } from '../../core/math/Rng';
import { gustAt, windSpeed } from '../../core/world/wind';
import { colorNumber } from '../../art/palette';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import { DEPTH } from '../world/depths';
import type { AlarmHandle, WorldPoint } from '../world/LevelBuilder';
import type { FxSystem } from './FxSystem';
import type { Light, LightingSystem } from './LightingSystem';

const PAPER_COUNT = 9;
/** Cada cuánto suelta humo un fuego visible. */
const SMOKE_EVERY_MS = 170;

interface Paper {
  sprite: Phaser.GameObjects.Sprite;
  baseY: number;
  phase: number;
  /** Cuánto lo arrastra el viento respecto a los demás. */
  drag: number;
}

interface Sparker extends WorldPoint {
  nextAt: number;
  light: Light;
  lightUntil: number;
}

/**
 * Ambiente vivo: ceniza en el aire, papeles que arrastra el viento, humo
 * de los fuegos, chispazos de cables sueltos y la luz giratoria de las
 * alarmas. Todo es decorativo: no afecta a la jugabilidad.
 */
export class AtmosphereSystem {
  private readonly papers: Paper[] = [];
  private readonly sparkers: Sparker[];
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rng = new Rng(555);
  private nextSmokeAt = 0;
  /** Fuegos temporales (restos de una explosión): se añaden y retiran. */
  private readonly extraFires: WorldPoint[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: FxSystem,
    lighting: LightingSystem,
    private readonly fires: WorldPoint[],
    sparkPoints: WorldPoint[],
    private readonly alarms: AlarmHandle[],
    private readonly groundY: number,
  ) {
    // Ceniza y pavesas, fijas a la pantalla.
    scene.add
      .particles(0, 0, ATLAS_KEY, {
        frame: ['fx/ash', 'fx/ash', 'fx/ash', 'fx/ember'],
        x: { min: 0, max: 560 },
        y: -4,
        lifespan: 11000,
        speedX: { min: -16, max: -5 },
        speedY: { min: 10, max: 24 },
        frequency: 190,
        quantity: 1,
        advance: 9000,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.foreground + 1);

    this.smoke = scene.add
      .particles(0, 0, ATLAS_KEY, {
        frame: ['fx/smoke/0', 'fx/smoke/1', 'fx/smoke/1', 'fx/smoke/2'],
        emitting: false,
        lifespan: { min: 1400, max: 2600 },
        speedY: { min: -26, max: -12 },
        speedX: { min: -22, max: -4 },
        alpha: { start: 0.55, end: 0 },
      })
      .setDepth(DEPTH.fx);

    for (let i = 0; i < PAPER_COUNT; i++) {
      const baseY = groundY - 2 + this.rng.int(0, 34);
      const sprite = scene.add
        .sprite(this.rng.int(0, GAME_WIDTH), baseY, ATLAS_KEY, 'fx/paper/0')
        .setDepth(baseY + 0.5)
        .play({ key: 'fx/paper', startFrame: i % 2 });
      this.papers.push({ sprite, baseY, phase: this.rng.next() * 10, drag: 0.6 + this.rng.next() * 0.8 });
    }

    this.sparkers = sparkPoints.map((point) => {
      const light = lighting.addLight(MASK.radialMedium, point.x, point.y, { intensity: 0.9 });
      light.enabled = false;
      return { ...point, nextAt: 1500 + this.rng.next() * 3000, light, lightUntil: 0 };
    });
  }

  /** Añade un fuego temporal del que saldrá humo; devuelve cómo retirarlo. */
  addFire(point: WorldPoint): () => void {
    this.extraFires.push(point);
    return () => {
      const index = this.extraFires.indexOf(point);
      if (index >= 0) this.extraFires.splice(index, 1);
    };
  }

  update(timeMs: number, deltaMs: number): void {
    const camera = this.scene.cameras.main;
    const left = camera.scrollX;
    const right = left + GAME_WIDTH;
    const visible = (x: number, margin = 30): boolean => x > left - margin && x < right + margin;

    this.updatePapers(timeMs, deltaMs, left, right);

    if (timeMs >= this.nextSmokeAt) {
      this.nextSmokeAt = timeMs + SMOKE_EVERY_MS;
      for (const fire of [...this.fires, ...this.extraFires]) {
        if (visible(fire.x, 60)) this.smoke.emitParticleAt(fire.x + this.rng.int(-2, 2), fire.y, 1);
      }
    }

    for (const sparker of this.sparkers) {
      if (sparker.light.enabled && timeMs >= sparker.lightUntil) sparker.light.enabled = false;
      if (timeMs < sparker.nextAt) continue;
      sparker.nextAt = timeMs + 1800 + this.rng.next() * 4200;
      if (!visible(sparker.x, 120)) continue;
      this.fx.sparkBurst(sparker.x, sparker.y);
      sparker.light.enabled = true;
      sparker.lightUntil = timeMs + 110;
      playSfxAt(this.scene, SFX.zap, sparker.x, 0.35);
    }

    // Alarma: destello rojo que gira, dos vueltas por segundo.
    for (const alarm of this.alarms) {
      const sweep = Math.sin(timeMs * 0.0125);
      const on = sweep > 0.2;
      alarm.light.power = on ? 1 : 0.15;
      alarm.glow.setAlpha(on ? 0.5 : 0.08).setTint(colorNumber(on ? 'blood1' : 'blood2'));
    }
  }

  private updatePapers(timeMs: number, deltaMs: number, left: number, right: number): void {
    const wind = windSpeed(timeMs);
    const gust = gustAt(timeMs);
    for (const paper of this.papers) {
      const sprite = paper.sprite;
      sprite.x += (wind * paper.drag * deltaMs) / 1000;
      // Con racha fuerte el papel se levanta del suelo y da tumbos.
      const lift = Math.max(0, gust - 0.45) * 22 * Math.abs(Math.sin(timeMs * 0.004 + paper.phase));
      sprite.y = paper.baseY - lift;
      sprite.anims.timeScale = 0.3 + gust * 1.6;
      if (sprite.x < left - 12) {
        sprite.x = right + this.rng.int(4, 60);
        paper.baseY = this.groundY - 2 + this.rng.int(0, 34);
        sprite.setDepth(paper.baseY + 0.5);
      } else if (sprite.x > right + 80) sprite.x = right + 10;
    }
  }
}
