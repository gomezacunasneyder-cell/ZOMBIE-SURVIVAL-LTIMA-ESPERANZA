import {
  AIM_ANGLES,
  paintAlexArm,
  paintAlexArmWith,
  paintAlexDie,
  paintAlexFall,
  paintAlexHurt,
  paintAlexIdle,
  paintAlexJump,
  paintAlexRun,
  paintAlexWalk,
  paintBullet,
  paintMuzzleFlash,
} from './painters/alex';
import {
  paintDetailedDie,
  paintDetailedFall,
  paintDetailedHurt,
  paintDetailedIdle,
  paintDetailedJump,
  paintDetailedLand,
  paintDetailedRun,
  paintDetailedWalk,
} from './painters/alexDetailed';
import { DETAILED_RELOAD_FRAMES, paintDetailedArm, paintDetailedReload } from './painters/alexDetailedArm';
import { SKINS, skinArmFrame, skinReloadFrame } from './skins';
import {
  BULLET_ANGLES,
  FLASH_STYLES,
  GUNS,
  IMPACT_FRAMES,
  paintGunFlash,
  paintImpact,
  paintPellet,
  paintShell,
  type FlashStyle,
} from './painters/guns';
import { paintApartmentFacade, paintShopFacade } from './painters/facades';
import {
  EXPLOSION_FRAMES,
  SHADOW_WIDTHS,
  paintAlarmBeacon,
  paintExplosion,
  paintFuelBarrel,
  paintGroundShadow,
  paintPaper,
  paintScorch,
  paintSmoke,
} from './painters/hazards';
import { paintCityLights, paintCityNear, paintClouds, paintFog, paintNightSky } from './painters/skyline';
import {
  paintCrosshair,
  paintHealthIcon,
  paintMachineGunIcon,
  paintPickupMarker,
  paintPistolIcon,
  paintRifleIcon,
  paintRound,
  paintShotgunIcon,
  paintSkullIcon,
  paintThinRound,
} from './painters/ui';
import {
  FIRE_FRAMES,
  paintBarrel,
  paintBarrier,
  paintBloodDecal,
  paintBodyBag,
  paintCone,
  paintContactShadow,
  paintCrate,
  paintFire,
  paintFireBarrel,
  paintLedSign,
  paintLightTower,
  paintSandbags,
  paintStreetLamp,
  paintSupplyCrate,
  paintTent,
} from './painters/props';
import {
  paintCityFar,
  paintCityMid,
  paintForeground,
  paintGround,
  paintSky,
  paintWall,
} from './painters/scenery';
import {
  ROTOR_FRAMES,
  paintHelicopterBody,
  paintMilitaryTruck,
  paintRotor,
  paintTailRotor,
  paintWreckedCar,
} from './painters/vehicles';
import {
  WALKER_VARIANTS,
  paintWalkerAttack,
  paintWalkerDie,
  paintWalkerHurt,
  paintWalkerWalk,
} from './painters/zombies';
import { P } from './palette';
import { PixelBuffer } from './PixelBuffer';
import type { HumanoidFrame } from './rig/humanoid';

export interface AnimationDef {
  key: string;
  frames: string[];
  frameRate: number;
  /** -1 = bucle infinito. */
  repeat: number;
}

export interface ArtCatalog {
  /** Fotogramas que van al atlas, por nombre `grupo/elemento/animación/n`. */
  sprites: Map<string, PixelBuffer>;
  /** Capas de fondo repetibles; cada una es una textura propia. */
  layers: Map<string, PixelBuffer>;
  animations: AnimationDef[];
  /** Posición del hombro en cada fotograma de personaje. */
  shoulders: Map<string, { x: number; y: number }>;
}

/** Nombre del fotograma de brazo o fogonazo para un ángulo de puntería. */
export function aimFrame(kind: 'arm' | 'flash0' | 'flash1', angle: number): string {
  return `alex/${kind}/${angle}`;
}

/** Nombre del fotograma de bala para un ángulo (múltiplo de 5°, ver `bulletAngle`). */
export function bulletFrame(angle: number): string {
  return `fx/bullet/${angle}`;
}

/** Fogonazo de un arma: el centro del fotograma es la boca del cañón. */
export function gunFlashFrame(style: FlashStyle, stage: 0 | 1, angle: number): string {
  return `fx/flash/${style}/${stage}/${angle}`;
}

/**
 * Genera todo el arte del juego. Función pura y determinista: no toca
 * el navegador, así que se ejecuta igual en las pruebas que en el juego.
 */
