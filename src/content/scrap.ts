/**
 * Piezas (GDD §6): la moneda de las mejoras. Las sueltan los enemigos al
 * morir y las traen los contenedores (cajas de suministros y de munición).
 */

import type { ScrapDropRule } from '../core/economy/Scrap';
import type { EnemyKind } from './enemies';

/** Lo que suelta cada enemigo al morir: los duros, más y más a menudo. */
export const SCRAP_DROPS: Readonly<Record<EnemyKind, ScrapDropRule>> = {
  walker: { chance: 0.35, amount: [1, 2] },
  runner: { chance: 0.45, amount: [1, 3] },
  clicker: { chance: 0.6, amount: [2, 4] },
  mutant: { chance: 1, amount: [8, 12] },
};

export const SCRAP = {
  /** Piezas que trae cada caja de suministros al abrirla. */
  crate: [3, 6] as const,
  /** Piezas de una caja de munición del nivel. */
  ammoBox: 2,
  /** Montoncitos en el suelo como mucho por muerte. */
  maxPiles: 3,
  /** Distancia a la que Alex las recoge al pasar. */
  reach: 14,
  /** Desde más cerca, las piezas vuelan hacia Alex. */
  magnet: 36,
  /** Tras tanto tiempo en el suelo se pierden. */
  lifetimeMs: 20_000,
} as const;
