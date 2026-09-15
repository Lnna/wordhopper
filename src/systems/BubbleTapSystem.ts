export interface BubbleTapResult {
  charIndex: number;
  completed: boolean;
  wrong: boolean;
  letter: string;
}

export interface BubbleTapProgress {
  word: string;
  correctChars: number;
  wrong: boolean;
  completed: boolean;
}

/** Ordered letter-bubble tapping (one word). Wrong tap does not clear progress. */
export class BubbleTapSystem {
  private word = '';
  private charIndex = 0;
  private wrong = false;

  setWord(word: string): void {
    this.word = word.toLowerCase();
    this.charIndex = 0;
    this.wrong = false;
  }

  tapIndex(index: number): BubbleTapResult {
    if (!this.word || this.charIndex >= this.word.length) {
      return { charIndex: this.charIndex, completed: this.isComplete(), wrong: false, letter: '' };
    }

    if (index !== this.charIndex) {
      this.wrong = true;
      return {
        charIndex: this.charIndex,
        completed: false,
        wrong: true,
        letter: this.word[index] ?? '',
      };
    }

    this.wrong = false;
    this.charIndex++;
    const completed = this.charIndex >= this.word.length;
    return {
      charIndex: this.charIndex,
      completed,
      wrong: false,
      letter: this.word[index],
    };
  }

  /** 按字符判定（成语模式）：与下一个所需字符比对 */
  tapChar(char: string): BubbleTapResult {
    if (!this.word || this.charIndex >= this.word.length) {
      return { charIndex: this.charIndex, completed: this.isComplete(), wrong: false, letter: '' };
    }

    if (char !== this.word[this.charIndex]) {
      this.wrong = true;
      return { charIndex: this.charIndex, completed: false, wrong: true, letter: char };
    }

    this.wrong = false;
    this.charIndex++;
    const completed = this.charIndex >= this.word.length;
    return { charIndex: this.charIndex, completed, wrong: false, letter: char };
  }

  isComplete(): boolean {
    return this.word.length > 0 && this.charIndex >= this.word.length;
  }

  hasWord(): boolean {
    return this.word !== '';
  }

  getWord(): string {
    return this.word;
  }

  getCharIndex(): number {
    return this.charIndex;
  }

  getProgress(): BubbleTapProgress {
    return {
      word: this.word,
      correctChars: this.charIndex,
      wrong: this.wrong,
      completed: this.isComplete(),
    };
  }

  clear(): void {
    this.word = '';
    this.charIndex = 0;
    this.wrong = false;
  }
}
