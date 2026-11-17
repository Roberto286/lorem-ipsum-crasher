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
  private graced = false;
  private slowed = false;
  // Whether the label shows the placeholder instead of the word: only a ghost does, until revealed.
  private hiddenShown: boolean;
  // The sprite colour of a ghost; other demons keep the art as it is.
  private readonly baseTint?: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: EnemyState,
  ) {
    const typeConfig = config.enemyTypes[state.type];
    const { sprite } = typeConfig;
    this.sprite = scene.add.sprite(0, 0, sprite).play(sprite).setDepth(config.depths.enemy);
    if ('alpha' in typeConfig) this.sprite.setAlpha(typeConfig.alpha);
    if ('tint' in typeConfig) this.baseTint = typeConfig.tint;
    this.hiddenShown = state.hidden === true;
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
    // A hidden word shows dim: the label keeps its background, so a carrier's drop colour shows.
    if (this.hiddenShown) this.label.setColor(config.colors.dim);
    this.setWords();
    this.refreshTint();
  }

  /**
   * Shows the state's texts: the short word while descoped, else the remaining words. A hidden
   * ghost shows a placeholder.
   */
  setWords(): void {
    this.label.setText(this.hiddenShown ? t('hiddenWord') : labelText(this.texts));
  }

  /** Shows the word of a ghost that has just been revealed: it fades in. */
  syncHidden(): void {
    const hidden = this.state.hidden === true;
    if (hidden === this.hiddenShown) return;
    this.hiddenShown = hidden;
    this.label.setColor(config.colors.text).setAlpha(0);
    this.setWords();
    this.scene.tweens.add({
      targets: this.label,
      alpha: 1,
      duration: config.enemyTypes.ghost.revealMs,
    });
  }

  /** The texts the player types through now: the top one is typed next. */
  private get texts(): string[] {
    return this.state.descoped === undefined ? this.state.words : [this.state.descoped];
  }

  /** Lights up the first typed letters of the top word. */
  highlight(letters: number): void {
    const shown = this.label.text;
    // The label lags the session while a hurled word is in flight: its top word is not the
    // one being typed any more.
    const count = shown === labelText(this.texts) ? letters : 0;
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
    this.refreshTint();
    if (frozen) this.sprite.anims.pause();
    else this.sprite.anims.resume();
  }

  /** Slows the walk of the sprite while a throttle lasts. */
  setThrottled(throttled: boolean): void {
    if (throttled === this.throttled) return;
    this.throttled = throttled;
    this.refreshWalk();
  }

  /** Tints the sprite and slows its walk while the devops passive slows the demon. */
  setSlowed(slowed: boolean): void {
    if (slowed === this.slowed) return;
    this.slowed = slowed;
    this.refreshTint();
    this.refreshWalk();
  }

  /** Tints the sprite while the junior's passive holds the demon at the hero. */
  setGraced(graced: boolean): void {
    if (graced === this.graced) return;
    this.graced = graced;
    this.refreshTint();
  }

  /** The walk runs at the smallest factor of the slows in effect. */
  private refreshWalk(): void {
    const factors = [1];
    if (this.throttled) factors.push(config.spells.throttle.speedScale);
    if (this.slowed) factors.push(config.classes.devops.passive.slowFactor);
    this.sprite.anims.timeScale = Math.min(...factors);
  }

  /** Freeze tint wins over grace, which wins over slowed, which wins over the ghost's own. */
  private refreshTint(): void {
    if (this.frozen) this.sprite.setTint(config.spells.freeze.tint);
    else if (this.graced) this.sprite.setTint(config.classes.junior.passive.tint);
    else if (this.slowed) this.sprite.setTint(config.classes.devops.passive.tint);
    else if (this.baseTint !== undefined) this.sprite.setTint(this.baseTint);
    else this.sprite.clearTint();
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
