import * as Phaser from 'phaser';
import { config } from '../config';
import { helpPages, type HelpPage } from '../utils/helpPages';
import { t } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import type { ScoreEntry } from '../utils/scoreStorage';
import { addText } from '../utils/ui';

/** The how-to-play screen: pages of rules, opened from the menu, read from config. */
export class HelpScene extends Phaser.Scene {
  private pages!: HelpPage[];
  private pageIndex!: number;
  private title!: Phaser.GameObjects.Text;
  private indicator!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.GameObject[];

  constructor() {
    super('HelpScene');
  }

  create(lastRun: Partial<ScoreEntry>): void {
    const { width, height } = this.scale;
    const { margin, titleTop, footerOffset } = config.help;
    this.pages = helpPages();
    this.pageIndex = 0;
    this.body = [];
    this.title = addText(this, width / 2, titleTop, '', {
      color: config.colors.accent,
      fontSize: `${config.font.titleSize}px`,
    }).setOrigin(0.5, 0);
    this.indicator = addText(this, width - margin, titleTop, '', {
      color: config.colors.dim,
    }).setOrigin(1, 0);
    addText(this, width / 2, height - footerOffset, t('helpFooter'), { color: config.colors.dim });
    this.showPage(0);

    listenForKeys(this, (key) => {
      if (key === 'Escape' || key === 'h' || key === 'H') this.scene.start('MenuScene', lastRun);
      else if (key === 'ArrowLeft') this.showPage(this.pageIndex - 1);
      else if (key === 'ArrowRight') this.showPage(this.pageIndex + 1);
    });
  }

  private showPage(index: number): void {
    this.pageIndex = Phaser.Math.Clamp(index, 0, this.pages.length - 1);
    const page = this.pages[this.pageIndex];
    this.title.setText(page.title);
    this.indicator.setText(t('helpPage', { page: this.pageIndex + 1, total: this.pages.length }));
    this.body.forEach((object) => object.destroy());
    this.body = [];

    const { margin, bodyTop, blockGap, headingGap, iconColumn, swatch } = config.help;
    let y = bodyTop;
    for (const block of page.blocks) {
      const { icon } = block;
      const indent = icon ? ('sprite' in icon ? iconColumn : swatch * 2) : 0;
      const left = margin + indent;
      const style = { align: 'left', wordWrap: { width: this.scale.width - margin - left } };
      let blockHeight = 0;
      if (block.heading) {
        const heading = addText(this, left, y, block.heading, {
          ...style,
          color: config.colors.accent,
        }).setOrigin(0, 0);
        this.body.push(heading);
        blockHeight = heading.height + headingGap;
      }
      const text = addText(this, left, y + blockHeight, block.text, style).setOrigin(0, 0);
      this.body.push(text);
      blockHeight += text.height;

      if (icon && 'sprite' in icon) {
        const sprite = this.add
          .sprite(margin + iconColumn / 2, y, icon.sprite)
          .setOrigin(0.5, 0)
          .play(icon.sprite);
        this.body.push(sprite);
        blockHeight = Math.max(blockHeight, sprite.height);
      } else if (icon) {
        this.body.push(this.add.rectangle(margin, y, swatch, swatch, icon.color).setOrigin(0, 0));
      }
      y += blockHeight + blockGap;
    }
  }
}
