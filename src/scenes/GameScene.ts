import * as Phaser from 'phaser';
import { config } from '../config';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { hurlWord } from '../entities/wordProjectile';
import { GameSession } from '../utils/gameSession';
import { t } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import { saveScore } from '../utils/scoreStorage';
import { addButton, addText } from '../utils/ui';

/** Draws a GameSession and feeds it input; the rules live in the session. */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private readonly enemies = new Map<number, Enemy>();
  private player!: Player;
  private hud!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private typedBox!: Phaser.GameObjects.Rectangle;
  private typedText!: Phaser.GameObjects.Text;
  private playHeight = 0;
  private paused = false;
  // Set while the resume countdown runs; the game stays paused until it ends.
  private resumeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.playHeight = height - config.typedBox.height;
    // Phaser reuses the scene instance on restart: reset what the previous run left behind.
    this.enemies.clear();
    this.paused = false;
    this.resumeTimer = undefined;
    this.session = new GameSession(width / 2, this.playHeight / 2, this.registry.get('level'));
    this.player = new Player(this, width / 2, this.playHeight / 2);
    this.createHud();
    this.createBottomPanel();

    listenForKeys(this, (key) => {
      if (key === 'Escape') this.togglePause();
      else if (key === 'Backspace') this.handleBackspace();
      else if (/^[a-z ]$/i.test(key)) this.handleLetter(key.toLowerCase());
    });
    this.pauseOnFocusLoss();
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;

    const { spawned, reached } = this.session.update(delta);
    for (const state of spawned) this.enemies.set(state.id, new Enemy(this, state));
    for (const state of reached) this.removeEnemy(state.id)?.destroy();
    if (reached.length > 0) this.showPlayerHit();

    this.drawEnemies();
    this.drawHud();
    if (this.session.isOver) this.endRun();
  }

  private createHud(): void {
    const right = this.scale.width - 2;
    // Mute state lives in the registry: sound.mute reads the audio graph, which lags the setter
    // and never updates while the browser keeps the audio context locked.
    const soundLabel = () => t(this.registry.get('muted') ? 'soundOff' : 'soundOn');

    this.hud = addText(this, 4, 4, '', { align: 'left' }).setOrigin(0).setDepth(config.depths.hud);
    this.pauseButton = addButton(this, right, 0, t('pause'), () => this.togglePause());
    this.pauseButton.setOrigin(1, 0).setDepth(config.depths.hud);
    const soundButton = addButton(this, right, this.pauseButton.height, soundLabel(), () => {
      this.registry.toggle('muted');
      this.sound.mute = this.registry.get('muted');
      soundButton.setText(soundLabel());
    });
    soundButton.setOrigin(1, 0).setDepth(config.depths.hud);
    this.pausedText = addText(this, this.scale.width / 2, this.playHeight / 4, t('paused'), {
      color: config.colors.accent,
      fontSize: `${config.font.titleSize}px`,
    }).setVisible(false);
  }

  private createBottomPanel(): void {
    const { width, height } = this.scale;
    const panelHeight = height - this.playHeight;
    const boxCenterY = this.playHeight + config.typedBox.height / 2;

    // Opaque backdrop: enemies coming from below stay hidden until they enter the play area.
    this.add.rectangle(
      width / 2,
      this.playHeight + panelHeight / 2,
      width,
      panelHeight,
      config.colors.panel,
    );
    this.typedBox = this.add
      .rectangle(width / 2, boxCenterY, width - 8, config.typedBox.height - 6, config.colors.panel)
      .setStrokeStyle(1, config.colors.typedBoxBorder);
    this.typedText = addText(this, width / 2, boxCenterY, '', { color: config.colors.accent });
  }

  private handleLetter(letter: string): void {
    if (this.paused) return;

    const result = this.session.typeLetter(letter);
    if (result.kind === 'kill' || result.kind === 'word') {
      const { kind, enemy: state, word } = result;
      // A killed enemy has already left the session: its sprite waits for the word to land.
      const enemy = kind === 'kill' ? this.removeEnemy(state.id) : this.enemies.get(state.id);
      if (!enemy) return;
      enemy.highlight(0);
      hurlWord(this, word, this.player, enemy.sprite, () => {
        // Gone already if it reached the player while the word was flying.
        if (!enemy.sprite.active) return;
        this.sound.play('kill');
        if (kind === 'kill') enemy.vanish();
        else enemy.setWords(state.words);
      });
    } else if (result.kind === 'typo') {
      this.sound.play('error');
    } else if (result.kind === 'error') {
      this.sound.play('error');
      if (result.enemy) this.enemies.get(result.enemy.id)?.enrage();
      this.typedBox.setFillStyle(config.colors.panelError);
      this.time.delayedCall(config.typedBox.errorFlashMs, () =>
        this.typedBox.setFillStyle(config.colors.panel),
      );
    }
  }

  private handleBackspace(): void {
    if (!this.paused) this.session.eraseLetter();
  }

  private removeEnemy(id: number): Enemy | undefined {
    const enemy = this.enemies.get(id);
    this.enemies.delete(id);
    return enemy;
  }

  private showPlayerHit(): void {
    this.player.hurt();
    this.cameras.main.shake(150, 0.01);
    this.sound.play('hurt');
  }

  private drawEnemies(): void {
    const { x, y } = this.player;
    const { target, matches, typed } = this.session;
    if (target) this.player.face(target.angle);
    for (const state of this.session.enemies) {
      const enemy = this.enemies.get(state.id);
      if (!enemy) continue;
      enemy.moveTo(
        x + Math.cos(state.angle) * state.distance,
        y + Math.sin(state.angle) * state.distance,
        this.scale.width,
        this.playHeight,
      );
      enemy.highlight(matches.includes(state) ? typed.length : 0);
    }
  }

  private drawHud(): void {
    const { score, lives, elapsedMs, typed, target } = this.session;
    // Red while the buffer holds a typo: nothing can be killed until it is erased.
    const typedColor = typed === '' || target ? config.colors.accent : config.colors.enraged;
    const status = [
      t('score', { value: score }),
      `${t('lives', { value: lives })}  ${t('time', { value: Math.floor(elapsedMs / 1000) })}`,
    ];
    this.hud.setText(status.join('\n'));
    this.typedText.setText(typed);
    if (this.typedText.style.color !== typedColor) this.typedText.setColor(typedColor);
  }

  private togglePause(): void {
    if (this.paused && !this.resumeTimer) this.startResumeCountdown();
    else this.pause();
  }

  /** Also cancels a running resume countdown. */
  private pause(): void {
    this.resumeTimer?.remove();
    this.resumeTimer = undefined;
    this.paused = true;
    this.pausedText.setText(t('paused')).setVisible(true);
    this.pauseButton.setText(t('resume'));
    this.tweens.pauseAll();
  }

  // Scene clock, not a tween: tweens stay paused until the countdown ends.
  private startResumeCountdown(): void {
    let secondsLeft: number = config.pause.resumeCountdownSeconds;
    this.pausedText.setText(String(secondsLeft));
    // The button cancels the countdown, which pauses again.
    this.pauseButton.setText(t('pause'));
    this.resumeTimer = this.time.addEvent({
      delay: 1000,
      repeat: secondsLeft - 1,
      callback: () => {
        secondsLeft -= 1;
        if (secondsLeft > 0) this.pausedText.setText(String(secondsLeft));
        else this.resume();
      },
    });
  }

  private resume(): void {
    this.resumeTimer = undefined;
    this.paused = false;
    this.pausedText.setVisible(false);
    this.tweens.resumeAll();
  }

  private pauseOnFocusLoss(): void {
    const pause = () => this.pause();
    const { BLUR, HIDDEN } = Phaser.Core.Events;
    this.game.events.on(BLUR, pause).on(HIDDEN, pause);
    // game.events outlives the scene, and the scene instance is reused across runs.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(BLUR, pause).off(HIDDEN, pause),
    );
  }

  private endRun(): void {
    const run = { score: this.session.score, seconds: Math.floor(this.session.elapsedMs / 1000) };
    saveScore(this.registry.get('level'), run);
    this.sound.play('gameOver');
    this.scene.start('MenuScene', run);
  }
}
