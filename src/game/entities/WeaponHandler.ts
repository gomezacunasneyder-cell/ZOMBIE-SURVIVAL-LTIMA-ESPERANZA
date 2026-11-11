import type Phaser from 'phaser';
import { STARTING_LOADOUT, WEAPON_SWITCH_MS, type WeaponDef } from '../../content/weapons';
import type { AimAngle } from '../../core/combat/aim';
import { Arsenal, type Resupply } from '../../core/combat/Arsenal';
import { pelletSpreads, shotDirection, type Vector } from '../../core/combat/ballistics';
import type { WeaponState } from '../../core/combat/WeaponState';
import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { SFX, playSfx, shotSfx } from '../boot/registerAudio';
import type { InputFrame } from '../input/PlayerInput';
import type { Point } from './AimRig';

/** Datos de un disparo que la escena convierte en balas, sonido y efectos. */
export interface ShotRequest {
  x: number;
  y: number;
  /** Dirección de cada proyectil (uno por perdigón). */
  directions: Vector[];
  /** Ángulo ajustado del brazo y ángulo libre hacia el cursor. */
  aim: AimAngle;
  angle: number;
  facing: 1 | -1;
  weapon: WeaponDef;
}

/** Cómo suena la recarga de cada arma. */
type ReloadVoice = 'clip' | 'shells' | 'long';
const RELOAD_VOICE: Readonly<Record<string, ReloadVoice>> = { shotgun: 'shells', rifle: 'long', mg: 'long' };
/** Bombeo de la escopeta tras cada disparo. */
const PUMP_SOUND_DELAY_MS = 180;

export interface AimInput {
  /** Ángulo ajustado al dibujo más cercano. */
  aim: AimAngle;
  /** Ángulo libre hacia el cursor. */
  angle: number;
  facing: 1 | -1;
  muzzle: Point;
}

/**
 * Armas de Alex en la capa de juego: aplica al arsenal (reglas puras) lo
 * que pide el jugador y lo convierte en disparos, sonidos, avisos y
 * eventos para el HUD. No mueve sprites: eso es cosa de `AimRig`.
 */
export class WeaponHandler {
  readonly arsenal = new Arsenal<WeaponDef>(STARTING_LOADOUT, WEAPON_SWITCH_MS);
  private lastAmmoKey = '';
  private lastReload: number | null = null;
  private reloadTicks = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  get weapon(): WeaponState<WeaponDef> {
    return this.arsenal.current;
  }

  /** Envía a la interfaz el estado completo. */
  announce(): void {
    this.emitWeapon();
    this.emitAmmo(true);
  }

  isSwitching(now: number): boolean {
    return !this.arsenal.isReady(now);
  }

  /** Aplica cambio de arma, recarga y gatillo. Devuelve el disparo si lo hay. */
  update(now: number, input: InputFrame, aim: AimInput): ShotRequest | null {
    if (input.slotPressed !== null) this.select(input.slotPressed, now);
    else if (input.cycle !== 0) this.cycle(input.cycle, now);

    const weapon = this.weapon;
    const reloadVoice = RELOAD_VOICE[weapon.def.id] ?? 'clip';
    this.reloadSounds(now, reloadVoice);
    if (this.arsenal.update(now)) {
      playSfx(this.scene, reloadVoice === 'shells' ? SFX.pump : SFX.dryFire, 0.4, 40);
    }

    if (input.reloadPressed) this.reload(now, reloadVoice);

    // Un toque rápido también dispara con las automáticas (pulsar y soltar en el mismo fotograma).
    const wantsFire = input.firePressed || (weapon.def.automatic && input.fireHeld);
    if (!wantsFire) return null;

    const result = this.arsenal.tryFire(now);
    if (result === 'empty' && input.firePressed) {
      playSfx(this.scene, SFX.dryFire, 0.45, 60);
      this.bus.emit('notice', { text: weapon.reserve > 0 ? 'CARGADOR VACIO - PULSA R' : `SIN MUNICION: ${weapon.def.ammoName}` });
    }
    if (result !== 'fired') return null;

    const def = weapon.def;
    playSfx(this.scene, shotSfx(def.id), def.id === 'mg' ? 0.42 : 0.5, 150);
    if (RELOAD_VOICE[def.id] === 'shells') {
      this.scene.time.delayedCall(PUMP_SOUND_DELAY_MS, () => playSfx(this.scene, SFX.pump, 0.4, 60));
    }
    const directions = pelletSpreads(def.pellets, def.spreadDeg, Math.random).map((spread) =>
      shotDirection(aim.angle, aim.facing, spread),
    );
    return { x: aim.muzzle.x, y: aim.muzzle.y, directions, aim: aim.aim, angle: aim.angle, facing: aim.facing, weapon: def };
  }

