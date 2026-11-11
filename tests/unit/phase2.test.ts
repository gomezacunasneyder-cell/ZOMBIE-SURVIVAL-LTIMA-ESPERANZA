import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import { EXPLOSION_FRAMES, SHADOW_WIDTHS, shadowFrameFor } from '../../src/art/painters/hazards';
import { synthDeathCry, synthExplosion, synthFootstep, synthSnarl, synthZap } from '../../src/audio/synth/impacts';
import {
  LOOP_RATE,
  synthAlarmLoop,
  synthCombatLoop,
  synthHelicopterLoop,
  synthNightLoop,
  synthTensionLoop,
  synthWindLoop,
} from '../../src/audio/synth/loops';
import { CHAPTER_1 } from '../../src/content/chapters/chapter1';
import { EXPLOSION, explosionDamage } from '../../src/content/hazards';
import { EXPLOSIVE_SOLIDS, SOLIDS } from '../../src/content/level';
import { WALKER } from '../../src/content/enemies';
import { PLAYER_TUNING } from '../../src/content/player';
import { SHAKE, ShakeModel, TRAUMA, explosionTrauma } from '../../src/core/fx/shake';
import {
  DEFAULT_AUDIO,
  parseAudio,
  positional,
  serializeAudio,
  stepVolume,
} from '../../src/core/settings/audioSettings';
import {
  DAY_CYCLE,
  ambienceAt,
  lampPower,
  lampThreshold,
  luminance,
  mixColor,
  nightAt,
  phaseName,
} from '../../src/core/world/dayCycle';
import { gustAt, windSpeed } from '../../src/core/world/wind';
import { createBrowserStore, createMemoryStore } from '../../src/platform/storage';

describe('ciclo atardecer-noche', () => {
  it('empieza en pleno atardecer, oscurece de forma gradual y se queda en noche', () => {
    expect(nightAt(0)).toBe(0);
    expect(nightAt(DAY_CYCLE.holdDuskMs)).toBe(0);
    const end = DAY_CYCLE.holdDuskMs + DAY_CYCLE.transitionMs;
    expect(nightAt(end)).toBe(1);
    expect(nightAt(end * 10)).toBe(1);
    let previous = 0;
    for (let t = 0; t <= end; t += 3000) {
      const value = nightAt(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      // Nunca salta: menos de un 5 % de cambio cada tres segundos.
      expect(value - previous).toBeLessThan(0.05);
      previous = value;
    }
  });

  it('la noche es más oscura que el atardecer, pero sigue siendo legible', () => {
    const dusk = luminance(ambienceAt(0).ambientColor);
    const night = luminance(ambienceAt(1).ambientColor);
    expect(night).toBeLessThan(dusk - 0.1);
    // Límite de visibilidad: la calle nunca baja de un tercio de su brillo.
    expect(night).toBeGreaterThanOrEqual(0.33);
    expect(ambienceAt(1).playerLight).toBeGreaterThan(0.2);
    expect(ambienceAt(0).playerLight).toBe(0);
  });

  it('cielo, ventanas y niebla cambian con la noche', () => {
    const dusk = ambienceAt(0);
    const night = ambienceAt(1);
    expect([dusk.nightSkyAlpha, night.nightSkyAlpha]).toEqual([0, 1]);
    expect([dusk.cityLightsAlpha, night.cityLightsAlpha]).toEqual([0, 1]);
    expect(dusk.cityTint).toBe(0xffffff);
    expect(luminance(night.cityTint)).toBeLessThan(0.5);
    expect(night.fogAlpha).toBeGreaterThan(dusk.fogAlpha);
    // La niebla es ligera: no llega a tapar la acción.
    expect(night.fogAlpha).toBeLessThanOrEqual(0.25);
    expect(ambienceAt(5).night).toBe(1);
    expect(ambienceAt(-1).night).toBe(0);
  });

  it('las farolas se encienden escalonadas y con parpadeo inicial', () => {
    const thresholds = Array.from({ length: 10 }, (_, i) => lampThreshold(i));
    expect(new Set(thresholds).size).toBeGreaterThan(5);
    expect(Math.max(...thresholds)).toBeLessThan(0.4);
    for (let i = 0; i < 10; i++) {
      expect(lampPower(0, i, 1000)).toBe(0);
      expect(lampPower(1, i, 1000)).toBe(1);
    }
    // Recién superado el umbral, parpadea entre tenue y encendida.
    const index = 3;
    const warming = lampThreshold(index) + 0.01;
    const seen = new Set<number>();
    for (let t = 0; t < 3000; t += 16) seen.add(lampPower(warming, index, t));
    expect([...seen].sort()).toEqual([0.15, 1]);
  });

  it('mezcla colores y nombra el momento del día', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x102030, 0x405060, 0)).toBe(0x102030);
    expect(mixColor(0x102030, 0x405060, 2)).toBe(0x405060);
    expect([phaseName(0), phaseName(0.5), phaseName(1)]).toEqual(['ATARDECER', 'ANOCHECER', 'NOCHE']);
  });
});

