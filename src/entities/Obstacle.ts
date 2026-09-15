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
  PLAYER_Y,
} from '../config/constants';
import { COLORS, FONT_WORD } from '../config/colors';
import { addCrispText } from '../config/text';
import { hex } from '../config/utils';

/** wordBlock 顶到障碍本体顶的容器内距离（本体 1.35 倍高 + 18 间距 + 字条半径余量） */
const PACK_TOP_OFFSET = OBSTACLE_VISUAL_BASE * 1.35 + 18 + 14;
/** 成语模式 8 字板每排字数 */
const BOARD_PER_ROW = 4;
/** 单词泡：直径 30、间距 40 */
const BUBBLE_CELL = 30;
const BUBBLE_PITCH = 40;
/** 成语方框字块：边长 38、间距 46（米白宣纸风，prototypes/idiom-tiles.html B 版） */
const TILE_CELL = 38;
const TILE_PITCH = 46;
const TILE_RADIUS = 9;

export interface ObstacleConfig {
  obstacleType: ObstacleType;
  word: string;
  meaning: string;
  progress: number;
  /** 成语模式：8 字板（成语 4 字 + 4 干扰字，已洗牌）；气泡按板渲染 */
  board?: string[];
}

export class Obstacle {
  private scene: Phaser.Scene;
  private config: ObstacleConfig;
  private root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private bubbles: Phaser.GameObjects.Container[] = [];
  private doneText: Phaser.GameObjects.Text;
  private doneCount = 0;
  private wordBlock: Phaser.GameObjects.Container;
  private bubbleWrap!: Phaser.GameObjects.Container;
  private active = true;
  private clearing = false;
  private canJump = false;
  private clearStartProgress = 0;
  private clearDone: (() => void) | null = null;
  private onPassed: (() => void) | null = null;
  private passedFired = false;
  private perRow: number;
  private pitch: number;
  private cell: number;
  private packTopOffset: number;
  private hitbox = new Phaser.Geom.Rectangle(0, 0, OBSTACLE_BODY_WIDTH, OBSTACLE_BODY_WIDTH);

