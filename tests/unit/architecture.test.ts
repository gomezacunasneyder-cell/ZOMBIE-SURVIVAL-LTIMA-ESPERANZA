import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reglas de capas (ver docs/02-arquitectura.md). Sustituyen a las reglas
 * de ESLint previstas, porque typescript-eslint aún no admite TypeScript 7.
 */

const SRC = join(process.cwd(), 'src');

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.ts$/.test(entry) && !/\.d\.ts$/.test(entry) ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

const files = listSourceFiles(SRC).map((file) => ({
  file,
  layer: relative(SRC, file).split(sep)[0]!,
  path: relative(SRC, file).split(sep).join('/'),
  imports: importsOf(file),
}));

/** Capas que deben poder ejecutarse sin motor ni navegador. */
const PURE_LAYERS = ['core', 'content', 'platform', 'art', 'audio'];

describe('arquitectura por capas', () => {
  it('encuentra el código fuente', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('las capas puras no importan Phaser', () => {
    const offenders = files
      .filter((f) => PURE_LAYERS.includes(f.layer))
      .filter((f) => f.imports.some((i) => i === 'phaser' || i.startsWith('phaser/')))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('las capas puras no dependen de la capa de juego', () => {
    const offenders = files
      .filter((f) => PURE_LAYERS.includes(f.layer))
      .filter((f) => f.imports.some((i) => /(^|\/)game\//.test(i)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('core no depende de ninguna otra capa', () => {
    const offenders = files
      .filter((f) => f.layer === 'core')
      .filter((f) => f.imports.some((i) => /\.\.\/(\.\.\/)*(art|audio|game|content|platform)\//.test(i)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('ningún archivo supera las 400 líneas', () => {
    const offenders = files
      .map((f) => ({ path: f.path, lines: readFileSync(f.file, 'utf8').split('\n').length }))
      .filter((f) => f.lines > 400);
    expect(offenders).toEqual([]);
  });
});
