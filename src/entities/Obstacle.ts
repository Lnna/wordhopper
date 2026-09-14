import Phaser from 'phaser';
import {
  APPROACH_SCALE_FAR,
  APPROACH_SCALE_NEAR,
  APPROACH_TOP_FAR,
  APPROACH_TOP_NEAR,
  BUBBLE_PER_ROW,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_EXIT_PROGRESS,
  CLEAR_SPEED_BOOST,
  HIT_PROGRESS,
  OBSTACLE_BODY_WIDTH,
  OBSTACLE_SPRITES,
  OBSTACLE_VISUAL_BASE,
  ObstacleType,
  PLAYER_X,
} from '../config/constants';
import { COLORS, FONT_WORD } from '../config/colors';
import { addCrispText } from '../config/text';
import { hex } from '../config/utils';

export interface ObstacleConfig {
  obstacleType: ObstacleType;
  word: string;
  meaning: string;
  progress: number;
}

export class Obstacle {
  private scene: Phaser.Scene;
  private config: ObstacleConfig;
  private root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private bubbles: Phaser.GameObjects.Container[] = [];
  private doneStrip: Phaser.GameObjects.Container;
  private wordBlock: Phaser.GameObjects.Container;
  private bubbleWrap!: Phaser.GameObjects.Container;
  private active = true;
  private clearing = false;
  private canJump = false;
  private clearStartProgress = 0;
  private clearDone: (() => void) | null = null;
  private hitbox = new Phaser.Geom.Rectangle(0, 0, OBSTACLE_BODY_WIDTH, OBSTACLE_BODY_WIDTH);

  constructor(scene: Phaser.Scene, config: ObstacleConfig) {
    this.scene = scene;
    this.config = { ...config };
    this.root = scene.add.container(PLAYER_X, 0).setDepth(14);

    this.wordBlock = scene.add.container(0, 0);
    this.doneStrip = scene.add.container(0, 0);
    this.wordBlock.add(this.doneStrip);
    this.buildBubbles(config.word);
    this.root.add(this.wordBlock);

    this.sprite = scene.add.sprite(0, 0, OBSTACLE_SPRITES[config.obstacleType]);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDisplaySize(OBSTACLE_VISUAL_BASE, OBSTACLE_VISUAL_BASE * 1.35);
    this.root.add(this.sprite);

    this.wordBlock.setY(-OBSTACLE_VISUAL_BASE * 1.35 - 18);

    this.applyLayout();
  }

  private buildBubbles(word: string): void {
    const letters = word.toUpperCase().split('');
    this.bubbleWrap = this.scene.add.container(0, 0);
    this.wordBlock.add(this.bubbleWrap);

    for (let start = 0; start < letters.length; start += BUBBLE_PER_ROW) {
      const row = this.scene.add.container(0, Math.floor(start / BUBBLE_PER_ROW) * 40);
      const slice = letters.slice(start, start + BUBBLE_PER_ROW);
      slice.forEach((ch, j) => {
        const index = start + j;
        const bubble = this.makeBubble(ch, index);
        bubble.setPosition((j - (slice.length - 1) / 2) * 40, 0);
        row.add(bubble);
        this.bubbles[index] = bubble;
      });
      this.bubbleWrap.add(row);
    }
    this.layoutDoneAndBubbles();
    this.highlightNext();
  }

  private layoutDoneAndBubbles(): void {
    const doneW = Math.max(12, this.doneStrip.list.length * 16);
    this.doneStrip.setPosition(-doneW / 2 - 8, 0);
    this.bubbleWrap.setPosition(doneW / 2 + 8, 0);
  }

  private makeBubble(letter: string, index: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    g.fillStyle(0x7dd3fc, 0.35);
    g.fillCircle(0, 0, 15);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(-5, -6, 5);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(5, 6, 3);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(0, 0, 15);
    const t = addCrispText(this.scene, 0, 0, letter, {
      fontSize: '14px',
      fontFamily: FONT_WORD,
      color: '#1e3a2f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(30, 30);
    c.setInteractive({ useHandCursor: true });
    c.setData('index', index);
    c.setData('gfx', g);
    c.setData('label', t);
    c.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.scene.events.emit('obstacle-bubble-tap', this, index);
    });
    return c;
  }

