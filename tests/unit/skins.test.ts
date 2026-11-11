import { describe, expect, it } from 'vitest';
import { buildArtCatalog } from '../../src/art/catalog';
import {
  applyPack,
  applySingle,
  indexRegion,
  nearestPaletteIndex,
  parseManifest,
  parsePackMeta,
  type DecodedImage,
} from '../../src/art/import/spritePack';
import { ARM_CANVAS } from '../../src/art/painters/alex';
import { DETAILED_PROPORTIONS } from '../../src/art/painters/alexDetailed';
import { PALETTE_RGBA, P } from '../../src/art/palette';
import { CLASSIC_PROPORTIONS } from '../../src/art/rig/humanoid';
import {
  BODY_ANIMATIONS,
  DEFAULT_SKIN,
  SKINS,
  parseSkinId,
  reloadFrameIndex,
  skinAnimation,
  skinArmFrame,
  skinReloadFrame,
} from '../../src/art/skins';
import { AIM_ANGLES } from '../../src/core/combat/aim';

const catalog = buildArtCatalog();
const PROPORTIONS = { clasico: CLASSIC_PROPORTIONS, detallado: DETAILED_PROPORTIONS };

describe.each(Object.values(SKINS))('aspecto «$id»', (skin) => {
  const proportions = PROPORTIONS[skin.id];
  const bodyFrames = [...catalog.sprites].filter(([name]) =>
    new RegExp(`^${skin.prefix}/(idle|walk|run|jump|fall|land|hurt|die)/`).test(name),
  );

  it('tiene todas las animaciones de cuerpo que usa el juego', () => {
    for (const name of BODY_ANIMATIONS) {
      const animation = catalog.animations.find((a) => a.key === skinAnimation(skin, name));
      expect(animation, name).toBeDefined();
      expect(animation!.frames.length, name).toBeGreaterThan(0);
      for (const frame of animation!.frames) expect(catalog.sprites.has(frame), frame).toBe(true);
    }
    expect(catalog.animations.some((a) => a.key === skinAnimation(skin, 'land'))).toBe(skin.hasLanding);
  });

  it('todos sus fotogramas de cuerpo miden lo mismo y apoyan en el mismo suelo', () => {
    expect(bodyFrames.length).toBeGreaterThan(20);
    for (const [name, buffer] of bodyFrames) {
      expect([buffer.width, buffer.height], name).toEqual([skin.frameWidth, skin.frameHeight]);
      const row = (y: number): number[] => [...buffer.data.subarray(y * buffer.width, (y + 1) * buffer.width)];
      expect(row(proportions.groundRow).some((c) => c !== 0), `${name} toca el suelo`).toBe(true);
      // Por debajo del suelo solo puede quedar la línea de contorno.
      for (let y = proportions.groundRow + 2; y < buffer.height; y++) {
        expect(row(y).every((c) => c === 0), `${name} fila ${y}`).toBe(true);
      }
    }
  });

  it('registra un hombro estable en cada fotograma de cuerpo', () => {
    const ys: number[] = [];
    for (const [name] of bodyFrames) {
      const shoulder = catalog.shoulders.get(name);
      expect(shoulder, name).toBeDefined();
      expect(shoulder!.x, name).toBeGreaterThanOrEqual(10);
      expect(shoulder!.x, name).toBeLessThanOrEqual(18);
      if (/\/(idle|walk|run)\//.test(name)) ys.push(shoulder!.y);
    }
    // El hombro solo sube o baja lo que dura el balanceo del paso.
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(3);
  });

  it('tiene un brazo distinto para cada uno de los 7 ángulos, en el lienzo común', () => {
    const drawings = new Set<string>();
    for (const angle of AIM_ANGLES) {
      const arm = catalog.sprites.get(skinArmFrame(skin, angle));
      expect(arm, String(angle)).toBeDefined();
      expect([arm!.width, arm!.height]).toEqual([ARM_CANVAS, ARM_CANVAS]);
      drawings.add(Buffer.from(arm!.data).toString('base64'));
    }
    expect(drawings.size).toBe(7);
  });

  it('declara la recarga que realmente tiene', () => {
    for (let i = 0; i < skin.reloadFrames; i++) {
      const frame = catalog.sprites.get(skinReloadFrame(skin, i));
      expect(frame, `recarga ${i}`).toBeDefined();
      expect([frame!.width, frame!.height]).toEqual([ARM_CANVAS, ARM_CANVAS]);
    }
    expect(catalog.sprites.has(skinReloadFrame(skin, skin.reloadFrames))).toBe(false);
  });
});

describe('aspectos', () => {
  it('el nuevo es más alto que el clásico, con el mismo ancho de fotograma', () => {
    const height = (prefix: string): number => {
      const box = catalog.sprites.get(`${prefix}/idle/0`)!.bounds();
      return box.bottom - box.top + 1;
    };
    // Altura con contorno incluido.
    expect(height('alex')).toBe(30);
    expect(height('alex2')).toBeGreaterThanOrEqual(32);
    expect(height('alex2')).toBeLessThanOrEqual(35);
    expect(SKINS.detallado.frameWidth).toBe(SKINS.clasico.frameWidth);
  });

  it('elige el aspecto por la URL y reparte la recarga por progreso', () => {
    expect(parseSkinId(null)).toBe(DEFAULT_SKIN);
    expect(parseSkinId('clasico')).toBe('clasico');
    expect(parseSkinId('nuevo')).toBe('detallado');
    expect(parseSkinId('otro')).toBe(DEFAULT_SKIN);
    const skin = SKINS.detallado;
    expect(reloadFrameIndex(skin, 0)).toBe(0);
    expect(reloadFrameIndex(skin, 0.5)).toBe(3);
    expect(reloadFrameIndex(skin, 1)).toBe(5);
  });
});

// ───────────────────────── Importador ─────────────────────────

/** Imagen de prueba rellena de un color de la paleta. */
function solidImage(width: number, height: number, index: number, alpha = 255): DecodedImage {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = PALETTE_RGBA[index * 4]!;
    rgba[i * 4 + 1] = PALETTE_RGBA[index * 4 + 1]!;
    rgba[i * 4 + 2] = PALETTE_RGBA[index * 4 + 2]!;
    rgba[i * 4 + 3] = alpha;
  }
  return { width, height, rgba };
}

