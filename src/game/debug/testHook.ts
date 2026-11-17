import type Phaser from 'phaser';
import type { ImportReport } from '../../art/import/spritePack';
import { parseSkinId, type SkinId } from '../../art/skins';
import type { LoadoutId } from '../../content/weapons';
import type { SpriteExport } from './exportSprites';
import type { SimState } from './simState';

/** Órdenes y lecturas que la escena de juego ofrece a las pruebas. */
export interface SimHook {
  state(): SimState;
  /** Hace aparecer un enemigo (walker, runner, clicker o mutant). */
  spawnZombie(x: number, kind?: string): void;
  clearZombies(): void;
  teleport(x: number): void;
  /** Fija el momento del día (0 atardecer, 1 noche) o lo libera con `null`. */
  setNight(night: number | null): void;
  /** Hace estallar el bidón más cercano a `x`. */
  detonate(x: number): boolean;
  /** Fija cargador y reserva de una ranura (para probar casos límite sin gastar cientos de balas). */
  setAmmo(slot: number, magazine: number, reserve: number): void;
  /** Pide a Cóndor 7 un lanzamiento de suministros ya. */
  airdrop(): boolean;
  /** Hace daño a Alex (para probar los botiquines). */
  hurtPlayer(amount: number): void;
  /** Da un arma a Alex como si saliera de una caja. */
  giveWeapon(id: string): void;
  /** Da granadas o molotov a Alex. */
  giveThrowable(id: string, count: number): void;
  /** Deja piezas en el suelo junto a `x`. */
  dropScrap(x: number, amount: number): void;
  /** Modo supervivencia: salta a la oleada `wave` (1…5). */
  skipToWave(wave: number): void;
  /** Mata a todos los enemigos en pie (cuentan como bajas). */
  killAll(): void;
  /** Prueba de rendimiento: hace aparecer `count` enemigos alrededor de Alex. */
  stress(count: number): void;
}

export interface TextBounds {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Estado que el juego expone a las pruebas de navegador. Solo en desarrollo. */
export interface TestHook {
  game: Phaser.Game;
  /** Clave de la escena visible cuando ya ha terminado de montarse. */
  readyScene: string | null;
  renderer: 'webgl' | 'canvas';
  audioRegistered: boolean;
  lightCount: number;
  sim?: SimHook;
  /** Rectángulos de los textos visibles del HUD, en píxeles del juego. */
  hudTexts?: () => TextBounds[];
  /** Resultado de importar los paquetes de `public/sprites/`. */
  importReports?: ImportReport[];
  exportPack?: (prefix: string) => SpriteExport;
  frameSignature?: (name: string) => string;
  /** La pausa con ajustes de sonido está abierta. */
  optionsOpen?: boolean;
  /** El inventario (Tab) está abierto. */
  inventoryOpen?: boolean;
}

declare global {
  interface Window {
    __ZS__?: TestHook;
  }
}

/** Opciones de arranque leídas de la URL (`?scene=gallery&freeze=1&test=1`). */
export interface LaunchOptions {
  scene: 'game' | 'gallery' | 'compare' | 'arsenal' | 'bestiary';
  /** Detiene las animaciones de la galería para capturas reproducibles. */
  freeze: boolean;
  /** Arranca el nivel sin enemigos, para pruebas deterministas. */
  test: boolean;
  /** Aspecto de Alex (`?skin=nuevo`). */
  skin: SkinId;
  /** Momento del día fijo (`?hora=noche`); `null` = ciclo normal. */
  night: number | null;
  /** Armas al empezar (`?arsenal=basico|completo`); por defecto solo la pistola. */
  loadout: LoadoutId;
  /** Semilla de la partida (`?semilla=123`); sin ella, cada partida es distinta. */
  seed: number | null;
  /** `?suministros=ya`: Cóndor 7 llega nada más empezar. */
  airdropNow: boolean;
  /** `?modo=oleadas`: modo supervivencia; si no, la campaña. */
  mode: 'campaign' | 'survival';
  /** `&oleada=N`: oleada con la que empieza el modo supervivencia (0 = la primera). */
  startWave: number;
}

/** `atardecer`, `noche` o un número de 0 a 1. */
function parseHour(value: string | null): number | null {
  if (value === 'atardecer') return 0;
  if (value === 'noche') return 1;
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
}

export function readLaunchOptions(search: string): LaunchOptions {
  const params = new URLSearchParams(search);
  const scene = params.get('scene');
  return {
    scene:
      scene === 'gallery' || scene === 'compare' || scene === 'arsenal'
        ? scene
        : scene === 'bestiario' || scene === 'bestiary'
          ? 'bestiary'
          : 'game',
    freeze: params.get('freeze') === '1',
    test: params.get('test') === '1',
    skin: parseSkinId(params.get('skin')),
    night: parseHour(params.get('hora')),
    loadout: params.get('arsenal') === 'completo' ? 'completo' : params.get('arsenal') === 'basico' ? 'basico' : 'inicial',
    seed: Number.isFinite(Number(params.get('semilla'))) && params.get('semilla') !== null ? Number(params.get('semilla')) : null,
    airdropNow: params.get('suministros') === 'ya',
    mode: params.get('modo') === 'oleadas' ? 'survival' : 'campaign',
    startWave: Math.max(0, Math.floor(Number(params.get('oleada') ?? 1) || 1) - 1),
  };
}

type HookState = Omit<TestHook, 'game'>;

const DEFAULTS: HookState = {
  readyScene: null,
  renderer: 'canvas',
  audioRegistered: false,
  lightCount: 0,
};

/** Estado acumulado; las escenas pueden escribir antes de que exista el juego. */
const pending: Partial<HookState> = {};

export function installTestHook(game: Phaser.Game): void {
  if (!import.meta.env.DEV) return;
  window.__ZS__ = { ...DEFAULTS, ...pending, game };
}

export function updateTestHook(patch: Partial<HookState>): void {
  if (!import.meta.env.DEV) return;
  Object.assign(pending, patch);
  if (window.__ZS__) Object.assign(window.__ZS__, patch);
}

export function installSimHook(sim: SimHook): void {
  updateTestHook({ sim });
}
