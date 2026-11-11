import type { EventBus, GameEvents } from '../../core/events/EventBus';
import { DAY_CYCLE, ambienceAt, lampPower, nightAt, phaseName, type Ambience } from '../../core/world/dayCycle';
import { MASK } from '../boot/registerArt';
import type { Backdrop } from '../world/Backdrop';
import type { LampHandle } from '../world/LevelBuilder';
import type { Light, LightingSystem } from './LightingSystem';

/**
 * Lleva el paso del atardecer a la noche y lo aplica al mundo: cielo y
 * ciudad, oscuridad ambiente, encendido escalonado de las farolas y la
 * luz tenue que acompaña a Alex para que la noche no lo oculte.
 */
export class DayNight {
  private elapsed = 0;
  private fixed: number | null = null;
  private ambience: Ambience = ambienceAt(0);
  private readonly playerLight: Light;
  private phase = '';

  constructor(
    private readonly lighting: LightingSystem,
    private readonly backdrop: Backdrop,
    private readonly lamps: LampHandle[],
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.playerLight = lighting.addLight(MASK.radialLarge, 0, 0, { intensity: 0 });
  }

  /** Cuánta noche ha caído (0 = atardecer, 1 = noche cerrada). */
  get night(): number {
    return this.ambience.night;
  }

  get lampsOn(): number {
    return this.lamps.filter((lamp) => lamp.light.power > 0.5).length;
  }

  /** Reenvía a la interfaz el momento del día actual. */
  announce(): void {
    this.bus.emit('daytime', { phase: phaseName(this.ambience.night), night: this.ambience.night });
  }

  /** Fija el momento del día (pruebas y capturas) o lo libera con `null`. */
  setFixed(night: number | null): void {
    this.fixed = night;
  }

  update(deltaMs: number, timeMs: number, playerX: number, playerY: number): void {
    this.elapsed += deltaMs;
    const night = this.fixed ?? nightAt(this.elapsed, DAY_CYCLE);
    this.ambience = ambienceAt(night);

    this.lighting.setAmbientColor(this.ambience.ambientColor);
    this.backdrop.applyAmbience(this.ambience);

    for (const lamp of this.lamps) {
      const power = lampPower(night, lamp.index, timeMs);
      lamp.light.power = power;
      lamp.glow.setAlpha(lamp.glowAlpha * power);
    }

    this.playerLight.x = playerX;
    this.playerLight.y = playerY - 14;
    this.playerLight.intensity = this.ambience.playerLight;

    const phase = phaseName(night);
    if (phase !== this.phase) {
      this.phase = phase;
      this.bus.emit('daytime', { phase, night });
    }
  }
}
