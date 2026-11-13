import * as Phaser from 'phaser';
import { config } from '../config';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { GameSession } from '../utils/gameSession';
import { t } from '../utils/i18n';
import { addVirtualKeyboard, listenForKeys, virtualKeyboardHeight } from '../utils/letterInput';
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

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    const touch = this.sys.game.device.input.touch;
    const onLetter = (letter: string) => this.handleLetter(letter);

    this.playHeight = height - config.typedBox.height - (touch ? virtualKeyboardHeight : 0);
    // Phaser reuses the scene instance on restart: reset what the previous run left behind.
    this.enemies.clear();
    this.paused = false;
    this.session = new GameSession(width / 2, this.playHeight / 2);
    this.player = new Player(this, width / 2, this.playHeight / 2);
    this.createHud();
    this.createBottomPanel();

    listenForKeys(this, onLetter, () => this.togglePause());
    if (touch) addVirtualKeyboard(this, this.playHeight + config.typedBox.height, onLetter);
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;

    const { spawned, reached } = this.session.update(delta);
    for (const state of spawned) this.enemies.set(state.id, new Enemy(this, state.word));
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

    this.hud = addText(this, 4, 4, '', { align: 'left' }).setOrigin(0);
    this.pauseButton = addButton(this, right, 0, t('pause'), () => this.togglePause());
    this.pauseButton.setOrigin(1, 0);
    const soundButton = addButton(this, right, this.pauseButton.height, soundLabel(), () => {
      this.registry.toggle('muted');
      this.sound.mute = this.registry.get('muted');
      soundButton.setText(soundLabel());
    }).setOrigin(1, 0);
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
    if (result.kind === 'kill') {
      this.removeEnemy(result.enemy.id)?.vanish();
      this.sound.play('kill');
    } else if (result.kind === 'error') {
      this.sound.play('error');
      this.typedBox.setFillStyle(config.colors.panelError);
      this.time.delayedCall(config.typedBox.errorFlashMs, () =>
        this.typedBox.setFillStyle(config.colors.panel),
      );
    }
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
    for (const state of this.session.enemies) {
      this.enemies
        .get(state.id)
        ?.moveTo(
          x + Math.cos(state.angle) * state.distance,
          y + Math.sin(state.angle) * state.distance,
          this.scale.width,
          this.playHeight,
        );
    }
  }

  private drawHud(): void {
    const { score, lives, elapsedMs, typed } = this.session;
    const status = [
      t('score', { value: score }),
      `${t('lives', { value: lives })}  ${t('time', { value: Math.floor(elapsedMs / 1000) })}`,
    ];
    this.hud.setText(status.join('\n'));
    this.typedText.setText(typed);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pausedText.setVisible(this.paused);
    this.pauseButton.setText(t(this.paused ? 'resume' : 'pause'));
    if (this.paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  private endRun(): void {
    const run = { score: this.session.score, seconds: Math.floor(this.session.elapsedMs / 1000) };
    saveScore(run);
    this.sound.play('gameOver');
    this.scene.start('MenuScene', run);
  }
}
