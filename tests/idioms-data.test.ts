import { describe, it, expect } from 'vitest';
import idioms from '../src/data/idioms.json';

interface IdiomEntry {
  t: string; // 成语
  p: string; // 去声调拼音，4 音节空格分隔
  m: string; // 释义
  d: string[]; // 4 个干扰字
}

const entries = idioms as IdiomEntry[];

describe('idioms.json 数据校验', () => {
  it('库规模在常用范围内（2000-6000 条）', () => {
    expect(entries.length).toBeGreaterThanOrEqual(2000);
    expect(entries.length).toBeLessThanOrEqual(6000);
  });

  it('每条成语恰好 4 个汉字且不重复', () => {
    const words = new Set<string>();
    for (const e of entries) {
      expect([...e.t].length, e.t).toBe(4);
      expect([...e.t].every((ch) => /\p{Script=Han}/u.test(ch)), e.t).toBe(true);
      expect(words.has(e.t), `duplicate: ${e.t}`).toBe(false);
      words.add(e.t);
    }
  });

  it('每条拼音恰好 4 个去调音节', () => {
    for (const e of entries) {
      const syllables = e.p.split(' ');
      expect(syllables.length, e.t).toBe(4);
      for (const s of syllables) {
        expect(s, e.t).toMatch(/^[a-zv]+$/);
      }
    }
  });

  it('每条有非空释义', () => {
    for (const e of entries) {
      expect(e.m.length, e.t).toBeGreaterThan(0);
    }
  });

  it('每条 4 个干扰字：互不重复、不与成语字重复、均为汉字', () => {
    for (const e of entries) {
      expect(e.d.length, e.t).toBe(4);
      expect(new Set(e.d).size, e.t).toBe(4);
      for (const ch of e.d) {
        expect(/\p{Script=Han}/u.test(ch), `${e.t} distractor ${ch}`).toBe(true);
        expect(e.t.includes(ch), `${e.t} distractor ${ch} overlaps`).toBe(false);
      }
    }
  });

  it('链接通性：随机抽样 1000 条，≥90% 末字音节存在可接成语', () => {
    const firstSyllables = new Set(entries.map((e) => e.p.split(' ')[0]));
    const step = Math.max(1, Math.floor(entries.length / 1000));
    let sampled = 0;
    let chainable = 0;
    for (let i = 0; i < entries.length; i += step) {
      sampled++;
      const lastSyllable = entries[i].p.split(' ')[3];
      if (firstSyllables.has(lastSyllable)) chainable++;
    }
    expect(chainable / sampled).toBeGreaterThanOrEqual(0.9);
  });
});
