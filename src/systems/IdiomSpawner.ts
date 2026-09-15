import idiomsData from '../data/idioms.json';

export interface IdiomEntry {
  t: string; // 成语
  p: string; // 去声调拼音，4 音节空格分隔
  m: string; // 释义
  d: string[]; // 4 个干扰字
}

export interface IdiomRound {
  idiom: string;
  pinyin: string; // 去声调拼音，4 音节空格分隔
  meaning: string;
  board: string[]; // 8 字板：成语 4 字 + 4 干扰字，已洗牌
}

/** 断链时重新起头的候选开头字数量（按可接成语数取前 N 个洗牌） */
const FALLBACK_POOL_SIZE = 100;

/**
 * 成语接龙状态机：
 * - 下一题首字音节 = 上一题末字音节（忽略声调），同字优先于同音字
 * - 断链时从「高产开头字队列」取字重新起头；队列耗尽则清空已用集合重建
 */
export class IdiomSpawner {
  private entries: IdiomEntry[];
  private rand: () => number;
  private bySyllable = new Map<string, IdiomEntry[]>();
  private byChar = new Map<string, IdiomEntry[]>();
  private lastChar = '';
  private lastSyllable = '';
  private used = new Set<string>();
  private fallbackQueue: string[] = [];

  constructor(rand: () => number = Math.random, entries?: IdiomEntry[]) {
    this.rand = rand;
    this.entries = entries ?? (idiomsData as IdiomEntry[]);
    for (const e of this.entries) {
      const firstSyllable = e.p.split(' ')[0];
      const firstChar = [...e.t][0];
      if (!this.bySyllable.has(firstSyllable)) this.bySyllable.set(firstSyllable, []);
      this.bySyllable.get(firstSyllable)!.push(e);
      if (!this.byChar.has(firstChar)) this.byChar.set(firstChar, []);
      this.byChar.get(firstChar)!.push(e);
    }
    this.reset();
  }

  reset(): void {
    this.lastChar = '';
    this.lastSyllable = '';
    this.used.clear();
    this.rebuildFallbackQueue();
  }

  /** 高产开头字队列：按可接成语数量排序取前 N 个，洗牌后逐个消耗 */
  private rebuildFallbackQueue(): void {
    const ranked = [...this.byChar.entries()]
      .map(([ch, list]) => ({ ch, count: list.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, FALLBACK_POOL_SIZE)
      .map((x) => x.ch);
    this.fallbackQueue = this.shuffle(ranked);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  private unusedOnly(list: IdiomEntry[] | undefined): IdiomEntry[] {
    return (list ?? []).filter((e) => !this.used.has(e.t));
  }

  /** 断链回退：从队列取下一个仍有未用成语的开头字；队列耗尽则清空 used 重建 */
  private pickFallback(): IdiomEntry | null {
    while (this.fallbackQueue.length > 0) {
      const ch = this.fallbackQueue.shift()!;
      const candidates = this.unusedOnly(this.byChar.get(ch));
      if (candidates.length > 0) return this.pickRandom(candidates);
    }
    // 全部耗尽：清空已用集合，重建队列再来一轮
    this.used.clear();
    this.rebuildFallbackQueue();
    while (this.fallbackQueue.length > 0) {
      const ch = this.fallbackQueue.shift()!;
      const candidates = this.unusedOnly(this.byChar.get(ch));
      if (candidates.length > 0) return this.pickRandom(candidates);
    }
    return null;
  }

  generateNext(): IdiomRound {
    let entry: IdiomEntry | null = null;

    if (this.lastSyllable) {
      // 同字优先
      const sameChar = this.unusedOnly(this.byChar.get(this.lastChar));
      if (sameChar.length > 0) {
        entry = this.pickRandom(sameChar);
      } else {
        // 同音字（忽略声调）
        const sameSyllable = this.unusedOnly(this.bySyllable.get(this.lastSyllable));
        if (sameSyllable.length > 0) entry = this.pickRandom(sameSyllable);
      }
    }

    if (!entry) {
      entry = this.pickFallback();
    }
    if (!entry) {
      throw new Error('IdiomSpawner: no idiom available');
    }

    this.used.add(entry.t);
    const chars = [...entry.t];
    this.lastChar = chars[chars.length - 1];
    this.lastSyllable = entry.p.split(' ')[3];

    const board = this.shuffle([...chars, ...entry.d]);
    return { idiom: entry.t, pinyin: entry.p, meaning: entry.m, board };
  }
}
