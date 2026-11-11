/** Parámetros de movimiento que usan estas reglas. */
export interface MotionTuning {
  walkSpeed: number;
  runSpeed: number;
  backwardFactor: number;
  groundAccel: number;
  groundDecel: number;
  airAccel: number;
  airDecel: number;
  coyoteMs: number;
  jumpBufferMs: number;
}

/** Acerca `current` a `target` sin pasarse, como máximo `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

export interface MoveInput {
  /** -1 izquierda, 0 quieto, 1 derecha. */
  direction: -1 | 0 | 1;
  running: boolean;
  /** Hacia dónde mira (apunta) el personaje. */
  facing: 1 | -1;
  onGround: boolean;
}

/** Velocidad horizontal que el jugador quiere alcanzar. */
export function targetSpeed(input: MoveInput, tuning: MotionTuning): number {
  if (input.direction === 0) return 0;
  // De espaldas no se puede correr: retroceder disparando tiene un coste.
  if (input.direction !== input.facing) return input.direction * tuning.walkSpeed * tuning.backwardFactor;
  return input.direction * (input.running ? tuning.runSpeed : tuning.walkSpeed);
}

/** Nueva velocidad horizontal tras `dtSeconds`, con aceleración y frenado. */
export function stepHorizontalVelocity(
  velocity: number,
  input: MoveInput,
  dtSeconds: number,
  tuning: MotionTuning,
): number {
  const target = targetSpeed(input, tuning);
  const sameWay = target !== 0 && (velocity === 0 || Math.sign(velocity) === Math.sign(target));
  const speedingUp = sameWay && Math.abs(target) >= Math.abs(velocity);
  let rate: number;
  if (input.onGround) rate = speedingUp ? tuning.groundAccel : tuning.groundDecel;
  else rate = target === 0 ? tuning.airDecel : tuning.airAccel;
  return approach(velocity, target, rate * dtSeconds);
}

export interface JumpDecision {
  /** Iniciar un salto en este instante. */
  jump: boolean;
  /** Recortar la subida porque se soltó el botón. */
  cut: boolean;
}

/**
 * Decide cuándo saltar. Añade dos márgenes que hacen el control más justo:
 * «coyote» (saltar un instante después de dejar el suelo) y memoria de
 * pulsación (pulsar un instante antes de aterrizar).
 */
export class JumpController {
  private lastGroundedAt = -Infinity;
  private lastPressedAt = -Infinity;
  private rising = false;

  constructor(private readonly tuning: Pick<MotionTuning, 'coyoteMs' | 'jumpBufferMs'>) {}

  update(now: number, onGround: boolean, pressed: boolean, held: boolean, velocityY: number): JumpDecision {
    if (onGround) {
      this.lastGroundedAt = now;
      if (velocityY >= 0) this.rising = false;
    }
    if (pressed) this.lastPressedAt = now;

    const buffered = now - this.lastPressedAt <= this.tuning.jumpBufferMs;
    const grounded = now - this.lastGroundedAt <= this.tuning.coyoteMs;
    if (buffered && grounded) {
      this.lastPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
      this.rising = true;
      return { jump: true, cut: false };
    }
    if (this.rising && !held && velocityY < 0) {
      this.rising = false;
      return { jump: false, cut: true };
    }
    if (velocityY >= 0) this.rising = false;
    return { jump: false, cut: false };
  }
}
