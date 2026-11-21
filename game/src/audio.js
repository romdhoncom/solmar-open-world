// All sound is synthesized with WebAudio — no audio files.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  noise(dur, vol, low) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = low ? 'lowpass' : 'highpass';
      f.frequency.value = low ? 900 : 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }
  shot() { this.noise(0.12, 0.35); this.tone(180, 0.08, 'square', 0.15, 60); }
  punch() { this.noise(0.08, 0.3, true); this.tone(120, 0.08, 'sine', 0.25, 50); }
  horn() { this.tone(370, 0.35, 'sawtooth', 0.18); this.tone(466, 0.35, 'sawtooth', 0.12); }
  skid() { this.noise(0.25, 0.12); }
  chime() { this.tone(880, 0.15, 'sine', 0.2); setTimeout(() => this.tone(1320, 0.25, 'sine', 0.2), 120); }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.22), i * 130));
  }
  crash() { this.noise(0.3, 0.4, true); }
  // Continuous engine hum; call every frame with speed 0..1.
  engine(speed01) {
    if (!this.ctx || this.muted) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speed01 * 110;
      this.engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0.0;
    } catch (e) { /* ignore */ }
  }
  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = this.muted ? 0 : 0.045;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } else if (!on && this.sirenOsc) {
        this.sirenOsc.stop(); this.sirenOsc = null; this.sirenGain = null;
      }
      if (this.sirenOsc) {
        const t = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(750 + 220 * Math.sin(t * 2.4), t);
      }
    } catch (e) { /* ignore */ }
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 0, 130.8, 0, 98, 0, 146.8, 0, 110, 0, 130.8, 0, 164.8, 146.8, 130.8, 98];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      if (f) this.tone(f, 0.22, 'triangle', 0.07);
    }, 240);
  }
}
