import type Phaser from 'phaser';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { ATLAS_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import type { Player } from '../entities/Player';
import { DEPTH } from '../world/depths';

interface Pickup {
  crate: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Image;
  x: number;
}

/** Distancia a la que Alex recoge una caja al pasar por encima. */
const REACH = 12;

/** Cajas de suministros con munición, señaladas con un marcador flotante. */
export class PickupSystem {
  private readonly pickups: Pickup[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    positions: number[],
    groundY: number,
    private readonly bus: EventBus<GameEvents>,
  ) {
    const y = groundY + 1;
    for (const x of positions) {
      const crate = scene.add.image(x, y, ATLAS_KEY, 'prop/supply-crate').setOrigin(0.5, 1).setDepth(y);
      const marker = scene.add.image(x, y - 24, ATLAS_KEY, 'ui/pickup').setDepth(DEPTH.fx);
      scene.tweens.add({ targets: marker, y: y - 27, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
      this.pickups.push({ crate, marker, x });
    }
  }

  get remaining(): number {
    return this.pickups.length;
  }

  update(player: Player): void {
    if (!player.alive || !player.onGround) return;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i] as Pickup;
      if (Math.abs(pickup.x - player.x) > REACH) continue;
      const supply = player.resupply();
      if (!supply) continue;
      playSfx(this.scene, SFX.pickup, 0.45, 0);
      this.bus.emit('notice', { text: `${supply.def.ammoName} +${supply.added}` });
      pickup.crate.destroy();
      pickup.marker.destroy();
      this.pickups.splice(i, 1);
    }
  }
}
