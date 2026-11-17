import type Phaser from 'phaser';
import { colorNumber, type ColorName } from '../../art/palette';
import type { LevelDef } from '../../content/level';
import { SOLIDS } from '../../content/level';
import { SCRAP } from '../../content/scrap';
import {
  AIRDROP_SCHEDULE,
  CRATE,
  CRATES_PER_DROP,
  DROP_POINTS,
  FLIGHT,
  LOOT_TABLE,
  RADIO,
} from '../../content/supplies';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import type { Rng } from '../../core/math/Rng';
import { AirdropFlight, AirdropScheduler, chooseDropPoints, type FlightEvent } from '../../core/supply/airdrop';
import { lootId, nextContext, rollDrop, type CrateLoot, type DropContext } from '../../core/supply/loot';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { SFX, playSfx } from '../boot/registerAudio';
import { GAME_WIDTH } from '../config';
import { HelicopterView } from '../entities/HelicopterView';
import type { Player } from '../entities/Player';
import { SupplyCrate } from '../entities/SupplyCrate';
import { DEPTH } from '../world/depths';
import type { FxSystem } from './FxSystem';
import type { LightingSystem } from './LightingSystem';
import { applyLoot } from './lootApply';
import type { NoiseSystem } from './NoiseSystem';
import type { ZombieDirector } from './ZombieDirector';

export interface AirdropDeps {
  lighting: LightingSystem;
  fx: FxSystem;
  noise: NoiseSystem;
  director: ZombieDirector;
  bus: EventBus<GameEvents>;
  player: Player;
  level: LevelDef;
  rng: Rng;
  /** Lanzamientos automáticos (al azar y por evento); en modo prueba solo se piden a mano. */
  automatic: boolean;
  /** Una caja toca el suelo (la escena sacude la cámara si está cerca). */
  onLanded(x: number): void;
}

/** Por encima de la oscuridad: las flechas se ven también de noche. */
const ARROW_DEPTH = 1003;
/** Tope de enemigos vivos para la emboscada. */
const AMBUSH_CAP = 14;
const DOWNWASH_EVERY_MS = 140;

/**
 * Lanzamientos de suministros de Cóndor 7, de principio a fin: alarma de
 * radio y aviso, helicóptero que entra desde un extremo con el foco
 * encendido, carga que suelta en estacionario, cajas en paracaídas que
 * atraen a los zombis y se abren manteniendo E.
 */
