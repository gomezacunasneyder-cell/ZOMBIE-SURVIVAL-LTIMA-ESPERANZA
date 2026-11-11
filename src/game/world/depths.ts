/**
 * Orden de dibujado. El decorado usa como profundidad la Y de su base
 * (entre 180 y 265), así que los actores se sitúan dentro de ese rango:
 * por delante de lo que hay al fondo de la calzada y por detrás del
 * primer plano.
 */
export const DEPTH = {
  sky: 0,
  clouds: 0.5,
  cityFar: 1,
  cityMid: 2,
  cityNear: 2.5,
  wall: 3,
  ground: 4,
  decal: 5,
  /** Sombras de contacto de objetos y vehículos. */
  groundShadow: 5.5,
  fogBack: 6,
  helicopter: 150,
  corpse: 223.5,
  zombie: 224,
  player: 226,
  bullet: 228,
  fx: 229,
  /** Por encima de la oscuridad (1000): la explosión emite luz propia. */
  explosion: 1002,
  foreground: 900,
  fogFront: 900.5,
} as const;
