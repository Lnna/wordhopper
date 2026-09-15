import Phaser from 'phaser';
import { applyRenderZoom } from '../config/display';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DIFFICULTY_CONFIG,
  Difficulty,
  GameMode,
  HIT_PROGRESS,
  INITIAL_APPROACH_RATE,
  PERFECT_WINDOW_RATIO,
  PLAYER_X,
  PLAYER_Y,
  ROAD_SCROLL_DURATION,
  ROAD_STRIPE_PERIOD,
  SPRITE_KEYS,
  getRoadBox,
  roadTrapezoid,
  TUTORIAL_KEY,
  WIN_HI,
  WIN_LO,
} from '../config/constants';
import { COLORS, FONT_BODY, FONT_DISPLAY } from '../config/colors';
import { addCrispText } from '../config/text';
import { hex } from '../config/utils';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { BubbleTapSystem } from '../systems/BubbleTapSystem';
import { WordSpawner } from '../systems/WordSpawner';
import { ScoreSystem } from '../systems/ScoreSystem';
import { SpeedManager } from '../systems/SpeedManager';
import { ObstacleSpawner } from '../systems/ObstacleSpawner';
import { audioSystem } from '../systems/AudioSystem';

const DEBUG_WINDOW = false;

function isTutorialNeeded(): boolean {
  try { return !localStorage.getItem(TUTORIAL_KEY); } catch { return true; }
}

function markTutorialDone(): void {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* noop */ }
}

function inWindow(p: number): boolean {
  return p >= WIN_LO && p < WIN_HI;
}

