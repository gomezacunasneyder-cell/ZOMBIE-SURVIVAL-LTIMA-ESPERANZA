/**
 * Paso del atardecer a la noche. Todo se deriva de un único número,
 * `night` (0 = atardecer, 1 = noche cerrada), de modo que cielo, luces,
 * niebla y sonido cambian a la vez y de forma coherente.
 */

export interface DayCycleConfig {
  /** Tiempo inicial en pleno atardecer antes de empezar a oscurecer. */
  holdDuskMs: number;
  /** Duración de la transición hasta la noche cerrada. */
  transitionMs: number;
}

export const DAY_CYCLE: DayCycleConfig = { holdDuskMs: 15_000, transitionMs: 150_000 };

/** Curva suave: arranca y termina despacio. */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Cuánta noche ha caído tras `elapsedMs` de partida (0–1). */
export function nightAt(elapsedMs: number, config: DayCycleConfig = DAY_CYCLE): number {
  return smoothstep((elapsedMs - config.holdDuskMs) / config.transitionMs);
}

/** Mezcla dos colores 0xRRGGBB. */
export function mixColor(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * k);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Luminosidad percibida de un color, 0–1. */
export function luminance(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface Ambience {
  night: number;
  /** Color por el que se multiplica la calle (oscuridad ambiente). */
  ambientColor: number;
  /** Opacidad del cielo nocturno sobre el del atardecer. */
  nightSkyAlpha: number;
  /** Tinte de los edificios lejanos. */
  cityTint: number;
  /** Opacidad de las ventanas encendidas de la ciudad. */
  cityLightsAlpha: number;
  fogAlpha: number;
  /** Luz tenue que acompaña a Alex para que nunca se pierda de vista. */
  playerLight: number;
}

const DUSK_AMBIENT = 0x8a7aa8;
/**
 * La noche es oscura pero legible: su luminosidad no baja de un tercio,
 * y las farolas, el fuego y la luz de Alex hacen el resto.
 */
const NIGHT_AMBIENT = 0x55548c;
const NIGHT_CITY_TINT = 0x5f6696;

export function ambienceAt(night: number): Ambience {
  const n = Math.min(1, Math.max(0, night));
  return {
    night: n,
    ambientColor: mixColor(DUSK_AMBIENT, NIGHT_AMBIENT, n),
    nightSkyAlpha: n,
    cityTint: mixColor(0xffffff, NIGHT_CITY_TINT, n),
    cityLightsAlpha: smoothstep((n - 0.2) / 0.5),
    fogAlpha: 0.1 + n * 0.1,
    playerLight: n * 0.4,
  };
}

/** Umbral de noche a partir del cual se enciende la farola número `index`. */
export function lampThreshold(index: number): number {
  // Se encienden escalonadas a lo largo del anochecer, no todas a la vez.
  return 0.04 + ((index * 7) % 10) * 0.03;
}

/**
 * Potencia de una farola (0–1). Al encenderse parpadea unos instantes,
 * como un tubo viejo, antes de quedar fija.
 */
export function lampPower(night: number, index: number, timeMs: number): number {
  const threshold = lampThreshold(index);
  if (night < threshold) return 0;
  const warmup = (night - threshold) / 0.03;
  if (warmup >= 1) return 1;
  const flicker = Math.sin(timeMs * 0.045 + index * 1.7) * Math.sin(timeMs * 0.013 + index);
  return flicker > 0.1 ? 1 : 0.15;
}

/** Nombre del momento del día para la interfaz. */
export function phaseName(night: number): 'ATARDECER' | 'ANOCHECER' | 'NOCHE' {
  if (night < 0.15) return 'ATARDECER';
  return night < 0.85 ? 'ANOCHECER' : 'NOCHE';
}
