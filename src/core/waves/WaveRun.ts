import type { Rng } from '../math/Rng';

/**
 * Modo supervivencia por oleadas, sin motor ni sprites. Decide qué
 * enemigo sale, cuándo y por qué lado; cuenta las bajas de cada oleada;
 * marca los descansos y, tras la última (la horda), la llegada del jefe.
 *
 *   intro ─► fighting ─► rest ─► intro ─► … ─► alarm ─► fighting (horda) ─► boss ─► done
 */

export interface WaveGroup<Kind extends string = string> {
  kind: Kind;
  count: number;
}

export interface WaveDef<Kind extends string = string> {
  /** Título del aviso («OLEADA 3»). */
  title: string;
  /** Subtítulo con la novedad («¡CHASQUEADORES!»). */
  subtitle: string;
  groups: readonly WaveGroup<Kind>[];
  /** Pausa entre llegadas. */
  spawnEveryMs: number;
  /** Enemigos que llegan a la vez en cada llegada. */
  burst: number;
  /** Tope de enemigos vivos de esta oleada a la vez. */
  maxAlive: number;
  /** `both`: alternan los dos extremos; `random`: uno al azar cada vez. */
  sides: 'both' | 'random';
  /** Descanso tras superarla. */
  restMs: number;
  /** La horda final: va precedida de la alarma y acaba con el jefe. */
  final?: boolean;
  /** Tipos que llegan al final de la cola (los más duros, para el cierre). */
  lastKinds?: readonly Kind[];
}

export interface WaveTiming {
  /** Duración del aviso de cada oleada antes de que lleguen enemigos. */
  introMs: number;
  /** Duración de la alarma que despierta a la horda. */
  alarmMs: number;
  /** Secuencia de aparición del jefe. */
  bossMs: number;
}

export type WavePhase = 'intro' | 'alarm' | 'fighting' | 'rest' | 'boss' | 'done';

export type WaveEvent<Kind extends string = string> =
  | { type: 'intro'; wave: number }
  | { type: 'alarm'; wave: number }
  | { type: 'fight'; wave: number }
  | { type: 'spawn'; kind: Kind; side: -1 | 1 }
  | { type: 'cleared'; wave: number }
  | { type: 'boss' }
  | { type: 'done' };

/** Cola de llegadas de una oleada: mezclada, con los tipos duros al final. */
export function buildQueue<Kind extends string>(wave: WaveDef<Kind>, rng: Rng): Kind[] {
  const last = new Set(wave.lastKinds ?? []);
  const early: Kind[] = [];
  const late: Kind[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) (last.has(group.kind) ? late : early).push(group.kind);
  }
  // Fisher-Yates con la semilla de la partida.
  for (const list of [early, late]) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [list[i], list[j]] = [list[j] as Kind, list[i] as Kind];
    }
  }
  return [...early, ...late];
}

export function waveTotal(wave: WaveDef): number {
  return wave.groups.reduce((sum, group) => sum + group.count, 0);
}

export class WaveRun<Kind extends string = string> {
  phase: WavePhase = 'intro';
  /** Índice de la oleada actual (0 = primera). */
  index = 0;
  private phaseStartedAt: number;
  private queue: Kind[] = [];
  private nextSpawnAt = 0;
  private spawned = 0;
  private killed = 0;
  private nextSide: -1 | 1 = 1;

  constructor(
    readonly waves: readonly WaveDef<Kind>[],
    private readonly timing: WaveTiming,
    private readonly rng: Rng,
    now: number,
    startAt = 0,
  ) {
    if (waves.length === 0) throw new Error('WaveRun: hace falta al menos una oleada');
    this.index = Math.max(0, Math.min(waves.length - 1, startAt));
    this.phaseStartedAt = now;
    this.phase = this.current.final ? 'alarm' : 'intro';
  }

  get current(): WaveDef<Kind> {
    return this.waves[this.index] as WaveDef<Kind>;
  }

  /** Número de oleada para mostrar (1…N). */
  get number(): number {
    return this.index + 1;
  }

  get total(): number {
    return waveTotal(this.current);
  }

  get kills(): number {
    return this.killed;
  }

  /** Enemigos de la oleada que quedan por abatir (en pie o por llegar). */
  get remaining(): number {
    return Math.max(0, this.total - this.killed);
  }