  constructor(scene: Phaser.Scene, config: ObstacleConfig) {
    this.scene = scene;
    this.config = { ...config };
    this.root = scene.add.container(PLAYER_X, 0).setDepth(14);

    const rows = config.board
      ? Math.ceil(config.board.length / BOARD_PER_ROW)
      : Math.ceil(config.word.length / BUBBLE_PER_ROW);
    this.perRow = config.board ? BOARD_PER_ROW : BUBBLE_PER_ROW;
    this.pitch = config.board ? TILE_PITCH : BUBBLE_PITCH;
    this.cell = config.board ? TILE_CELL : BUBBLE_CELL;
    this.packTopOffset = PACK_TOP_OFFSET + (rows - 1) * this.pitch;

    this.wordBlock = scene.add.container(0, 0);
    this.doneText = addCrispText(scene, 0, 0, '', {
      fontSize: '16px',
      fontFamily: FONT_WORD,
      color: '#14532d',
      fontStyle: 'bold',
      stroke: '#FFFDF5',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);
    this.wordBlock.add(this.doneText);
    this.buildBubbles(config.word);
    this.root.add(this.wordBlock);

    this.sprite = scene.add.sprite(0, 0, OBSTACLE_SPRITES[config.obstacleType]);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDisplaySize(OBSTACLE_VISUAL_BASE, OBSTACLE_VISUAL_BASE * 1.35);
    this.root.add(this.sprite);

    this.wordBlock.setY(-OBSTACLE_VISUAL_BASE * 1.35 - 18 - (rows - 1) * this.pitch);

    this.applyLayout();
  }

  private buildBubbles(word: string): void {
    const items = this.config.board ?? word.toUpperCase().split('');
    const perRow = this.perRow;
    const pitch = this.pitch;
    const fontSize = this.config.board ? '18px' : '14px';
    this.bubbleWrap = this.scene.add.container(0, 0);
    this.wordBlock.add(this.bubbleWrap);

    for (let start = 0; start < items.length; start += perRow) {
      const row = this.scene.add.container(0, Math.floor(start / perRow) * pitch);
      const slice = items.slice(start, start + perRow);
      slice.forEach((ch, j) => {
        const index = start + j;
        const bubble = this.config.board
          ? this.makeTile(ch, index, fontSize)
          : this.makeBubble(ch, index, fontSize);
        bubble.setPosition((j - (slice.length - 1) / 2) * pitch, 0);
        row.add(bubble);
        this.bubbles[index] = bubble;
      });
      this.bubbleWrap.add(row);
    }
    this.layoutDoneAndBubbles();
  }

  private layoutDoneAndBubbles(): void {
    const firstRowLen = Math.min(this.bubbles.length, this.perRow);
    const bubblesW = (firstRowLen - 1) * this.pitch + this.cell;
    const gap = this.doneText.width > 0 ? 8 : 0;
    this.bubbleWrap.setPosition(0, 0);
    this.doneText.setPosition(-(bubblesW / 2 + gap), 0);
  }

  /** 单词泡：肥皂泡造型（无「下一泡」高亮，玩家自行找序） */
  private drawBubble(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    g.fillStyle(0x7dd3fc, 0.35);
    g.fillCircle(0, 0, 15);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(-5, -6, 5);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(5, 6, 3);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(0, 0, 15);
  }

  /** 成语字块：米白宣纸方框（prototypes/idiom-tiles.html B 版；无「下一字」高亮） */
  private drawTile(g: Phaser.GameObjects.Graphics): void {
    const h = TILE_CELL / 2;
    g.clear();
    // 米白底（顶部亮、底部略深，模拟 165° 渐变）
    g.fillStyle(0xf7efcf, 1);
    g.fillRoundedRect(-h, -h, TILE_CELL, TILE_CELL, TILE_RADIUS);
    g.fillStyle(0xfffef8, 0.85);
    g.fillRoundedRect(-h + 2, -h + 2, TILE_CELL - 4, TILE_CELL * 0.45, { tl: TILE_RADIUS - 2, tr: TILE_RADIUS - 2, bl: 4, br: 4 });
    g.fillStyle(0xe8d9ae, 0.55);
    g.fillRoundedRect(-h + 2, h - TILE_CELL * 0.28, TILE_CELL - 4, TILE_CELL * 0.28 - 2, { tl: 4, tr: 4, bl: TILE_RADIUS - 2, br: TILE_RADIUS - 2 });
    // 绿描边
    g.lineStyle(2, 0x15803d, 0.5);
    g.strokeRoundedRect(-h, -h, TILE_CELL, TILE_CELL, TILE_RADIUS);
  }

  private makeBubble(letter: string, index: number, fontSize: string): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    this.drawBubble(g);
    const t = addCrispText(this.scene, 0, 0, letter, {
      fontSize,
      fontFamily: FONT_WORD,
      color: '#1e3a2f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(BUBBLE_CELL, BUBBLE_CELL);
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

  private makeTile(ch: string, index: number, fontSize: string): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    this.drawTile(g);
    const t = addCrispText(this.scene, 0, 0, ch, {
      fontSize,
      fontFamily: FONT_WORD,
      color: '#14532d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(TILE_CELL, TILE_CELL);
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
    this.doneCount += 1;
    this.doneText.setText(this.config.word.slice(0, this.doneCount).toLowerCase());
    this.layoutDoneAndBubbles();
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
    this.scene.tweens.add({
      targets: this.doneText,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 130,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private getNextIndex(): number {
    if (!this.config.board) return this.doneCount;
    // 成语模式：定位「下一个所需字」所在的可见槽位（重复字跳过已隐藏的）；flashWrong 兜底用，不做任何高亮
    const needed = this.config.word[this.doneCount];
    if (!needed) return -1;
    return this.bubbles.findIndex((b, i) => !!b?.visible && this.config.board![i] === needed);
  }

  /** 槽位字符（成语模式供 tapChar 判定用） */
  getCharAt(slot: number): string {
    if (this.config.board) return this.config.board[slot] ?? '';
    return this.config.word[slot] ?? '';
  }

  isBoard(): boolean {
    return !!this.config.board;
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
        this.firePassed();
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
      const topEdge = y - this.packTopOffset * scale;
      if (topEdge >= PLAYER_Y) this.firePassed();
    } else {
      this.root.setAlpha(1);
    }

    const size = OBSTACLE_BODY_WIDTH * scale;
    this.hitbox.setTo(PLAYER_X - size / 2, y - size, size, size);
  }

  private firePassed(): void {
    if (this.passedFired) return;
    this.passedFired = true;
    const cb = this.onPassed;
    this.onPassed = null;
    cb?.();
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

  beginClear(onPassed: () => void, onDone: () => void): void {
    if (this.clearing) return;
    this.clearing = true;
    this.clearStartProgress = this.config.progress;
    this.onPassed = onPassed;
    this.clearDone = onDone;
  }

  destroy(): void {
    this.bubbles.forEach((b) => b?.destroy());
    this.bubbles = [];
    this.root.destroy(true);
  }
}
