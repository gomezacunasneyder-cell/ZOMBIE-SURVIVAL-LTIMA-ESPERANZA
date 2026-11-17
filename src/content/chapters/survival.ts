import type { LevelDef } from '../level';

/**
 * Modo supervivencia · «Último refugio». Un tramo de calle de cinco
 * pantallas con un puesto fortificado en el centro: dos barricadas
 * reforzadas encierran a Alex y los zombis llegan por los dos extremos.
 * Bidones de combustible fuera del refugio para volar grupos, una torre
 * de luz en el centro y dos alarmas que despiertan a la horda final.
 */
export const SURVIVAL_ARENA: LevelDef = {
  id: 'survival',
  width: 1400,
  playLine: 222,
  spawnX: 700,
  zones: [{ name: 'ULTIMO REFUGIO', from: 0 }],
  solids: [
    { kind: 'fortification', x: 610 },
    { kind: 'fortification', x: 790, flipX: true },
    // Fuera: coberturas bajas y bidones para hacer saltar a los grupos.
    { kind: 'fuelBarrel', x: 470 },
    { kind: 'fuelBarrel', x: 930 },
    { kind: 'fuelBarrel', x: 300 },
    { kind: 'fuelBarrel', x: 1100 },
    { kind: 'car', x: 180 },
    { kind: 'car', x: 1220, flipX: true },
  ],
  decor: [
    { frame: 'prop/tent', x: 700, y: 187 },
    { frame: 'prop/sandbags', x: 660, y: 206 },
    { frame: 'prop/supply-crate', x: 740, y: 205 },
    { frame: 'prop/crate', x: 755, y: 204 },
    { frame: 'prop/barrel', x: 640, y: 203 },
    { frame: 'vehicle/car', x: 420, y: 207, flipX: true },
    { frame: 'vehicle/car', x: 1000, y: 208 },
    { frame: 'prop/barrier', x: 520, y: 207 },
    { frame: 'prop/barrier', x: 880, y: 207 },
    { frame: 'prop/cone', x: 250, y: 205 },
    { frame: 'prop/cone', x: 1150, y: 205 },
    { frame: 'prop/led-sign', x: 560, y: 187 },
    // Primer plano.
    { frame: 'prop/body-bag', x: 380, y: 250 },
    { frame: 'prop/crate', x: 690, y: 258 },
    { frame: 'prop/barrier', x: 860, y: 262 },
    { frame: 'prop/body-bag', x: 1050, y: 251 },
    { frame: 'prop/cone', x: 150, y: 253 },
  ],
  fixtures: [
    { kind: 'facadeApartment', x: 120 },
    { kind: 'facadeShop', x: 360 },
    { kind: 'streetLamp', x: 240 },
    { kind: 'brokenLamp', x: 480 },
    { kind: 'fireBarrel', x: 640 },
    { kind: 'lightTower', x: 700 },
    { kind: 'fireBarrel', x: 765 },
    { kind: 'brokenLamp', x: 920 },
    { kind: 'facadeShop', x: 1040, flipX: true },
    { kind: 'streetLamp', x: 1160 },
    { kind: 'facadeApartment', x: 1300 },
    { kind: 'burningCar', x: 1240 },
    { kind: 'alarm', x: 560 },
    { kind: 'alarm', x: 840 },
  ],
  enemies: [],
  reinforcements: {},
  pickups: [],
  decals: [
    [0, 330, 230],
    [1, 520, 238],
    [2, 610, 241],
    [0, 790, 233],
    [1, 880, 240],
    [2, 1060, 229],
    [0, 1260, 236],
  ],
  helicopter: { y: 44 },
};
