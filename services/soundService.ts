// Procedural game sound effects using Web Audio API — no external audio files needed.

class SoundService {
  private ctx: AudioContext | null = null;
  private _muted: boolean = false;

  /** Lazily create (or resume) the AudioContext.
   *  Must be called from a user-gesture handler the first time on mobile. */
  private ensureContext(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        console.warn('[SoundService] Web Audio API not available');
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ── helpers ──────────────────────────────────────────────

  /** Play a short oscillator tone. */
  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.15,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.01);
  }

  /** Generate a short noise burst (for whoosh / card-flip effects). */
  private noise(duration: number, volume = 0.08, delay = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Bandpass filter to shape the noise
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.01);
  }

  // ── public sound effects ─────────────────────────────────

  /** Card dealt — short click / snap */
  playDeal(): void {
    this.tone(1200, 0.06, 'square', 0.08);
    this.noise(0.04, 0.06, 0.01);
  }

  /** Your turn — rising chime (two ascending tones) */
  playYourTurn(): void {
    this.tone(523, 0.12, 'sine', 0.12);      // C5
    this.tone(659, 0.15, 'sine', 0.12, 0.12); // E5
  }

  /** Fold — soft whoosh */
  playFold(): void {
    this.noise(0.18, 0.07);
    this.tone(200, 0.15, 'sine', 0.04);
  }

  /** Call / Check — single chip clink */
  playChip(): void {
    this.tone(2400, 0.08, 'triangle', 0.1);
    this.tone(3200, 0.05, 'triangle', 0.06, 0.03);
  }

  /** Raise — multiple chip clinks */
  playRaise(): void {
    this.tone(2400, 0.07, 'triangle', 0.1);
    this.tone(3000, 0.06, 'triangle', 0.08, 0.06);
    this.tone(3600, 0.06, 'triangle', 0.08, 0.12);
    this.tone(4000, 0.05, 'triangle', 0.06, 0.17);
  }

  /** Win — celebratory ascending tones */
  playWin(): void {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      this.tone(freq, 0.2, 'sine', 0.12, i * 0.12);
    });
  }

  /** Timer warning tick */
  playTick(): void {
    this.tone(800, 0.04, 'square', 0.06);
  }

  /** Community card revealed — card flip */
  playCardFlip(): void {
    this.noise(0.06, 0.05);
    this.tone(1800, 0.05, 'triangle', 0.06, 0.02);
  }

  /** New round starting */
  playNewRound(): void {
    this.tone(440, 0.1, 'sine', 0.08);       // A4
    this.tone(554, 0.12, 'sine', 0.08, 0.08); // C#5
    this.tone(659, 0.15, 'sine', 0.08, 0.16); // E5
  }

  // ── controls ─────────────────────────────────────────────

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  setMuted(val: boolean): void {
    this._muted = val;
  }

  /** Call once on a user gesture (click / tap) to unlock audio on mobile. */
  unlock(): void {
    this.ensureContext();
  }
}

export const soundService = new SoundService();
