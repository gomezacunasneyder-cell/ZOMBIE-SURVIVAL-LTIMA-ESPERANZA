import { NoiseField, type NoiseKind } from '../../core/ai/noise';
import type { EventBus, GameEvents } from '../../core/events/EventBus';

/** Cada cuánto se anota el ruido de los pasos de Alex. */
const STEP_EVERY_MS = 140;
/** Radio que llena el medidor del HUD. */
const METER_FULL = 300;
/** El medidor baja despacio para que se pueda leer. */
const METER_DECAY_PER_S = 0.9;

/**
 * Ruido del mundo en la capa de juego: anota los ruidos de Alex (pasos,
 * carrera, disparos), de las explosiones y de los impactos en el campo
 * compartido que escuchan los enemigos, y alimenta el medidor de ruido.
 */
export class NoiseSystem {
  readonly field = new NoiseField();
  private nextStepAt = 0;
  private meter = 0;
  private shownMeter = -1;

  constructor(private readonly bus: EventBus<GameEvents>) {}

  /** Un ruido puntual. Los de Alex suben el medidor. */
  emit(x: number, radius: number, kind: NoiseKind, now: number, fromPlayer: boolean): void {
    this.field.emit({ x, radius, kind, at: now, fromPlayer });
    if (fromPlayer) this.meter = Math.max(this.meter, Math.min(1, radius / METER_FULL));
  }

  /** Ruido de los pasos de Alex en este fotograma. */
  update(now: number, deltaMs: number, playerX: number, movementRadius: number, sneaking: boolean): void {
    if (movementRadius > 0 && now >= this.nextStepAt) {
      this.nextStepAt = now + STEP_EVERY_MS;
      this.emit(playerX, movementRadius, movementRadius > 100 ? 'run' : 'step', now, true);
    }
    this.field.prune(now);
    this.meter = Math.max(0, this.meter - (METER_DECAY_PER_S * deltaMs) / 1000);
    const shown = Math.round(this.meter * 20) / 20;
    if (shown !== this.shownMeter || sneaking !== this.lastSneak) {
      this.shownMeter = shown;
      this.lastSneak = sneaking;
      this.bus.emit('noise', { level: shown, sneaking });
    }
  }

  private lastSneak = false;

  get level(): number {
    return this.meter;
  }
}
