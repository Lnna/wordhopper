import { describe, it, expect } from 'vitest';
import { IdiomSpawner, IdiomEntry } from '../src/systems/IdiomSpawner';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const D: [string, string, string, string] = ['甲', '乙', '丙', '丁'];
// 链路设计：一心一意(末字意/yi) -> 意味深长(末字长/chang，断链) -> 回退到怡然自得(yi 同音开头)
const mini: IdiomEntry[] = [
  { t: '一心一意', p: 'yi xin yi yi', m: 'm1', d: [...D] },
  { t: '意味深长', p: 'yi wei shen chang', m: 'm2', d: [...D] },
  { t: '怡然自得', p: 'yi ran zi de', m: 'm3', d: [...D] }, // 同音不同字（yi）
];
// 集思广益 末字「益」(yi)，库中无「益」开头成语，只能走同音字
const miniHomophone: IdiomEntry[] = [
  { t: '集思广益', p: 'ji si guang yi', m: 'm1', d: [...D] },
  { t: '怡然自得', p: 'yi ran zi de', m: 'm2', d: [...D] },
];

/** 恒定 0.5：洗牌/选取结果确定，便于断言精确序列 */
const half = () => 0.5;

describe('IdiomSpawner（真实词库）', () => {
  it('连续 20 次接龙：下一题首字音节 = 上一题末字音节', () => {
    const spawner = new IdiomSpawner(mulberry32(7));
    let prevLastSyllable = '';
    for (let i = 0; i < 20; i++) {
      const round = spawner.generateNext();
      const firstSyllable = round.pinyin.split(' ')[0];
      if (prevLastSyllable) {
        expect(firstSyllable, `round ${i}: ${round.idiom}`).toBe(prevLastSyllable);
      }
      prevLastSyllable = round.pinyin.split(' ')[3];
    }
  });

  it('每局不重复出同一成语', () => {
    const spawner = new IdiomSpawner(mulberry32(11));
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const round = spawner.generateNext();
      expect(seen.has(round.idiom), `duplicate: ${round.idiom}`).toBe(false);
      seen.add(round.idiom);
    }
  });

  it('board 恰好是成语 4 字 + 4 干扰字共 8 格', () => {
    const spawner = new IdiomSpawner(mulberry32(3));
    for (let i = 0; i < 10; i++) {
      const round = spawner.generateNext();
      expect(round.board.length).toBe(8);
      // 成语 4 字（计重数）都在板上
      const counts = new Map<string, number>();
      for (const ch of round.board) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      for (const ch of round.idiom) {
        expect(counts.get(ch) ?? 0, `${round.idiom} missing ${ch}`).toBeGreaterThan(0);
        counts.set(ch, counts.get(ch)! - 1);
      }
      // 剩余 4 格互不相同且不在成语里
      const rest: string[] = [];
      for (const [ch, n] of counts) for (let k = 0; k < n; k++) rest.push(ch);
      expect(rest.length).toBe(4);
      expect(new Set(rest).size).toBe(4);
      for (const ch of rest) expect(round.idiom.includes(ch)).toBe(false);
    }
  });
});

describe('IdiomSpawner（迷你词库，确定性 rand）', () => {
  it('同字优先于同音字', () => {
    const spawner = new IdiomSpawner(half, mini);
    const first = spawner.generateNext();
    expect(first.idiom).toBe('一心一意'); // 队列首 pop 为「一」
    const next = spawner.generateNext();
    // 末字「意」：必须选「意」开头的意味深长，而不是同音的怡然自得
    expect(next.idiom).toBe('意味深长');
  });

  it('无同字成语时走同音字（忽略声调）', () => {
    const spawner = new IdiomSpawner(half, miniHomophone);
    const first = spawner.generateNext();
    expect(first.idiom).toBe('集思广益');
    const next = spawner.generateNext();
    // 「益」无同字开头成语，回退到同音 yi 的怡然自得
    expect(next.idiom).toBe('怡然自得');
  });

  it('断链时回退到仍有未用成语的开头字', () => {
    const spawner = new IdiomSpawner(half, mini);
    spawner.generateNext(); // 一心一意
    const second = spawner.generateNext(); // 意味深长，末字 长(chang) 无候选
    expect(second.idiom).toBe('意味深长');
    const third = spawner.generateNext();
    expect(third.pinyin.split(' ')[0]).not.toBe('chang'); // 断链
    expect(third.idiom).toBe('怡然自得'); // 回退到未用的「怡」
  });

  it('全部用完后清空已用集合重新开始（不抛异常）', () => {
    const spawner = new IdiomSpawner(half, mini);
    const seen = new Set<string>();
    for (let i = 0; i < mini.length; i++) {
      seen.add(spawner.generateNext().idiom);
    }
    expect(seen.size).toBe(mini.length);
    // 第 4 次：库已耗尽，应清空 used 重新起头，不抛异常
    const extra = spawner.generateNext();
    expect(mini.some((e) => e.t === extra.idiom)).toBe(true);
  });
});
