import type Phaser from 'phaser';
import { APARTMENT_OPENINGS, SHOP_OPENINGS, type FacadeOpening } from '../../art/painters/facades';
import { shadowFrameFor } from '../../art/painters/hazards';
import { colorNumber } from '../../art/palette';
import { EXPLOSIVE_SOLIDS, SOLIDS, type FixturePlacement, type LevelDef } from '../../content/level';
import { ATLAS_KEY, MASK } from '../boot/registerArt';
import { GAME_HEIGHT } from '../config';
import type { Light, LightingSystem } from '../systems/LightingSystem';
import { DEPTH } from './depths';

/** Farola cuyo encendido depende del momento del día. */
export interface LampHandle {
  light: Light;
  glow: Phaser.GameObjects.Image;
  intensity: number;
  glowAlpha: number;
  index: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

/** Baliza de alarma: su luz parpadea y su sirena suena desde ese punto. */
export interface AlarmHandle extends WorldPoint {
  light: Light;
  glow: Phaser.GameObjects.Image;
}

/** Bidón de combustible que puede estallar. */
export interface ExplosiveHandle extends WorldPoint {
  zone: Phaser.GameObjects.Zone;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  hits: number;
  exploded: boolean;
}

export interface BuiltLevel {
  /** Suelo y obstáculos: todo lo que detiene a personajes y balas. */
  solids: Phaser.GameObjects.Zone[];
  lamps: LampHandle[];
  /** Fuegos permanentes, de los que sale humo. */
  fires: WorldPoint[];
  /** Cables sueltos que sueltan chispazos. */
  sparkers: WorldPoint[];
  alarms: AlarmHandle[];
  explosives: ExplosiveHandle[];
}

/**
 * Construye el mundo a partir de los datos del nivel: piezas independientes
 * con su propia profundidad y sombra, y cuerpos estáticos para el suelo y
 * los obstáculos. No hay ninguna imagen de fondo que simule el escenario.
 */
export function buildLevel(scene: Phaser.Scene, level: LevelDef, lighting: LightingSystem): BuiltLevel {
  const built: BuiltLevel = { solids: [], lamps: [], fires: [], sparkers: [], alarms: [], explosives: [] };

  const solidZone = (x: number, y: number, width: number, height: number): Phaser.GameObjects.Zone => {
    const zone = scene.add.zone(x, y, width, height);
    scene.physics.add.existing(zone, true);
    return zone;
  };

  // Suelo: un cuerpo estático bajo la línea de juego, a todo lo ancho.
  const groundHeight = GAME_HEIGHT - level.playLine + 40;
  built.solids.push(solidZone(level.width / 2, level.playLine + groundHeight / 2, level.width + 200, groundHeight));

  for (const [variant, x, y] of level.decals) {
    scene.add.image(x, y, ATLAS_KEY, `decal/blood/${variant}`).setDepth(DEPTH.decal);
  }

  for (const item of level.decor) prop(scene, item.frame, item.x, item.y, item.flipX ?? false);

  // Obstáculos sólidos sobre la línea de juego.
  for (const solid of level.solids) {
    const def = SOLIDS[solid.kind];
    const baseY = level.playLine + 1;
    const shadow = groundShadow(scene, solid.x, baseY, def.width + 6);
    const sprite = scene.add
      .image(solid.x, baseY, ATLAS_KEY, def.frame)
      .setOrigin(0.5, 1)
      .setFlipX(solid.flipX ?? false)
      .setDepth(baseY);
    const zone = solidZone(solid.x, level.playLine - def.height / 2, def.width, def.height);
    built.solids.push(zone);
    if (EXPLOSIVE_SOLIDS.includes(solid.kind)) {
      const handle: ExplosiveHandle = {
        zone,
        sprite,
        shadow,
        x: solid.x,
        y: level.playLine - def.height / 2,
        hits: 0,
        exploded: false,
      };
      zone.setData('explosive', handle);
      built.explosives.push(handle);
    }
  }

  let lampIndex = 0;
  for (const fixture of level.fixtures) {
    buildFixture(scene, fixture, lighting, built, () => lampIndex++);
  }
  return built;
}

function groundShadow(scene: Phaser.Scene, x: number, baseY: number, width: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, baseY - 1, ATLAS_KEY, shadowFrameFor(width))
    .setAlpha(0.42)
    .setDepth(DEPTH.groundShadow);
}

/** Coloca un objeto apoyado en el suelo, con su sombra de contacto. */
function prop(scene: Phaser.Scene, frame: string, x: number, baseY: number, flipX = false): Phaser.GameObjects.Image {
  const image = scene.add.image(x, baseY, ATLAS_KEY, frame).setOrigin(0.5, 1).setFlipX(flipX).setDepth(baseY);
  groundShadow(scene, x, baseY, Math.round(image.width * 0.85));
  return image;
}