describe('viento', () => {
  it('sopla siempre hacia la izquierda, con rachas dentro de sus límites', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 120_000; t += 100) {
      const gust = gustAt(t);
      expect(gust).toBeGreaterThanOrEqual(0);
      expect(gust).toBeLessThanOrEqual(1);
      expect(windSpeed(t)).toBeLessThan(0);
      min = Math.min(min, gust);
      max = Math.max(max, gust);
    }
    // Hay calma y hay rachas: el viento varía de verdad.
    expect(min).toBeLessThan(0.1);
    expect(max).toBeGreaterThan(0.8);
  });
});

describe('sacudida de cámara', () => {
  it('nunca supera el máximo y se disipa sola', () => {
    const shake = new ShakeModel();
    shake.add(5);
    expect(shake.level).toBe(1);
    let time = 0;
    let moved = false;
    for (let i = 0; i < 120; i++) {
      time += 16;
      const offset = shake.update(16, time);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(SHAKE.maxOffset);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(SHAKE.maxOffset);
      expect(Number.isInteger(offset.x) && Number.isInteger(offset.y)).toBe(true);
      if (offset.x !== 0 || offset.y !== 0) moved = true;
    }
    expect(moved).toBe(true);
    // Menos de un segundo después ya no queda nada.
    expect(shake.level).toBe(0);
    expect(shake.update(16, time + 16)).toEqual({ x: 0, y: 0 });
  });

  it('un disparo apenas mueve la cámara; una explosión, sí', () => {
    const quiet = new ShakeModel();
    quiet.add(TRAUMA.shot);
    let peak = 0;
    for (let t = 0; t < 300; t += 16) peak = Math.max(peak, Math.abs(quiet.update(16, t).x));
    expect(peak).toBe(0);
    expect(TRAUMA.explosion).toBeGreaterThan(TRAUMA.playerHit);
    expect(explosionTrauma(0)).toBe(TRAUMA.explosion);
    expect(explosionTrauma(200)).toBeLessThan(explosionTrauma(50));
    expect(explosionTrauma(5000)).toBe(0);
  });
});

describe('ajustes de sonido', () => {
  it('sube y baja por pasos sin salir de 0–1, cada canal por separado', () => {
    let s = { ...DEFAULT_AUDIO };
    s = stepVolume(s, 'music', -1);
    expect(s).toEqual({ music: 0.5, sfx: 0.8 });
    s = stepVolume(s, 'sfx', 1);
    expect(s).toEqual({ music: 0.5, sfx: 0.9 });
    for (let i = 0; i < 20; i++) s = stepVolume(s, 'sfx', 1);
    expect(s.sfx).toBe(1);
    for (let i = 0; i < 20; i++) s = stepVolume(s, 'music', -1);
    expect(s.music).toBe(0);
  });

  it('guarda y recupera; los datos corruptos vuelven a los valores por defecto', () => {
    expect(parseAudio(serializeAudio({ music: 0.3, sfx: 1 }))).toEqual({ music: 0.3, sfx: 1 });
    expect(parseAudio(null)).toEqual(DEFAULT_AUDIO);
    expect(parseAudio('no es json')).toEqual(DEFAULT_AUDIO);
    expect(parseAudio('{"music":7,"sfx":"alto"}')).toEqual({ music: 1, sfx: DEFAULT_AUDIO.sfx });
    expect(parseAudio('null')).toEqual(DEFAULT_AUDIO);
  });

  it('el almacén funciona en memoria y sin navegador', () => {
    const memory = createMemoryStore();
    expect(memory.get('x')).toBeNull();
    memory.set('x', '1');
    expect(memory.get('x')).toBe('1');
    // En Node no hay localStorage: no debe lanzar y debe conservar el valor en la sesión.
    const store = createBrowserStore('prueba.');
    store.set('audio', 'a');
    expect(store.get('audio')).toBe('a');
  });

  it('un sonido lejano suena más flojo y hacia su lado', () => {
    expect(positional(100, 100, 400)).toEqual({ gain: 1, pan: 0 });
    const right = positional(300, 100, 400);
    expect(right.gain).toBeGreaterThan(0);
    expect(right.gain).toBeLessThan(1);
    expect(right.pan).toBeGreaterThan(0);
    expect(positional(-100, 100, 400).pan).toBeLessThan(0);
    expect(positional(900, 100, 400).gain).toBe(0);
  });
});