describe('importador de sprites', () => {
  it('valida el manifiesto y descarta las entradas incorrectas', () => {
    expect(parseManifest({ version: 1, packs: [] })).toEqual({ manifest: { version: 1, packs: [] }, errors: [] });
    const { manifest, errors } = parseManifest({
      packs: [
        { image: 'a.png', data: 'a.json' },
        { image: 'b.png', frame: 'alex2/idle/0', shoulder: { x: 14, y: 20 } },
        { image: 'c.png' },
        { image: 'd.png', data: 'd.json', frame: 'x' },
        { data: 'e.json' },
      ],
    });
    expect(manifest.packs).toHaveLength(2);
    expect(manifest.packs[1]).toEqual({ image: 'b.png', frame: 'alex2/idle/0', shoulder: { x: 14, y: 20 } });
    expect(errors).toHaveLength(3);
    expect(parseManifest('nada').errors).toHaveLength(1);
  });

  it('valida los metadatos de un atlas', () => {
    const { meta, errors } = parsePackMeta({
      frames: {
        bueno: { x: 0, y: 0, w: 32, h: 40, shoulder: { x: 14, y: 20 } },
        malo: { x: 0, y: 0, w: 'ancho', h: 40 },
      },
      animations: {
        correcta: { frames: ['bueno'], frameRate: 8 },
        rota: { frames: 'bueno', frameRate: 8 },
      },
    });
    expect(Object.keys(meta.frames)).toEqual(['bueno']);
    expect(meta.animations).toEqual({ correcta: { frames: ['bueno'], frameRate: 8, repeat: -1 } });
    expect(errors).toHaveLength(2);
  });

  it('ajusta los colores a la paleta y la transparencia a todo o nada', () => {
    expect(nearestPaletteIndex(0xc2, 0x3b, 0x2c)).toBe(P.blood1);
    expect(nearestPaletteIndex(0xc0, 0x3d, 0x2e)).toBe(P.blood1);
    const image = solidImage(2, 1, P.blue2);
    image.rgba[0] = image.rgba[0]! + 3;
    image.rgba[7] = 40;
    const { buffer, adjusted } = indexRegion(image, 0, 0, 2, 1);
    expect([buffer.get(0, 0), buffer.get(1, 0)]).toEqual([P.blue2, 0]);
    expect(adjusted).toBe(2);
  });

  it('sustituye un fotograma del mismo tamaño y conserva o actualiza el hombro', () => {
    const target = buildArtCatalog();
    const before = target.shoulders.get('alex2/idle/0')!;
    const report = applyPack(
      target,
      { frames: { 'alex2/idle/0': { x: 0, y: 0, w: 32, h: 40 }, 'alex2/idle/1': { x: 32, y: 0, w: 32, h: 40, shoulder: { x: 15, y: 21 } } } },
      solidImage(64, 40, P.ui1),
      'prueba.png',
    );
    expect(report.errors).toEqual([]);
    expect(report.applied).toEqual(['alex2/idle/0', 'alex2/idle/1']);
    expect(target.sprites.get('alex2/idle/0')!.get(5, 5)).toBe(P.ui1);
    expect(target.shoulders.get('alex2/idle/0')).toEqual(before);
    expect(target.shoulders.get('alex2/idle/1')).toEqual({ x: 15, y: 21 });
  });

  it('rechaza lo que rompería anclajes o colisiones, sin tocar el original', () => {
    const target = buildArtCatalog();
    const original = Buffer.from(target.sprites.get('alex2/idle/0')!.data);
    const report = applyPack(
      target,
      {
        frames: {
          'alex2/idle/0': { x: 0, y: 0, w: 32, h: 48 },
          'alex2/idle/1': { x: 40, y: 0, w: 32, h: 40 },
          'alex2/idle/2': { x: 0, y: 0, w: 32, h: 40, shoulder: { x: 99, y: 2 } },
        },
        animations: { 'alex2/idle': { frames: ['alex2/idle/0', 'no-existe'], frameRate: 6 } },
      },
      solidImage(64, 48, P.ui1),
      'prueba.png',
    );
    expect(report.applied).toEqual([]);
    expect(report.errors).toHaveLength(4);
    expect(report.errors[0]).toContain('32×48');
    expect(Buffer.from(target.sprites.get('alex2/idle/0')!.data).equals(original)).toBe(true);
    expect(target.animations.find((a) => a.key === 'alex2/idle')!.frames).toHaveLength(6);
  });

  it('rechaza un fotograma vacío y avisa de los nombres nuevos', () => {
    const target = buildArtCatalog();
    const empty = applyPack(target, { frames: { 'alex2/idle/0': { x: 0, y: 0, w: 32, h: 40 } } }, solidImage(32, 40, P.ui1, 0), 'v.png');
    expect(empty.errors).toHaveLength(1);
    const fresh = applySingle(target, 'nuevo/objeto', solidImage(8, 8, P.org1), 'n.png');
    expect(fresh.applied).toEqual(['nuevo/objeto']);
    expect(fresh.warnings[0]).toContain('nuevo');
    expect(target.sprites.get('nuevo/objeto')!.width).toBe(8);
  });

  it('sustituye una animación entera si todos sus fotogramas existen', () => {
    const target = buildArtCatalog();
    const report = applyPack(
      target,
      { frames: {}, animations: { 'alex2/idle': { frames: ['alex2/idle/0', 'alex2/idle/3'], frameRate: 3, repeat: -1 } } },
      solidImage(1, 1, P.ui1),
      'a.png',
    );
    expect(report.errors).toEqual([]);
    expect(target.animations.find((a) => a.key === 'alex2/idle')).toMatchObject({ frameRate: 3, frames: ['alex2/idle/0', 'alex2/idle/3'] });
  });
});
