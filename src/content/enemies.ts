/** Definición de un enemigo por datos. Velocidades en px/s, distancias en px. */
export interface WalkerDef {
  id: string;
  maxHealth: number;
  chaseSpeed: number;
  wanderSpeed: number;
  /** Radio alrededor de su punto de aparición por el que deambula. */
  wanderRange: number;
  /** Distancia horizontal a la que ve a Alex. */
  sightRange: number;
  /** Diferencia de altura máxima para verlo. */
  sightHeight: number;
  /** Distancia a la que se detiene y prepara el golpe. */
  attackRange: number;
  /** Alcance real del golpe cuando lo descarga. */
  attackReach: number;
  attackDamage: number;
  /** Tiempo de preparación: permite al jugador apartarse. */
  windupMs: number;
  recoverMs: number;
  /** Tiempo aturdido tras recibir un disparo. */
  staggerMs: number;
  /** Impulso con el que trepa un obstáculo bajo. */
  hopSpeed: number;
}

export const WALKER: WalkerDef = {
  id: 'walker',
  maxHealth: 100,
  chaseSpeed: 30,
  wanderSpeed: 9,
  wanderRange: 36,
  sightRange: 170,
  sightHeight: 60,
  attackRange: 15,
  attackReach: 22,
  attackDamage: 15,
  windupMs: 340,
  recoverMs: 650,
  staggerMs: 190,
  hopSpeed: 250,
};
