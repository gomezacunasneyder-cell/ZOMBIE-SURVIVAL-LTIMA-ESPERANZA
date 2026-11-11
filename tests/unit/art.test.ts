import { describe, expect, it } from 'vitest';
import { packAtlas } from '../../src/art/atlas';
import { aimFrame, buildArtCatalog } from '../../src/art/catalog';
import { FONT_CHARS, paintFontSheet, textWidth } from '../../src/art/font';
import { ambientMask, radialMask } from '../../src/art/lightMasks';
import { PALETTE_HEX, PALETTE_RGBA, PALETTE_SIZE, P } from '../../src/art/palette';
import { LAYER_WIDTH } from '../../src/art/painters/scenery';
import { WALKER_VARIANTS } from '../../src/art/painters/zombies';
import { FRAME_SIZE, GROUND_ROW } from '../../src/art/rig/humanoid';
import { AIM_ANGLES } from '../../src/core/combat/aim';

const catalog = buildArtCatalog();

describe('paleta', () => {
  it('no tiene colores repetidos', () => {
    const colors = PALETTE_HEX.slice(1);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('reserva el índice 0 como transparente y cabe en un byte', () => {
    expect(PALETTE_HEX[0]).toBeNull();
    expect(PALETTE_RGBA[3]).toBe(0);
    expect(PALETTE_SIZE).toBeLessThanOrEqual(256);
    expect(P.outline).toBe(1);
  });
});

describe('catálogo de arte', () => {
  it('solo usa índices de la paleta', () => {
    for (const [name, buffer] of [...catalog.sprites, ...catalog.layers]) {
      const max = buffer.data.reduce((a, b) => Math.max(a, b), 0);
      expect(max, name).toBeLessThan(PALETTE_SIZE);
    }
  });

  it('no deja ningún sprite vacío', () => {
    for (const [name, buffer] of catalog.sprites) {
      expect(buffer.countOpaque(), name).toBeGreaterThan(0);
    }
  });

  it('es determinista: dos generaciones dan los mismos píxeles', () => {
    const again = buildArtCatalog();
    for (const [name, buffer] of [...catalog.sprites, ...catalog.layers]) {
      const other = again.sprites.get(name) ?? again.layers.get(name);
      expect(other, name).toBeDefined();
      expect(Buffer.from(buffer.data).equals(Buffer.from(other!.data)), name).toBe(true);
    }
  });

  it('pinta los personajes en lienzos de 32×32 apoyados en el suelo', () => {
    const characterFrames = [...catalog.sprites].filter(
      ([name]) => /^(alex\/(idle|run)|walker\/)/.test(name),
    );
    expect(characterFrames.length).toBeGreaterThan(40);
    for (const [name, buffer] of characterFrames) {
      expect([buffer.width, buffer.height], name).toEqual([FRAME_SIZE, FRAME_SIZE]);
      // Alguna suela toca la fila de suelo y nada baja más allá del contorno.
      const row = (y: number): number[] => [...buffer.data.subarray(y * FRAME_SIZE, (y + 1) * FRAME_SIZE)];
      expect(row(GROUND_ROW).some((c) => c !== 0), `${name} toca el suelo`).toBe(true);
      expect(row(FRAME_SIZE - 1).every((c) => c === 0 || c === P.outline), name).toBe(true);
    }
  });

  it('tiene los fotogramas que declara cada animación', () => {
    const expected: Record<string, number> = {
      'alex/idle': 4,
      'alex/run': 8,
      'fx/fire': 6,
      'heli/rotor': 4,
    };
    for (const variant of WALKER_VARIANTS) {
      expected[`walker/${variant}/walk`] = 8;
      expected[`walker/${variant}/attack`] = 5;
    }
    for (const [key, count] of Object.entries(expected)) {
      const animation = catalog.animations.find((a) => a.key === key);
      expect(animation?.frames.length, key).toBe(count);
    }
    for (const animation of catalog.animations) {
      for (const frame of animation.frames) expect(catalog.sprites.has(frame), frame).toBe(true);
    }
  });

  it('registra el hombro de cada fotograma de Alex', () => {
    for (const [name] of catalog.sprites) {
      if (/^alex\/(idle|run)\//.test(name)) expect(catalog.shoulders.has(name), name).toBe(true);
    }
  });

  it('incluye brazo y fogonazo para los 7 ángulos de puntería', () => {
    expect(AIM_ANGLES).toHaveLength(7);
    const arms = new Set<string>();
    for (const angle of AIM_ANGLES) {
      for (const kind of ['arm', 'flash0', 'flash1'] as const) {
        expect(catalog.sprites.has(aimFrame(kind, angle)), `${kind} ${angle}`).toBe(true);
      }
      arms.add(Buffer.from(catalog.sprites.get(aimFrame('arm', angle))!.data).toString('base64'));
    }
    expect(arms.size, 'cada ángulo tiene un dibujo distinto').toBe(7);
  });

  it('genera capas de escenario del ancho de pantalla', () => {
    expect(catalog.layers.size).toBe(12);
    for (const [name, layer] of catalog.layers) expect(layer.width, name).toBe(LAYER_WIDTH);
  });

  it('anima de verdad: los fotogramas consecutivos de caminar difieren', () => {
    const a = catalog.sprites.get('walker/civil/walk/0')!;
    const b = catalog.sprites.get('walker/civil/walk/2')!;
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
  });
});

describe('atlas', () => {
  const packed = packAtlas(catalog.sprites);

  it('coloca todos los fotogramas dentro de la imagen y sin solaparse', () => {
    expect(packed.frames).toHaveLength(catalog.sprites.size);
    const used = new Uint8Array(packed.width * packed.height);
    const outside: string[] = [];
    const overlapping = new Set<string>();
    for (const f of packed.frames) {
      if (f.x < 0 || f.y < 0 || f.x + f.width > packed.width || f.y + f.height > packed.height) outside.push(f.name);
      for (let y = f.y; y < f.y + f.height; y++) {
        for (let x = f.x; x < f.x + f.width; x++) {
          if (used[y * packed.width + x]) overlapping.add(f.name);
          used[y * packed.width + x] = 1;
        }
      }
    }
    expect(outside).toEqual([]);
    expect([...overlapping]).toEqual([]);
  });

  it('cabe en una textura que cualquier GPU admite', () => {
    expect(packed.width).toBeLessThanOrEqual(2048);
    expect(packed.height).toBeLessThanOrEqual(2048);
  });

  it('copia los píxeles con el color exacto de la paleta', () => {
    const frame = packed.frames.find((f) => f.name === 'prop/barrel')!;
    const source = catalog.sprites.get('prop/barrel')!;
    const index = source.get(5, 8);
    const o = ((frame.y + 8) * packed.width + frame.x + 5) * 4;
    expect([...packed.rgba.subarray(o, o + 4)]).toEqual([...PALETTE_RGBA.subarray(index * 4, index * 4 + 4)]);
  });
});

describe('tipografía y máscaras', () => {
  it('dibuja un glifo por carácter disponible', () => {
    const sheet = paintFontSheet(P.white);
    expect(sheet.countOpaque()).toBeGreaterThan(FONT_CHARS.length * 3);
    expect(textWidth('ZONA')).toBe(15);
    expect(textWidth('')).toBe(0);
  });

  it('cuantiza la luz en cinco niveles, sin degradados suaves', () => {
    const mask = radialMask(24);
    const alphas = new Set<number>();
    for (let i = 3; i < mask.rgba.length; i += 4) alphas.add(mask.rgba[i]!);
    expect([...alphas].sort((a, b) => a - b)).toEqual([0, 64, 128, 191, 255]);
  });

  it('deja el cielo sin oscurecer y la calle a oscuridad completa', () => {
    const mask = ambientMask(8, 100, 20, 60);
    const alphaAt = (y: number): number => mask.rgba[(y * 8 + 0) * 4 + 3]!;
    expect(alphaAt(0)).toBe(0);
    expect(alphaAt(99)).toBe(255);
  });
});
