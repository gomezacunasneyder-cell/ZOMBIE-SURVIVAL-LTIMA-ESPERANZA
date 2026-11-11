/**
 * Aspectos de Alex. Un aspecto es un juego completo de animaciones con
 * el mismo conjunto de nombres; el juego elige uno y no necesita saber
 * cómo está dibujado. Así se puede comparar el nuevo con el actual y
 * sustituirlo sin tocar la física, las colisiones ni los controles.
 */

export type SkinId = 'clasico' | 'detallado';

export interface PlayerSkin {
  id: SkinId;
  /** Nombre para la interfaz (la tipografía de píxel no tiene tildes). */
  label: string;
  /** Prefijo de sus fotogramas y animaciones en el atlas. */
  prefix: string;
  frameWidth: number;
  frameHeight: number;
  /** Número de fotogramas de la recarga del brazo; 0 si no tiene. */
  reloadFrames: number;
  /** Tiene animación propia de aterrizaje. */
  hasLanding: boolean;
}

export const SKINS: Record<SkinId, PlayerSkin> = {
  clasico: {
    id: 'clasico',
    label: 'ACTUAL',
    prefix: 'alex',
    frameWidth: 32,
    frameHeight: 32,
    reloadFrames: 0,
    hasLanding: false,
  },
  detallado: {
    id: 'detallado',
    label: 'NUEVO',
    prefix: 'alex2',
    frameWidth: 32,
    frameHeight: 40,
    reloadFrames: 6,
    hasLanding: true,
  },
};

/** Aspecto que usa el juego si no se indica otro. */
export const DEFAULT_SKIN: SkinId = 'detallado';

/** Animaciones de cuerpo que todo aspecto debe tener. */
export const BODY_ANIMATIONS = ['idle', 'walk', 'walk-back', 'run', 'jump', 'fall', 'hurt', 'die'] as const;
export type BodyAnimation = (typeof BODY_ANIMATIONS)[number] | 'land';

export function skinAnimation(skin: PlayerSkin, name: BodyAnimation): string {
  return `${skin.prefix}/${name}`;
}

/** Pose del brazo: apuntando o con la corredera atrás (escopeta, tras disparar). */
export type ArmPose = 'aim' | 'pump';

/**
 * Fotograma del brazo que apunta en un ángulo dado con un arma. La pistola
 * conserva los nombres originales (`alex2/arm/0`) para que los paquetes de
 * sprites exportados antes sigan valiendo; las demás armas añaden su nombre.
 */
export function skinArmFrame(skin: PlayerSkin, angle: number, weapon = 'pistol', pose: ArmPose = 'aim'): string {
  if (weapon === 'pistol' && pose === 'aim') return `${skin.prefix}/arm/${angle}`;
  return `${skin.prefix}/arm/${weapon}${pose === 'pump' ? '-pump' : ''}/${angle}`;
}

/** Fotograma del brazo durante la recarga de un arma. */
export function skinReloadFrame(skin: PlayerSkin, index: number, weapon = 'pistol'): string {
  if (weapon === 'pistol') return `${skin.prefix}/reload/${index}`;
  return `${skin.prefix}/reload/${weapon}/${index}`;
}

/** Fotograma de recarga que corresponde a un progreso 0–1. */
export function reloadFrameIndex(skin: PlayerSkin, progress: number): number {
  return Math.min(skin.reloadFrames - 1, Math.max(0, Math.floor(progress * skin.reloadFrames)));
}

/** Lee el aspecto pedido en la URL (`?skin=clasico` o `?skin=nuevo`). */
export function parseSkinId(value: string | null): SkinId {
  if (value === 'clasico' || value === 'actual') return 'clasico';
  if (value === 'nuevo' || value === 'detallado') return 'detallado';
  return DEFAULT_SKIN;
}
