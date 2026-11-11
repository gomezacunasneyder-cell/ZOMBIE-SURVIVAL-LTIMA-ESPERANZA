import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { installTestHook } from './game/debug/testHook';
import { installIntegerScale } from './game/display/integerScale';
import { HudScene } from './game/hud/HudScene';
import { ArsenalScene } from './game/scenes/ArsenalScene';
import { CompareScene } from './game/scenes/CompareScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { GameScene } from './game/scenes/GameScene';
import { OptionsScene } from './game/scenes/OptionsScene';
import { PreloadScene } from './game/scenes/PreloadScene';

const game = new Phaser.Game(createGameConfig([PreloadScene, GameScene, HudScene, OptionsScene, GalleryScene, CompareScene, ArsenalScene]));
installIntegerScale(game);
installTestHook(game);
