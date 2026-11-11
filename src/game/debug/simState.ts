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
  bullets: { x: number; y: number; vx: number; vy: number }[];
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
    /** Caja de colisión en coordenadas del mundo. */
    bodyTop: number;
    bodyBottom: number;
    bodyLeft: number;
    bodyRight: number;
  };
  weapon: { name: string; magazine: number; reserve: number; reloading: boolean };
  zombies: { x: number; health: number; state: string; alive: boolean }[];
}
