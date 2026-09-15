import { describe, it, expect } from 'vitest';
import { ScoreSystem } from '../src/systems/ScoreSystem';

describe('ScoreSystem', () => {
  it('should accumulate base score per tick', () => {
    const score = new ScoreSystem();
    score.addTick();
    score.addTick();
    score.addTick();
    expect(score.getScore()).toBe(3);
  });

  it('should add word bonus with base + combo', () => {
    const score = new ScoreSystem();
    score.addWordBonus('leaf', 1.0, false);
    // base = 5*4*1.0 = 20, combo=1 → +3, total = 23
    expect(score.getScore()).toBe(23);
  });

  it('should scale word base by speed', () => {
    const score = new ScoreSystem();
    score.addWordBonus('adventure', 2.0, false);
    // base = 5*9*2.0 = 90, combo=1 → +3, total = 93
    expect(score.getScore()).toBe(93);
  });

  it('should apply combo as additive bonus', () => {
    const score = new ScoreSystem();
    score.addWordBonus('cat', 1.0, false);
    // base = 5*3*1.0 = 15, combo=1 → +3, total = 18
    score.addWordBonus('cat', 1.0, false);
    // base = 15, combo=2 → +6, total = 18 + 21 = 39
    expect(score.getScore()).toBe(39);
  });

  it('should apply perfect 1.2x multiplier', () => {
    const score = new ScoreSystem();
    score.addWordBonus('cat', 1.0, true);
    // (base=15 + combo=1*3) * 1.2 = 18 * 1.2 = 21.6 → 22
    expect(score.getScore()).toBe(22);
  });

  it('should track words typed count', () => {
    const score = new ScoreSystem();
    score.addWordBonus('cat', 1.0, false);
    score.addWordBonus('dog', 1.0, false);
    expect(score.getWordsTyped()).toBe(2);
  });

  it('should track total chars typed for WPM', () => {
    const score = new ScoreSystem();
    score.addWordBonus('leaf', 1.0, false);
    score.addWordBonus('spring', 1.0, false);
    expect(score.getTotalChars()).toBe(4 + 6);
  });

  it('should track best word', () => {
    const score = new ScoreSystem();
    score.addWordBonus('cat', 1.0, false);
    score.addWordBonus('adventure', 1.0, false);
    expect(score.getBestWord()).toBe('adventure');
  });

  it('should break combo', () => {
    const score = new ScoreSystem();
    score.addWordBonus('cat', 1.0, false);
    score.addWordBonus('cat', 1.0, false);
    expect(score.getCombo()).toBe(2);
    score.breakCombo();
    expect(score.getCombo()).toBe(0);
  });

  it('should reset all state including combo', () => {
    const score = new ScoreSystem();
    score.addTick();
    score.addWordBonus('cat', 1.0, false);
    score.reset();
    expect(score.getScore()).toBe(0);
    expect(score.getWordsTyped()).toBe(0);
    expect(score.getTotalChars()).toBe(0);
    expect(score.getCombo()).toBe(0);
  });

  it('rush bonus scales with remaining progress and speed multiplier', () => {
    const score = new ScoreSystem();
    // progress 0.2、速度 1.0 → (1-0.2)*15*1.0 = 12
    expect(score.addRushBonus(0.2, 1.0)).toBe(12);
    expect(score.getScore()).toBe(12);
    // progress 0.8、速度 1.2 → 0.2*15*1.2 = 3.6 → 4
    expect(score.addRushBonus(0.8, 1.2)).toBe(4);
    expect(score.getScore()).toBe(16);
  });

  it('rush bonus is zero when obstacle already at hit line', () => {
    const score = new ScoreSystem();
    expect(score.addRushBonus(1, 1.0)).toBe(0);
    expect(score.getScore()).toBe(0);
  });
});