function windowCenter(): number {
  return (WIN_LO + WIN_HI) / 2;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private obstacles: Obstacle[] = [];
  private bubbleTap = new BubbleTapSystem();
  private wordSpawner = new WordSpawner();
  private scoreSystem = new ScoreSystem();
  private speedManager = new SpeedManager();
  private obstacleSpawner!: ObstacleSpawner;
  private difficulty: Difficulty = 'easy';
  private mode: GameMode = 'word';
  private tutorial = false;
  private tutorialStarted = false;
  private dodgeCount = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hitLabel!: Phaser.GameObjects.Text;
  private defText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private roadStripes!: Phaser.GameObjects.TileSprite;
  private roadMaskGfx!: Phaser.GameObjects.Graphics;
  private visibilityHandler: (() => void) | null = null;
  private elapsedTime = 0;
  private alive = true;
  private tickAccumulator = 0;
  private pausedByUser = false;
  private seenMeanings: string[] = [];
  private ignoreJumpUntil = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { difficulty: Difficulty; mode?: GameMode }): void {
    this.difficulty = data.difficulty || 'easy';
    this.mode = data.mode || 'word';
    this.wordSpawner.loadWords(this.difficulty);
  }

  create(): void {
    applyRenderZoom(this);
    this.alive = true;
    this.elapsedTime = 0;
    this.obstacles = [];
    this.tutorial = isTutorialNeeded();
    this.tutorialStarted = false;
    this.dodgeCount = 0;
    this.pausedByUser = false;
    this.seenMeanings = [];
    this.scoreSystem.reset();
    this.speedManager.reset();
    this.speedManager.setBaseMultiplier(DIFFICULTY_CONFIG[this.difficulty].speedMultiplier);
    this.bubbleTap.clear();
    this.obstacleSpawner = new ObstacleSpawner(this.wordSpawner);
    this.obstacleSpawner.setDifficulty(this.difficulty);
    this.obstacleSpawner.setMode(this.mode);

    this.drawWorld();
    this.player = new Player(this);
    this.buildHUD();

    this.events.on('obstacle-bubble-tap', this.onBubbleTap, this);
    this.input.on('pointerdown', this.onPointerJump, this);
    this.input.topOnly = false;

    this.spawnObstacle(true);
    this.refreshDefinition();

    // dev-only 调试句柄（生产构建会被摇树移除）
    if (import.meta.env.DEV) {
      (window as unknown as { __wh: unknown }).__wh = this;
    }

    this.visibilityHandler = () => {
      if (document.hidden && this.alive) {
        this.scene.pause();
      } else if (!document.hidden && !this.pausedByUser) {
        this.scene.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    if (this.tutorial) {
      this.hintText.setText(
        this.mode === 'idiom'
          ? '按序点汉字拼出成语，拼完后在贴身时机点空白处起跳'
          : '按序点字母泡，拼完后在贴身时机点空白处起跳'
      );
    }
  }

  private drawWorld(): void {
    this.add.image(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, SPRITE_KEYS.BG_SKY)
      .setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT).setDepth(0);

    const cloudGfx = this.add.graphics().setDepth(1);
    cloudGfx.fillStyle(0xffffff, 0.8);
    cloudGfx.fillEllipse(70, 64, 64, 20);
    cloudGfx.fillEllipse(96, 52, 30, 26);
    cloudGfx.fillEllipse(120, 60, 32, 20);
    cloudGfx.fillEllipse(320, 128, 80, 22);
    cloudGfx.fillEllipse(350, 114, 34, 30);
    cloudGfx.fillEllipse(378, 124, 36, 22);

    const { boxH } = getRoadBox();
    const borderPts = roadTrapezoid(0.16, 0.84, 0.60, 0.40);
    const roadPts = roadTrapezoid(0.18, 0.82, 0.58, 0.42);

    const border = this.add.graphics().setDepth(2);
    this.fillTrapezoid(border, borderPts, 0x166534, 0.45);

    this.roadStripes = this.add.tileSprite(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT - boxH / 2,
      CANVAS_WIDTH, boxH,
      SPRITE_KEYS.BG_ROAD_STRIPES
    ).setDepth(3).setAlpha(0.75);

    this.roadMaskGfx = this.add.graphics().setVisible(false);
    this.fillTrapezoid(this.roadMaskGfx, roadPts, 0xffffff, 1);
    this.roadStripes.setMask(this.roadMaskGfx.createGeometryMask());

    const ground = this.add.graphics().setDepth(4);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * 0.85;
      ground.fillStyle(0x15803d, a);
      ground.fillRect(0, CANVAS_HEIGHT - 36 + i, CANVAS_WIDTH, 1);
    }

    if (DEBUG_WINDOW) {
      this.debugGfx = this.add.graphics().setDepth(6);
      const y0 = (0.18 + WIN_LO * (0.58 - 0.18)) * CANVAS_HEIGHT;
      const y1 = (0.18 + WIN_HI * (0.58 - 0.18)) * CANVAS_HEIGHT;
      this.debugGfx.lineStyle(2, 0x22c55e, 0.7);
      this.debugGfx.strokeRect(CANVAS_WIDTH * 0.18, y0, CANVAS_WIDTH * 0.64, y1 - y0);
    }
  }

  private fillTrapezoid(
    g: Phaser.GameObjects.Graphics,
    pts: { x: number; y: number }[],
    color: number,
    alpha: number,
  ): void {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
  }

  private buildHUD(): void {
    const hudGfx = this.add.graphics().setDepth(20);
    hudGfx.fillStyle(COLORS.PRIMARY, 0.9);
    hudGfx.fillRoundedRect(10, 10, 150, 50, 14);

    addCrispText(this, 24, 22, '分数', {
      fontSize: '12px', color: '#FFFFFF', fontFamily: FONT_BODY, fontStyle: 'bold',
    }).setDepth(20);
    this.scoreText = addCrispText(this, 150, 22, '0', {
      fontSize: '12px', color: '#FFFFFF', fontFamily: FONT_BODY, fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(20);

    addCrispText(this, 24, 40, '速度', {
      fontSize: '11px', color: '#D1FAE5', fontFamily: FONT_BODY,
    }).setDepth(20);
    this.speedText = addCrispText(this, 150, 40, '1.0x', {
      fontSize: '11px', color: '#D1FAE5', fontFamily: FONT_BODY,
    }).setOrigin(1, 0).setDepth(20);

    this.pauseBtn = addCrispText(this, CANVAS_WIDTH - 28, 28, '⏸', {
      fontSize: '13px', color: '#FFFFFF', fontFamily: FONT_BODY,
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    const pauseBg = this.add.graphics().setDepth(20);
    pauseBg.fillStyle(COLORS.PRIMARY, 0.9);
    pauseBg.fillCircle(CANVAS_WIDTH - 28, 28, 17);
    this.pauseBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      this.togglePause();
    });

    this.comboText = addCrispText(this, CANVAS_WIDTH / 2, 72, '', {
      fontSize: '26px',
      color: '#15803D',
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
      stroke: '#FFFFFF',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20);

    this.hitLabel = addCrispText(this, PLAYER_X, PLAYER_Y - 100, '', {
      fontSize: '22px',
      color: '#34D399',
      fontFamily: FONT_DISPLAY,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.defText = addCrispText(this, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14, '', {
      fontSize: '12px',
      color: hex(0x14532d),
      fontFamily: FONT_BODY,
      fontStyle: 'bold',
      backgroundColor: '#FFFDF5f0',
      padding: { left: 12, right: 12, top: 5, bottom: 5 },
    }).setOrigin(0.5, 1).setDepth(18);
    this.defText.setData('prefix', '释义 ');

    this.hintText = addCrispText(this, CANVAS_WIDTH / 2, 110, '', {
      fontSize: '13px',
      color: hex(COLORS.ACCENT_DARK),
      fontFamily: FONT_BODY,
      fontStyle: 'bold',
      wordWrap: { width: CANVAS_WIDTH - 40 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(20);
  }

  update(_time: number, delta: number): void {
    if (!this.alive || this.pausedByUser) return;
    const dt = delta / 1000;
    const rate = this.tutorialShouldPause() ? 0 : this.speedManager.getSpeed();

    if (rate > 0) this.elapsedTime += dt;
    this.player.update();

    if (rate > 0) {
      this.tickAccumulator += dt;
      if (this.tickAccumulator >= 0.1) {
        this.scoreSystem.addTick();
        this.tickAccumulator -= 0.1;
      }
    }

    for (const obs of this.obstacles) obs.advance(dt, rate);
    if (rate > 0) {
      const speedMul = rate / INITIAL_APPROACH_RATE;
      this.roadStripes.tilePositionY += (ROAD_STRIPE_PERIOD / ROAD_SCROLL_DURATION) * speedMul * dt;
    }
    this.checkCollisions();
    this.cleanupObstacles();
    this.checkSpawn();
    this.refreshDefinition();
    this.updateHUD();
    this.syncTargetWord();
  }

  private syncTargetWord(): void {
    const target = this.getTargetObstacle();
    if (!target || target.isJumpReady()) return;
    const word = target.getWord().toLowerCase();
    if (!this.bubbleTap.hasWord() || this.bubbleTap.getWord() !== word) {
      this.bubbleTap.setWord(word);
    }
  }

  private tutorialShouldPause(): boolean {
    if (!this.tutorial) return false;
    if (!this.tutorialStarted) return true;
    const target = this.getTargetObstacle();
    if (!target) return true;
    if (!target.isJumpReady()) return false;
    return Math.abs(target.getProgress() - windowCenter()) < 0.012;
  }

  private getTargetObstacle(): Obstacle | null {
    const alive = this.obstacles.filter((o) => o.isActive() && !o.isClearing());
    if (!alive.length) return null;
    alive.sort((a, b) => b.getProgress() - a.getProgress());
    return alive[0];
  }

  private onBubbleTap(obstacle: Obstacle, index: number): void {
    if (!this.alive || this.pausedByUser) return;
    this.ignoreJumpUntil = this.time.now + 80;
    const target = this.getTargetObstacle();
    if (!target || obstacle !== target) return;
    if (obstacle.isJumpReady()) return;

    if (!this.bubbleTap.hasWord() || this.bubbleTap.getWord() !== obstacle.getWord().toLowerCase()) {
      this.bubbleTap.setWord(obstacle.getWord());
    }

    const result = this.mode === 'idiom'
      ? this.bubbleTap.tapChar(obstacle.getCharAt(index))
      : this.bubbleTap.tapIndex(index);
    if (result.wrong) {
      this.scoreSystem.breakCombo();
      this.comboText.setText('');
      obstacle.flashWrong(index);
      audioSystem.play('wrong');
      return;
    }

    if (this.tutorial && !this.tutorialStarted) this.tutorialStarted = true;

    obstacle.onCorrectTap(index);
    audioSystem.play('correct');

    if (result.completed) {
      obstacle.markComplete();
      audioSystem.play('complete');
      this.hintText.setText(this.tutorial ? '时机到了点空白处起跳' : '');
    }
  }

  private onPointerJump(pointer: Phaser.Input.Pointer): void {
    if (!this.alive || this.pausedByUser || this.player.isBusy()) return;
    if (this.time.now < this.ignoreJumpUntil) return;
    if (pointer.y < 56 && pointer.x > CANVAS_WIDTH - 56) return;

    const target = this.getTargetObstacle();
    if (!target) {
      this.player.emptyHop();
      return;
    }

    if (!target.isJumpReady()) {
      this.player.emptyHop();
      return;
    }

    const p = target.getProgress();
    if (inWindow(p)) {
      const center = windowCenter();
      const half = (WIN_HI - WIN_LO) / 2;
      const perfect = Math.abs(p - center) <= half * PERFECT_WINDOW_RATIO;
      this.performClear(target, perfect);
    } else {
      this.player.emptyHop();
      this.hintText.setText('窗外空蹦 · 还可再跳');
      this.time.delayedCall(900, () => {
        if (this.hintText.active && !this.tutorial) this.hintText.setText('');
      });
    }
  }

  private performClear(obstacle: Obstacle, perfect: boolean): void {
    const word = obstacle.getWord();
    const direction = this.dodgeDirection();
    this.player.clearJump(
      direction,
      () => {
        obstacle.beginClear(
          () => this.player.returnFromDodge(),
          () => {
            this.obstacles = this.obstacles.filter((o) => o !== obstacle);
          }
        );
      },
      () => {
        /* landed */
      }
    );

    this.scoreSystem.addWordBonus(word, this.speedManager.getSpeedMultiplier(), perfect);
    this.speedManager.onObstacleCleared();
    this.wordSpawner.onObstacleCleared();
    this.bubbleTap.clear();
    audioSystem.play(perfect ? 'combo' : 'clear');
    this.updateComboDisplay(perfect);
    this.hintText.setText('');

    if (this.tutorial) {
      this.tutorial = false;
      markTutorialDone();
    }
  }

  private dodgeDirection(): -1 | 1 {
    const dir = this.dodgeCount % 2 === 0 ? -1 : 1;
    this.dodgeCount += 1;
    return dir as -1 | 1;
  }

  private checkCollisions(): void {
    for (const obs of this.obstacles) {
      if (!obs.isActive() || obs.isClearing()) continue;
      if (obs.getProgress() >= HIT_PROGRESS) {
        if (!this.player.isBusy()) {
          this.die();
          return;
        }
      }
      if (obs.getProgress() >= WIN_HI) {
        const pr = this.player.getHitbox();
        if (Phaser.Geom.Intersects.RectangleToRectangle(pr, obs.getHitbox()) && !this.player.isBusy()) {
          this.die();
          return;
        }
      }
    }
  }

  private spawnObstacle(isFirst = false): void {
    const config = this.obstacleSpawner.generate(isFirst && this.tutorial);
    const obstacle = new Obstacle(this, config);
    this.obstacles.push(obstacle);
    if (!this.bubbleTap.hasWord()) {
      this.bubbleTap.setWord(config.word);
    }
  }

  private checkSpawn(): void {
    if (this.obstacleSpawner.canSpawn(this.obstacles)) {
      this.spawnObstacle(false);
    }
  }

  private cleanupObstacles(): void {
    this.obstacles = this.obstacles.filter((o) => {
      if (!o.isActive()) {
        o.destroy();
        return false;
      }
      return true;
    });
  }

  private refreshDefinition(): void {
    const target = this.getTargetObstacle();
    if (!target) {
      this.defText.setText('');
      return;
    }
    const meaning = target.getMeaning();
    this.defText.setText(`释义 ${meaning}`);
    if (meaning && !this.seenMeanings.includes(meaning)) {
      this.seenMeanings.push(meaning);
    }
  }

  private updateHUD(): void {
    this.scoreText.setText(this.scoreSystem.getScore().toLocaleString());
    this.speedText.setText(`${this.speedManager.getSpeedMultiplier().toFixed(1)}x`);
  }

  private updateComboDisplay(perfect: boolean): void {
    const combo = this.scoreSystem.getCombo();
    this.comboText.setText(`x${combo} 连击`);
    this.comboText.setColor(combo >= 5 ? '#B45309' : '#15803D');
    this.tweens.killTweensOf(this.comboText);
    this.comboText.setScale(1.35);
    this.tweens.add({ targets: this.comboText, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });

    this.hitLabel.setText(perfect ? '完美！' : '不错！');
    this.hitLabel.setPosition(PLAYER_X, PLAYER_Y - 130);
    this.hitLabel.setColor(perfect ? '#FCD34D' : '#34D399');
    this.hitLabel.setAlpha(1);
    this.tweens.killTweensOf(this.hitLabel);
    this.tweens.add({
      targets: this.hitLabel,
      y: PLAYER_Y - 170,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
    });
  }

  private togglePause(): void {
    if (!this.alive) return;
    this.pausedByUser = !this.pausedByUser;
    if (this.pausedByUser) {
      this.pauseBtn.setText('▶');
      this.hintText.setText('已暂停 · 再点继续');
    } else {
      this.pauseBtn.setText('⏸');
      this.hintText.setText('');
    }
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.scoreSystem.breakCombo();
    this.comboText.setText('');
    this.player.die();
    audioSystem.play('die');
    this.time.delayedCall(500, () => {
      this.scene.start('DeathScene', {
        score: this.scoreSystem.getScore(),
        wordsTyped: this.scoreSystem.getWordsTyped(),
        wpm: this.scoreSystem.getWPM(this.elapsedTime),
        bestWord: this.scoreSystem.getBestWord(),
        maxCombo: this.scoreSystem.getMaxCombo(),
        difficulty: this.difficulty,
        mode: this.mode,
        meanings: this.seenMeanings.slice(0, 8),
      });
    });
  }

  shutdown(): void {
    this.events.off('obstacle-bubble-tap', this.onBubbleTap, this);
    this.input.off('pointerdown', this.onPointerJump, this);
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
