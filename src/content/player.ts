/** Ajustes de movimiento y resistencia de Alex. Velocidades en px/s. */
export interface PlayerTuning {
  walkSpeed: number;
  runSpeed: number;
  /** Caminar en silencio. */
  sneakSpeed: number;
  /** Factor de velocidad al caminar de espaldas a donde apunta. */
  backwardFactor: number;
  groundAccel: number;
  groundDecel: number;
  airAccel: number;
  airDecel: number;
  jumpSpeed: number;
  /** Al soltar el salto, la velocidad de subida se multiplica por esto. */
  jumpCutFactor: number;
  /** Margen para saltar justo después de dejar una cornisa. */
  coyoteMs: number;
  /** Margen para saltar si se pulsó justo antes de aterrizar. */
  jumpBufferMs: number;
  maxHealth: number;
  invulnerableMs: number;
  hurtStunMs: number;
  knockbackSpeed: number;
}

export const PLAYER_TUNING: PlayerTuning = {
  walkSpeed: 54,
  runSpeed: 104,
  sneakSpeed: 26,
  backwardFactor: 0.75,
  groundAccel: 560,
  groundDecel: 700,
  airAccel: 340,
  airDecel: 140,
  jumpSpeed: 268,
  jumpCutFactor: 0.45,
  coyoteMs: 90,
  jumpBufferMs: 110,
  maxHealth: 100,
  invulnerableMs: 750,
  hurtStunMs: 200,
  knockbackSpeed: 110,
};

/** Botiquines (GDD §6): hasta 3, curan 50 y tardan 1,5 s. */
export const MEDKIT = { max: 3, heal: 50, useMs: 1500 } as const;
/** Botiquines con los que empieza Alex. */
export const STARTING_MEDKITS = 1;
/** Mientras se cura, Alex camina despacio. */
export const MEDKIT_WALK_FACTOR = 0.45;

/** Gravedad del mundo en px/s². */
export const GRAVITY = 900;
