import * as Phaser from 'phaser';
import errorUrl from '../assets/audio/error.wav';
import gameOverUrl from '../assets/audio/gameover.wav';
import hurtUrl from '../assets/audio/hurt.wav';
import killUrl from '../assets/audio/kill.wav';
import backdropUrl from '../assets/backgrounds/arena.jpg';
import fontUrl from '../assets/font/PressStart2P-Regular.ttf';
import bigDemonUrl from '../assets/sprites/bigDemon.png';
import chortUrl from '../assets/sprites/chort.png';
import impUrl from '../assets/sprites/imp.png';
import playerUrl from '../assets/sprites/player.png';
import { config } from '../config';
import { t } from '../utils/i18n';
import { addText } from '../utils/ui';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.spritesheet('player', playerUrl, config.sprites.player);
    this.load.spritesheet('imp', impUrl, config.sprites.imp);
    this.load.spritesheet('chort', chortUrl, config.sprites.chort);
    this.load.spritesheet('bigDemon', bigDemonUrl, config.sprites.bigDemon);
    this.load.image('backdrop', backdropUrl);
    this.load.audio('kill', killUrl);
    this.load.audio('error', errorUrl);
    this.load.audio('hurt', hurtUrl);
    this.load.audio('gameOver', gameOverUrl);
    this.load.font(config.font.family, fontUrl);
  }

  create(): void {
    if (!this.sys.game.device.os.desktop) {
      // A typing game needs a physical keyboard: phones and tablets stop here.
      addText(this, this.scale.width / 2, this.scale.height / 2, t('mobileUnsupported'), {
        fontSize: `${config.font.titleSize}px`,
      });
      return;
    }
    // Every sheet is one looping animation named after its texture.
    for (const key of Object.keys(config.sprites)) {
      this.anims.create({ key, frames: key, frameRate: config.animationFps, repeat: -1 });
    }
    this.registry.set('level', config.defaultLevel);
    this.scene.start('IntroScene');
  }
}
