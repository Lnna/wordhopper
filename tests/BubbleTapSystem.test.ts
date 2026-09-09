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
