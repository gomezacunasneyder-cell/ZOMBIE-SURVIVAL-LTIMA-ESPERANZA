/** Parámetros de comportamiento que necesita el cerebro. */
export interface WalkerRules {
  chaseSpeed: number;
  wanderSpeed: number;
  wanderRange: number;
  sightRange: number;
  sightHeight: number;
  attackRange: number;
  windupMs: number;
  recoverMs: number;
  staggerMs: number;
}

export type WalkerState = 'wander' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead';

export interface WalkerPerception {
  now: number;
  selfX: number;
  /** Posición de Alex relativa al zombi: positivo = a su derecha / por debajo. */
  dx: number;
  dy: number;
  playerAlive: boolean;
}

export interface WalkerIntent {
  /** Dirección de avance. */
  move: -1 | 0 | 1;
  speed: number;
  facing: 1 | -1;
  /** Verdadero solo en el instante en que descarga el golpe. */
  strike: boolean;
}

/** Diferencia de altura máxima para iniciar un ataque. */
const ATTACK_HEIGHT = 26;

/**
 * Cerebro del caminante: deambula, detecta a Alex, lo persigue, prepara el
 * golpe y lo descarga. Solo decide; el sprite ejecuta. Sin Phaser.
 */
export class WalkerBrain {
  state: WalkerState = 'wander';
  private facing: 1 | -1 = -1;
  private stateEndsAt = 0;
  private wanderTarget: number;
  private nextWanderAt = 0;

  constructor(
    private readonly rules: WalkerRules,
    private readonly homeX: number,
    /** Fuente de azar 0–1 inyectada, para pruebas reproducibles. */
    private readonly random: () => number,
  ) {
    this.wanderTarget = homeX;
  }

  /** Un ruido o un disparo lo ponen en persecución aunque no vea a Alex. */
  alert(): void {
    if (this.state === 'wander') this.state = 'chase';
  }

  /** Recibe un impacto: queda aturdido un instante y después persigue. */
  onHit(now: number): void {
    if (this.state === 'dead') return;
    this.state = 'stagger';
    this.stateEndsAt = now + this.rules.staggerMs;
  }

  kill(): void {
    this.state = 'dead';
  }

  update(p: WalkerPerception): WalkerIntent {
    if (this.state === 'dead') return this.idle();
    if (!p.playerAlive && this.state !== 'stagger') this.state = 'wander';

    const distance = Math.abs(p.dx);
    const towards: 1 | -1 = p.dx >= 0 ? 1 : -1;

    if (this.state === 'wander') {
      const sees =
        p.playerAlive && distance <= this.rules.sightRange && Math.abs(p.dy) <= this.rules.sightHeight;
      if (!sees) return this.wander(p);
      this.state = 'chase';
    }

    if (this.state === 'chase') {
      this.facing = towards;
      if (distance <= this.rules.attackRange && Math.abs(p.dy) <= ATTACK_HEIGHT) {
        this.state = 'windup';
        this.stateEndsAt = p.now + this.rules.windupMs;
        return this.idle();
      }
      // Si Alex está justo encima o debajo, espera en lugar de temblar.
      if (distance < 3) return this.idle();
      return { move: towards, speed: this.rules.chaseSpeed, facing: towards, strike: false };
    }

    if (this.state === 'windup') {
      if (p.now < this.stateEndsAt) return this.idle();
      this.state = 'recover';
      this.stateEndsAt = p.now + this.rules.recoverMs;
      return { move: 0, speed: 0, facing: this.facing, strike: true };
    }

    // 'recover' o 'stagger': quieto hasta que pase el tiempo.
    if (p.now >= this.stateEndsAt) this.state = 'chase';
    return this.idle();
  }

  private idle(): WalkerIntent {
    return { move: 0, speed: 0, facing: this.facing, strike: false };
  }

  private wander(p: WalkerPerception): WalkerIntent {
    if (p.now >= this.nextWanderAt) {
      this.wanderTarget = this.homeX + (this.random() * 2 - 1) * this.rules.wanderRange;
      this.nextWanderAt = p.now + 1500 + this.random() * 2500;
    }
    const gap = this.wanderTarget - p.selfX;
    if (Math.abs(gap) < 2) return this.idle();
    this.facing = gap > 0 ? 1 : -1;
    return { move: this.facing, speed: this.rules.wanderSpeed, facing: this.facing, strike: false };
  }
}