  private reload(now: number, voice: ReloadVoice): void {
    const result = this.weapon.startReload(now);
    if (result === 'started') {
      this.reloadTicks = 0;
      if (voice === 'long') playSfx(this.scene, SFX.rifleReload, 0.5, 40);
      else if (voice === 'clip') playSfx(this.scene, SFX.reload, 0.5, 40);
    } else if (result === 'no-reserve') {
      this.bus.emit('notice', { text: `SIN MUNICION DE RESERVA: ${this.weapon.def.ammoName}` });
    } else if (result === 'full') {
      this.bus.emit('notice', { text: 'CARGADOR LLENO' });
    }
  }

  /** Escopeta: se oye entrar cada cartucho repartido a lo largo de la recarga. */
  private reloadSounds(now: number, voice: ReloadVoice): void {
    const progress = this.weapon.reloadProgress(now);
    if (voice !== 'shells' || progress === null) return;
    const loading = Math.min(this.weapon.def.magazineSize - this.weapon.magazine, this.weapon.reserve);
    const due = Math.min(loading, Math.floor(progress * (loading + 1)));
    while (this.reloadTicks < due) {
      this.reloadTicks += 1;
      playSfx(this.scene, SFX.shellInsert, 0.4, 80);
    }
  }

  private select(slot: number, now: number): void {
    const result = this.arsenal.select(slot, now);
    if (result === 'empty-slot') this.bus.emit('notice', { text: `RANURA ${slot + 1} VACIA` });
    if (result === 'switched') this.onSwitched();
  }

  private cycle(direction: 1 | -1, now: number): void {
    if (this.arsenal.cycle(direction, now) === 'switched') this.onSwitched();
  }

  private onSwitched(): void {
    playSfx(this.scene, SFX.equip, 0.45, 60);
    this.emitWeapon();
    this.emitAmmo(true);
  }

  /** Interrumpe la recarga (al morir). */
  cancelReload(): void {
    this.weapon.cancelReload();
  }

  /** Munición de una caja de suministros. */
  resupply(): Resupply<WeaponDef> | null {
    const result = this.arsenal.resupply();
    if (result) this.emitAmmo(true);
    return result;
  }

  /** Avisa a la interfaz de los cambios de munición y recarga del fotograma. */
  sync(now: number, alive: boolean): number | null {
    const progress = alive ? this.weapon.reloadProgress(now) : null;
    this.emitAmmo(false);
    if (progress !== this.lastReload) {
      this.lastReload = progress;
      this.bus.emit('reload', { progress });
    }
    return progress;
  }

  private emitWeapon(): void {
    const def = this.weapon.def;
    this.bus.emit('weapon', { id: def.id, name: def.name, icon: def.icon, slot: this.arsenal.slot });
  }

  private emitAmmo(force: boolean): void {
    const arsenal = this.arsenal;
    const slots = Array.from({ length: arsenal.slotCount }, (_, i) => arsenal.weaponAt(i));
    const key = slots.map((w) => (w ? `${w.magazine}:${w.reserve}` : '-')).join('|') + `#${arsenal.slot}`;
    if (!force && key === this.lastAmmoKey) return;
    this.lastAmmoKey = key;
    const weapon = this.weapon;
    this.bus.emit('ammo', { magazine: weapon.magazine, magazineSize: weapon.def.magazineSize, reserve: weapon.reserve });
    this.bus.emit('arsenal', {
      active: arsenal.slot,
      slots: slots.map((w) => (w ? { name: w.def.name, magazine: w.magazine, reserve: w.reserve } : null)),
    });
  }
}
