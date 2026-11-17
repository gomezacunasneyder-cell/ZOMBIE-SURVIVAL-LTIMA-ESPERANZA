import type { Rng } from '../math/Rng';

/**
 * Lanzamiento de suministros de Cóndor 7, sin motor ni sprites:
 *
 * 1. `AirdropScheduler` decide cuándo hay lanzamiento (al azar en algunas
 *    partidas y siempre en ciertos eventos de zona).
 * 2. `chooseDropPoints` elige dónde caen las cajas.
 * 3. `AirdropFlight` mueve el helicóptero: aviso por radio, entrada desde
 *    un extremo, frenada y estacionario sobre cada punto, suelta de la caja
 *    y salida por el otro lado.
 * 4. `crateFall` describe la caída de cada caja con su paracaídas.
 */

// ───────────────────────── Calendario ─────────────────────────

export interface AirdropSchedule {
  /** Probabilidad de que en esta partida haya lanzamientos al azar. */
  randomChance: number;
  /** Espera hasta el primer lanzamiento al azar, en ms de juego. */
  firstDelayMs: readonly [min: number, max: number];
  /** Espera entre un lanzamiento y el siguiente. */
  repeatDelayMs: readonly [min: number, max: number];
  /** Tope de lanzamientos por partida, contando los de evento. */
  maxPerRun: number;
  /** Zonas cuya primera visita provoca un lanzamiento. */
  eventZones: readonly string[];
}

export type AirdropReason = 'random' | 'event';

export class AirdropScheduler {
  /** Esta partida tiene lanzamientos al azar. */
  readonly randomEnabled: boolean;
  private nextRandomAt: number;
  private launched = 0;
  private readonly visited = new Set<string>();
  private queued: AirdropReason | null = null;

  constructor(
    private readonly rules: AirdropSchedule,
    private readonly rng: Rng,
    now: number,
  ) {
    this.randomEnabled = rng.chance(rules.randomChance);
    this.nextRandomAt = now + this.between(rules.firstDelayMs);
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.rng.next() * (max - min);
  }

  get count(): number {
    return this.launched;
  }

  /** Momento previsto del siguiente lanzamiento al azar (o `Infinity`). */
  get nextRandom(): number {
    return this.randomEnabled && this.launched < this.rules.maxPerRun ? this.nextRandomAt : Infinity;
  }

  /** Alex entra en una zona. Si es de evento y es la primera vez, deja un lanzamiento pendiente. */
  enterZone(name: string): void {
    if (this.visited.has(name)) return;
    this.visited.add(name);
    if (this.rules.eventZones.includes(name)) this.queued = 'event';
  }

  /**
   * Avanza el calendario. `busy` indica que ya hay un lanzamiento en curso
   * (nunca se solapan). Devuelve el motivo si toca lanzar ahora.
   */
  update(now: number, busy: boolean): AirdropReason | null {
    if (busy || this.launched >= this.rules.maxPerRun) return null;
    let reason: AirdropReason | null = null;
    if (this.queued) reason = this.queued;
    else if (this.randomEnabled && now >= this.nextRandomAt) reason = 'random';
    if (!reason) return null;
    this.queued = null;
    this.launched += 1;
    this.nextRandomAt = now + this.between(this.rules.repeatDelayMs);
    return reason;
  }

  /** Fuerza un lanzamiento (pruebas y depuración); respeta el tope. */
  force(now: number): boolean {
    if (this.launched >= this.rules.maxPerRun) return false;
    this.launched += 1;
    this.nextRandomAt = now + this.between(this.rules.repeatDelayMs);
    return true;
  }
}

// ───────────────────────── Puntos de caída ─────────────────────────

export interface DropArea {
  playerX: number;
  levelWidth: number;
  /** Tramos ocupados por obstáculos, donde no debe caer una caja. */
  blocked: readonly (readonly [from: number, to: number])[];
}

export interface DropPointRules {
  /** Distancia a Alex del primer punto: [mín, máx]. */
  ahead: readonly [number, number];
  /** Separación entre cajas: [mín, máx]. */
  spacing: readonly [number, number];
  /** Margen con los bordes del nivel. */
  edge: number;
}

function isBlocked(x: number, area: DropArea, clearance: number, taken: readonly number[], spacing: number): boolean {
  return (
    area.blocked.some(([from, to]) => x > from - clearance && x < to + clearance) ||
    taken.some((other) => Math.abs(other - x) < spacing)
  );
}

