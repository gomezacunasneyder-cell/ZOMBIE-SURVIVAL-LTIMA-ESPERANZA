import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { BOSS_HAZARDS } from '../../content/boss';
import type { BossPhase } from '../../core/boss/DevourerBrain';
import { throwVelocity } from '../../core/combat/Throwables';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { Player } from '../entities/Player';
import { DEPTH } from '../world/depths';
import type { CameraRig } from './CameraRig';
import type { FxSystem } from './FxSystem';
import type { LightingSystem } from './LightingSystem';

interface Wave {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  dir: 1 | -1;
  speed: number;
  travelled: number;
  range: number;
  damage: number;
  hit: boolean;
  nextDustAt: number;
}

interface Blob {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

interface Puddle {
  sprite: Phaser.GameObjects.Image;
  x: number;
  endsAt: number;
  nextHurtAt: number;
}

interface Spike {
  x: number;
  at: number;
  /** Ya se ha avisado (la grieta se crea una sola vez). */
  warned: boolean;
  warning: Phaser.GameObjects.Sprite | null;
  sprite: Phaser.GameObjects.Sprite | null;
  glow: Phaser.GameObjects.Image | null;
  endsAt: number;
  damage: number;
  hit: boolean;
}

/** Gravedad de la bilis: más flotante que la del mundo para que se vea venir. */
const BILE_GRAVITY = 520;
const BILE_ARC = { launchDeg: 42, minRange: 40, maxRange: 520 };
const PUDDLE_HURT_MS = 500;
const CONTACT_HURT_MS = 700;

/**
 * Lo que hace daño durante el combate contra EL DEVORADOR: la onda del
 * golpe contra el suelo (se salta), la bilis en parábola y sus charcos,
 * las espinas de la erupción (avisadas con una grieta encendida), el
 * zarpazo de la embestida y el simple contacto con su cuerpo.
 */
export class BossHazards {
  private readonly waves: Wave[] = [];
  private readonly blobs: Blob[] = [];
  private readonly puddles: Puddle[] = [];
  private readonly spikes: Spike[] = [];
  private nextContactAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lighting: LightingSystem,
    private readonly fx: FxSystem,
    private readonly cameraRig: CameraRig,
    private readonly player: Player,
    private readonly groundY: number,
    private readonly worldWidth: number,
    private readonly hurt: (damage: number, fromX: number, now: number, shove: number) => void,
  ) {}

  /** Peligros activos (pruebas). */
  get counts(): { waves: number; bile: number; puddles: number; spikes: number } {
    return { waves: this.waves.length, bile: this.blobs.length, puddles: this.puddles.length, spikes: this.spikes.length };
  }

  private scale(phase: BossPhase): number {
    return phase === 1 ? 1 : BOSS_HAZARDS.enragedDamage;
  }

  /** Golpe contra el suelo: dos ondas que se alejan hacia los lados. */
  slam(x: number, phase: BossPhase): void {
    const rules = BOSS_HAZARDS.shockwave;
    const i = phase - 1;
    playSfxAt(this.scene, SFX.bossSlam, x, 1);
    this.cameraRig.addTrauma(0.7);
    this.fx.dustPuff(x, this.groundY, 16);
    this.fx.debris(x, this.groundY - 4, 10);
    for (const dir of [-1, 1] as const) {
      const sprite = this.scene.add.sprite(x, this.groundY + 1, ATLAS_KEY, 'boss/shockwave/0').setOrigin(0.5, 1).setDepth(DEPTH.fx).play('boss/shockwave');
      sprite.setFlipX(dir === -1);
      this.waves.push({
        sprite,
        x,
        dir,
        speed: rules.speed[i] ?? 240,
        travelled: 0,
        range: rules.range[i] ?? 360,
        damage: Math.round(rules.damage * this.scale(phase)),
        hit: false,
        nextDustAt: 0,
      });
    }
  }

