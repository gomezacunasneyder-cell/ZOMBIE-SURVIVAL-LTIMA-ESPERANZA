import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/art/PixelBuffer';
import { P } from '../../src/art/palette';
import { synthGunshot } from '../../src/audio/synth/gunshot';
import { AIM_ANGLES, aimAngleTowards, snapAimAngle } from '../../src/core/combat/aim';
import { Rng } from '../../src/core/math/Rng';
import { computeIntegerZoom } from '../../src/game/display/integerScale';
import { readLaunchOptions } from '../../src/game/debug/testHook';

describe('Rng', () => {
  it('repite la secuencia con la misma semilla', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('da secuencias distintas con semillas distintas', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('respeta los límites', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect(() => rng.pick([])).toThrow();
  });
});

describe('puntería', () => {
  it('ajusta cualquier ángulo al más cercano de los 7 permitidos', () => {
    expect(snapAimAngle(0)).toBe(0);
    expect(snapAimAngle(14)).toBe(0);
    expect(snapAimAngle(16)).toBe(30);
    expect(snapAimAngle(50)).toBe(60);
    expect(snapAimAngle(200)).toBe(90);
    expect(snapAimAngle(-80)).toBe(-90);
    for (let d = -120; d <= 120; d += 7) expect(AIM_ANGLES).toContain(snapAimAngle(d));
  });

  it('apunta en horizontal, diagonal y vertical según el objetivo', () => {
    expect(aimAngleTowards(100, 100, 200, 100, 1)).toBe(0);
    expect(aimAngleTowards(100, 100, 200, 0, 1)).toBe(60);
    expect(aimAngleTowards(100, 100, 200, 42, 1)).toBe(30);
    expect(aimAngleTowards(100, 100, 100, 0, 1)).toBe(90);
    expect(aimAngleTowards(100, 100, 100, 200, 1)).toBe(-90);
  });

  it('funciona igual mirando a la izquierda', () => {
    expect(aimAngleTowards(100, 100, 0, 100, -1)).toBe(0);
    expect(aimAngleTowards(100, 100, 0, 42, -1)).toBe(30);
  });
});

describe('PixelBuffer', () => {
  it('ignora lo que se pinta fuera del lienzo', () => {
    const buf = new PixelBuffer(4, 4);
    buf.set(-1, 0, P.white).set(4, 4, P.white).rect(-5, -5, 3, 3, P.white);
    expect(buf.countOpaque()).toBe(0);
  });

  it('contornea una figura sin alterar su interior', () => {
    const buf = new PixelBuffer(5, 5).rect(2, 2, 1, 1, P.white).outline(P.outline);
    expect(buf.get(2, 2)).toBe(P.white);
    expect([buf.get(1, 2), buf.get(3, 2), buf.get(2, 1), buf.get(2, 3)]).toEqual(Array(4).fill(P.outline));
    expect(buf.get(1, 1)).toBe(0);
  });

  it('voltea y copia respetando la transparencia', () => {
    const src = PixelBuffer.fromRows(['a.', '.b'], { a: P.blood1, b: P.blue1 });
    const flipped = src.flippedX();
    expect([flipped.get(1, 0), flipped.get(0, 1)]).toEqual([P.blood1, P.blue1]);
    const dst = new PixelBuffer(2, 2).fill(P.white).blit(src, 0, 0);
    expect(dst.get(1, 0)).toBe(P.white);
  });

  it('rechaza filas desiguales y caracteres sin leyenda', () => {
    expect(() => PixelBuffer.fromRows(['ab', 'a'], { a: 1, b: 2 })).toThrow();
    expect(() => PixelBuffer.fromRows(['z'], { a: 1 })).toThrow();
  });

  it('trama aproximadamente la densidad pedida', () => {
    const buf = new PixelBuffer(16, 16).dither(0, 0, 16, 16, P.white, 0.5);
    expect(buf.countOpaque()).toBe(128);
  });
});

describe('zoom entero', () => {
  it('usa siempre un número entero de píxeles físicos por píxel de juego', () => {
    const cases: [w: number, h: number, dpr: number, expected: number][] = [
      [1920, 1080, 1, 4],
      [1280, 720, 1, 2],
      [1280, 720, 1.25, 3],
      [1366, 768, 1.5, 4],
      [2560, 1440, 2, 10],
      [300, 200, 1, 1],
    ];
    for (const [w, h, dpr, expected] of cases) {
      const { cssZoom, deviceZoom } = computeIntegerZoom(w, h, dpr, 480, 270);
      expect(deviceZoom, `${w}×${h}@${dpr}`).toBe(expected);
      expect(cssZoom * dpr).toBeCloseTo(expected, 9);
      expect(480 * cssZoom).toBeLessThanOrEqual(Math.max(w, 480 / dpr) + 1e-9);
    }
  });
});

describe('sonido sintetizado', () => {
  it('genera un disparo audible, sin saturar y reproducible', () => {
    const a = synthGunshot(44100, 3);
    const b = synthGunshot(44100, 3);
    expect(a.samples.length).toBeGreaterThan(10000);
    let peak = 0;
    for (const s of a.samples) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThanOrEqual(1);
    expect(Buffer.from(a.samples.buffer).equals(Buffer.from(b.samples.buffer))).toBe(true);
    // Termina casi en silencio para no hacer «clic».
    expect(Math.abs(a.samples[a.samples.length - 1]!)).toBeLessThan(0.02);
  });
});

describe('opciones de arranque', () => {
  it('lee la escena y la congelación de la URL', () => {
    expect(readLaunchOptions('')).toEqual({ scene: 'game', freeze: false, test: false, skin: 'detallado', night: null });
    expect(readLaunchOptions('?scene=gallery&freeze=1')).toEqual({ scene: 'gallery', freeze: true, test: false, skin: 'detallado', night: null });
    expect(readLaunchOptions('?scene=otra')).toEqual({ scene: 'game', freeze: false, test: false, skin: 'detallado', night: null });
  });
});
