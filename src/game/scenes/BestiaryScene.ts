import Phaser from 'phaser';
import { ENEMY_VARIANTS, enemyAnimation } from '../../art/enemyArt';
import { colorNumber } from '../../art/palette';
import { WALKER_VARIANTS } from '../../art/painters/zombies';
import { ENEMIES, type EnemyDef } from '../../content/enemies';
import { ATLAS_KEY, FONT_KEY } from '../boot/registerArt';
import { updateTestHook, type LaunchOptions } from '../debug/testHook';
import { SCENE } from './keys';

const ROW_FEET = [70, 132, 196, 262];
const ACTIONS: Record<string, string[]> = {
  walker: ['walk', 'attack', 'hurt', 'die'],
  runner: ['walk', 'attack', 'leap', 'hurt', 'die'],
  clicker: ['walk', 'click', 'attack', 'hurt', 'die'],
  mutant: ['walk', 'attack', 'hurt', 'die'],
};
const LABELS: Record<string, string> = {
  walk: 'ANDAR',
  attack: 'ATAQUE',
  leap: 'RODEAR',
  click: 'CHASQUIDO',
  hurt: 'GOLPE',
  die: 'MUERTE',
};

/**
 * Bestiario (`?scene=bestiario`): los cuatro enemigos con todas sus
 * animaciones, Alex al lado para comparar tamaños y la ficha de cada uno.
 */
export class BestiaryScene extends Phaser.Scene {
  constructor() {
    super(SCENE.bestiary);
  }

  create(): void {
    const options = this.registry.get('launch') as LaunchOptions;
    this.cameras.main.setBackgroundColor(colorNumber('asph4'));
    this.text(4, 3, 'BESTIARIO: CUATRO ENEMIGOS       J: JUGAR').setTint(colorNumber('light2'));
    (['walker', 'runner', 'clicker', 'mutant'] as const).forEach((kind, row) => this.buildRow(ENEMIES[kind], row, options.freeze));
    this.input.keyboard?.on('keydown-J', () => {
      this.registry.set('launch', { ...options, scene: 'game' });
      this.scene.start(SCENE.game);
    });
    updateTestHook({ readyScene: SCENE.bestiary });
  }

  private buildRow(def: EnemyDef, row: number, freeze: boolean): void {
    const feet = ROW_FEET[row] as number;
    const variant = (def.id === 'walker' ? WALKER_VARIANTS : (ENEMY_VARIANTS[def.art] ?? []))[0] as string;
    const step = def.id === 'mutant' ? 58 : 44;
    // Alex a la izquierda, como referencia de escala.
    this.add.image(20, feet, ATLAS_KEY, 'alex2/idle/0').setOrigin(0.5, 1);
    (ACTIONS[def.id] ?? []).forEach((action, i) => {
      const x = 62 + i * step;
      const sprite = this.add.sprite(x, feet, ATLAS_KEY, `${enemyAnimation(def.art, variant, action)}/0`).setOrigin(0.5, 1);
      const key = enemyAnimation(def.art, variant, action);
      if (freeze) sprite.setFrame(`${key}/${action === 'die' ? 4 : action === 'hurt' ? 0 : 1}`);
      else sprite.play({ key, repeat: -1, repeatDelay: action === 'walk' ? 0 : 600 });
      this.text(x, feet + 1, LABELS[action] ?? action).setOrigin(0.5, 0).setTint(colorNumber('grey2'));
    });
    const info = [
      def.name,
      `VIDA ${def.maxHealth}  VELOCIDAD ${def.chaseSpeed}`,
      `GOLPE ${def.attack.damage}${def.attack.hits > 1 ? 'X' + def.attack.hits : ''}  PREPARA ${def.attack.windupMs} MS`,
      def.sight ? `VISTA ${def.sight.range}  OIDO X${def.hearing.sensitivity}` : `CIEGO  OIDO X${def.hearing.sensitivity}`,
      def.flank ? 'SALTA PARA RODEAR' : def.echo ? 'SE GUIA POR EL RUIDO' : def.breaker ? 'ROMPE BARRICADAS' : 'LENTO, VA EN GRUPO',
    ];
    info.forEach((line, i) =>
      this.text(330, feet - 40 + i * 7, line).setTint(colorNumber(i === 0 ? 'light2' : 'grey1')),
    );
  }

  private text(x: number, y: number, content: string): Phaser.GameObjects.BitmapText {
    return this.add.bitmapText(x, y, FONT_KEY, content);
  }
}