/**
 * Corre `x` al hueco libre más cercano dentro del nivel, lejos de los
 * obstáculos y de las cajas ya colocadas. Prefiere avanzar en `direction`.
 */
function freeSpot(x: number, area: DropArea, rules: DropPointRules, clearance: number, taken: readonly number[], direction: 1 | -1): number {
  const min = rules.edge;
  const max = area.levelWidth - rules.edge;
  for (let step = 0; step < area.levelWidth; step += 2) {
    for (const candidate of [x + direction * step, x - direction * step]) {
      if (candidate >= min && candidate <= max && !isBlocked(candidate, area, clearance, taken, rules.spacing[0])) return candidate;
    }
  }
  return Math.min(max, Math.max(min, x));
}

/**
 * Elige dónde caen las cajas: por delante de Alex en el sentido del
 * nivel (hacia atrás si ya está al final), separadas entre sí, dentro
 * del nivel y fuera de los obstáculos. Siempre hay que ir a por ellas.
 */
export function chooseDropPoints(rng: Rng, count: number, area: DropArea, rules: DropPointRules, clearance = 14): number[] {
  const roomAhead = area.levelWidth - rules.edge - area.playerX;
  const needed = rules.ahead[1] + rules.spacing[1] * count;
  const direction = roomAhead >= needed ? 1 : -1;
  const points: number[] = [];
  // Alrededor de Alex tampoco: aunque un obstáculo empuje una caja hacia atrás, hay que ir a por ella.
  const nearPlayer = rules.ahead[0] * 0.7;
  area = { ...area, blocked: [...area.blocked, [area.playerX - nearPlayer, area.playerX + nearPlayer]] };
  let x = area.playerX + direction * (rules.ahead[0] + rng.next() * (rules.ahead[1] - rules.ahead[0]));
  for (let i = 0; i < count; i++) {
    points.push(freeSpot(Math.round(x), area, rules, clearance, points, direction));
    x = (points[points.length - 1] as number) + direction * (rules.spacing[0] + rng.next() * (rules.spacing[1] - rules.spacing[0]));
  }
  return points.sort((a, b) => a - b);
}

// ───────────────────────── Vuelo ─────────────────────────

export interface FlightRules {
  /** Aviso por radio antes de que el helicóptero empiece a acercarse. */
  warningMs: number;
  /** Distancia a la que empieza, antes del primer punto (fuera de la pantalla). */
  entryDistance: number;
  /** Distancia tras el último punto a la que se da por terminado. */
  exitDistance: number;
  cruiseSpeed: number;
  exitSpeed: number;
  /** Rapidez con la que cambia de velocidad (1/s). */
  response: number;
  /** Frena al acercarse: velocidad deseada = distancia × esto. */
  brake: number;
  /** Tiempo en estacionario sobre cada punto; la caja sale a mitad. */
  hoverMs: number;
}

export type FlightPhase = 'warning' | 'inbound' | 'hover' | 'outbound' | 'done';

export type FlightEvent =
  | { type: 'inbound' }
  | { type: 'release'; index: number; x: number }
  | { type: 'outbound' }
  | { type: 'done' };

/** Morro abajo al acelerar, nivelado, o morro arriba al frenar. */
export type Attitude = -1 | 0 | 1;

export class AirdropFlight {
  phase: FlightPhase = 'warning';
  x: number;
  speed = 0;
  attitude: Attitude = 0;
  private target = 0;
  private hoverStartedAt = 0;
  private released = false;
  private readonly startedAt: number;
  private readonly points: number[];

  /**
   * @param dropXs puntos de caída (en cualquier orden).
   * @param direction sentido del vuelo: 1 entra por la izquierda, -1 por la derecha.
   */
  constructor(
    private readonly rules: FlightRules,
    dropXs: readonly number[],
    readonly direction: 1 | -1,
    now: number,
  ) {
    if (dropXs.length === 0) throw new Error('AirdropFlight: hace falta al menos un punto de caída');
    this.points = [...dropXs].sort((a, b) => (a - b) * direction);
    this.x = (this.points[0] as number) - direction * rules.entryDistance;
    this.startedAt = now;
  }

  /** Puntos de caída en el orden en que los sobrevuela. */
  get dropPoints(): readonly number[] {
    return this.points;
  }

  /** Cajas soltadas hasta ahora. */
  get releasedCount(): number {
    return this.target + (this.released ? 1 : 0);
  }

  get active(): boolean {
    return this.phase !== 'done';
  }