  /** Embestida: el zarpazo alcanza a Alex si está delante y cerca. */
  swipe(x: number, facing: 1 | -1, phase: BossPhase, now: number): boolean {
    const rules = BOSS_HAZARDS.charge;
    playSfxAt(this.scene, SFX.slam, x, 0.8);
    this.cameraRig.addTrauma(0.35);
    const p = this.player;
    const ahead = (p.x - x) * facing > -14;
    if (!p.alive || !ahead || Math.abs(p.x - x) > rules.reach) return false;
    this.hurt(Math.round(rules.damage * this.scale(phase)), x - facing * 20, now, rules.shove);
    return true;
  }

  /** Escupe bilis hacia Alex: varias gotas repartidas alrededor de él. */
  spit(from: { x: number; y: number }, targetX: number, count: number, phase: BossPhase): void {
    const rules = BOSS_HAZARDS.bile;
    playSfxAt(this.scene, SFX.bossSpit, from.x, 0.8);
    const facing: 1 | -1 = targetX >= from.x ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * rules.spreadPx * 2;
      const v = throwVelocity(targetX + offset - from.x, facing, BILE_ARC, BILE_GRAVITY, this.groundY - from.y);
      const sprite = this.scene.add.sprite(from.x, from.y, ATLAS_KEY, 'boss/bile/0').setDepth(DEPTH.bullet).play('boss/bile');
      this.blobs.push({ sprite, x: from.x, y: from.y, vx: v.vx, vy: v.vy, damage: Math.round(rules.damage * this.scale(phase)) });
    }
  }

  /** Erupción: cada espina se avisa con una grieta y brota al rato. */
  erupt(spikes: { x: number; delayMs: number }[], phase: BossPhase, now: number): void {
    const damage = Math.round(BOSS_HAZARDS.spike.damage * this.scale(phase));
    for (const spike of spikes) {
      if (spike.x < 8 || spike.x > this.worldWidth - 8) continue;
      this.spikes.push({ x: spike.x, at: now + spike.delayMs, warned: false, warning: null, sprite: null, glow: null, endsAt: Infinity, damage, hit: false });
    }
  }

  update(now: number, deltaMs: number, boss: { x: number; alive: boolean; phase: BossPhase } | null): void {
    const dt = deltaMs / 1000;
    this.updateWaves(now, dt);
    this.updateBile(now, dt);
    this.updatePuddles(now);
    this.updateSpikes(now);
    // Tocar al jefe hace daño y empuja.
    const p = this.player;
    if (boss?.alive && p.alive && now >= this.nextContactAt && Math.abs(p.x - boss.x) < 15) {
      this.nextContactAt = now + CONTACT_HURT_MS;
      this.hurt(Math.round(BOSS_HAZARDS.contact.damage * this.scale(boss.phase)), boss.x, now, BOSS_HAZARDS.contact.shove);
    }
  }

  private updateWaves(now: number, dt: number): void {
    const p = this.player;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i] as Wave;
      const step = wave.speed * dt;
      wave.x += wave.dir * step;
      wave.travelled += step;
      wave.sprite.setX(Math.round(wave.x));
      if (now >= wave.nextDustAt) {
        wave.nextDustAt = now + 70;
        this.fx.dustPuff(wave.x, this.groundY, 2);
      }
      // A ras de suelo: saltando por encima se esquiva.
      const low = p.sprite.y > this.groundY - BOSS_HAZARDS.shockwave.height;
      if (!wave.hit && p.alive && low && Math.abs(p.x - wave.x) < 9) {
        wave.hit = true;
        this.hurt(wave.damage, wave.x - wave.dir * 10, now, BOSS_HAZARDS.shockwave.shove);
      }
      if (wave.travelled >= wave.range || wave.x < 0 || wave.x > this.worldWidth) {
        wave.sprite.destroy();
        this.waves.splice(i, 1);
      }
    }
  }

  private updateBile(now: number, dt: number): void {
    const p = this.player;
    const rules = BOSS_HAZARDS.bile;
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const blob = this.blobs[i] as Blob;
      blob.vy += BILE_GRAVITY * dt;
      blob.x += blob.vx * dt;
      blob.y += blob.vy * dt;
      blob.sprite.setPosition(Math.round(blob.x), Math.round(blob.y));
      const hitsPlayer = p.alive && Math.abs(p.x - blob.x) < 7 && blob.y > p.sprite.y - 26 && blob.y < p.sprite.y;
      if (!hitsPlayer && blob.y < this.groundY) continue;
      blob.sprite.destroy();
      this.blobs.splice(i, 1);
      playSfxAt(this.scene, SFX.bileSplat, blob.x, 0.5);
      this.fx.bloodBurst(blob.x, Math.min(blob.y, this.groundY - 2), 3);
      if (hitsPlayer) this.hurt(blob.damage, blob.x - Math.sign(blob.vx) * 6, now, 0.6);
      else {
        const sprite = this.scene.add.image(Math.round(blob.x), this.groundY + 1, ATLAS_KEY, 'boss/bile-puddle').setOrigin(0.5, 1).setDepth(DEPTH.decal + 0.2);
        this.puddles.push({ sprite, x: blob.x, endsAt: now + rules.puddleMs, nextHurtAt: now });
      }
    }
  }

  private updatePuddles(now: number): void {
    const p = this.player;
    const rules = BOSS_HAZARDS.bile;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const puddle = this.puddles[i] as Puddle;
      const left = puddle.endsAt - now;
      if (left <= 0) {
        puddle.sprite.destroy();
        this.puddles.splice(i, 1);
        continue;
      }
      puddle.sprite.setAlpha(left < 600 ? 0.5 : 1);
      if (p.alive && p.onGround && Math.abs(p.x - puddle.x) < rules.puddleWidth / 2 && now >= puddle.nextHurtAt) {
        puddle.nextHurtAt = now + PUDDLE_HURT_MS;
        this.hurt(rules.puddleDamage, puddle.x, now, 0);
      }
    }
  }

  private updateSpikes(now: number): void {
    const p = this.player;
    const rules = BOSS_HAZARDS.spike;
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const spike = this.spikes[i] as Spike;
      // Grieta encendida antes de brotar.
      if (!spike.warned && now >= spike.at - rules.telegraphMs) {
        spike.warned = true;
        spike.warning = this.scene.add.sprite(spike.x, this.groundY + 2, ATLAS_KEY, 'boss/spike-warning/0').setOrigin(0.5, 1).setDepth(DEPTH.decal + 0.3).play('boss/spike-warning');
        spike.glow = this.lighting.addGlow(MASK.radialTiny, spike.x, this.groundY - 1, colorNumber('org1'), 0.4);
      }
      if (!spike.sprite && now >= spike.at) {
        spike.warning?.destroy();
        spike.warning = null;
        spike.glow?.destroy();
        spike.glow = null;
        spike.sprite = this.scene.add.sprite(spike.x, this.groundY + 2, ATLAS_KEY, 'boss/spike/0').setOrigin(0.5, 1).setDepth(DEPTH.zombie + 0.6).play('boss/spike');
        spike.endsAt = now + rules.upMs;
        playSfxAt(this.scene, SFX.spike, spike.x, 0.45);
        this.fx.debris(spike.x, this.groundY - 2, 3);
      }
      if (spike.sprite && !spike.hit && now < spike.at + 160 && p.alive && Math.abs(p.x - spike.x) < rules.width / 2 + 4 && p.sprite.y > this.groundY - 26) {
        spike.hit = true;
        this.hurt(spike.damage, spike.x, now, 1.2);
      }
      if (now >= spike.endsAt) {
        spike.sprite?.destroy();
        spike.glow?.destroy();
        this.spikes.splice(i, 1);
      }
    }
  }

  /** Lo retira todo (al morir el jefe). */
  clear(): void {
    for (const wave of this.waves) wave.sprite.destroy();
    for (const blob of this.blobs) blob.sprite.destroy();
    for (const puddle of this.puddles) puddle.sprite.destroy();
    for (const spike of this.spikes) {
      spike.warning?.destroy();
      spike.sprite?.destroy();
      spike.glow?.destroy();
    }
    this.waves.length = 0;
    this.blobs.length = 0;
    this.puddles.length = 0;
    this.spikes.length = 0;
  }
}
