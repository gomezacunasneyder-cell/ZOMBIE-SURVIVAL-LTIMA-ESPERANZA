/**
 * Sacudida de cámara por «trauma». Cada impacto suma trauma; el
 * desplazamiento crece con su cuadrado y se disipa solo. Así un golpe
 * pequeño apenas se nota, varios seguidos no se acumulan sin límite y el
 * movimiento es una oscilación suave, no un salto aleatorio por fotograma.
 */

export interface ShakeConfig {
  /** Desplazamiento máximo en píxeles del juego. */
  maxOffset: number;
  /** Trauma que se disipa por segundo. */
  decayPerSecond: number;
  /** Oscilaciones por segundo. */
  frequency: number;
}

/** Valores comedidos: 3 px como mucho y medio segundo de duración. */
export const SHAKE: ShakeConfig = { maxOffset: 3, decayPerSecond: 2.2, frequency: 13 };

/** Trauma que aporta cada tipo de suceso. */
export const TRAUMA = { shot: 0.16, playerHit: 0.5, explosion: 0.85 } as const;

export class ShakeModel {
  private trauma = 0;

  constructor(private readonly config: ShakeConfig = SHAKE) {}

  get level(): number {
    return this.trauma;
  }

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  /** Avanza el tiempo y devuelve el desplazamiento entero de este fotograma. */
  update(deltaMs: number, timeMs: number): { x: number; y: number } {
    this.trauma = Math.max(0, this.trauma - (this.config.decayPerSecond * deltaMs) / 1000);
    if (this.trauma === 0) return { x: 0, y: 0 };
    const strength = this.trauma * this.trauma * this.config.maxOffset;
    const phase = (timeMs / 1000) * this.config.frequency * Math.PI * 2;
    // Dos senos de frecuencia distinta: recorrido irregular pero continuo.
    return {
      x: Math.round(Math.sin(phase) * strength),
      y: Math.round(Math.sin(phase * 1.31 + 1.7) * strength * 0.7),
    };
  }
}

/** Trauma de una explosión según la distancia a la cámara. */
export function explosionTrauma(distance: number, reach = 420): number {
  const k = 1 - Math.min(1, Math.max(0, distance / reach));
  return TRAUMA.explosion * k;
}