  update(now: number, deltaMs: number): FlightEvent[] {
    const events: FlightEvent[] = [];
    const dt = Math.min(0.1, Math.max(0, deltaMs / 1000));
    const r = this.rules;

    if (this.phase === 'warning') {
      if (now - this.startedAt < r.warningMs) return events;
      this.phase = 'inbound';
      this.speed = r.cruiseSpeed;
      events.push({ type: 'inbound' });
    }
    if (this.phase === 'done') return events;

    let desired: number;
    if (this.phase === 'inbound') {
      const goal = this.points[this.target] as number;
      const distance = (goal - this.x) * this.direction;
      desired = Math.min(r.cruiseSpeed, Math.max(8, distance * r.brake));
      if (distance <= 1.5) {
        this.x = goal;
        this.speed = 0;
        this.phase = 'hover';
        this.hoverStartedAt = now;
        this.released = false;
      }
    } else if (this.phase === 'hover') {
      desired = 0;
      const held = now - this.hoverStartedAt;
      if (!this.released && held >= r.hoverMs / 2) {
        this.released = true;
        events.push({ type: 'release', index: this.target, x: this.x });
      }
      if (held >= r.hoverMs) {
        this.target += 1;
        this.released = false;
        this.phase = this.target < this.points.length ? 'inbound' : 'outbound';
        if (this.phase === 'outbound') events.push({ type: 'outbound' });
      }
    } else {
      desired = r.exitSpeed;
      const last = this.points[this.points.length - 1] as number;
      if ((this.x - last) * this.direction >= r.exitDistance) {
        this.phase = 'done';
        events.push({ type: 'done' });
        return events;
      }
    }

    const before = this.speed;
    this.speed += (desired - this.speed) * Math.min(1, r.response * dt);
    if (this.phase !== 'hover') this.x += this.direction * this.speed * dt;
    const change = (this.speed - before) / Math.max(dt, 1e-6);
    this.attitude = change < -25 ? -1 : this.speed > r.cruiseSpeed * 0.45 || change > 25 ? 1 : 0;
    return events;
  }
}

// ───────────────────────── Caída de las cajas ─────────────────────────

export interface FallRules {
  /** Caída libre antes de que se abra el paracaídas. */
  freeFallMs: number;
  gravity: number;
  /** Lo que tarda el paracaídas en desplegarse del todo. */
  deployMs: number;
  /** Velocidad de bajada con el paracaídas abierto. */
  chuteSpeed: number;
  /** Balanceo lateral: amplitud en px y periodo en ms. */
  swayPx: number;
  swayPeriodMs: number;
}

export type ChuteState = 'none' | 'deploying' | 'open' | 'landed';

export interface FallPose {
  y: number;
  /** Desplazamiento lateral por el balanceo. */
  sway: number;
  chute: ChuteState;
}

/**
 * Posición de una caja `elapsedMs` después de soltarla desde `startY`.
 * Cae libre un instante, se abre el paracaídas y baja despacio
 * balanceándose hasta tocar el suelo en `groundY`.
 */
export function crateFall(elapsedMs: number, startY: number, groundY: number, rules: FallRules): FallPose {
  const t = Math.max(0, elapsedMs);
  const free = Math.min(t, rules.freeFallMs) / 1000;
  const freeDrop = 0.5 * rules.gravity * free * free;
  if (t <= rules.freeFallMs) {
    const y = startY + freeDrop;
    return y >= groundY ? { y: groundY, sway: 0, chute: 'landed' } : { y, sway: 0, chute: 'none' };
  }
  const after = t - rules.freeFallMs;
  // La velocidad de caída libre se frena hasta la del paracaídas mientras se despliega.
  const freeSpeed = rules.gravity * free;
  const deploy = Math.min(after, rules.deployMs) / 1000;
  const deployK = deploy / (rules.deployMs / 1000);
  const deployDrop = deploy * (freeSpeed + (rules.chuteSpeed - freeSpeed) * deployK * 0.5);
  const openDrop = (Math.max(0, after - rules.deployMs) / 1000) * rules.chuteSpeed;
  const y = startY + freeDrop + deployDrop + openDrop;
  if (y >= groundY) return { y: groundY, sway: 0, chute: 'landed' };
  const swayIn = Math.min(1, after / (rules.deployMs * 2));
  const sway = Math.round(Math.sin((after / rules.swayPeriodMs) * Math.PI * 2) * rules.swayPx * swayIn);
  return { y, sway, chute: after < rules.deployMs ? 'deploying' : 'open' };
}
