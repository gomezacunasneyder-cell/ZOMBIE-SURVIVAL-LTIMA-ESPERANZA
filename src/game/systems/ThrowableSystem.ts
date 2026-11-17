import Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { THROW_SPIN_FRAMES } from '../../art/throwArt';
import { GRAVITY } from '../../content/player';
import { throwableById, type GrenadeDef, type MolotovDef } from '../../content/throwables';
import { throwVelocity } from '../../core/combat/Throwables';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import type { Point } from '../entities/AimRig';
import type { Zombie } from '../entities/Zombie';
import { DEPTH } from '../world/depths';
import type { AtmosphereSystem } from './AtmosphereSystem';
import type { BurnSystem } from './BurnSystem';
import type { ExplosionSystem } from './ExplosionSystem';
import type { FxSystem } from './FxSystem';
import type { Light, LightingSystem } from './LightingSystem';
import type { NoiseSystem } from './NoiseSystem';

export interface ThrowableDeps {
  lighting: LightingSystem;
  fx: FxSystem;
  atmosphere: AtmosphereSystem;
  explosions: ExplosionSystem;
  noise: NoiseSystem;
  burns: BurnSystem;
  zombies: () => readonly Zombie[];
  solids: Phaser.GameObjects.Zone[];
  groundY: number;
  /** Posición de Alex y daño que le hace el fuego. */
  player: () => { x: number; alive: boolean };
  hurtPlayer: (damage: number, fromX: number, now: number) => void;
}

interface Flying {
  def: GrenadeDef | MolotovDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  collider: Phaser.Physics.Arcade.Collider;
  thrownAt: number;
  light: Light | null;
  /** Último contacto con el suelo (para el ruido del rebote). */
  wasBlocked: boolean;
}

interface FirePatch {
  def: MolotovDef;
  x: number;
  endsAt: number;
  flames: Phaser.GameObjects.Sprite[];
  light: Light;
  glow: Phaser.GameObjects.Image;
  stopSmoke: () => void;
  nextTickAt: number;
  nextNoiseAt: number;
  nextHurtAt: number;
}

const TICK_MS = 250;
const PLAYER_HURT_MS = 500;
const SPIN_MS = 70;

/**
 * Granadas y cócteles molotov: objetos físicos que salen del hombro de
 * Alex en parábola hacia el ratón. La granada rebota, rueda y estalla al
 * acabarse la mecha; el molotov se rompe al primer contacto y deja un
 * charco de fuego que prende a quien lo pisa, ilumina y hace ruido.
 */
