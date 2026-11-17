import type { Hearing } from '../core/ai/noise';

/**
 * Enemigos definidos por datos. Velocidades en px/s, distancias en px.
 * Todos usan la misma IA (`core/ai/EnemyBrain`), pero cada uno activa
 * comportamientos distintos: el corredor rodea, el Chasqueador no ve y se
 * guía por el oído, el mutante rompe barricadas y no se deja aturdir.
 */

export type EnemyKind = 'walker' | 'runner' | 'clicker' | 'mutant';

export interface AttackDef {
  /** Distancia a la que se detiene y prepara el golpe. */
  range: number;
  /** Alcance real del golpe cuando lo descarga. */
  reach: number;
  damage: number;
  /** Tiempo de preparación: permite al jugador apartarse. */
  windupMs: number;
  recoverMs: number;
  /** Golpes seguidos por ataque (el corredor encadena dos). */
  hits: number;
  /** Preparación de los golpes siguientes de la serie. */
  followUpMs: number;
  /** Multiplica el empujón que recibe Alex. */
  shove: number;
}

export interface SightDef {
  range: number;
  /** Diferencia de altura máxima para verlo. */
  height: number;
}

/** Salto por encima de Alex para atacarle por la espalda. */
export interface FlankDef {
  /** Distancia a partir de la cual puede intentarlo. */
  range: number;
  chance: number;
  cooldownMs: number;
  leapX: number;
  leapY: number;
}

/** Ecolocalización del Chasqueador. */
export interface EchoDef {
  /** Duración de la pausa en que chasquea y escucha al llegar a un ruido. */
  listenMs: number;
  /** A esta distancia nota a Alex por contacto aunque esté quieto. */
  touchRange: number;
  /** Fuerza mínima (0–1) de un ruido de Alex para lanzarse a la carga en vez de investigar. */
  chargeStrength: number;
}

export interface BreakerDef {
  /** Golpes que da por segundo a una barricada. */
  intervalMs: number;
}

export interface EnemyDef {
  id: EnemyKind;
  /** Nombre en pantalla (sin tildes: la fuente de píxel no las tiene). */
  name: string;
  /** Prefijo de sus animaciones en el atlas. */
  art: string;
  maxHealth: number;
  wanderSpeed: number;
  /** Radio alrededor de su punto de aparición por el que deambula. */
  wanderRange: number;
  chaseSpeed: number;
  investigateSpeed: number;
  sight: SightDef | null;
  hearing: Hearing;
  /** Al oír a Alex: perseguirle o ir a ver qué ha sido. */
  onHear: 'chase' | 'investigate';
  /** Tiempo persiguiendo sin percibir a Alex antes de ir a su última posición conocida. */
  loseTrackMs: number;
  attack: AttackDef;
  /** Tiempo aturdido tras recibir un disparo. */
  staggerMs: number;
  /** Daño mínimo de un impacto para aturdirlo. */
  poise: number;
  /** Fracción del empujón de las balas que recibe. */
  knockbackTaken: number;
  /** Impulso con el que trepa un obstáculo bajo (0 = no trepa). */
  hopSpeed: number;
  flank: FlankDef | null;
  echo: EchoDef | null;
  breaker: BreakerDef | null;
  /** Radio del ruido que hacen sus gruñidos. */
  voice: number;
  /** Caja de colisión, apoyada en los pies y centrada. */
  body: { width: number; height: number };
  frame: { width: number; height: number };
}

const BASE_ATTACK: AttackDef = {
  range: 15,
  reach: 22,
  damage: 15,
  windupMs: 340,
  recoverMs: 650,
  hits: 1,
  followUpMs: 0,
  shove: 1,
};

