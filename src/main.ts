import * as Phaser from 'phaser';
import { config } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { MenuScene } from './scenes/MenuScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: config.screen.width,
  height: config.screen.height,
  backgroundColor: config.colors.background,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, IntroScene, MenuScene, GameScene],
});
