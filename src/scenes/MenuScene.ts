import * as Phaser from 'phaser';
import { config } from '../config';
import { t } from '../utils/i18n';
import { loadScores, type ScoreEntry } from '../utils/scoreStorage';
import { addText } from '../utils/ui';

/** Title screen, also shown as the game over screen when it receives the last run. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(lastRun: Partial<ScoreEntry>): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const accent = { color: config.colors.accent };

    addText(this, centerX, height * 0.14, t('title'), {
      ...accent,
      fontSize: `${config.font.titleSize}px`,
    });
    addText(this, centerX, height * 0.4, this.introText(lastRun));
    addText(this, centerX, height * 0.7, this.highScoresText());
    const prompt = addText(this, centerX, height * 0.93, t('start'), accent);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    // Delay so keys still being mashed when a run ends do not start the next one.
    this.time.delayedCall(config.menuInputDelayMs, () => {
      const start = () => this.scene.start('GameScene');
      this.input.keyboard?.once('keydown-ENTER', start);
      this.input.once('pointerdown', start);
    });
  }

  private introText(lastRun: Partial<ScoreEntry>): string {
    if (lastRun.score === undefined) return t('lore');
    return [
      t('gameOver'),
      '',
      t('score', { value: lastRun.score }),
      t('time', { value: lastRun.seconds ?? 0 }),
    ].join('\n');
  }

  private highScoresText(): string {
    const rows = loadScores().map((entry, index) =>
      t('highScoreRow', { rank: index + 1, score: entry.score, seconds: entry.seconds }),
    );
    return [t('highScores'), ...rows].join('\n');
  }
}
