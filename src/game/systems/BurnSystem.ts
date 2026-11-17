import type Phaser from 'phaser';
import type { BurnDef } from '../../content/weapons';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import type { Zombie } from '../entities/Zombie';
import type { Light, LightingSystem } from './LightingSystem';

interface Burning {
  zombie: Zombie;
  flame: Phaser.GameObjects.Sprite;
  light: Light | null;
  endsAt: number;
  nextTickAt: number;
  dps: number;
}

/** Cada cuánto hace daño el fuego. */
const TICK_MS = 250;
/** Como mucho tantos enemigos ardiendo emiten luz propia. */
const MAX_LIT = 5;

/**
 * Enemigos en llamas: el lanzallamas los prende y siguen ardiendo un
 * tiempo, con una llama encima que ilumina a su alrededor y daño cada
 * cuarto de segundo. Volver a alcanzarlos alarga el fuego.
 */
export class BurnSystem {
  private readonly burning = new Map<Zombie, Burning>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lighting: LightingSystem,
    private readonly damage: (zombie: Zombie, amount: number, now: number) => void,
  ) {}

  get count(): number {
    return this.burning.size;
  }

  ignite(zombie: Zombie, burn: BurnDef, now: number): void {
    if (!zombie.alive) return;
    const current = this.burning.get(zombie);
    if (current) {
      current.endsAt = Math.max(current.endsAt, now + burn.durationMs);
      return;
    }
    const flame = this.scene.add
      .sprite(zombie.x, zombie.y, ATLAS_KEY, 'fx/fire/0')
      .setOrigin(0.5, 1)
      .setDepth(zombie.depth + 0.2)
      .play('fx/fire');
    const lit = [...this.burning.values()].filter((b) => b.light).length < MAX_LIT;
    const light = lit ? this.lighting.addLight(MASK.radialMedium, zombie.x, zombie.y - 12, { intensity: 0.8, flicker: 0.3 }) : null;
    this.burning.set(zombie, { zombie, flame, light, endsAt: now + burn.durationMs, nextTickAt: now + TICK_MS, dps: burn.dps });
  }

  update(now: number): void {
    for (const [zombie, fire] of this.burning) {
      if (!zombie.active || !zombie.alive || now >= fire.endsAt) {
        this.extinguish(fire);
        continue;
      }
      fire.flame.setPosition(zombie.x, zombie.y - 6).setDepth(zombie.depth + 0.2);
      if (fire.light) {
        fire.light.x = zombie.x;
        fire.light.y = zombie.y - 14;
      }
      if (now >= fire.nextTickAt) {
        fire.nextTickAt = now + TICK_MS;
        this.damage(zombie, (fire.dps * TICK_MS) / 1000, now);
      }
    }
  }

  private extinguish(fire: Burning): void {
    fire.flame.destroy();
    if (fire.light) this.lighting.removeLight(fire.light);
    this.burning.delete(fire.zombie);
  }
}