describe('explosiones', () => {
  it('el daño decae con la distancia y es nulo fuera del radio', () => {
    expect(explosionDamage(0, 100)).toBe(100);
    expect(explosionDamage(EXPLOSION.radius / 2, 100)).toBeLessThan(100);
    expect(explosionDamage(EXPLOSION.radius / 2, 100)).toBeGreaterThan(explosionDamage(EXPLOSION.radius - 1, 100));
    expect(explosionDamage(EXPLOSION.radius, 100)).toBe(0);
    expect(explosionDamage(EXPLOSION.radius + 50, 100)).toBe(0);
  });

  it('mata a un caminante cercano, hiere a Alex sin matarlo de un golpe', () => {
    expect(explosionDamage(10, EXPLOSION.enemyDamage)).toBeGreaterThanOrEqual(WALKER.maxHealth);
    expect(explosionDamage(0, EXPLOSION.playerDamage)).toBeLessThan(PLAYER_TUNING.maxHealth);
    expect(EXPLOSION.hitsToExplode).toBeGreaterThanOrEqual(2);
  });

  it('el nivel tiene bidones explosivos lejos del punto de partida', () => {
    const barrels = CHAPTER_1.solids.filter((solid) => EXPLOSIVE_SOLIDS.includes(solid.kind));
    expect(barrels.length).toBeGreaterThanOrEqual(4);
    for (const barrel of barrels) expect(Math.abs(barrel.x - CHAPTER_1.spawnX)).toBeGreaterThan(200);
    // Ninguna caja de munición queda tapada por un bidón.
    for (const pickup of CHAPTER_1.pickups) {
      for (const barrel of barrels) expect(Math.abs(barrel.x - pickup)).toBeGreaterThan(SOLIDS.fuelBarrel.width + 6);
    }
  });
});

