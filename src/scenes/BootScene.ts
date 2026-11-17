import * as Phaser from 'phaser';
import deathGruntUrl from '../assets/audio/deathgrunt.wav';
import deathKamikazeUrl from '../assets/audio/deathkamikaze.wav';
import deathTankUrl from '../assets/audio/deathtank.wav';
import errorUrl from '../assets/audio/error.wav';
import gameOverUrl from '../assets/audio/gameover.wav';
import hurtUrl from '../assets/audio/hurt.wav';
import killUrl from '../assets/audio/kill.wav';
import laughTankUrl from '../assets/audio/laughtank.wav';
import musicMp3Url from '../assets/audio/music.mp3';
import musicOggUrl from '../assets/audio/music.ogg';
import screechKamikazeUrl from '../assets/audio/screechkamikaze.wav';
import backdropUrl from '../assets/backgrounds/arena.jpg';
import fontUrl from '../assets/font/PressStart2P-Regular.ttf';
import bigDemonUrl from '../assets/sprites/bigDemon.png';
import chortUrl from '../assets/sprites/chort.png';
import ghostUrl from '../assets/sprites/ghost.png';
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
    this.load.spritesheet('ghost', ghostUrl, config.sprites.ghost);
    this.load.spritesheet('bigDemon', bigDemonUrl, config.sprites.bigDemon);
    this.load.image('backdrop', backdropUrl);
    this.load.audio('kill', killUrl);
    this.load.audio('deathGrunt', deathGruntUrl);
    this.load.audio('deathKamikaze', deathKamikazeUrl);
    this.load.audio('deathTank', deathTankUrl);
    this.load.audio('laughTank', laughTankUrl);
    this.load.audio('screechKamikaze', screechKamikazeUrl);
    this.load.audio('error', errorUrl);
    this.load.audio('hurt', hurtUrl);
    this.load.audio('gameOver', gameOverUrl);
    // OGG first: it loops gaplessly; MP3 encoders pad the ends, so it is only a fallback.
    this.load.audio('music', [musicOggUrl, musicMp3Url]);
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
    this.registry.set('heroClass', config.defaultClass);
    // The sound manager is global, so the loop survives scene changes and follows sound.mute.
    // Boot runs once, so this starts a single loop; Phaser holds it until the browser unlocks audio.
    this.sound.play('music', { loop: true, volume: config.music.volume });
    this.scene.start('IntroScene');
  }
}