/** Lento y torpe; ve a media distancia y acude a los disparos. Siempre en grupo. */
export const WALKER: EnemyDef = {
  id: 'walker',
  name: 'CAMINANTE',
  art: 'walker',
  maxHealth: 100,
  wanderSpeed: 9,
  wanderRange: 36,
  chaseSpeed: 30,
  investigateSpeed: 24,
  sight: { range: 170, height: 60 },
  hearing: { sensitivity: 1, hearsCreatures: false },
  onHear: 'chase',
  loseTrackMs: 9000,
  attack: BASE_ATTACK,
  staggerMs: 190,
  poise: 0,
  knockbackTaken: 1,
  hopSpeed: 250,
  flank: null,
  echo: null,
  breaker: null,
  voice: 110,
  body: { width: 10, height: 24 },
  frame: { width: 32, height: 32 },
};

/** Rápido y frágil: ataques rápidos encadenados y salta por encima de Alex para rodearle. */
export const RUNNER: EnemyDef = {
  id: 'runner',
  name: 'CORREDOR',
  art: 'runner',
  maxHealth: 60,
  wanderSpeed: 16,
  wanderRange: 60,
  chaseSpeed: 92,
  investigateSpeed: 70,
  sight: { range: 230, height: 60 },
  hearing: { sensitivity: 1.2, hearsCreatures: false },
  onHear: 'chase',
  loseTrackMs: 6000,
  attack: { range: 13, reach: 20, damage: 7, windupMs: 150, recoverMs: 420, hits: 2, followUpMs: 170, shove: 0.6 },
  staggerMs: 160,
  poise: 0,
  knockbackTaken: 1.3,
  hopSpeed: 300,
  flank: { range: 64, chance: 0.55, cooldownMs: 3200, leapX: 150, leapY: 255 },
  echo: null,
  breaker: null,
  voice: 120,
  body: { width: 10, height: 22 },
  frame: { width: 32, height: 32 },
};

/**
 * Ciego: se guía por el oído. Va a donde oye un ruido, chasquea para
 * escuchar y, si Alex hace ruido cerca, carga. Caminar en silencio o
 * quedarse quieto permite esquivarlo; su agarre es casi letal.
 */
export const CLICKER: EnemyDef = {
  id: 'clicker',
  name: 'CHASQUEADOR',
  art: 'clicker',
  maxHealth: 190,
  wanderSpeed: 10,
  wanderRange: 40,
  chaseSpeed: 66,
  investigateSpeed: 38,
  sight: null,
  hearing: { sensitivity: 1.7, hearsCreatures: true },
  onHear: 'investigate',
  loseTrackMs: 1800,
  attack: { range: 14, reach: 20, damage: 40, windupMs: 420, recoverMs: 950, hits: 1, followUpMs: 0, shove: 1.4 },
  staggerMs: 260,
  poise: 20,
  knockbackTaken: 0.6,
  hopSpeed: 220,
  flank: null,
  echo: { listenMs: 1600, touchRange: 15, chargeStrength: 0.35 },
  breaker: null,
  voice: 120,
  body: { width: 10, height: 24 },
  frame: { width: 32, height: 34 },
};

/** Gigante lento con muchísima vida; golpes devastadores; derriba barricadas en lugar de saltarlas. */
export const MUTANT: EnemyDef = {
  id: 'mutant',
  name: 'MUTANTE',
  art: 'mutant',
  maxHealth: 1100,
  wanderSpeed: 8,
  wanderRange: 30,
  chaseSpeed: 24,
  investigateSpeed: 20,
  sight: { range: 210, height: 90 },
  hearing: { sensitivity: 0.8, hearsCreatures: false },
  onHear: 'chase',
  loseTrackMs: 14000,
  attack: { range: 24, reach: 36, damage: 40, windupMs: 760, recoverMs: 1150, hits: 1, followUpMs: 0, shove: 2.2 },
  staggerMs: 320,
  poise: 120,
  knockbackTaken: 0.08,
  hopSpeed: 0,
  flank: null,
  echo: null,
  breaker: { intervalMs: 850 },
  voice: 200,
  body: { width: 20, height: 42 },
  frame: { width: 64, height: 56 },
};

export const ENEMIES: Readonly<Record<EnemyKind, EnemyDef>> = {
  walker: WALKER,
  runner: RUNNER,
  clicker: CLICKER,
  mutant: MUTANT,
};

/** Golpes que aguanta una barricada antes de romperse. */
export const BARRICADE_HITS = 3;
