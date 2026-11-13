import * as Phaser from 'phaser';
import { config } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

const { longSide, shortSide } = config.screen;
// shortcut: orientation is read once at boot, reload after rotating; add a resize handler if mid-game rotation matters.
const portrait = window.innerHeight > window.innerWidth;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: portrait ? shortSide : longSide,
  height: portrait ? longSide : shortSide,
  backgroundColor: config.colors.background,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Fast thumbs overlap on the on-screen keyboard.
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene],
});
