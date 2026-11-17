/** Estado resumido del juego que las pruebas de navegador pueden leer. */
export interface SimState {
  time: number;
  worldWidth: number;
  cameraX: number;
  /** Desplazamiento del encuadre por la sacudida, en píxeles. */
  cameraOffset: { x: number; y: number };
  shake: number;
  zone: string;
  kills: number;
  bullets: { x: number; y: number; vx: number; vy: number; weapon: string }[];
  /** Impactos contra algo duro y contra zombis desde el inicio. */
  impacts: { hard: number; flesh: number };
  /** Momento del día: 0 = atardecer, 1 = noche cerrada. */
  night: number;
  lampsOn: number;
  lampCount: number;
  explosions: { total: number; remaining: number };
  pickups: number;
  audio: { music: number; sfx: number; loops: Record<string, number> };
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    facing: 1 | -1;
    aim: number;
    health: number;
    alive: boolean;
    animation: string;
    /** Últimas animaciones de cuerpo, de la más antigua a la actual. */
    recentAnimations: string[];
    skin: string;
    armFrame: string;
    /** Fogonazo visible, o `null`. */
    flashFrame: string | null;
    /** Ángulo libre hacia el cursor. */
    aimDegrees: number;
    /** Caja de colisión en coordenadas del mundo. */
    bodyTop: number;
    bodyBottom: number;
    bodyLeft: number;
    bodyRight: number;
  };
  weapon: {
    id: string;
    name: string;
    slot: number;
    magazine: number;
    magazineSize: number;
    reserve: number;
    reloading: boolean;
    /** Ya desenfundada (no está cambiando de arma). */
    ready: boolean;
    /** Balas disparadas con esta arma desde el inicio. */
    fired: number;
  };
  /** Todas las ranuras. */
  arsenal: ({ id: string; magazine: number; reserve: number; fired: number } | null)[];
  zombies: { kind: string; x: number; y: number; health: number; state: string; alive: boolean; target: number | null; animation: string }[];
  /** Ruido de Alex (0–1), ruidos emitidos desde el inicio y si camina en silencio. */
  noise: { level: number; emitted: number; sneaking: boolean };
  barricades: { x: number; hits: number; broken: boolean }[];
  /** Lanzamiento de Cóndor 7: fase, posición del helicóptero y cajas. */
  airdrop: {
    phase: string;
    heliX: number | null;
    drops: number;
    randomEnabled: boolean;
    crates: { x: number; y: number; state: string; items: string[]; rarity: string }[];
    /** Progreso de apertura de la caja (0–1), o `null`. */
    opening: number | null;
  };
  medkits: { count: number; using: boolean };
  /** Arrojadizos: los que lleva, los que vuelan, charcos de fuego y totales. */
  throwables: {
    grenade: number;
    molotov: number;
    flying: { id: string; x: number; y: number }[];
    fires: number;
    thrown: number;
    exploded: number;
  };
  /** Piezas reunidas, montoncitos en el suelo y piezas soltadas desde el inicio. */
  scrap: { total: number; onGround: number; dropped: number };
  /** Enemigos en llamas. */
  burning: number;
  /** Reutilización de enemigos: objetos creados, apariciones y retirados en reserva. */
  pool: { created: number; spawned: number; pooled: number };
  /** Enemigos vivos. */
  alive: number;
  /** Modo supervivencia, o `null` en la campaña. */
  survival: {
    wave: number;
    phase: string;
    remaining: number;
    total: number;
    kills: number;
    timeLeft: number;
    horde: string;
    alert: number;
    danger: number;
    finished: boolean;
    boss: boolean;
    bossRevealed: boolean;
  } | null;
}
