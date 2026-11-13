import * as Phaser from 'phaser';
import errorUrl from '../assets/audio/error.wav';
import gameOverUrl from '../assets/audio/gameover.wav';
import hurtUrl from '../assets/audio/hurt.wav';
import killUrl from '../assets/audio/kill.wav';
import fontUrl from '../assets/font/PressStart2P-Regular.ttf';
import demonUrl from '../assets/sprites/demon.png';
import playerUrl from '../assets/sprites/player.png';
import { config } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('player', playerUrl);
    this.load.image('demon', demonUrl);
    this.load.audio('kill', killUrl);
    this.load.audio('error', errorUrl);
    this.load.audio('hurt', hurtUrl);
    this.load.audio('gameOver', gameOverUrl);
    this.load.font(config.font.family, fontUrl);
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