function fire(scene: Phaser.Scene, lighting: LightingSystem, built: BuiltLevel, x: number, y: number, depth: number): void {
  scene.add.sprite(x, y, ATLAS_KEY, 'fx/fire/0').setOrigin(0.5, 1).setDepth(depth).play('fx/fire');
  lighting.addLight(MASK.radialLarge, x, y + 3, { intensity: 0.95, flicker: 0.22 });
  lighting.addGlow(MASK.radialMedium, x, y - 1, colorNumber('org1'), 0.3);
  built.fires.push({ x, y: y - 14 });
}

/** Coloca una fachada y deja a oscuras sus huecos. */
function facade(
  scene: Phaser.Scene,
  lighting: LightingSystem,
  frame: string,
  openings: FacadeOpening[],
  x: number,
  flip: boolean,
): void {
  const baseY = 188;
  const image = scene.add.image(x, baseY, ATLAS_KEY, frame).setOrigin(0.5, 1).setFlipX(flip).setDepth(baseY - 1);
  const left = x - image.width / 2;
  const top = baseY - image.height;
  for (const opening of openings) {
    const localX = flip ? image.width - opening.x : opening.x;
    lighting.addShade(opening.radius > 16 ? MASK.radialSmall : MASK.radialTiny, left + localX, top + opening.y, 0.9);
  }
}

/** Coloca un elemento con luz propia: su dibujo, la luz que recorta la oscuridad y su halo. */
function buildFixture(
  scene: Phaser.Scene,
  fixture: FixturePlacement,
  lighting: LightingSystem,
  built: BuiltLevel,
  nextLampIndex: () => number,
): void {
  const { x } = fixture;
  const flip = fixture.flipX ?? false;
  const light1 = colorNumber('light1');
  const light2 = colorNumber('light2');

  switch (fixture.kind) {
    case 'streetLamp': {
      prop(scene, 'prop/street-lamp', x, 188);
      const bulbX = x + 3;
      const intensity = 0.85;
      const glowAlpha = 0.3;
      built.lamps.push({
        light: lighting.addLight(MASK.lampCone, bulbX, 118, { originY: 0, intensity, flicker: 0.1 }),
        glow: lighting.addGlow(MASK.radialSmall, bulbX, 118, light2, glowAlpha),
        intensity,
        glowAlpha,
        index: nextLampIndex(),
      });
      break;
    }
    case 'brokenLamp': {
      prop(scene, 'prop/street-lamp', x, 188).setTint(0xb8b8c8);
      built.sparkers.push({ x: x + 3, y: 120 });
      break;
    }
    case 'lightTower': {
      prop(scene, 'prop/light-tower', x, 191);
      lighting.addLight(MASK.lampCone, x, 134, { originY: 0, intensity: 1 });
      lighting.addLight(MASK.radialLarge, x, 190, { intensity: 0.5 });
      lighting.addGlow(MASK.radialSmall, x, 134, light2, 0.32);
      break;
    }
    case 'fireBarrel': {
      prop(scene, 'prop/fire-barrel', x, 206);
      fire(scene, lighting, built, x, 193, 206.1);
      break;
    }
    case 'burningCar': {
      prop(scene, 'vehicle/car', x, 208, flip);
      fire(scene, lighting, built, x - 14, 196, 208.1);
      fire(scene, lighting, built, x + 10, 192, 208.1);
      break;
    }
    case 'truck': {
      prop(scene, 'vehicle/truck', x, 208, flip);
      // El faro queda en el morro; el haz apunta hacia donde mira el camión.
      const lampX = flip ? x - 42 : x + 42;
      lighting.addLight(MASK.beam, lampX, 186, { originX: flip ? 1 : 0, flipX: flip, intensity: 0.9 });
      lighting
        .addGlow(MASK.beam, lampX, 186, light1, 0.16)
        .setOrigin(flip ? 1 : 0, 0.5)
        .setFlipX(flip);
      lighting.addGlow(MASK.radialSmall, lampX, 186, light2, 0.35);
      break;
    }
    case 'alarm': {
      prop(scene, 'prop/alarm-beacon', x, 189);
      const lampX = x;
      const lampY = 189 - 46 + 4;
      built.alarms.push({
        x: lampX,
        y: lampY,
        light: lighting.addLight(MASK.radialMedium, lampX, lampY, { intensity: 0.5 }),
        glow: lighting.addGlow(MASK.radialMedium, lampX, lampY, colorNumber('blood1'), 0.5),
      });
      break;
    }
    case 'facadeShop':
      facade(scene, lighting, 'prop/facade-shop', SHOP_OPENINGS, x, flip);
      break;
    case 'facadeApartment':
      facade(scene, lighting, 'prop/facade-apartment', APARTMENT_OPENINGS, x, flip);
      break;
  }
}
