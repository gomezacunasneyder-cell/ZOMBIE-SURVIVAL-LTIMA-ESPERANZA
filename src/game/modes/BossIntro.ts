import type Phaser from 'phaser';
import { DEVOURER_HEIGHT } from '../../art/painters/survival';
import { colorNumber } from '../../art/palette';
import { DEVOURER_FRAMES } from '../../art/survivalArt';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import type { CameraRig } from '../systems/CameraRig';
import type { FxSystem } from '../systems/FxSystem';
import type { LightingSystem } from '../systems/LightingSystem';

/** Altura del borde superior del muro: la silueta asoma por encima. */
const WALL_TOP = 94;
/** Entre la ciudad cercana y el muro: el muro la tapa hasta que se alza. */
const SILHOUETTE_DEPTH = 2.8;
/** Ojos de la silueta, relativos a su esquina superior izquierda. */
const EYES: readonly [number, number][] = [
  [31, 46],
  [39, 44],
  [47, 47],
  [36, 50],
];

/** Lo que la secuencia pide a la escena en cada instante. */
export interface BossAmbience {
  /** 0–1: la música se apaga. */
  hush: number;
  /** 0–1: las luces de la calle se apagan. */
  blackout: number;
}

/**
 * Llegada de EL DEVORADOR al terminar la horda (14 s):
 *
 * 0 s silencio tras la horda · 2 s se apagan las farolas y tiembla el
 * suelo · 4 s un rugido lejano · 5 s una silueta enorme se alza tras el
 * muro · 9 s abre los ojos, ruge y la pantalla se sacude · 9,5 s rótulo
 * «EL DEVORADOR». El combate contra él es la Fase 6 del plan.
 */
export class BossIntro {
  private silhouette: Phaser.GameObjects.Image | null = null;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly fired = new Set<string>();
  private nextRumbleAt = 0;
  private originX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
    private readonly lighting: LightingSystem,
    private readonly fx: FxSystem,
    private readonly cameraRig: CameraRig,
    private readonly groundY: number,
    private readonly startedAt: number,
  ) {}

  /** La silueta ya se ve (pruebas). */
  get revealed(): boolean {
    return this.fired.has('eyes');
  }

  private once(key: string, at: number, elapsed: number, action: () => void): void {
    if (elapsed < at || this.fired.has(key)) return;
    this.fired.add(key);
    action();
  }

  update(now: number): BossAmbience {
    const t = now - this.startedAt;
    this.once('fallen', 0, t, () =>
      this.bus.emit('announce', { title: 'LA HORDA HA CAIDO', subtitle: 'SILENCIO...', tone: 'success' }),
    );
    this.once('roar-far', 4000, t, () => playSfx(this.scene, SFX.roar, 0.45, 0));
    this.once('rise', 5000, t, () => this.raise());
    this.once('warning', 6000, t, () =>
      this.bus.emit('announce', { title: 'ALGO SE ACERCA', subtitle: 'EL SUELO TIEMBLA', tone: 'danger' }),
    );
    this.once('eyes', 9000, t, () => this.openEyes());
    this.once('title', 9500, t, () => this.bus.emit('announce', { title: 'EL DEVORADOR', subtitle: 'HA DESPERTADO', tone: 'boss' }));

    // Temblores cada vez más fuertes hasta que abre los ojos.
    if (t >= 2000 && t < 9000 && now >= this.nextRumbleAt) {
      this.nextRumbleAt = now + 600;
      this.cameraRig.addTrauma(0.08 + ((t - 2000) / 7000) * 0.25);
      const camera = this.scene.cameras.main;
      this.fx.dustPuff(camera.scrollX + Math.random() * GAME_WIDTH, this.groundY, 3);
    }
    this.updateSilhouette(t);
    return {
      hush: Math.min(1, t / 2000),
      blackout: t < 2000 ? 0 : Math.min(1, (t - 2000) / 4000),
    };
  }

  private raise(): void {
    const camera = this.scene.cameras.main;
    // A un lado, para que el rótulo no la tape.
    this.originX = Math.round(camera.scrollX + GAME_WIDTH * 0.78);
    this.silhouette = this.scene.add
      .image(this.originX, WALL_TOP + DEVOURER_HEIGHT + 10, ATLAS_KEY, DEVOURER_FRAMES.dark)
      .setOrigin(0.5, 1)
      .setDepth(SILHOUETTE_DEPTH);
  }

  /** Se alza despacio durante 4 s, en escalones de un píxel. */
  private updateSilhouette(t: number): void {
    if (!this.silhouette) return;
    const k = Math.min(1, Math.max(0, (t - 5000) / 4000));
    const eased = 1 - (1 - k) * (1 - k);
    const bottom = WALL_TOP + DEVOURER_HEIGHT + 10 - Math.round(eased * 66);
    this.silhouette.setY(bottom);
    const left = this.originX - Math.round(this.silhouette.width / 2);
    const top = bottom - DEVOURER_HEIGHT;
    this.glows.forEach((glow, i) => {
      const [ex, ey] = EYES[i] as [number, number];
      glow.setPosition(left + ex, top + ey).setAlpha(0.55 + Math.sin(t / 140 + i) * 0.15);
    });
  }

  private openEyes(): void {
    this.silhouette?.setFrame(DEVOURER_FRAMES.eyes);
    for (let i = 0; i < EYES.length; i++) this.glows.push(this.lighting.addGlow(MASK.radialSmall, 0, 0, colorNumber('blood1'), 0.6));
    playSfx(this.scene, SFX.roar, 0.9, 0);
    this.scene.time.delayedCall(260, () => playSfx(this.scene, SFX.slam, 0.7, 0));
    this.cameraRig.addTrauma(0.9);
  }
}
