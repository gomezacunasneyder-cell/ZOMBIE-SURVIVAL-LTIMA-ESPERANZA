import type Phaser from 'phaser';
import { colorNumber } from '../../art/palette';
import { EXPLOSION, explosionDamage } from '../../content/hazards';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { SFX, playSfxAt } from '../boot/registerAudio';
import { DEPTH } from '../world/depths';
import type { ExplosiveHandle } from '../world/LevelBuilder';
import type { AtmosphereSystem } from './AtmosphereSystem';
import type { FxSystem } from './FxSystem';
import type { Light, LightingSystem } from './LightingSystem';

/** Lo que una explosión comunica a la escena para que aplique sus efectos. */
export interface Blast {
  x: number;
  y: number;
  /** Daño a una distancia dada, para enemigos y para Alex. */
  enemyDamageAt(distance: number): number;
  playerDamageAt(distance: number): number;
}

interface Burning {
  light: Light;
  glow: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Sprite;
  endsAt: number;
  stopSmoke: () => void;
}

interface Flash {
  light: Light;
  glow: Phaser.GameObjects.Image;
  startedAt: number;
}

const FLASH_MS = 320;

/**
 * Bidones de combustible: aguantan un par de disparos y estallan. La
 * explosión ilumina la escena con un destello que se apaga, deja un
 * charco ardiendo unos segundos, marca el asfalto y puede hacer estallar
 * otros bidones cercanos en cadena.
 */
export class ExplosionSystem {
  private readonly burning: Burning[] = [];
  private readonly flashes: Flash[] = [];
  private count = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lighting: LightingSystem,
    private readonly fx: FxSystem,
    private readonly atmosphere: AtmosphereSystem,
    private readonly explosives: ExplosiveHandle[],
    private readonly groundY: number,
    private readonly onBlast: (blast: Blast) => void,
  ) {}

  /** Número de explosiones ocurridas (para pruebas). */
  get total(): number {
    return this.count;
  }

  get remaining(): number {
    return this.explosives.filter((barrel) => !barrel.exploded).length;
  }

  /** Un disparo alcanza un bidón. Devuelve `true` si lo hace estallar. */
  hit(barrel: ExplosiveHandle): boolean {
    if (barrel.exploded) return false;
    barrel.hits += 1;
    if (barrel.hits < EXPLOSION.hitsToExplode) {
      // Primer impacto: pierde combustible y avisa de que está a punto.
      barrel.sprite.setTint(0xffc9a8);
      this.fx.sparkBurst(barrel.x, barrel.y);
      return false;
    }
    this.explode(barrel);
    return true;
  }

  /** Hace estallar el bidón más cercano a `x` (para pruebas). */
  detonateNear(x: number): boolean {
    const live = this.explosives.filter((barrel) => !barrel.exploded);
    if (live.length === 0) return false;
    const nearest = live.reduce((a, b) => (Math.abs(a.x - x) <= Math.abs(b.x - x) ? a : b));
    this.explode(nearest);
    return true;
  }

  private explode(barrel: ExplosiveHandle): void {
    if (barrel.exploded) return;
    barrel.exploded = true;
    this.count += 1;
    const { x } = barrel;
    const y = this.groundY - 6;
    const now = this.scene.time.now;

    // El bidón desaparece y deja de ser un obstáculo.
    barrel.sprite.destroy();
    barrel.shadow.destroy();
    (barrel.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    this.scene.add
      .sprite(x, this.groundY - 14, ATLAS_KEY, 'fx/explosion/0')
      .setDepth(DEPTH.explosion)
      .play('fx/explosion')
      .once('animationcomplete', (_animation: unknown, _frame: unknown, sprite: Phaser.GameObjects.Sprite) => sprite.destroy());
    this.scene.add.image(x, this.groundY + 3, ATLAS_KEY, 'decal/scorch').setDepth(DEPTH.decal + 0.1);
    this.fx.sparkBurst(x, y);
    this.fx.sparkBurst(x, y - 8);
    playSfxAt(this.scene, SFX.explosion, x, 0.9, 900);

    // Destello: mucha luz de golpe que se apaga en un tercio de segundo.
    this.flashes.push({
      light: this.lighting.addLight(MASK.radialHuge, x, y, { intensity: 1 }),
      glow: this.lighting.addGlow(MASK.radialLarge, x, y, colorNumber('light2'), 0.7),
      startedAt: now,
    });

    // Combustible ardiendo unos segundos.
    const flame = this.scene.add.sprite(x, this.groundY + 1, ATLAS_KEY, 'fx/fire/0').setOrigin(0.5, 1).setDepth(this.groundY + 1.2).play('fx/fire');
    this.burning.push({
      flame,
      light: this.lighting.addLight(MASK.radialLarge, x, this.groundY - 6, { intensity: 0.9, flicker: 0.25 }),
      glow: this.lighting.addGlow(MASK.radialMedium, x, this.groundY - 8, colorNumber('org1'), 0.3),
      endsAt: now + EXPLOSION.fireMs,
      stopSmoke: this.atmosphere.addFire({ x, y: this.groundY - 16 }),
    });

    this.onBlast({
      x,
      y,
      enemyDamageAt: (distance) => explosionDamage(distance, EXPLOSION.enemyDamage),
      playerDamageAt: (distance) => explosionDamage(distance, EXPLOSION.playerDamage),
    });

    // Reacción en cadena con un pequeño retardo.
    for (const other of this.explosives) {
      if (other.exploded || Math.abs(other.x - x) > EXPLOSION.radius) continue;
      this.scene.time.delayedCall(EXPLOSION.chainDelayMs, () => this.explode(other));
    }
  }

  update(timeMs: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i] as Flash;
      const k = 1 - (timeMs - flash.startedAt) / FLASH_MS;
      if (k <= 0) {
        this.lighting.removeLight(flash.light);
        flash.glow.destroy();
        this.flashes.splice(i, 1);
        continue;
      }
      // Apagado en escalones, acorde con la luz cuantizada del juego.
      const stepped = Math.ceil(k * 4) / 4;
      flash.light.power = stepped;
      flash.glow.setAlpha(0.7 * stepped);
    }

    for (let i = this.burning.length - 1; i >= 0; i--) {
      const fire = this.burning[i] as Burning;
      const left = fire.endsAt - timeMs;
      if (left <= 0) {
        this.lighting.removeLight(fire.light);
        fire.glow.destroy();
        fire.flame.destroy();
        fire.stopSmoke();
        this.burning.splice(i, 1);
        continue;
      }
      // El último segundo y medio el fuego se va consumiendo.
      const fade = Math.min(1, left / 1500);
      fire.light.power = fade;
      fire.glow.setAlpha(0.3 * fade);
      fire.flame.setAlpha(fade < 0.4 ? 0.5 : 1);
    }
  }
}