describe('arte de la fase 2', () => {
  const catalog = buildArtCatalog();

  it('tiene las capas nuevas de cielo, ciudad y niebla', () => {
    for (const key of ['layer/sky-night', 'layer/clouds', 'layer/city-near', 'layer/city-mid-lights', 'layer/city-near-lights', 'layer/fog']) {
      expect(catalog.layers.has(key), key).toBe(true);
    }
    // Las ventanas encendidas existen y solo ocupan huecos de ventana.
    const lights = catalog.layers.get('layer/city-mid-lights')!;
    const base = catalog.layers.get('layer/city-mid')!;
    expect(lights.countOpaque()).toBeGreaterThan(200);
    expect(lights.countOpaque()).toBeLessThan(base.countOpaque() * 0.1);
  });

  it('tiene explosión, bidón, humo, papeles, fachadas y sombras', () => {
    const explosion = catalog.animations.find((a) => a.key === 'fx/explosion');
    expect(explosion?.frames).toHaveLength(EXPLOSION_FRAMES);
    expect(explosion?.repeat).toBe(0);
    for (const frame of ['prop/fuel-barrel', 'prop/alarm-beacon', 'prop/facade-shop', 'prop/facade-apartment', 'decal/scorch', 'fx/smoke/0', 'fx/smoke/2', 'fx/paper/0', 'fx/paper/1']) {
      expect(catalog.sprites.has(frame), frame).toBe(true);
    }
    for (const width of SHADOW_WIDTHS) expect(catalog.sprites.has(`fx/ground-shadow/${width}`)).toBe(true);
    expect(shadowFrameFor(10)).toBe('fx/ground-shadow/14');
    expect(shadowFrameFor(60)).toBe('fx/ground-shadow/62');
    expect(shadowFrameFor(500)).toBe('fx/ground-shadow/96');
  });

  it('ninguna fachada con rótulo se coloca volteada', () => {
    const flipped = CHAPTER_1.fixtures.filter((f) => f.kind === 'facadeShop' && f.flipX);
    expect(flipped).toEqual([]);
  });

  it('el bidón explosivo mide lo mismo que su caja de colisión prevé', () => {
    const barrel = catalog.sprites.get(SOLIDS.fuelBarrel.frame)!;
    expect(barrel.width).toBeGreaterThanOrEqual(SOLIDS.fuelBarrel.width);
    expect(barrel.height).toBeGreaterThanOrEqual(SOLIDS.fuelBarrel.height);
  });

  it('una bala horizontal alcanza el bidón: su caja llega por encima del hombro de Alex', () => {
    // Ambos aspectos tienen el hombro a 18–19 px de los pies (ver pruebas de aspectos).
    const shoulderAboveFeet = Math.max(
      ...['alex/idle/0', 'alex2/idle/0'].map((name) => {
        const frame = catalog.sprites.get(name)!;
        return frame.height - 2 - catalog.shoulders.get(name)!.y;
      }),
    );
    expect(SOLIDS.fuelBarrel.height).toBeGreaterThan(shoulderAboveFeet + 1);
    // Y sigue siendo saltable.
    expect(PLAYER_TUNING.jumpSpeed ** 2 / (2 * 900)).toBeGreaterThan(SOLIDS.fuelBarrel.height + 8);
  });
});

describe('audio sintetizado', () => {
  const loops = {
    viento: synthWindLoop(),
    helicoptero: synthHelicopterLoop(),
    alarma: synthAlarmLoop(),
    noche: synthNightLoop(),
    tension: synthTensionLoop(),
    combate: synthCombatLoop(),
  };

  it.each(Object.entries(loops))('el bucle de %s suena, no satura y enlaza sin salto', (_name, loop) => {
    expect(loop.sampleRate).toBe(LOOP_RATE);
    expect(loop.samples.length).toBeGreaterThan(LOOP_RATE * 0.9);
    let peak = 0;
    let energy = 0;
    let largestStep = 0;
    for (let i = 0; i < loop.samples.length; i++) {
      const value = loop.samples[i]!;
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
      if (i > 0) largestStep = Math.max(largestStep, Math.abs(value - loop.samples[i - 1]!));
    }
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.05);
    expect(Math.sqrt(energy / loop.samples.length)).toBeGreaterThan(0.01);
    // El salto entre la última muestra y la primera no supera a los que ya hay dentro.
    const seam = Math.abs(loop.samples[0]! - loop.samples[loop.samples.length - 1]!);
    expect(seam).toBeLessThanOrEqual(largestStep + 0.02);
  });

  it('la música de tensión y la de combate duran lo mismo, para sonar sincronizadas', () => {
    expect(loops.tension.samples.length).toBe(loops.combate.samples.length);
  });

  it('los efectos puntuales suenan y terminan en silencio', () => {
    const sounds = [synthFootstep(0), synthFootstep(1), synthSnarl(), synthDeathCry(), synthExplosion(), synthZap()];
    for (const sound of sounds) {
      let peak = 0;
      for (const value of sound.samples) peak = Math.max(peak, Math.abs(value));
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
      expect(Math.abs(sound.samples[sound.samples.length - 1]!)).toBeLessThan(0.05);
    }
    // Los dos pasos son distintos, para que no suene a metrónomo.
    expect(Buffer.from(sounds[0]!.samples.buffer).equals(Buffer.from(sounds[1]!.samples.buffer))).toBe(false);
    // La explosión es el efecto más largo.
    expect(sounds[4]!.samples.length).toBeGreaterThan(sounds[2]!.samples.length * 2);
  });
});
