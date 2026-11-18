// Procedural WebAudio sound for PAPER DRIFT. One job: every sound the game
// makes, synthesised live — pentatonic plucks, drums, firework pops and a
// soft night drone. No audio files, no network. Everything starts only
// after a user gesture (unlock), and M toggles mute.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.drone = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startDrone();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** A quiet two-oscillator night drone under everything. */
  startDrone() {
    if (!this.ctx || this.drone) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.81;
    const o3 = ctx.createOscillator();
    o3.type = 'triangle';
    o3.frequency.value = 55;
    o1.connect(filter);
    o2.connect(filter);
    o3.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    o3.start();
    this.drone = { gain, o1, o2, o3 };
  }

  /** A short plucked note; degree is a pentatonic step above A3. */
  pluck(degree, when = 0, volume = 0.22, duration = 0.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const freq = 220 * Math.pow(2, PENTA[degree % PENTA.length] / 12);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const harm = ctx.createOscillator();
    harm.type = 'triangle';
    harm.frequency.value = freq * 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    const hg = ctx.createGain();
    hg.gain.value = 0.25;
    osc.connect(gain);
    harm.connect(hg);
    hg.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    harm.start(t0);
    osc.stop(t0 + duration + 0.05);
    harm.stop(t0 + duration + 0.05);
  }

  /** Filtered noise burst: the raw material for pops, booms and whooshes. */
  noise(when, duration, volume, filterFreq, type = 'lowpass', sweepTo = null) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /** A low thump: sine dropping in pitch. */
  thump(when, volume, fromFreq, toFreq, duration) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, toFreq), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  shoot() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(720, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  hitEnemy() {
    this.pluck(7, 0, 0.1, 0.12);
    this.noise(0, 0.06, 0.1, 3200, 'highpass');
  }

  kill() {
    this.thump(0, 0.32, 190, 55, 0.28);
    this.noise(0, 0.28, 0.22, 1400, 'lowpass', 180);
    this.pluck(9, 0.02, 0.12, 0.3);
  }

  explodeBig() {
    this.thump(0, 0.5, 130, 34, 0.7);
    this.noise(0, 0.6, 0.34, 900, 'lowpass', 90);
    this.noise(0.05, 0.4, 0.2, 2600, 'bandpass', 500);
  }

  pickup(combo) {
    const degree = 4 + Math.min(10, combo || 0);
    this.pluck(degree, 0, 0.24, 0.55);
    this.pluck(degree + 2, 0.07, 0.14, 0.4);
  }

  hurt() {
    this.thump(0, 0.42, 220, 60, 0.32);
    this.noise(0, 0.22, 0.26, 700, 'lowpass', 140);
  }

  dash() {
    this.noise(0, 0.16, 0.16, 900, 'bandpass', 3200);
  }

  roar() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const detune of [-14, 0, 14]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(82, t0);
      osc.frequency.linearRampToValueAtTime(160, t0 + 0.5);
      osc.frequency.linearRampToValueAtTime(70, t0 + 0.9);
      osc.detune.value = detune;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.16, t0 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 1.0);
    }
    this.noise(0, 0.8, 0.14, 500, 'lowpass', 120);
  }

  upgrade() {
    this.pluck(4, 0, 0.2, 0.5);
    this.pluck(7, 0.09, 0.2, 0.5);
    this.pluck(9, 0.18, 0.22, 0.6);
    this.pluck(12, 0.27, 0.2, 0.7);
  }

  victory() {
    const notes = [4, 7, 9, 12, 14, 12, 16, 19];
    notes.forEach((degree, i) => this.pluck(degree, i * 0.13, 0.22, 0.6));
    this.thump(0, 0.3, 130, 65, 0.8);
  }

  waveHorn() {
    this.pluck(0, 0, 0.16, 0.4);
    this.pluck(4, 0.1, 0.16, 0.4);
    this.pluck(7, 0.2, 0.18, 0.5);
  }

  /** Quiet pentatonic wander while playing; call once per frame with dt. */
  startMusic() {
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  musicTick(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    this.musicStep += 1;
    const phrase = [0, -1, 4, -1, 7, -1, 9, 7, 4, -1, 2, 4, -1, 7, 9, 12];
    const degree = phrase[this.musicStep % phrase.length];
    if (degree >= 0) this.pluck(degree, 0, 0.05, 0.9);
  }
}
