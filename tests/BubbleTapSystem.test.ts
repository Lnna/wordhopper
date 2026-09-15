import { describe, it, expect } from 'vitest';
import { BubbleTapSystem } from '../src/systems/BubbleTapSystem';

describe('BubbleTapSystem', () => {
  it('advances on correct letter index', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('cat');
    const r1 = tap.tapIndex(0);
    expect(r1.wrong).toBe(false);
    expect(r1.charIndex).toBe(1);
    expect(r1.completed).toBe(false);
  });

  it('completes on last letter', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('hi');
    tap.tapIndex(0);
    const r = tap.tapIndex(1);
    expect(r.completed).toBe(true);
  });

  it('wrong index flashes without clearing progress', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('leaf');
    tap.tapIndex(0);
    const wrong = tap.tapIndex(2);
    expect(wrong.wrong).toBe(true);
    expect(tap.getCharIndex()).toBe(1);
    const next = tap.tapIndex(1);
    expect(next.wrong).toBe(false);
    expect(next.charIndex).toBe(2);
  });

  it('normalizes to lowercase', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('Apple');
    expect(tap.getWord()).toBe('apple');
  });
});

describe('BubbleTapSystem.tapChar（成语模式）', () => {
  it('按字正确推进', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('一心一意');
    const r1 = tap.tapChar('一');
    expect(r1.wrong).toBe(false);
    expect(r1.charIndex).toBe(1);
    expect(r1.letter).toBe('一');
    expect(r1.completed).toBe(false);
  });

  it('错字报 wrong 且不清进度', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('一心一意');
    tap.tapChar('一');
    const wrong = tap.tapChar('意');
    expect(wrong.wrong).toBe(true);
    expect(wrong.letter).toBe('意');
    expect(tap.getCharIndex()).toBe(1);
    const next = tap.tapChar('心');
    expect(next.wrong).toBe(false);
    expect(next.charIndex).toBe(2);
  });

  it('按序点完 4 字完成', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('画蛇添足');
    tap.tapChar('画');
    tap.tapChar('蛇');
    tap.tapChar('添');
    const r = tap.tapChar('足');
    expect(r.completed).toBe(true);
    expect(tap.isComplete()).toBe(true);
  });

  it('重复字成语按位置推进（一心一意两个一）', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('一心一意');
    tap.tapChar('一');
    tap.tapChar('心');
    const r = tap.tapChar('一'); // 第三个字还是一
    expect(r.wrong).toBe(false);
    expect(r.charIndex).toBe(3);
  });

  it('完成后继续点按无副作用', () => {
    const tap = new BubbleTapSystem();
    tap.setWord('守株待兔');
    for (const ch of '守株待兔') tap.tapChar(ch);
    const r = tap.tapChar('守');
    expect(r.wrong).toBe(false);
    expect(r.completed).toBe(true);
  });
});
