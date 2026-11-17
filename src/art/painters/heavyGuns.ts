import { P } from '../palette';
import { band, metal, solid } from './gunShapes';
import type { GunArt } from './guns';

/**
 * Armas pesadas de los suministros: lanzallamas y lanzacohetes. Se dibujan
 * igual que el resto del arsenal (ver `guns.ts`): coordenadas de cañón,
 * sin rotar sprites, válidas para los 7 ángulos de puntería.
 */

/** Lanzallamas: depósito naranja bajo el cuerpo, lanza con protector térmico y llama piloto. */
export const FLAMER_ART: GunArt = {
  muzzle: 20,
  flash: 'small',
  pump: false,
  magazineAlong: 9,
  looseColors: [P.org2, P.org3],
  back(buf, angle) {
    band(buf, angle, -1.5, 4, -0.5, 1.5, (side) => (side < 0 ? P.grey2 : side > 1 ? P.shadow : P.grey3));
  },
  front(buf, angle, pose) {
    band(buf, angle, 6.5, 7.5, 0.5, 2.5, solid(P.shadow));
    band(buf, angle, 4, 12, -1.5, 0.5, metal(-1.5, 0));
    // Depósito de combustible (es el «cargador»).
    if (pose.magazine !== false) {
      band(buf, angle, 8.5, 13, 1, 4, (side, along) => {
        if (along > 12.5 || along < 9) return P.org3;
        return side < 1.5 ? P.org1 : side > 3.5 ? P.org3 : P.org2;
      });
      band(buf, angle, 10.5, 11, 0.5, 1, solid(P.grey3));
    }
    // Lanza: protector perforado y boquilla.
    band(buf, angle, 12, 19.5, -1, -0.5, solid(P.grey2));
    band(buf, angle, 13.5, 17.5, -2, 0, (side, along) =>
      side > -1.5 && side < -0.5 && Math.round(along * 2) % 3 === 0 ? P.shadow : side < -1.5 ? P.grey2 : P.grey3,
    );
    band(buf, angle, 19.5, 20, -1.5, 0, solid(P.shadow));
    // Llama piloto, siempre encendida.
    band(buf, angle, 19.5, 19.5, 0.5, 0.5, solid(P.light2));
  },
  supportHand: () => [15, 0.5],
};

/** Lanzacohetes: tubo largo al hombro, mira encima y cabeza del cohete asomando. */
export const ROCKET_ART: GunArt = {
  muzzle: 21,
  flash: 'heavy',
  pump: false,
  magazineAlong: 14,
  looseColors: [P.mil1, P.mil3],
  back(buf, angle) {
    // El tubo sobresale por detrás del hombro.
    band(buf, angle, -6, 5, -3, 0.5, (side, along) => {
      if (along < -5) return P.shadow;
      if (Math.abs(along - 1) < 0.6) return P.mil4;
      return side < -2.5 ? P.mil2 : side > 0 ? P.mil4 : P.mil3;
    });
  },
  front(buf, angle, pose) {
    band(buf, angle, 5, 21, -3, 0.5, (side, along) => {
      if (Math.abs(along - 16) < 0.6) return P.mil4;
      return side < -2.5 ? P.mil2 : side > 0 ? P.mil4 : P.mil3;
    });
    // Empuñaduras y mira.
    band(buf, angle, 6.5, 7.5, 0.5, 3, solid(P.shadow));
    band(buf, angle, 12, 12.5, 0.5, 2.5, solid(P.shadow));
    band(buf, angle, 9, 11, -4.5, -3.5, solid(P.grey3));
    band(buf, angle, 10.5, 10.5, -5, -4.5, solid(P.grey3));
    // Cabeza del cohete en la boca del tubo, o el hueco vacío al recargar.
    if (pose.magazine !== false) {
      band(buf, angle, 19, 21, -2.5, 0, (side, along) => (along > 20.5 ? P.grey1 : side < -1.5 ? P.mil1 : P.mil2));
    } else {
      band(buf, angle, 19.5, 21, -2.5, 0, solid(P.shadow));
    }
  },
  supportHand: () => [13, 2],
};