export class ThrowableSystem {
  private readonly flying: Flying[] = [];
  private readonly fires: FirePatch[] = [];
  private thrown = 0;
  /** Cada cuarto de segundo, el charco de fuego también quema a otros (EL DEVORADOR). */
  onFireTick: ((x: number, half: number, now: number) => void) | null = null;
  private exploded = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: ThrowableDeps,
  ) {}

  get counts(): { thrown: number; flying: number; fires: number; exploded: number } {
    return { thrown: this.thrown, flying: this.flying.length, fires: this.fires.length, exploded: this.exploded };
  }

  /** Objetos en el aire o en el suelo, para las pruebas. */
  snapshot(): { id: string; x: number; y: number }[] {
    return this.flying.map((f) => ({ id: f.def.id, x: f.sprite.x, y: f.sprite.y }));
  }

  /** Lanza un arrojadizo desde `from` hacia el punto `target`. */
  launch(id: string, from: Point, target: Point, facing: 1 | -1, now: number): void {
    const def = throwableById(id);
    if (!def) return;
    // Cae sobre el asfalto, más abajo que la mano.
    const velocity = throwVelocity(target.x - from.x, facing, def.arc, GRAVITY, this.deps.groundY - from.y);
    const sprite = this.scene.physics.add.sprite(from.x, from.y, ATLAS_KEY, `${def.sprite}/0`).setDepth(DEPTH.bullet);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(4, 4).setVelocity(velocity.vx, velocity.vy).setBounce(def.bounce, def.bounce).setCollideWorldBounds(true);
    const collider = this.scene.physics.add.collider(sprite, this.deps.solids);
    // La mecha del molotov va encendida: un punto de luz que vuela.
    const light = def.id === 'molotov' ? this.deps.lighting.addLight(MASK.radialSmall, from.x, from.y, { intensity: 0.7, flicker: 0.3 }) : null;
    this.flying.push({ def, sprite, collider, thrownAt: now, light, wasBlocked: false });
    this.thrown += 1;
    playSfxAt(this.scene, SFX.throwSwish, from.x, 0.4);
  }

  update(now: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const item = this.flying[i] as Flying;
      const done = item.def.id === 'grenade' ? this.updateGrenade(item, item.def, now) : this.updateMolotov(item, item.def, now);
      if (done) {
        this.removeFlying(item);
        this.flying.splice(i, 1);
      }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i] as FirePatch;
      if (now >= fire.endsAt) {
        this.removeFire(fire);
        this.fires.splice(i, 1);
      } else this.updateFire(fire, now);
    }
  }

  /** Gira con cuatro dibujos (giros de 90°: el pixel art no se rota). */
  private spin(item: Flying, now: number, resting: boolean): void {
    if (resting) return;
    const frame = Math.floor((now - item.thrownAt) / SPIN_MS) % THROW_SPIN_FRAMES;
    item.sprite.setFrame(`${item.def.sprite}/${frame}`);
  }

  private updateGrenade(item: Flying, def: GrenadeDef, now: number): boolean {
    const body = item.sprite.body as Phaser.Physics.Arcade.Body;
    const blocked = body.blocked.down || body.touching.down;
    // En el suelo rueda y se frena.
    // Cada bote le quita la mitad del impulso: queda cerca de donde se apuntó.
    if (blocked && !item.wasBlocked) {
      body.setVelocityX(body.velocity.x * 0.5);
      playSfxAt(this.scene, SFX.grenadeBounce, item.sprite.x, 0.35);
    }
    if (blocked) body.setVelocityX(body.velocity.x * 0.88);
    item.wasBlocked = blocked;
    this.spin(item, now, blocked && Math.abs(body.velocity.x) < 8);
    // Los últimos instantes de la mecha la granada parpadea.
    const left = def.fuseMs - (now - item.thrownAt);
    item.sprite.setTint(left < 500 && Math.floor(now / 80) % 2 === 0 ? colorNumber('blood1') : 0xffffff);
    if (left > 0) return false;
    this.exploded += 1;
    this.deps.explosions.blastAt(item.sprite.x, item.sprite.y - 2, def.blast);
    return true;
  }

  private updateMolotov(item: Flying, def: MolotovDef, now: number): boolean {
    const { sprite } = item;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (item.light) {
      item.light.x = sprite.x;
      item.light.y = sprite.y;
    }
    this.spin(item, now, false);
    const hitWorld = body.blocked.down || body.blocked.left || body.blocked.right || body.touching.down || body.touching.left || body.touching.right;
    const hitZombie = this.deps.zombies().some((z) => z.alive && Math.abs(z.x - sprite.x) < 8 && sprite.y > z.y - 30 && sprite.y <= z.y + 2);
    if (!hitWorld && !hitZombie && sprite.y < this.deps.groundY) return false;
    this.ignite(def, sprite.x, now);
    return true;
  }

  /** El cristal estalla y el combustible arde sobre el asfalto. */
  private ignite(def: MolotovDef, x: number, now: number): void {
    const { groundY, lighting } = this.deps;
    playSfxAt(this.scene, SFX.glassBreak, x, 0.7);
    this.deps.fx.sparkBurst(x, groundY - 4);
    this.deps.noise.emit(x, def.shatterNoise, 'impact', now, true);
    const count = 4;
    const flames = Array.from({ length: count }, (_, i) => {
      const fx = Math.round(x - def.fireWidth / 2 + (def.fireWidth / (count - 1)) * i);
      return this.scene.add
        .sprite(fx, groundY + 1, ATLAS_KEY, 'fx/fire/0')
        .setOrigin(0.5, 1)
        .setDepth(groundY + 1.2)
        .play({ key: 'fx/fire', startFrame: i % 2 });
    });
    this.fires.push({
      def,
      x,
      endsAt: now + def.fireMs,
      flames,
      light: lighting.addLight(MASK.radialLarge, x, groundY - 8, { intensity: 0.9, flicker: 0.3 }),
      glow: lighting.addGlow(MASK.radialMedium, x, groundY - 8, colorNumber('org1'), 0.32),
      stopSmoke: this.deps.atmosphere.addFire({ x, y: groundY - 14 }),
      nextTickAt: now,
      nextNoiseAt: now + def.fireNoiseEveryMs,
      nextHurtAt: now,
    });
    // El fuego alcanza a los bidones que haya en el charco.
    this.deps.explosions.igniteWithin(x, def.fireWidth / 2 + 4);
  }

  private updateFire(fire: FirePatch, now: number): void {
    const { def } = fire;
    const half = def.fireWidth / 2;
    // El último segundo el fuego se consume.
    const fade = Math.min(1, (fire.endsAt - now) / 1000);
    fire.light.power = fade;
    fire.glow.setAlpha(0.32 * fade);
    if (now >= fire.nextTickAt) {
      fire.nextTickAt = now + TICK_MS;
      for (const zombie of this.deps.zombies()) {
        if (zombie.alive && Math.abs(zombie.x - fire.x) <= half) this.deps.burns.ignite(zombie, def.burn, now);
      }
      this.onFireTick?.(fire.x, half, now);
      const player = this.deps.player();
      if (player.alive && Math.abs(player.x - fire.x) <= half - 4 && now >= fire.nextHurtAt) {
        fire.nextHurtAt = now + PLAYER_HURT_MS;
        this.deps.hurtPlayer(def.playerDamage, fire.x, now);
      }
    }
    if (now >= fire.nextNoiseAt) {
      fire.nextNoiseAt = now + def.fireNoiseEveryMs;
      this.deps.noise.emit(fire.x, def.fireNoise, 'impact', now, false);
    }
  }

  private removeFlying(item: Flying): void {
    item.collider.destroy();
    item.sprite.destroy();
    if (item.light) this.deps.lighting.removeLight(item.light);
  }

  private removeFire(fire: FirePatch): void {
    fire.flames.forEach((flame) => flame.destroy());
    this.deps.lighting.removeLight(fire.light);
    fire.glow.destroy();
    fire.stopSmoke();
  }
}
