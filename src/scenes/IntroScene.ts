import * as Phaser from 'phaser';
import { config } from '../config';
import { t, type StringKey } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import { addText } from '../utils/ui';

function addActor(scene: Phaser.Scene, x: number, y: number, key: string, scale: number) {
  return scene.add.sprite(x, y, key).setScale(scale).play(key);
}

/** One cutscene page: a caption and a picture staged around the given center. */
interface Page {
  caption: StringKey;
  stage: (scene: Phaser.Scene, x: number, y: number) => void;
}

const pages: Page[] = [
  {
    caption: 'intro1',
    stage: (scene, x, y) => {
      const spell = addText(scene, x, y, 'LOREM IPSUM', {
        color: config.colors.accent,
        fontSize: `${config.font.titleSize * 2}px`,
      });
      scene.tweens.add({ targets: spell, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    },
  },
  {
    caption: 'intro2',
    stage: (scene, x, y) => {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        addText(scene, x + Math.cos(angle) * 150, y + Math.sin(angle) * 55, 'lorem ipsum', {
          color: config.colors.dim,
        });
      }
      addActor(scene, x, y, 'player', 4);
    },
  },
  {
    caption: 'intro3',
    stage: (scene, x, y) => {
      ['imp', 'chort', 'bigDemon', 'chort', 'imp'].forEach((key, index) =>
        addActor(scene, x + (index - 2) * 70, y, key, 3),
      );
    },
  },
  {
    caption: 'intro4',
    stage: (scene, x, y) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const demon = addActor(
          scene,
          x + Math.cos(angle) * 150,
          y + Math.sin(angle) * 50,
          'imp',
          2,
        );
        demon.setFlipX(Math.cos(angle) > 0);
      }
      addActor(scene, x, y, 'player', 3);
    },
  },
];

/** Tells the story before the menu, one page per scene restart. */
export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create(data: { page?: number }): void {
    const index = data.page ?? 0;
    const { width, height } = this.scale;
    const leave = () => this.scene.start('MenuScene');
    const next = () =>
      index + 1 < pages.length ? this.scene.restart({ page: index + 1 }) : leave();

    this.cameras.main.fadeIn(config.intro.fadeMs);
    pages[index].stage(this, width / 2, height * 0.38);
    addText(this, width / 2, height * 0.76, t(pages[index].caption));
    addText(this, width / 2, height * 0.93, t('introHint'), { color: config.colors.accent });

    listenForKeys(this, (key) => {
      if (key === 'Escape') leave();
      else if (key === 'Enter' || key === ' ') next();
    });
    this.input.on('pointerdown', next);
  }
}
