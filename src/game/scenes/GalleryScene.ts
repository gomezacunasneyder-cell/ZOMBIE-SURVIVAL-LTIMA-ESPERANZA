import Phaser from 'phaser';
import { aimFrame } from '../../art/catalog';
import { AIM_ANGLES } from '../../art/painters/alex';
import { WALKER_VARIANTS } from '../../art/painters/zombies';
import { colorNames, colorNumber } from '../../art/palette';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { updateTestHook, type LaunchOptions } from '../debug/testHook';
import { SCENE } from './keys';

/**
 * Galería de arte: todos los elementos a escala real, sin iluminación,
 * para revisar el estilo y servir de base a las pruebas visuales.
 * Aquí solo deben aparecer colores de la paleta.
 */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super(SCENE.gallery);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    this.cameras.main.setBackgroundColor(colorNumber('asph4'));

    this.label(4, 3, 'GALERIA DE ARTE      D: VOLVER AL JUEGO      C: COMPARAR ALEX');
    this.paletteStrip(4, 12);

    // Alex: reposo, carrera y los 7 ángulos de puntería.
    this.label(4, 22, 'ALEX: REPOSO CAMINAR CORRER / PUNTERIA 90 A -90 / SALTO CAIDA GOLPE MUERTE');
    this.animated('alex/idle', 16, 62);
    this.animated('alex/walk', 42, 62);
    this.animated('alex/run', 68, 62);
    this.animated('alex/jump', 366, 62, true);
    this.animated('alex/fall', 394, 62);
    this.animated('alex/hurt', 422, 62, true);
    this.animated('alex/die', 452, 62, true);
    AIM_ANGLES.forEach((angle, i) => {
      const x = 104 + i * 34;
      this.add.image(x, 62, ATLAS_KEY, 'alex/idle/0').setOrigin(0.5, 1);
      this.add.image(x - 16 + 13, 62 - 32 + 14, ATLAS_KEY, aimFrame('arm', angle));
      if (i === 3) this.add.image(x - 16 + 13, 62 - 32 + 14, ATLAS_KEY, aimFrame('flash0', angle));
    });

    // Caminantes: las cuatro variantes caminando y atacando.
    this.label(4, 68, 'CAMINANTES: CAMINAR / ATACAR / GOLPE Y MUERTE');
    WALKER_VARIANTS.forEach((variant, i) => {
      this.animated(`walker/${variant}/walk`, 16 + i * 30, 108);
      this.animated(`walker/${variant}/attack`, 140 + i * 30, 108, true);
      this.animated(`walker/${variant}/${i % 2 === 0 ? 'hurt' : 'die'}`, 264 + i * 30, 108, true);
    });
    // Fuego y manchas.
    this.animated('fx/fire', 392, 108);
    for (let i = 0; i < 3; i++) this.add.image(418 + i * 24, 102, ATLAS_KEY, `decal/blood/${i}`);

    // Vehículos.
    this.label(4, 114, 'VEHICULOS: TURISMO / CAMION / CONDOR 7');
    this.grounded('vehicle/car', 38, 166);
    this.grounded('vehicle/truck', 124, 166);
    this.add.image(186, 128, ATLAS_KEY, 'heli/body').setOrigin(0, 0);
    this.animated('heli/rotor', 186 + 34, 127, false, 0.5);
    this.animated('heli/tail', 186 + 79, 135, false, 0.5);
    this.grounded('prop/tent', 344, 166);

    // Objetos.
    this.label(4, 172, 'OBJETOS E INTERFAZ');
    ['ui/health', 'ui/skull', 'ui/pistol', 'ui/round', 'ui/round-empty', 'ui/pickup'].forEach((frame, i) => {
      this.add.image(330 + i * 22, 250, ATLAS_KEY, frame);
    });
    const props: [frame: string, x: number][] = [
      ['prop/street-lamp', 12],
      ['prop/light-tower', 40],
      ['prop/led-sign', 82],
      ['prop/barrier', 126],
      ['prop/barrel', 152],
      ['prop/fire-barrel', 168],
      ['prop/cone', 182],
      ['prop/sandbags', 208],
      ['prop/crate', 240],
      ['prop/supply-crate', 262],
      ['prop/body-bag', 290],
    ];
    for (const [frame, x] of props) this.grounded(frame, x, 262);

    if (options.freeze) this.anims.pauseAll();
    this.input.keyboard?.on('keydown-D', () => this.scene.start(SCENE.game));
    this.input.keyboard?.on('keydown-C', () => this.scene.start(SCENE.compare));
    updateTestHook({ readyScene: SCENE.gallery, lightCount: 0 });
  }

  private label(x: number, y: number, text: string): void {
    this.add.bitmapText(x, y, FONT_KEY, text);
  }

  private grounded(frame: string, x: number, baseY: number): void {
    this.add.image(x, baseY, ATLAS_KEY, frame).setOrigin(0.5, 1);
  }

  private animated(key: string, x: number, baseY: number, loop = false, originY = 1): void {
    const sprite = this.add.sprite(x, baseY, ATLAS_KEY, `${key}/0`).setOrigin(0.5, originY);
    sprite.play(loop ? { key, repeat: -1, repeatDelay: 500 } : key);
  }

  /** Muestra todos los colores de la paleta en una tira. */
  private paletteStrip(x: number, y: number): void {
    const graphics = this.add.graphics();
    colorNames().forEach((name, i) => {
      graphics.fillStyle(colorNumber(name), 1);
      graphics.fillRect(x + i * 8, y, 7, 6);
    });
  }
}
