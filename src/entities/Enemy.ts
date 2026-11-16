import * as Phaser from 'phaser';
import { config } from '../config';
import type { EnemyState } from '../utils/gameSession';
import { t } from '../utils/i18n';
import type { LabelBox } from '../utils/labelLayout';
import { addText } from '../utils/ui';

/** One text per line, the next one to type on top; past the visible cap, only a count. */
function labelText(words: string[]): string {
  const lines = words.slice(0, config.enemy.maxVisibleWords);
  const hidden = words.length - lines.length;
  if (hidden > 0) lines.push(t('moreWords', { count: hidden }));
  return lines.join('\n');
}

export class Enemy {
  /** Public so a hurled word can home in on it. */
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  /** Drawn over the label: the typed letters of the top word, every other glyph blank. */
  private readonly typedLetters: Phaser.GameObjects.Text;
  /** Around the label of a tank that carries a spell. */
  private readonly frame?: Phaser.GameObjects.Rectangle;
  private frozen = false;
  private throttled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: EnemyState,
  ) {
    const { sprite } = config.enemyTypes[state.type];
    this.sprite = scene.add.sprite(0, 0, sprite).play(sprite).setDepth(config.depths.enemy);
    // The art faces right: flip the demons that walk in from the right.
    this.sprite.setFlipX(Math.cos(state.angle) > 0);
    const padding = { x: 2, y: 2 };
    const spellColor = state.spell && config.spells[state.spell].color;
    // A carrier shows its spell behind its words. The tank keeps its own background, the mark
    // of the miniboss: its spell frames the label instead.
    const framed = state.type === 'tank';
    this.label = addText(scene, 0, 0, '', {
      backgroundColor:
        spellColor === undefined || framed
          ? config.colors.labelBackground[state.type]
          : Phaser.Display.Color.IntegerToColor(spellColor).rgba,
      padding,
    })
      .setOrigin(0.5, 1)
      .setDepth(config.depths.enemyLabel);
    this.typedLetters = addText(scene, 0, 0, '', { color: config.colors.accent, padding })
      .setOrigin(0.5, 1)
      .setDepth(config.depths.enemyLabel);
    if (spellColor !== undefined && framed) {
      this.frame = scene.add
        .rectangle(0, 0, 0, 0)
        .setStrokeStyle(1, spellColor)
        .setDepth(config.depths.enemyLabel);
    }
    this.setWords(state.words);
  }

  /** Shows the remaining texts: the top one is typed next. */
  setWords(words: string[]): void {
    this.label.setText(labelText(words));
  }

  /** Lights up the first typed letters of the top word. */
  highlight(letters: number): void {
    const shown = this.label.text;
    // The label lags the session while a hurled word is in flight: its top word is not the
    // one being typed any more.
    const count = shown === labelText(this.state.words) ? letters : 0;
    // Same text and layout as the label, so the monospace glyphs land exactly on its own.
    const blanked = shown.slice(count).replace(/[^\n]/g, ' ');
    this.typedLetters.setText(shown.slice(0, count) + blanked).setVisible(count > 0);
  }

  /** The label's natural box for a sprite at (x, y): centred over it, just above the sprite. */
  labelBox(x: number, y: number): LabelBox {
    return {
      x,
      bottom: y - this.sprite.height / 2 - config.enemy.labelGap,
      width: this.label.width,
      height: this.label.height,
    };
  }

  /** Puts the sprite at (x, y) and the label on the box that layoutLabels gave it. */
  moveTo(x: number, y: number, label: LabelBox): void {
    this.sprite.setPosition(x, y);
    this.label.setPosition(label.x, label.bottom);
    this.typedLetters.setPosition(this.label.x, this.label.y);
    // The label shrinks as its words go, so the frame is fitted to it every time.
    this.frame
      ?.setPosition(this.label.x, this.label.y - this.label.height / 2)
      .setSize(this.label.width, this.label.height);
  }

  /** Marks an enemy that got faster after a typo on its word. */
  enrage(): void {
    this.label.setColor(config.colors.enraged);
  }

  /** Tints the sprite and stops its walk while the demon is frozen. */
  setFrozen(frozen: boolean): void {
    if (frozen === this.frozen) return;
    this.frozen = frozen;
    if (frozen) {
      this.sprite.setTint(config.spells.freeze.tint);
      this.sprite.anims.pause();
    } else {
      this.sprite.clearTint();
      this.sprite.anims.resume();
    }
  }

  /** Slows the walk of the sprite while a throttle lasts. */
  setThrottled(throttled: boolean): void {
    if (throttled === this.throttled) return;
    this.throttled = throttled;
    this.sprite.anims.timeScale = throttled ? config.spells.throttle.speedScale : 1;
  }

  vanish(): void {
    this.scene.tweens.add({
      targets: this.parts,
      alpha: 0,
      scale: 2,
      duration: config.enemy.vanishMs,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    for (const part of this.parts) part.destroy();
  }

  private get parts(): Phaser.GameObjects.GameObject[] {
    const parts = [this.sprite, this.label, this.typedLetters];
    return this.frame ? [...parts, this.frame] : parts;
  }
}