export function buildArtCatalog(): ArtCatalog {
  const sprites = new Map<string, PixelBuffer>();
  const layers = new Map<string, PixelBuffer>();
  const animations: AnimationDef[] = [];
  const shoulders = new Map<string, { x: number; y: number }>();

  const addAnimation = (
    key: string,
    frames: HumanoidFrame[] | PixelBuffer[],
    frameRate: number,
    repeat = -1,
  ): void => {
    const names = frames.map((frame, i) => {
      const name = `${key}/${i}`;
      if (frame instanceof PixelBuffer) sprites.set(name, frame);
      else {
        sprites.set(name, frame.buffer);
        shoulders.set(name, frame.shoulder);
      }
      return name;
    });
    animations.push({ key, frames: names, frameRate, repeat });
  };

  // Alex.
  addAnimation('alex/idle', paintAlexIdle(), 4);
  const walk = paintAlexWalk();
  addAnimation('alex/walk', walk, 10);
  addAnimation('alex/run', paintAlexRun(), 13);
  addAnimation('alex/jump', paintAlexJump(), 10, 0);
  addAnimation('alex/fall', paintAlexFall(), 8);
  addAnimation('alex/hurt', paintAlexHurt(), 12, 0);
  addAnimation('alex/die', paintAlexDie(), 8, 0);
  // Caminar de espaldas: los mismos fotogramas en orden inverso.
  animations.push({
    key: 'alex/walk-back',
    frames: walk.map((_, i) => `alex/walk/${walk.length - 1 - i}`),
    frameRate: 9,
    repeat: -1,
  });
  // Alex, versión detallada: mismos nombres de animación con otro prefijo.
  const detailed = SKINS.detallado;
  const d = (name: string): string => `${detailed.prefix}/${name}`;
  addAnimation(d('idle'), paintDetailedIdle(), 6);
  const detailedWalk = paintDetailedWalk();
  addAnimation(d('walk'), detailedWalk, 10);
  addAnimation(d('run'), paintDetailedRun(), 13);
  addAnimation(d('jump'), paintDetailedJump(), 12, 0);
  addAnimation(d('fall'), paintDetailedFall(), 8);
  addAnimation(d('land'), paintDetailedLand(), 16, 0);
  addAnimation(d('hurt'), paintDetailedHurt(), 14, 0);
  addAnimation(d('die'), paintDetailedDie(), 8, 0);
  animations.push({
    key: d('walk-back'),
    frames: detailedWalk.map((_, i) => d(`walk/${detailedWalk.length - 1 - i}`)),
    frameRate: 9,
    repeat: -1,
  });
  for (const angle of AIM_ANGLES) {
    sprites.set(aimFrame('arm', angle), paintAlexArm(angle));
    sprites.set(aimFrame('flash0', angle), paintMuzzleFlash(angle, 0));
    sprites.set(aimFrame('flash1', angle), paintMuzzleFlash(angle, 1));
  }

  // Arsenal: brazo con cada arma en los dos aspectos, bombeo y recarga.
  const classic = SKINS.clasico;
  for (const [weapon, gun] of Object.entries(GUNS)) {
    for (const angle of AIM_ANGLES) {
      sprites.set(skinArmFrame(detailed, angle, weapon), paintDetailedArm(angle, weapon));
      if (weapon !== 'pistol') sprites.set(skinArmFrame(classic, angle, weapon), paintAlexArmWith(angle, weapon));
      if (gun.pump) {
        sprites.set(skinArmFrame(detailed, angle, weapon, 'pump'), paintDetailedArm(angle, weapon, { pumpBack: true }));
        sprites.set(skinArmFrame(classic, angle, weapon, 'pump'), paintAlexArmWith(angle, weapon, { pumpBack: true }));
      }
    }
    const reload = paintDetailedReload(weapon);
    if (reload.length !== DETAILED_RELOAD_FRAMES) throw new Error('Recarga: número de fotogramas inesperado');
    reload.forEach((frame, i) => sprites.set(skinReloadFrame(detailed, i, weapon), frame));
  }
  for (const style of FLASH_STYLES) {
    for (const angle of AIM_ANGLES) {
      sprites.set(gunFlashFrame(style, 0, angle), paintGunFlash(angle, style, 0));
      sprites.set(gunFlashFrame(style, 1, angle), paintGunFlash(angle, style, 1));
    }
  }
  for (const angle of BULLET_ANGLES) sprites.set(bulletFrame(angle), paintBullet(angle));

  // Caminantes.
  for (const variant of WALKER_VARIANTS) {
    addAnimation(`walker/${variant}/walk`, paintWalkerWalk(variant), 7);
    addAnimation(`walker/${variant}/attack`, paintWalkerAttack(variant), 11, 0);
    addAnimation(`walker/${variant}/hurt`, paintWalkerHurt(variant), 12, 0);
    addAnimation(`walker/${variant}/die`, paintWalkerDie(variant), 8, 0);
  }

  // Vehículos.
  sprites.set('vehicle/car', paintWreckedCar());
  sprites.set('vehicle/truck', paintMilitaryTruck());
  sprites.set('heli/body', paintHelicopterBody());
  addAnimation(
    'heli/rotor',
    Array.from({ length: ROTOR_FRAMES }, (_, i) => paintRotor(i)),
    24,
  );
  addAnimation('heli/tail', [paintTailRotor(0), paintTailRotor(1)], 24);

  // Objetos.
  sprites.set('prop/barrel', paintBarrel());
  sprites.set('prop/fire-barrel', paintFireBarrel());
  sprites.set('prop/barrier', paintBarrier());
  sprites.set('prop/cone', paintCone());
  sprites.set('prop/sandbags', paintSandbags());
  sprites.set('prop/street-lamp', paintStreetLamp());
  sprites.set('prop/light-tower', paintLightTower());
  sprites.set('prop/tent', paintTent());
  sprites.set('prop/led-sign', paintLedSign());
  sprites.set('prop/crate', paintCrate());
  sprites.set('prop/supply-crate', paintSupplyCrate());
  sprites.set('prop/body-bag', paintBodyBag());
  for (let i = 0; i < 3; i++) sprites.set(`decal/blood/${i}`, paintBloodDecal(i));

  // Efectos.
  sprites.set('fx/shadow', paintContactShadow());
  addAnimation(
    'fx/fire',
    Array.from({ length: FIRE_FRAMES }, (_, i) => paintFire(i)),
    10,
  );
  sprites.set('fx/ash', new PixelBuffer(1, 1).fill(P.grey1));
  sprites.set('fx/ember', new PixelBuffer(1, 1).fill(P.org1));
  sprites.set('fx/blood', new PixelBuffer(1, 1).fill(P.blood1));
  sprites.set('fx/blood-dark', new PixelBuffer(1, 1).fill(P.blood2));
  sprites.set('fx/spark', new PixelBuffer(1, 1).fill(P.light2));
  sprites.set('fx/dust', new PixelBuffer(1, 1).fill(P.grey2));
  sprites.set('fx/casing', new PixelBuffer(2, 1).fill(P.yel2));
  sprites.set('fx/shell', paintShell());
  sprites.set('fx/pellet', paintPellet());
  addAnimation(
    'fx/impact',
    Array.from({ length: IMPACT_FRAMES }, (_, i) => paintImpact(i)),
    24,
    0,
  );

  // Fase 2: peligros, humo, papeles, sombras y fachadas.
  sprites.set('prop/fuel-barrel', paintFuelBarrel());
  sprites.set('prop/alarm-beacon', paintAlarmBeacon());
  sprites.set('prop/facade-shop', paintShopFacade());
  sprites.set('prop/facade-apartment', paintApartmentFacade());
  sprites.set('decal/scorch', paintScorch());
  addAnimation(
    'fx/explosion',
    Array.from({ length: EXPLOSION_FRAMES }, (_, i) => paintExplosion(i)),
    14,
    0,
  );
  for (let size = 0; size < 3; size++) sprites.set(`fx/smoke/${size}`, paintSmoke(size));
  addAnimation('fx/paper', [paintPaper(0), paintPaper(1)], 6);
  for (const width of SHADOW_WIDTHS) sprites.set(`fx/ground-shadow/${width}`, paintGroundShadow(width));

  // Interfaz.
  sprites.set('ui/pistol', paintPistolIcon());
  sprites.set('ui/shotgun', paintShotgunIcon());
  sprites.set('ui/rifle', paintRifleIcon());
  sprites.set('ui/mg', paintMachineGunIcon());
  sprites.set('ui/round-thin', paintThinRound(true));
  sprites.set('ui/round-thin-empty', paintThinRound(false));
  sprites.set('ui/crosshair', paintCrosshair());
  sprites.set('ui/skull', paintSkullIcon());
  sprites.set('ui/health', paintHealthIcon());
  sprites.set('ui/round', paintRound(true));
  sprites.set('ui/round-empty', paintRound(false));
  sprites.set('ui/pickup', paintPickupMarker());

  // Capas de escenario.
  layers.set('layer/sky', paintSky());
  layers.set('layer/city-far', paintCityFar());
  const cityMid = paintCityMid();
  const cityNear = paintCityNear();
  layers.set('layer/city-mid', cityMid);
  layers.set('layer/city-near', cityNear);
  layers.set('layer/city-mid-lights', paintCityLights(cityMid, P.cityNear, 3, 4, 0.16, 71));
  layers.set('layer/city-near-lights', paintCityLights(cityNear, P.cityDark, 4, 5, 0.12, 72));
  layers.set('layer/sky-night', paintNightSky());
  layers.set('layer/clouds', paintClouds());
  layers.set('layer/fog', paintFog());
  layers.set('layer/wall', paintWall());
  layers.set('layer/ground', paintGround());
  layers.set('layer/foreground', paintForeground());

  return { sprites, layers, animations, shoulders };
}