  onCorrectTap(index: number): void {
    const bubble = this.bubbles[index];
    if (!bubble) return;
    bubble.disableInteractive();
    bubble.setVisible(false);
    const letter = (bubble.getData('label') as Phaser.GameObjects.Text).text;
    const ch = addCrispText(this.scene, this.doneStrip.list.length * 16, 0, letter, {
      fontSize: '12px',
      fontFamily: FONT_WORD,
      color: '#14532d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const chBg = this.scene.add.graphics();
    chBg.fillStyle(0x86efac, 0.9);
    chBg.fillCircle(0, 0, 9);
    chBg.lineStyle(1.5, 0x15803d, 0.55);
    chBg.strokeCircle(0, 0, 9);
    chBg.setPosition(this.doneStrip.list.length * 16, 0);
    this.doneStrip.add([chBg, ch]);
    this.layoutDoneAndBubbles();
    this.highlightNext();
  }

  flashWrong(index: number): void {
    const bubble = this.bubbles[index] ?? this.bubbles[this.getNextIndex()];
    if (!bubble) return;
    const label = bubble.getData('label') as Phaser.GameObjects.Text;
    const prev = label.style.color;
    label.setColor('#ef4444');
    this.scene.time.delayedCall(120, () => {
      if (label.active) label.setColor(prev || hex(COLORS.PRIMARY_DARK));
    });
  }

  markComplete(): void {
    this.canJump = true;
    this.bubbles.forEach((b) => b?.disableInteractive());
  }

  highlightNext(): void {
    const next = this.getNextIndex();
    this.bubbles.forEach((b, i) => {
      if (!b?.visible) return;
      const g = b.getData('gfx') as Phaser.GameObjects.Graphics;
      g.clear();
      const isNext = i === next;
      g.fillStyle(0x7dd3fc, isNext ? 0.55 : 0.35);
      g.fillCircle(0, 0, 15);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(-5, -6, 5);
      g.fillStyle(0xffffff, 0.3);
      g.fillCircle(5, 6, 3);
      g.lineStyle(isNext ? 3 : 2, isNext ? 0xd97706 : 0xffffff, isNext ? 0.9 : 0.7);
      g.strokeCircle(0, 0, 15);
    });
  }

  private getNextIndex(): number {
    return Math.floor(this.doneStrip.list.length / 2);
  }

  advance(dt: number, rate: number): void {
    if (!this.active) return;
    if (this.clearing) {
      this.config.progress = Math.min(
        CLEAR_EXIT_PROGRESS,
        this.config.progress + rate * CLEAR_SPEED_BOOST * dt
      );
      this.applyLayout();
      if (this.config.progress >= CLEAR_EXIT_PROGRESS) {
        this.active = false;
        const cb = this.clearDone;
        this.clearDone = null;
        this.destroy();
        cb?.();
      }
      return;
    }
    this.config.progress = Math.min(HIT_PROGRESS, this.config.progress + rate * dt);
    this.applyLayout();
  }

  applyLayout(): void {
    const p = this.config.progress;
    const topRatio = APPROACH_TOP_FAR + p * (APPROACH_TOP_NEAR - APPROACH_TOP_FAR);
    const scale = APPROACH_SCALE_FAR + p * (APPROACH_SCALE_NEAR - APPROACH_SCALE_FAR);
    const y = topRatio * CANVAS_HEIGHT;
    this.root.setPosition(PLAYER_X, y);
    this.root.setScale(scale);
    if (this.clearing) {
      const t = (p - this.clearStartProgress) / (CLEAR_EXIT_PROGRESS - this.clearStartProgress);
      this.root.setAlpha(Math.max(0, 1 - t));
    } else {
      this.root.setAlpha(1);
    }

    const size = OBSTACLE_BODY_WIDTH * scale;
    this.hitbox.setTo(PLAYER_X - size / 2, y - size, size, size);
  }

  getProgress(): number {
    return this.config.progress;
  }

  getWord(): string {
    return this.config.word;
  }

  getMeaning(): string {
    return this.config.meaning;
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return this.hitbox;
  }

  isActive(): boolean {
    return this.active;
  }

  isClearing(): boolean {
    return this.clearing;
  }

  isJumpReady(): boolean {
    return this.canJump;
  }

  beginClear(onDone: () => void): void {
    if (this.clearing) return;
    this.clearing = true;
    this.clearStartProgress = this.config.progress;
    this.clearDone = onDone;
  }

  destroy(): void {
    this.bubbles.forEach((b) => b?.destroy());
    this.bubbles = [];
    this.root.destroy(true);
  }
}
