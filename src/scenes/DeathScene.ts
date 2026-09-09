import Phaser from 'phaser';
import { applyRenderZoom, isMobile } from '../config/display';
import { COLORS, FONT_DISPLAY, FONT_BODY } from '../config/colors';
import { Difficulty, CANVAS_WIDTH, CANVAS_HEIGHT, SPRITE_KEYS } from '../config/constants';
import { addCrispText } from '../config/text';
import { hex, darker } from '../config/utils';
import { buildShareURL } from './ShareCardScene';

function getBestScore(difficulty: Difficulty): number {
  try { return parseInt(localStorage.getItem(`word-hopper-best-${difficulty}`) || '0', 10); } catch { return 0; }
}

function setBestScore(difficulty: Difficulty, score: number): void {
  try { localStorage.setItem(`word-hopper-best-${difficulty}`, score.toString()); } catch { /* noop */ }
}

export interface DeathData {
  score: number;
  wordsTyped: number;
  wpm: number;
  bestWord: string;
  maxCombo: number;
  difficulty: Difficulty;
  meanings?: string[];
}

export async function shareResult(data: { title: string; url: string }): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(data.url);
      return true;
    }
  } catch {
    // Fall through to the Web Share API when clipboard access fails.
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: data.title, url: data.url });
    } catch {
      return false;
    }
  }

  return false;
}

