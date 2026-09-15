import Phaser from 'phaser';
import { applyRenderZoom } from '../config/display';
import { CANVAS_WIDTH, CANVAS_HEIGHT, Difficulty, GameMode, SPRITE_KEYS } from '../config/constants';
import { COLORS, FONT_DISPLAY, FONT_BODY } from '../config/colors';
import { addCrispText } from '../config/text';
import { hex, darker } from '../config/utils';
import { audioSystem } from '../systems/AudioSystem';

const WORD_DESCS: Record<Difficulty, string> = {
  chill: '3–5 字母 · 慢',
  easy: '3–5 字母',
  medium: '6–8 字母',
  hard: '8+ 字母',
};

/** 成语模式难度只控制初始速度 */
const IDIOM_DESCS: Record<Difficulty, string> = {
  chill: '慢速',
  easy: '常速',
  medium: '常速',
  hard: '常速',
};

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'easy';
  private selectedMode: GameMode = 'word';
  private difficultyBtns: Record<Difficulty, Phaser.GameObjects.Container> = {} as Record<Difficulty, Phaser.GameObjects.Container>;
  private difficultyDescs: Record<Difficulty, Phaser.GameObjects.Text> = {} as Record<Difficulty, Phaser.GameObjects.Text>;
  private modeTabs: Record<GameMode, Phaser.GameObjects.Container> = {} as Record<GameMode, Phaser.GameObjects.Container>;
  private bestText!: Phaser.GameObjects.Text;
  private sfxBtn!: Phaser.GameObjects.Text;

  private static readonly DIFFICULTIES: Difficulty[] = ['chill', 'easy', 'medium', 'hard'];
  private static readonly MODES: { key: GameMode; label: string }[] = [
    { key: 'word', label: '单词' },
    { key: 'idiom', label: '成语' },
  ];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    applyRenderZoom(this);
    this.selectedDifficulty = 'easy';
    this.selectedMode = 'word';
    this.difficultyBtns = {} as Record<Difficulty, Phaser.GameObjects.Container>;
    this.difficultyDescs = {} as Record<Difficulty, Phaser.GameObjects.Text>;
    this.modeTabs = {} as Record<GameMode, Phaser.GameObjects.Container>;
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;

    const bgGfx = this.add.graphics().setDepth(0);
    const stops = [
      { t: 0.0, c: 0x86efac },
      { t: 0.4, c: 0xbbf7d0 },
      { t: 0.7, c: 0xecfdf5 },
      { t: 1.0, c: 0xd1fae5 },
    ];
    for (let y = 0; y < height; y++) {
      const t = y / height;
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].t && t <= stops[i + 1].t) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const ar = (a.c >> 16) & 255, ag = (a.c >> 8) & 255, ab = a.c & 255;
      const br = (b.c >> 16) & 255, bg = (b.c >> 8) & 255, bb = b.c & 255;
      const r = Math.round(ar + (br - ar) * k);
      const gv = Math.round(ag + (bg - ag) * k);
      const bl = Math.round(ab + (bb - ab) * k);
      bgGfx.fillStyle((r << 16) | (gv << 8) | bl);
      bgGfx.fillRect(0, y, width, 1);
    }

    const titleBg = this.add.graphics().setDepth(4);
    titleBg.fillStyle(COLORS.PRIMARY, 1);
    titleBg.fillRoundedRect(width / 2 - 140, 48, 280, 56, 16);

    addCrispText(this, width / 2, 76, 'Word Hopper', {
      fontSize: '36px',
      fontFamily: FONT_DISPLAY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    addCrispText(this, width / 2, 128, '点字母泡 · 时机起跳', {
      fontSize: '16px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    // 模式 Tab：单词 | 成语
    MenuScene.MODES.forEach(({ key, label }, i) => {
      const tabX = width / 2 + (i === 0 ? -58 : 58);
      const tab = this.add.container(tabX, 158).setDepth(5);
      const bg = this.add.graphics();
      tab.add(bg);
      const text = addCrispText(this, 0, 0, label, {
        fontSize: '15px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      tab.add(text);
      tab.setSize(104, 32);
      tab.setInteractive({ useHandCursor: true });
      tab.on('pointerdown', () => {
        if (this.selectedMode !== key) {
          this.selectedMode = key;
          this.updateModeUI();
        }
      });
      this.modeTabs[key] = tab;
    });

    const liuY = 200;
    const liu = this.add.sprite(width / 2, liuY, SPRITE_KEYS.PLAYER_RUN);
    liu.setOrigin(0.5, 0.5);
    liu.setDisplaySize(96, 96);
    liu.setDepth(10);
    liu.play(SPRITE_KEYS.PLAYER_RUN_ANIM);

    const liuBg = this.add.graphics().setDepth(9);
    liuBg.fillStyle(0xecfdf5, 0.7);
    liuBg.fillEllipse(width / 2, liuY + 8, 130, 100);
    this.tweens.add({
      targets: liu,
      y: liuY - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const difficulties: { key: Difficulty; label: string }[] = [
      { key: 'chill', label: 'CHILL' },
      { key: 'easy', label: 'EASY' },
      { key: 'medium', label: 'MEDIUM' },
      { key: 'hard', label: 'HARD' },
    ];

    const btnStartY = 300;
    const btnStepY = 52;

    difficulties.forEach(({ key, label }, i) => {
      const yPos = btnStartY + i * btnStepY;
      const container = this.add.container(width / 2, yPos).setDepth(5);
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.MUTED_DARK, 0.75);
      bg.fillRoundedRect(-130, -20, 260, 40, 14);
      container.add(bg);

      const labelText = addCrispText(this, -110, 0, label, {
        fontSize: '16px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      container.add(labelText);

      const descText = addCrispText(this, 110, 0, WORD_DESCS[key], {
        fontSize: '13px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_MUTED),
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      container.add(descText);
      this.difficultyDescs[key] = descText;

      container.setSize(260, 40);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => {
        if (this.selectedDifficulty === key) {
          this.startGame();
        } else {
          this.selectedDifficulty = key;
          this.updateHighlight();
        }
      });
      this.difficultyBtns[key] = container;
    });

    const startY = btnStartY + difficulties.length * btnStepY + 20;
    const startGfx = this.add.graphics().setDepth(6);
    startGfx.fillStyle(0xD97706, 1);
    startGfx.fillRoundedRect(width / 2 - 100, startY, 200, 44, 16);
    startGfx.setInteractive(
      new Phaser.Geom.Rectangle(width / 2 - 100, startY, 200, 44),
      Phaser.Geom.Rectangle.Contains
    );
    startGfx.on('pointerdown', () => this.startGame());

    addCrispText(this, width / 2, startY + 22, '开始游戏', {
      fontSize: '18px',
      fontFamily: FONT_BODY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);

    this.sfxBtn = addCrispText(this, width / 2, startY + 70, this.sfxLabel(), {
      fontSize: '14px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY_DARK),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7).setInteractive({ useHandCursor: true });    this.sfxBtn.on('pointerdown', () => {
      audioSystem.toggle();
      this.sfxBtn.setText(this.sfxLabel());
    });

    this.bestText = addCrispText(this, width / 2, height - 30, '', {
      fontSize: '13px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY_DARK),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);

    this.updateHighlight();
    this.updateModeUI();
  }

  private sfxLabel(): string {
    return audioSystem.isEnabled() ? '音效：开' : '音效：关';
  }

  private bestKey(mode: GameMode, difficulty: Difficulty): string {
    return `word-hopper-best-${mode}-${difficulty}`;
  }

  private readBest(mode: GameMode, difficulty: Difficulty): number {
    try {
      return parseInt(localStorage.getItem(this.bestKey(mode, difficulty)) || '0', 10);
    } catch {
      return 0;
    }
  }

  /** 模式切换：Tab 高亮 + 难度描述 + 最高分展示 */
  private updateModeUI(): void {
    (Object.keys(this.modeTabs) as GameMode[]).forEach((key) => {
      const tab = this.modeTabs[key];
      const bg = tab.getAt(0) as Phaser.GameObjects.Graphics;
      const text = tab.getAt(1) as Phaser.GameObjects.Text;
      bg.clear();
      if (key === this.selectedMode) {
        bg.fillStyle(COLORS.PRIMARY, 1);
        bg.fillRoundedRect(-52, -16, 104, 32, 16);
        text.setColor('#FFFFFF');
      } else {
        bg.fillStyle(COLORS.MUTED_DARK, 0.75);
        bg.fillRoundedRect(-52, -16, 104, 32, 16);
        text.setColor(hex(COLORS.TEXT_ON_LIGHT));
      }
    });

    const descs = this.selectedMode === 'idiom' ? IDIOM_DESCS : WORD_DESCS;
    (Object.keys(this.difficultyDescs) as Difficulty[]).forEach((key) => {
      this.difficultyDescs[key].setText(descs[key]);
    });

    this.refreshBest();
  }

  private refreshBest(): void {
    const best = this.readBest(this.selectedMode, this.selectedDifficulty);
    this.bestText.setText(best > 0 ? `BEST ${best.toLocaleString()}` : '竖屏 · 单手指尖');
  }

  private updateHighlight(): void {
    (Object.keys(this.difficultyBtns) as Difficulty[]).forEach((key) => {
      const container = this.difficultyBtns[key];
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const labelText = container.getAt(1) as Phaser.GameObjects.Text;
      bg.clear();
      if (key === this.selectedDifficulty) {
        bg.fillStyle(COLORS.PRIMARY, 0.18);
        bg.fillRoundedRect(-130, -20, 260, 40, 14);
        bg.lineStyle(2.5, COLORS.PRIMARY, 0.85);
        bg.strokeRoundedRect(-130, -20, 260, 40, 14);
        labelText.setText('> ' + key.toUpperCase());
        labelText.setColor(hex(COLORS.PRIMARY));
      } else {
        bg.fillStyle(COLORS.MUTED_DARK, 0.75);
        bg.fillRoundedRect(-130, -20, 260, 40, 14);
        labelText.setText('  ' + key.toUpperCase());
        labelText.setColor(hex(COLORS.TEXT_ON_LIGHT));
      }
    });
    this.refreshBest();
  }

  private startGame(): void {
    this.scene.start('GameScene', { difficulty: this.selectedDifficulty, mode: this.selectedMode });
  }
}