  /** Progreso 0–1 de la oleada en curso. */
  get progress(): number {
    return this.phase === 'fighting' ? Math.min(1, this.killed / this.total) : this.phase === 'rest' ? 1 : 0;
  }

  /** Tiempo que queda de la fase actual (descanso, aviso, alarma, jefe), en ms. */
  timeLeft(now: number): number {
    const length =
      this.phase === 'rest'
        ? this.current.restMs
        : this.phase === 'intro'
          ? this.timing.introMs
          : this.phase === 'alarm'
            ? this.timing.alarmMs
            : this.phase === 'boss'
              ? this.timing.bossMs
              : 0;
    return Math.max(0, length - (now - this.phaseStartedAt));
  }

  /** Se ha abatido un enemigo de la oleada. */
  onKill(): void {
    if (this.phase === 'fighting') this.killed = Math.min(this.total, this.killed + 1);
  }

  /** Avanza. `alive` es el número de enemigos de la oleada en pie. */
  update(now: number, alive: number): WaveEvent<Kind>[] {
    const events: WaveEvent<Kind>[] = [];
    const elapsed = now - this.phaseStartedAt;
    switch (this.phase) {
      case 'intro':
        if (elapsed >= this.timing.introMs) this.startFight(now, events);
        break;
      case 'alarm':
        if (elapsed >= this.timing.alarmMs) this.startFight(now, events);
        break;
      case 'fighting':
        this.spawn(now, alive, events);
        if (this.queue.length === 0 && alive === 0 && this.killed >= this.spawned) {
          events.push({ type: 'cleared', wave: this.index });
          const final = this.current.final === true;
          this.enter(final ? 'boss' : 'rest', now);
          if (final) events.push({ type: 'boss' });
        }
        break;
      case 'rest':
        if (elapsed >= this.current.restMs) {
          this.index = Math.min(this.waves.length - 1, this.index + 1);
          this.enter(this.current.final ? 'alarm' : 'intro', now);
          events.push(this.current.final ? { type: 'alarm', wave: this.index } : { type: 'intro', wave: this.index });
        }
        break;
      case 'boss':
        if (elapsed >= this.timing.bossMs) {
          this.enter('done', now);
          events.push({ type: 'done' });
        }
        break;
      case 'done':
        break;
    }
    return events;
  }

  /** Empieza el primer aviso: la escena lo llama una vez para anunciarlo. */
  begin(now: number): WaveEvent<Kind>[] {
    this.phaseStartedAt = now;
    return [this.phase === 'alarm' ? { type: 'alarm', wave: this.index } : { type: 'intro', wave: this.index }];
  }

  private enter(phase: WavePhase, now: number): void {
    this.phase = phase;
    this.phaseStartedAt = now;
  }

  private startFight(now: number, events: WaveEvent<Kind>[]): void {
    this.enter('fighting', now);
    this.queue = buildQueue(this.current, this.rng);
    this.spawned = 0;
    this.killed = 0;
    this.nextSpawnAt = now;
    events.push({ type: 'fight', wave: this.index });
  }

  private spawn(now: number, alive: number, events: WaveEvent<Kind>[]): void {
    const wave = this.current;
    if (now < this.nextSpawnAt || this.queue.length === 0) return;
    let room = wave.maxAlive - alive;
    if (room <= 0) return;
    this.nextSpawnAt = now + wave.spawnEveryMs;
    for (let i = 0; i < wave.burst && room > 0 && this.queue.length > 0; i++, room--) {
      const kind = this.queue.shift() as Kind;
      const side = wave.sides === 'both' ? this.flipSide() : this.rng.chance(0.5) ? 1 : -1;
      this.spawned += 1;
      events.push({ type: 'spawn', kind, side });
    }
  }

  private flipSide(): -1 | 1 {
    this.nextSide = this.nextSide === 1 ? -1 : 1;
    return this.nextSide;
  }

  /** Salta a una oleada (pruebas): empieza su aviso. */
  skipTo(index: number, now: number): WaveEvent<Kind>[] {
    this.index = Math.max(0, Math.min(this.waves.length - 1, index));
    this.queue = [];
    this.spawned = 0;
    this.killed = 0;
    this.enter(this.current.final ? 'alarm' : 'intro', now);
    return [this.current.final ? { type: 'alarm', wave: this.index } : { type: 'intro', wave: this.index }];
  }
}