export class AirdropSystem {
  readonly helicopter: HelicopterView;
  readonly crates: SupplyCrate[] = [];
  private readonly scheduler: AirdropScheduler;
  private flight: AirdropFlight | null = null;
  private loot: CrateLoot[] = [];
  private context: DropContext;
  private opening: { crate: SupplyCrate; startedAt: number; health: number } | null = null;
  /** Tras una interrupción hay que soltar E y volver a pulsarla. */
  private needsRelease = false;
  private readonly prompt: Phaser.GameObjects.BitmapText;
  private readonly arrows: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.BitmapText }[];
  private nextRotorNoiseAt = 0;
  private nextFlareNoiseAt = 0;
  private nextDownwashAt = 0;
  private ambushDone = false;
  private dropsTotal = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: AirdropDeps,
  ) {
    const level = deps.level;
    this.helicopter = new HelicopterView(scene, deps.lighting, level.playLine, DEPTH.helicopter);
    this.scheduler = new AirdropScheduler(AIRDROP_SCHEDULE, deps.rng, scene.time.now);
    this.context = { ownedWeapons: new Set(), epicGiven: 0, dropsWithoutWeapon: 0 };
    this.prompt = scene.add.bitmapText(0, 0, FONT_KEY, 'E: ABRIR').setOrigin(0.5, 1).setDepth(ARROW_DEPTH).setVisible(false);
    this.arrows = [-1, 1].map((side) => ({
      icon: scene.add.image(0, 0, ATLAS_KEY, 'ui/crate-arrow').setFlipX(side < 0).setDepth(ARROW_DEPTH).setVisible(false),
      text: scene.add.bitmapText(0, 0, FONT_KEY, '').setOrigin(side < 0 ? 0 : 1, 0.5).setDepth(ARROW_DEPTH).setVisible(false),
    }));
  }

  /** Hay un helicóptero en camino o volando. */
  get active(): boolean {
    return this.flight !== null;
  }

  get phase(): string {
    return this.flight?.phase ?? 'idle';
  }

  /** Lanzamientos de esta partida y si esta partida los tiene al azar. */
  get stats(): { drops: number; randomEnabled: boolean; nextRandom: number } {
    return { drops: this.dropsTotal, randomEnabled: this.scheduler.randomEnabled, nextRandom: this.scheduler.nextRandom };
  }

  enterZone(name: string): void {
    if (this.deps.automatic) this.scheduler.enterZone(name);
  }

  /** Pide un lanzamiento ya (pruebas). Devuelve `false` si hay uno en curso o se ha llegado al tope. */
  call(now: number): boolean {
    if (this.flight || !this.scheduler.force(now)) return false;
    this.start(now);
    return true;
  }

  /**
   * Una caja suelta que cae en paracaídas desde lo alto, sin helicóptero
   * (recompensas del modo supervivencia).
   */
  dropCrate(x: number, loot: CrateLoot, now: number): void {
    this.crates.push(new SupplyCrate(this.scene, this.deps.lighting, this.deps.fx, x, -30, this.deps.level.playLine, loot, now));
  }

  update(now: number, deltaMs: number, interactHeld: boolean): void {
    if (this.deps.automatic && this.scheduler.update(now, this.flight !== null)) this.start(now);
    if (this.flight) this.fly(now, deltaMs);
    for (const crate of this.crates) {
      if (crate.update(now)) this.landed(crate);
    }
    this.emitCrateNoise(now);
    this.updateOpening(now, interactHeld);
    this.updateArrows();
  }

  // ───────────────────────── Vuelo ─────────────────────────

  private start(now: number): void {
    const { rng, player, level, bus } = this.deps;
    const count = CRATES_PER_DROP.base + (rng.chance(CRATES_PER_DROP.extraChance) ? 1 : 0);
    const blocked = level.solids.map((s) => [s.x - SOLIDS[s.kind].width / 2, s.x + SOLIDS[s.kind].width / 2] as const);
    const points = chooseDropPoints(rng, count, { playerX: player.x, levelWidth: level.width, blocked }, DROP_POINTS);
    this.context = { ...this.context, ownedWeapons: new Set(player.weapons.arsenal.ownedIds()) };
    const loot = rollDrop(rng, LOOT_TABLE, points.length, this.context);
    this.context = nextContext(this.context, loot, LOOT_TABLE);
    const direction = rng.chance(0.5) ? 1 : -1;
    this.flight = new AirdropFlight(FLIGHT, points, direction, now);
    // El contenido va en el orden en que se sueltan las cajas.
    this.loot = loot;
    this.ambushDone = false;
    this.dropsTotal += 1;
    playSfx(this.scene, SFX.radioAlarm, 0.6, 0);
    bus.emit('airdrop', { phase: 'warning', radio: null });
  }

  private fly(now: number, deltaMs: number): void {
    const flight = this.flight as AirdropFlight;
    for (const event of flight.update(now, deltaMs)) this.onFlightEvent(event, now);
    if (!this.flight) return;
    const heli = this.helicopter;
    const cargo = flight.dropPoints.length - flight.releasedCount;
    heli.update(now, {
      x: flight.x,
      y: this.deps.level.helicopter.y,
      facing: flight.direction,
      attitude: flight.attitude,
      cargo,
      hovering: flight.phase === 'hover',
    });
    if (!heli.visible) return;
    // El rotor se oye de lejos: los zombis miran al cielo y acuden.
    if (now >= this.nextRotorNoiseAt) {
      this.nextRotorNoiseAt = now + CRATE.rotorNoiseEveryMs;
      this.deps.noise.emit(flight.x, CRATE.rotorNoise, 'machine', now, false);
    }
    // En estacionario el aire del rotor levanta polvo de la calle.
    if (flight.phase === 'hover' && now >= this.nextDownwashAt) {
      this.nextDownwashAt = now + DOWNWASH_EVERY_MS;
      this.deps.fx.dustPuff(flight.x + (this.deps.rng.next() * 2 - 1) * 34, this.deps.level.playLine, 2);
    }
  }

  private onFlightEvent(event: FlightEvent, now: number): void {
    const { bus } = this.deps;
    switch (event.type) {
      case 'inbound':
        this.helicopter.setVisible(true);
        playSfx(this.scene, SFX.radioChatter, 0.5, 0);
        bus.emit('airdrop', { phase: 'inbound', radio: RADIO.inbound });
        break;
      case 'release': {
        const hook = this.helicopter.hook;
        const loot = this.loot[event.index];
        if (loot) this.crates.push(new SupplyCrate(this.scene, this.deps.lighting, this.deps.fx, event.x, hook.y, this.deps.level.playLine, loot, now));
        if (event.index === 0) {
          playSfx(this.scene, SFX.radioChatter, 0.5, 0);
          bus.emit('airdrop', { phase: 'dropping', radio: RADIO.dropping });
        }
        break;
      }
      case 'outbound':
        bus.emit('airdrop', { phase: 'leaving', radio: RADIO.leaving });
        break;
      case 'done':
        this.helicopter.setVisible(false);
        this.flight = null;
        bus.emit('airdrop', { phase: 'done', radio: null });
        break;
    }
  }

  // ───────────────────────── Cajas ─────────────────────────

  private landed(crate: SupplyCrate): void {
    const now = this.scene.time.now;
    this.deps.noise.emit(crate.x, CRATE.landingNoise, 'machine', now, false);
    this.deps.onLanded(crate.x);
    // Los zombis acuden a rodear la carga.
    if (!this.ambushDone) {
      this.ambushDone = true;
      const [min, max] = CRATE.ambush;
      this.deps.director.spawnAmbush(crate.x, this.deps.rng.int(min, max), AMBUSH_CAP);
    }
  }

  /** Las bengalas de las cajas sin abrir chisporrotean y mantienen a los zombis cerca. */
  private emitCrateNoise(now: number): void {
    if (now < this.nextFlareNoiseAt) return;
    this.nextFlareNoiseAt = now + CRATE.flareNoiseEveryMs;
    for (const crate of this.crates) {
      if (crate.state === 'landed') this.deps.noise.emit(crate.x, CRATE.flareNoise, 'machine', now, false);
    }
  }

  private nearestOpenable(): SupplyCrate | null {
    const player = this.deps.player;
    let best: SupplyCrate | null = null;
    for (const crate of this.crates) {
      if (crate.state !== 'landed' || crate.items.length === 0) continue;
      const distance = Math.abs(crate.x - player.x);
      if (distance <= CRATE.reach && (!best || distance < Math.abs(best.x - player.x))) best = crate;
    }
    return best;
  }

  private updateOpening(now: number, interactHeld: boolean): void {
    const player = this.deps.player;
    const crate = player.alive && player.onGround ? this.nearestOpenable() : null;
    this.prompt.setVisible(crate !== null && this.opening === null);
    // Por encima de la cabeza de Alex, para no taparle.
    if (crate) this.prompt.setPosition(crate.x, this.deps.level.playLine - 47);

    if (this.opening && (this.opening.crate !== crate || !interactHeld || player.health.current < this.opening.health)) {
      // Soltar E, alejarse o recibir un golpe interrumpe la apertura.
      this.opening.crate.showProgress(null);
      this.opening = null;
      this.needsRelease = interactHeld;
    }
    if (!interactHeld) this.needsRelease = false;
    if (!crate || !interactHeld || this.needsRelease) return;
    if (!this.opening) this.opening = { crate, startedAt: now, health: player.health.current };
    const progress = Math.min(1, (now - this.opening.startedAt) / CRATE.openMs);
    crate.showProgress(progress);
    if (progress < 1) return;
    this.opening = null;
    const result = applyLoot(player, crate.items, now);
    // Cada caja trae además unas piezas, solo la primera vez que se abre.
    if (!crate.scrapGiven) {
      crate.scrapGiven = true;
      // Cantidad según el punto de caída: no gasta números de la semilla de los lanzamientos.
      const [least, most] = SCRAP.crate;
      const scrap = player.addScrap(least + (Math.abs(Math.round(crate.x)) % (most - least + 1)));
      result.lines.splice(result.lines.length - (result.leftovers.length > 0 ? 1 : 0), 0, { text: `PIEZAS +${scrap}`, color: 'grey1' });
    }
    crate.open(now, result.leftovers);
    if (result.newWeapons.length === 0) playSfx(this.scene, SFX.pickup, 0.45, 0);
    else playSfx(this.scene, SFX.equip, 0.6, 0);
    this.floatLines(crate.x, result.lines);
  }

  /** Lo recogido sube sobre la caja y se desvanece. */
  private floatLines(x: number, lines: { text: string; color: string }[]): void {
    lines.forEach((line, i) => {
      const y = this.deps.level.playLine - 48 - (lines.length - 1 - i) * 7;
      const text = this.scene.add
        .bitmapText(Math.round(x), y, FONT_KEY, line.text)
        .setOrigin(0.5, 1)
        .setDepth(ARROW_DEPTH)
        .setTint(colorNumber(line.color as ColorName));
      this.scene.tweens.add({ targets: text, y: y - 14, alpha: 0, delay: 1600, duration: 900, onComplete: () => text.destroy() });
    });
  }

  /** Flechas en los bordes hacia las cajas sin abrir que no se ven, con la distancia. */
  private updateArrows(): void {
    const camera = this.scene.cameras.main;
    const player = this.deps.player;
    const sides = [-1, 1].map((side) => {
      let nearest: SupplyCrate | null = null;
      for (const crate of this.crates) {
        if (crate.items.length === 0 || crate.state === 'opened') continue;
        const offscreen = side < 0 ? crate.x < camera.scrollX + 4 : crate.x > camera.scrollX + GAME_WIDTH - 4;
        if (offscreen && (!nearest || Math.abs(crate.x - player.x) < Math.abs(nearest.x - player.x))) nearest = crate;
      }
      return nearest;
    });
    sides.forEach((crate, i) => {
      const arrow = this.arrows[i] as (typeof this.arrows)[number];
      arrow.icon.setVisible(crate !== null);
      arrow.text.setVisible(crate !== null);
      if (!crate) return;
      const left = i === 0;
      const y = this.deps.level.playLine - 40;
      const x = left ? camera.scrollX + 6 : camera.scrollX + GAME_WIDTH - 6;
      arrow.icon.setPosition(Math.round(x), y);
      // Distancia en metros (10 px por metro).
      arrow.text.setText(`${Math.round(Math.abs(crate.x - player.x) / 10)}M`).setPosition(Math.round(left ? x + 6 : x - 6), y);
    });
  }

  /** Estado resumido para las pruebas. */
  snapshot(): {
    phase: string;
    heliX: number | null;
    drops: number;
    randomEnabled: boolean;
    crates: { x: number; y: number; state: string; items: string[]; rarity: string }[];
    opening: number | null;
  } {
    return {
      phase: this.phase,
      heliX: this.flight && this.helicopter.visible ? this.flight.x : null,
      drops: this.dropsTotal,
      randomEnabled: this.scheduler.randomEnabled,
      crates: this.crates.map((c) => ({
        x: c.x,
        y: c.y,
        state: c.state,
        items: c.items.map(lootId),
        rarity: c.rarity,
      })),
      opening: this.opening ? Math.min(1, (this.scene.time.now - this.opening.startedAt) / CRATE.openMs) : null,
    };
  }
}
