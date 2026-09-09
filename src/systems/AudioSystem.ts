import { SFX_ENABLED_KEY } from '../config/constants';

type SfxKind = 'correct' | 'complete' | 'clear' | 'combo' | 'wrong' | 'die';

function readEnabled(): boolean {
  try {
    const v = localStorage.getItem(SFX_ENABLED_KEY);
    return v !== '0';
  } catch {
    return true;
  }
}

/** Lightweight procedural SFX (no asset files). */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private enabled = readEnabled();

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(SFX_ENABLED_KEY, on ? '1' : '0');
    } catch {
      /* noop */
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  play(kind: SfxKind): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const table: Record<SfxKind, { f: number; d: number; type: OscillatorType }> = {
        correct: { f: 660, d: 0.06, type: 'sine' },
        complete: { f: 880, d: 0.12, type: 'triangle' },
        clear: { f: 520, d: 0.16, type: 'sine' },
        combo: { f: 740, d: 0.1, type: 'triangle' },
        wrong: { f: 180, d: 0.1, type: 'square' },
        die: { f: 110, d: 0.28, type: 'sawtooth' },
      };
      const conf = table[kind];
      osc.type = conf.type;
      osc.frequency.setValueAtTime(conf.f, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + conf.d);
      osc.start(now);
      osc.stop(now + conf.d + 0.02);
    } catch {
      /* noop */
    }
  }
}

export const audioSystem = new AudioSystem();