export class DeathScene extends Phaser.Scene {
  private gameInputHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;
  private difficulty: Difficulty = 'easy';
  private deathData: DeathData | null = null;
  private shareURL = '';
  private toastText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'DeathScene' });
  }

  create(data: DeathData): void {
    applyRenderZoom(this);
    this.difficulty = data.difficulty;
    this.deathData = data;
    this.shareURL = buildShareURL({
      score: data.score,
      wpm: data.wpm,
      bestWord: data.bestWord,
      difficulty: data.difficulty,
    });
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;

    const g = this.add.graphics();
    g.fillStyle(COLORS.MUTED, 0.9);
    g.fillRect(0, 0, w, h);
    g.setDepth(5);

    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(COLORS.SURFACE, 1);
    panelGfx.fillRoundedRect(w / 2 - 190, 24, 380, h - 48, 24);
    panelGfx.setDepth(6);

    const siX = w / 2 + 142;
    const siY = 16;

    const shareBg = this.add.graphics();
    shareBg.fillStyle(darker(COLORS.PRIMARY, 0.15), 0.15);
    shareBg.fillRoundedRect(siX + 2, siY + 2, 32, 22, 8);
    shareBg.fillStyle(COLORS.SURFACE, 0.9);
    shareBg.fillRoundedRect(siX, siY, 32, 22, 8);
    shareBg.lineStyle(1.5, COLORS.PRIMARY, 0.3);
    shareBg.strokeRoundedRect(siX, siY, 32, 22, 8);
    shareBg.setDepth(7);

    addCrispText(this, siX + 16, siY + 11, 'share', {
      fontSize: '9px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const shareHitArea = this.add.graphics();
    shareHitArea.setInteractive(new Phaser.Geom.Rectangle(siX, siY, 32, 22), Phaser.Geom.Rectangle.Contains);
    shareHitArea.on('pointerover', () => { this.input.setDefaultCursor('pointer'); shareBg.clear(); shareBg.fillStyle(COLORS.PRIMARY, 0.08); shareBg.fillRoundedRect(siX, siY, 32, 22, 8); shareBg.lineStyle(1.5, COLORS.PRIMARY, 0.5); shareBg.strokeRoundedRect(siX, siY, 32, 22, 8); shareBg.setDepth(7); });
    shareHitArea.on('pointerout', () => { this.input.setDefaultCursor('default'); shareBg.clear(); shareBg.fillStyle(COLORS.SURFACE, 0.9); shareBg.fillRoundedRect(siX, siY, 32, 22, 8); shareBg.lineStyle(1.5, COLORS.PRIMARY, 0.3); shareBg.strokeRoundedRect(siX, siY, 32, 22, 8); shareBg.setDepth(7); });
    shareHitArea.on('pointerdown', () => this.share());

    this.toastText = addCrispText(this, w / 2 + 148, 52, 'Link copied!', {
      fontSize: '9px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.ACCENT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10).setAlpha(0);

    const liu = this.add.sprite(w / 2, 70, SPRITE_KEYS.PLAYER_DEAD);
    liu.setDisplaySize(72, 72);
    liu.setDepth(10);

    addCrispText(this, w / 2, 130, '本局结束', {
      fontSize: '30px',
      fontFamily: FONT_DISPLAY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
      padding: { right: 8, left: 2, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(10);

    const best = getBestScore(data.difficulty);
    const isNewBest = data.score > best;
    if (isNewBest) setBestScore(data.difficulty, data.score);
    const displayBest = isNewBest ? data.score : best;
    const pct = displayBest > 0 ? Math.min(data.score / displayBest, 1) : 0;

    const scoreCenterX = w / 2;
    const scoreY = 180;

    const scoreCard1 = this.add.graphics();
    scoreCard1.fillStyle(COLORS.PRIMARY, 0.08);
    scoreCard1.fillRoundedRect(scoreCenterX - 120, scoreY - 16, 110, 52, 12);
    scoreCard1.setDepth(7);

    addCrispText(this, scoreCenterX - 65, scoreY - 2, data.score.toLocaleString(), {
      fontSize: '26px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    addCrispText(this, scoreCenterX - 65, scoreY + 20, 'THIS RUN', {
      fontSize: '10px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const scoreCard2 = this.add.graphics();
    scoreCard2.fillStyle(COLORS.ACCENT, 0.08);
    scoreCard2.fillRoundedRect(scoreCenterX + 10, scoreY - 16, 110, 52, 12);
    scoreCard2.setDepth(7);

    addCrispText(this, scoreCenterX + 65, scoreY - 2, displayBest.toLocaleString(), {
      fontSize: '26px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.ACCENT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    addCrispText(this, scoreCenterX + 65, scoreY + 20, 'BEST', {
      fontSize: '10px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.ACCENT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    if (isNewBest) {
      const nbGfx = this.add.graphics();
      nbGfx.fillStyle(COLORS.ACCENT, 0.15);
      nbGfx.fillRoundedRect(w / 2 - 60, scoreY + 44, 120, 22, 11);
      nbGfx.setDepth(7);
      addCrispText(this, w / 2, scoreY + 56, '* NEW BEST *', {
        fontSize: '12px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.ACCENT),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
    }

    const barWidth = w * 0.45;
    const barHeight = 8;
    const barX = (w - barWidth) / 2;
    const barY = isNewBest ? scoreY + 78 : scoreY + 56;

    const barTrack = this.add.graphics();
    barTrack.fillStyle(COLORS.MUTED_DARK, 0.5);
    barTrack.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
    barTrack.setDepth(7);

    const fillBar = this.add.graphics();
    fillBar.setDepth(8);

    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 700,
      onUpdate: (tween) => {
        const v = tween.getValue() ?? 0;
        fillBar.clear();
        fillBar.fillStyle(COLORS.PRIMARY, 1);
        fillBar.fillRoundedRect(barX, barY, barWidth * pct * (v / 100), barHeight, 4);
      },
    });

    addCrispText(this, w / 2, barY + barHeight + 10, `${Math.round(pct * 100)}% of best`, {
      fontSize: '10px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const cardW = 72;
    const cardH = 34;
    const cardGap = 8;
    const totalCardsWidth = cardW * 4 + cardGap * 3;
    const cardsStartX = (w - totalCardsWidth) / 2;
    const cardsY = barY + 55;

    const cards = [
      { value: data.wordsTyped.toString(), label: 'WORDS', fontSize: '14px' },
      { value: data.wpm.toString(), label: 'WPM', fontSize: '14px' },
      { value: `x${data.maxCombo}`, label: 'MAX COMBO', fontSize: '14px' },
      { value: data.bestWord || '—', label: 'BEST WORD', fontSize: '10px' },
    ];

    cards.forEach((card, i) => {
      const cx = cardsStartX + i * (cardW + cardGap);
      const cardGfx = this.add.graphics();
      cardGfx.fillStyle(COLORS.PRIMARY, 0.1);
      cardGfx.fillRoundedRect(cx, cardsY, cardW, cardH, 10);
      cardGfx.setDepth(7);

      addCrispText(this, cx + cardW / 2, cardsY + 12, card.value, {
        fontSize: card.fontSize,
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      addCrispText(this, cx + cardW / 2, cardsY + 26, card.label, {
        fontSize: '10px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
    });

    addCrispText(this, w / 2, cardsY + cardH + 12, `> ${data.difficulty.toUpperCase()} <`, {
      fontSize: '10px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const meanings = (data.meanings || []).filter(Boolean).slice(0, 6);
    if (meanings.length) {
      addCrispText(this, w / 2, cardsY + cardH + 32, `释义回顾：${meanings.join(' · ')}`, {
        fontSize: '11px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_MUTED),
        fontStyle: 'bold',
        wordWrap: { width: w - 80 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(10);
    }

    const btnY = cardsY + cardH + (meanings.length ? 70 : 36);

    const retryGfx = this.add.graphics();
    retryGfx.fillStyle(COLORS.PRIMARY, 1);
    retryGfx.fillRoundedRect(w / 2 - 95, btnY, 88, 34, 14);
    retryGfx.fillStyle(darker(COLORS.PRIMARY, 0.15), 1);
    retryGfx.fillRoundedRect(w / 2 - 93, btnY + 17, 84, 16, 8);
    retryGfx.setDepth(7);
    retryGfx.setInteractive(new Phaser.Geom.Rectangle(w / 2 - 95, btnY, 88, 34), Phaser.Geom.Rectangle.Contains);
    retryGfx.on('pointerover', () => { this.input.setDefaultCursor('pointer'); });
    retryGfx.on('pointerout', () => { this.input.setDefaultCursor('default'); });
    retryGfx.on('pointerdown', () => this.retry());

    addCrispText(this, w / 2 - 51, btnY + 17, '再来一局', {
      fontSize: '13px',
      fontFamily: FONT_BODY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const menuGfx = this.add.graphics();
    menuGfx.fillStyle(COLORS.MUTED_DARK, 0.7);
    menuGfx.fillRoundedRect(w / 2 + 7, btnY, 88, 34, 14);
    menuGfx.setDepth(7);
    menuGfx.setInteractive(new Phaser.Geom.Rectangle(w / 2 + 7, btnY, 88, 34), Phaser.Geom.Rectangle.Contains);
    menuGfx.on('pointerover', () => { this.input.setDefaultCursor('pointer'); });
    menuGfx.on('pointerout', () => { this.input.setDefaultCursor('default'); });
    menuGfx.on('pointerdown', () => this.goToMenu());

    addCrispText(this, w / 2 + 51, btnY + 17, '菜单', {
      fontSize: '14px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    addCrispText(this, w / 2, btnY + 42, '点「再来一局」立即重开', {
      fontSize: '11px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.keyboardHandler = (event: KeyboardEvent) => {
      if (event.key === ' ') this.retry();
      else if (event.key === 'Escape') this.goToMenu();
    };
    this.input.keyboard!.on('keydown', this.keyboardHandler);

    const gameInput = document.getElementById('game-input') as HTMLInputElement;
    if (gameInput) {
      gameInput.focus();
      this.gameInputHandler = (e: KeyboardEvent) => {
        if (e.key === ' ') { e.preventDefault(); this.retry(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.goToMenu(); }
      };
      gameInput.addEventListener('keydown', this.gameInputHandler);
    }

    if (isMobile()) {
      window.__wordhopper_jump = () => this.retry();
    }
  }

  private retry(): void {
    this.cleanup();
    this.scene.start('GameScene', { difficulty: this.difficulty });
  }

  private async share(): Promise<void> {
    const copied = await shareResult({
      title: 'Word Hopper',
      url: this.shareURL,
    });
    if (copied) {
      this.showToast();
    }
  }

  private showToast(): void {
    if (!this.toastText) return;
    this.toastText.setAlpha(1);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      duration: 1500,
      delay: 800,
    });
  }

  private goToMenu(): void {
    this.cleanup();
    this.scene.start('MenuScene');
  }

  shutdown(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    if (this.gameInputHandler) {
      const gameInput = document.getElementById('game-input') as HTMLInputElement;
      if (gameInput) gameInput.removeEventListener('keydown', this.gameInputHandler);
      this.gameInputHandler = null;
    }
    delete window.__wordhopper_jump;
  }
}