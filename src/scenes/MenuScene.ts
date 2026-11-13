import * as Phaser from 'phaser';
import { config, type LevelKey } from '../config';
import { t } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import { loadScores, type ScoreEntry } from '../utils/scoreStorage';
import { addButton, addText } from '../utils/ui';

const levelKeys = Object.keys(config.levels) as LevelKey[];

/** Title screen, also shown as the game over screen when it receives the last run. */
export class MenuScene extends Phaser.Scene {
  private levelButton!: Phaser.GameObjects.Text;
  private scoresText!: Phaser.GameObjects.Text;

  constructor() {
    super('MenuScene');
  }

  create(lastRun: Partial<ScoreEntry>): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const start = () => this.scene.start('GameScene');

    addText(this, centerX, height * 0.12, t('title'), {
      color: config.colors.accent,
      fontSize: `${config.font.titleSize}px`,
    });
    addText(this, centerX, height * 0.33, this.introText(lastRun));
    this.levelButton = addButton(this, centerX, height * 0.52, '', () => this.shiftLevel(1));
    this.scoresText = addText(this, centerX, height * 0.6, '').setOrigin(0.5, 0);
    this.showLevel();
    const prompt = addButton(this, centerX, height * 0.94, t('start'), start);
    prompt.setColor(config.colors.accent);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    listenForKeys(this, (key) => {
      if (key === 'Enter') start();
      else if (key === 'ArrowLeft') this.shiftLevel(-1);
      else if (key === 'ArrowRight') this.shiftLevel(1);
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

  private shiftLevel(step: number): void {
    const index = levelKeys.indexOf(this.registry.get('level')) + step + levelKeys.length;
    this.registry.set('level', levelKeys[index % levelKeys.length]);
    this.showLevel();
  }

  private showLevel(): void {
    const level: LevelKey = this.registry.get('level');
    const rows = loadScores(level).map((entry, index) =>
      t('highScoreRow', { rank: index + 1, score: entry.score, seconds: entry.seconds }),
    );
    this.levelButton.setText(t('difficulty', { level: t(level) }));
    this.scoresText.setText([t('highScores'), ...rows].join('\n'));
  }
}
