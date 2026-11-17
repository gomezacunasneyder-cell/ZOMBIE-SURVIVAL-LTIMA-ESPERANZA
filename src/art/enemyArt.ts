import {
  CLICKER_VARIANTS,
  RUNNER_VARIANTS,
  paintClickerAttack,
  paintClickerClick,
  paintClickerDie,
  paintClickerHurt,
  paintClickerWalk,
  paintRunnerAttack,
  paintRunnerDie,
  paintRunnerHurt,
  paintRunnerLeap,
  paintRunnerRun,
} from './painters/infected';
import { MUTANT_VARIANTS, paintMutantAttack, paintMutantDie, paintMutantHurt, paintMutantWalk } from './painters/mutant';
import type { HumanoidFrame } from './rig/humanoid';

type AddAnimation = (key: string, frames: HumanoidFrame[], frameRate: number, repeat?: number) => void;

/** Variantes de aspecto de cada enemigo, por su prefijo de arte. */
export const ENEMY_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  runner: RUNNER_VARIANTS,
  clicker: CLICKER_VARIANTS,
  mutant: MUTANT_VARIANTS,
};

/** Clave de una animación de enemigo: `corredor/variante/accion`. */
export function enemyAnimation(art: string, variant: string, action: string): string {
  return `${art}/${variant}/${action}`;
}

/**
 * Animaciones de los enemigos especiales (el caminante está en el catálogo
 * desde la Fase 1). Todas comparten las acciones `walk`, `attack`, `hurt`
 * y `die`; el corredor añade `leap` y el Chasqueador `click`.
 */
export function addEnemyAnimations(add: AddAnimation): void {
  for (const v of RUNNER_VARIANTS) {
    add(enemyAnimation('runner', v, 'walk'), paintRunnerRun(v), 16);
    add(enemyAnimation('runner', v, 'attack'), paintRunnerAttack(v), 20, 0);
    add(enemyAnimation('runner', v, 'leap'), paintRunnerLeap(v), 8, 0);
    add(enemyAnimation('runner', v, 'hurt'), paintRunnerHurt(v), 14, 0);
    add(enemyAnimation('runner', v, 'die'), paintRunnerDie(v), 10, 0);
  }
  for (const v of CLICKER_VARIANTS) {
    add(enemyAnimation('clicker', v, 'walk'), paintClickerWalk(), 7);
    add(enemyAnimation('clicker', v, 'click'), paintClickerClick(), 14, 0);
    add(enemyAnimation('clicker', v, 'attack'), paintClickerAttack(), 10, 0);
    add(enemyAnimation('clicker', v, 'hurt'), paintClickerHurt(), 12, 0);
    add(enemyAnimation('clicker', v, 'die'), paintClickerDie(), 7, 0);
  }
  for (const v of MUTANT_VARIANTS) {
    add(enemyAnimation('mutant', v, 'walk'), paintMutantWalk(), 6);
    add(enemyAnimation('mutant', v, 'attack'), paintMutantAttack(), 8, 0);
    add(enemyAnimation('mutant', v, 'hurt'), paintMutantHurt(), 8, 0);
    add(enemyAnimation('mutant', v, 'die'), paintMutantDie(), 6, 0);
  }
}
