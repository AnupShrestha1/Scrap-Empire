// Tiny sound effects synthesised with WebAudio: no audio files to download.

export type SoundId = 'pickup' | 'drop' | 'cash' | 'upgrade' | 'warn' | 'horn' | 'objective' | 'chunk';

interface Note {
  /** Start and end frequency in Hz (a slide when they differ). */
  from: number;
  to: number;
  /** Seconds after the sound starts. */
  at: number;
  duration: number;
  wave: OscillatorType;
  volume: number;
}

const SOUNDS: Readonly<Record<SoundId, readonly Note[]>> = {
  pickup: [{ from: 520, to: 780, at: 0, duration: 0.06, wave: 'square', volume: 0.05 }],
  drop: [{ from: 420, to: 260, at: 0, duration: 0.06, wave: 'square', volume: 0.05 }],
  cash: [
    { from: 988, to: 988, at: 0, duration: 0.05, wave: 'square', volume: 0.05 },
    { from: 1319, to: 1319, at: 0.05, duration: 0.08, wave: 'square', volume: 0.05 },
  ],
  upgrade: [
    { from: 523, to: 523, at: 0, duration: 0.08, wave: 'triangle', volume: 0.12 },
    { from: 659, to: 659, at: 0.08, duration: 0.08, wave: 'triangle', volume: 0.12 },
    { from: 784, to: 784, at: 0.16, duration: 0.08, wave: 'triangle', volume: 0.12 },
    { from: 1047, to: 1047, at: 0.24, duration: 0.18, wave: 'triangle', volume: 0.12 },
  ],
  warn: [
    { from: 220, to: 180, at: 0, duration: 0.12, wave: 'sawtooth', volume: 0.06 },
    { from: 220, to: 180, at: 0.15, duration: 0.12, wave: 'sawtooth', volume: 0.06 },
  ],
  horn: [
    { from: 330, to: 330, at: 0, duration: 0.18, wave: 'square', volume: 0.05 },
    { from: 277, to: 277, at: 0.22, duration: 0.25, wave: 'square', volume: 0.05 },
  ],
  objective: [
    { from: 784, to: 784, at: 0, duration: 0.1, wave: 'triangle', volume: 0.12 },
    { from: 1175, to: 1175, at: 0.1, duration: 0.22, wave: 'triangle', volume: 0.12 },
  ],
  chunk: [{ from: 140, to: 70, at: 0, duration: 0.07, wave: 'triangle', volume: 0.07 }],
};

/** Minimum gap between two plays of the same sound, so fast transfers don't turn into a buzz. */
const MIN_GAP_S = 0.06;

/**
 * Plays the synthesised sounds. The AudioContext starts on the first tap or key press, as browsers
 * (iOS especially) require, and is resumed on later gestures if the browser suspended it.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private readonly lastPlayed = new Map<SoundId, number>();

  constructor(private readonly muted: () => boolean) {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchend', unlock);
  }

  play(id: SoundId): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.muted()) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -1) < MIN_GAP_S) return;
    this.lastPlayed.set(id, now);

    for (const note of SOUNDS[id]) {
      const start = now + note.at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.wave;
      osc.frequency.setValueAtTime(note.from, start);
      if (note.to !== note.from) osc.frequency.exponentialRampToValueAtTime(note.to, start + note.duration);
      gain.gain.setValueAtTime(note.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.duration + 0.02);
    }
  }

  private unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // No WebAudio: the game simply stays silent.
    }
  }
}
