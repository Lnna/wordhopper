import { Difficulty } from '../config/constants';
import easyWords from '../data/words-easy.json';
import mediumWords from '../data/words-medium.json';
import hardWords from '../data/words-hard.json';

export interface WordPair {
  word1: string;
  word2: string;
}

const easyList = (easyWords as string[]).filter((w) => w.length >= 3 && w.length <= 5);

const WORD_CACHE: Record<Difficulty, string[]> = {
  easy: easyList,
  medium: (mediumWords as string[]).filter((w) => w.length >= 6 && w.length <= 8),
  hard: (hardWords as string[]).filter((w) => w.length >= 8),
};

const HARD_TIERS = [
  { min: 9, max: 10 },
  { min: 11, max: 12 },
  { min: 13, max: 14 },
  { min: 14, max: Infinity },
];
const HARD_TIER_INTERVAL = 5;

export class WordSpawner {
  private words: string[] = [];
  private deck: string[] = [];
  private lastPicked = '';
  private difficulty: Difficulty = 'easy';
  private obstaclesCleared = 0;

  loadWords(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.obstaclesCleared = 0;
    this.words = WORD_CACHE[difficulty] || [];
    this.lastPicked = '';
    this.reshuffleDeck();
  }

  onObstacleCleared(): void {
    this.obstaclesCleared++;
  }

  generatePair(): WordPair {
    const word1 = this.takeFromDeck();
    const word2 = this.takeFromDeck({ firstLetterNot: word1[0], exclude: word1 });
    return { word1, word2 };
  }

  generateSingle(): string {
    return this.takeFromDeck();
  }

  private getPool(): string[] {
    if (this.difficulty !== 'hard') return this.words;
    const tierIdx = Math.min(
      Math.floor(this.obstaclesCleared / HARD_TIER_INTERVAL),
      HARD_TIERS.length - 1
    );
    const tier = HARD_TIERS[tierIdx];
    return this.words.filter(w => w.length >= tier.min && w.length <= tier.max);
  }

  private takeFromDeck(options?: { exclude?: string; firstLetterNot?: string }): string {
    const matches = (w: string) => {
      if (options?.exclude && w === options.exclude) return false;
      if (options?.firstLetterNot && w[0] === options.firstLetterNot) return false;
      return true;
    };

    const pickFromDeck = (): string | null => {
      const idx = this.deck.findIndex(matches);
      if (idx < 0) return null;
      return this.deck.splice(idx, 1)[0];
    };

    let word = pickFromDeck();
    if (!word) {
      this.reshuffleDeck();
      word = pickFromDeck();
    }
    if (!word) {
      const fallback = this.getPool().filter(matches);
      word = fallback[Math.floor(Math.random() * fallback.length)] || this.words[0] || '';
    }

    this.lastPicked = word;
    return word;
  }

  private reshuffleDeck(): void {
    this.deck = this.shuffle([...this.getPool()]);
    if (this.lastPicked && this.deck.length > 1 && this.deck[0] === this.lastPicked) {
      [this.deck[0], this.deck[1]] = [this.deck[1], this.deck[0]];
    }
  }

  private shuffle(items: string[]): string[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
