/**
 * EL DEVORADOR: equilibrio del combate, de sus ataques y del final.
 * Todo lo que se ajusta jugando está aquí.
 */

import type { DevourerRules } from '../core/boss/DevourerBrain';
import type { LootItem } from '../core/supply/loot';

export const DEVOURER: DevourerRules = {
  maxHealth: 4200,
  phase2At: 0.5,
  phase3At: 0.25,
  walkSpeed: 26,
  enragedSpeed: 1.4,
  enragedTempo: 0.8,
  chargeSpeed: 210,
  stalkRange: 70,
  attackGapMs: [1300, 950, 800],
  emergeMs: 600,
  enrageMs: 2400,
  flinchEvery: 0.06,
  flinchMs: 420,
  attacks: {
    // Golpe contra el suelo: onda expansiva a ras de suelo que hay que saltar.
    slam: { windupMs: 950, activeMs: 120, recoverMs: 1100, cooldownMs: 4200, range: [0, 230], weight: 3 },
    // Embestida y zarpazo directo contra Alex.
    charge: { windupMs: 800, activeMs: 950, recoverMs: 1200, cooldownMs: 5200, range: [70, 300], weight: 3 },
    // Escupe bilis en parábola.
    spit: { windupMs: 700, activeMs: 160, recoverMs: 800, cooldownMs: 3600, range: [110, 900], weight: 2.5 },
    // Ruge y de sus heridas brotan infectados pequeños.
    summon: { windupMs: 1100, activeMs: 200, recoverMs: 900, cooldownMs: 15_000, range: [0, 900], weight: 1.4 },
    // Derriba la barricada que le cierra el paso: dos mazazos.
    smash: { windupMs: 900, activeMs: 120, recoverMs: 700, cooldownMs: 0, range: [0, 900], weight: 0 },
  },
  spitCount: [3, 4, 5],
  summonCount: [3, 4, 4],
  summonCap: 6,
  eruption: {
    everyMs: 15_000,
    durationMs: 5200,
    waves: 4,
    waveGapMs: 1050,
    spikesPerWave: 16,
    safeGap: 70,
  },
  exhaustedMs: 4200,
  exhaustedDamage: 2,
  dyingMs: 5200,
};

/** Daño y alcance de los ataques. Fase 2 y 3 multiplican el daño por `enragedDamage`. */
export const BOSS_HAZARDS = {
  enragedDamage: 1.2,
  /** Zarpazo de la embestida. */
  charge: { damage: 28, reach: 40, shove: 2.2 },
  /** Onda del golpe contra el suelo: avanza hacia los dos lados; se esquiva saltando. */
  shockwave: { damage: 20, speed: [190, 240, 260] as const, range: [260, 360, 420] as const, height: 12, shove: 1.4 },
  /** Bilis: arco hacia Alex con algo de dispersión; deja un charco que quema un momento. */
  bile: { damage: 10, speed: 190, spreadPx: 46, puddleMs: 2600, puddleWidth: 18, puddleDamage: 4 },
  /** Espinas de la erupción: se avisa con una grieta encendida antes de brotar. */
  spike: { damage: 22, telegraphMs: 750, width: 12, upMs: 650 },
  /** Tocar al jefe hace daño y empuja. */
  contact: { damage: 8, shove: 1.6 },
  /** Mazazos para tirar una barricada reforzada. */
  smashHits: 2,
  /** Las explosiones le hacen esta fracción del daño: su piel es como una coraza. */
  blastFactor: 0.55,
  /** Fuego: daño por segundo mientras arde. */
  burnDps: 10,
  /** Enemigos que acuden durante la presentación y huyen al temblar el suelo. */
  stragglers: 6,
} as const;

/** Cóndor 7 deja munición al empezar y al enfurecerse el jefe: con buena administración, basta. */
export const BOSS_SUPPLIES: Readonly<Record<'start' | 'enrage', LootItem[]>> = {
  start: [{ kind: 'ammo' }, { kind: 'ammo' }, { kind: 'medkit', count: 1 }],
  enrage: [{ kind: 'ammo' }, { kind: 'ammo' }, { kind: 'medkit', count: 1 }, { kind: 'throwable', throwableId: 'grenade', count: 2 }],
};

/** Mensajes de la presentación, del combate y del final (la fuente de píxel no tiene tildes ni eñes). */
export const BOSS_TEXT = {
  name: 'EL DEVORADOR',
  title: 'SUJETO 7 - VIRUS Z-13',
  fallen: { title: 'LA HORDA HA CAIDO', subtitle: 'SILENCIO...' },
  flee: { title: 'HUYEN...', subtitle: 'ALGO LES DA MIEDO' },
  supplies: 'CONDOR 7: ¡ALEX, TE DEJO LO ULTIMO QUE TENGO!',
  enraged: { title: '¡SE ENFURECE!', subtitle: 'MAS RAPIDO Y MAS FUERTE' },
  enragedSupplies: 'CONDOR 7: ¡AGUANTA! MUNICION EN CAMINO',
  frenzy: { title: '¡FRENESI!', subtitle: 'ESQUIVA LAS ESPINAS Y DISPARA CUANDO CAIGA' },
  exhausted: { title: '¡ESTA AGOTADO!', subtitle: '¡DISPARA AHORA!' },
  victory: { title: 'VICTORIA', subtitle: 'EL DEVORADOR HA CAIDO' },
} as const;

/**
 * Grabación militar que se encuentra en los restos: revela el origen del
 * Virus Z-13 y deja abierta la segunda entrega.
 */
export const MILITARY_RECORDING = {
  header: 'ARCHIVO MILITAR CLASIFICADO - PROYECTO ORIGEN',
  meta: 'GRABACION 13-B  -  LABORATORIO 4, NIVEL -3',
  lines: [
    'DRA. HALVERSEN: SI ALGUIEN ESCUCHA ESTO, EL Z-13 NO FUE UN ACCIDENTE.',
    'LO CREAMOS AQUI, EN ORIGEN. QUERIAN SOLDADOS QUE NO SINTIERAN DOLOR NI MIEDO.',
    'LA CURA EXISTE, PERO ESTA INCOMPLETA. LA PROBAMOS EN EL SUJETO 7.',
    'NO DEJO DE CRECER. SE ALIMENTA DE LOS INFECTADOS. LO LLAMAN EL DEVORADOR.',
    'LA CONTENCION HA FALLADO. EL VIRUS SALIO POR LOS CONDUCTOS DE VENTILACION.',
    'EL MANDO LO SABIA. ORDENARON SELLAR LA CIUDAD CON TODOS DENTRO.',
    'Y HAY ALGO PEOR: EL SUJETO 7 NO ERA EL UNICO. HAY OTRAS INSTALACIONES.',
    'SI ENCONTRAIS ESTA GRABACION... DESTRUID ORIGEN.',
  ],
  end: '- FIN DE LA GRABACION -',
} as const;

/** Último momento: un chasquido detrás de Alex. */
export const ENDING_TEXT = {
  silence: '...',
  toBeContinued: 'CONTINUARA...',
  sequel: 'ZOMBIE SURVIVAL: ULTIMA ESPERANZA - PARTE 2',
  replay: 'PULSA R PARA JUGAR DE NUEVO',
} as const;
