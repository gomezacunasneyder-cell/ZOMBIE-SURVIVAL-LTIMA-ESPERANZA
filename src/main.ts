import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { installTestHook } from './game/debug/testHook';
import { installIntegerScale } from './game/display/integerScale';
import { HudScene } from './game/hud/HudScene';
import { ArsenalScene } from './game/scenes/ArsenalScene';
import { BestiaryScene } from './game/scenes/BestiaryScene';
import { CompareScene } from './game/scenes/CompareScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { GameScene } from './game/scenes/GameScene';
import { EpilogueScene } from './game/scenes/EpilogueScene';
import { InventoryScene } from './game/scenes/InventoryScene';
import { OptionsScene } from './game/scenes/OptionsScene';
import { PreloadScene } from './game/scenes/PreloadScene';

const game = new Phaser.Game(createGameConfig([PreloadScene, GameScene, HudScene, OptionsScene, InventoryScene, EpilogueScene, GalleryScene, CompareScene, ArsenalScene, BestiaryScene]));
installIntegerScale(game);
installTestHook(game);
