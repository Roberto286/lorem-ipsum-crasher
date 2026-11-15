import * as Phaser from 'phaser';
import { config } from '../config';
import { t, type StringKey } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import { addText } from '../utils/ui';

function addActor(scene: Phaser.Scene, x: number, y: number, key: string, scale: number) {
  return scene.add.sprite(x, y, key).setScale(scale).play(key);
}

/** Camera look: zoom factor and pan offset in pixels from the picture's center. */
interface Look {
  zoom: number;
  x: number;
  y: number;
}

/**
 * One cutscene page: a caption, a picture staged around the given center, and a slow camera
 * move over it. Keep every look inside the picture: at zoom z the view shows 1/z of the area.
 */
interface Page {
  caption: StringKey;
  stage: (scene: Phaser.Scene, x: number, y: number) => void;
  move: { from: Look; to: Look };
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
    // Push in on the glowing spell.
    move: { from: { zoom: 1, x: 0, y: 0 }, to: { zoom: 1.3, x: 0, y: 0 } },
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
    // Pull back from the dev to reveal the ring of pasted text.
    move: { from: { zoom: 1.5, x: 0, y: 0 }, to: { zoom: 1, x: 0, y: 0 } },
  },
  {
    caption: 'intro3',
    stage: (scene, x, y) => {
      ['imp', 'chort', 'bigDemon', 'chort', 'imp'].forEach((key, index) =>
        addActor(scene, x + (index - 2) * 70, y, key, 3),
      );
    },
    // Pan along the line of demons (at 1.2 the view stays within their span at +-30).
    move: { from: { zoom: 1.2, x: -30, y: 0 }, to: { zoom: 1.2, x: 30, y: 0 } },
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
    // Push in on the surrounded dev.
    move: { from: { zoom: 1, x: 0, y: 0 }, to: { zoom: 1.35, x: 0, y: 0 } },
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

    const pictureHeight = height * config.intro.pictureRatio;
    const pictureCamera = this.cameras.main.setViewport(0, 0, width, pictureHeight);
    pages[index].stage(this, width / 2, pictureHeight / 2);
    const picture = [...this.children.list];
    const caption = addText(this, width / 2, height * 0.76, t(pages[index].caption));
    const hint = addText(this, width / 2, height * 0.93, t('introHint'), {
      color: config.colors.accent,
    });

    // The picture camera zooms and pans; a second, fixed camera draws the text and the fade.
    const textCamera = this.cameras.add(0, 0, width, height);
    textCamera.ignore(picture);
    pictureCamera.ignore([caption, hint]);
    textCamera.fadeIn(config.intro.fadeMs);
    this.playMove(pictureCamera, pages[index].move);

    listenForKeys(this, (key) => {
      if (key === 'Escape') leave();
      else if (key === 'Enter' || key === ' ') next();
    });
    this.input.on('pointerdown', next);
  }

  private playMove(camera: Phaser.Cameras.Scene2D.Camera, { from, to }: Page['move']): void {
    // Whole pixels keep the sprites crisp while the camera drifts.
    camera.setRoundPixels(true).setZoom(from.zoom).setScroll(from.x, from.y);
    this.tweens.add({
      targets: camera,
      zoom: to.zoom,
      scrollX: to.x,
      scrollY: to.y,
      duration: config.intro.moveMs,
      ease: config.intro.moveEase,
    });
  }
}
