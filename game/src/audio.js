// All sound is synthesized in the browser with WebAudio — no audio files.
// Engine hum, siren, gunshots, punch, horn, skid, chimes, fanfare, music.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineOsc.connect(filt); filt.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.startMusic();
    } catch { this.ctx = null; }
  }

  setEngine(speed01) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, t, 0.08);
  }

  blip(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.25, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  }

  gunshot() { this.noise(0.14, 0.3, 900); this.blip(90, 0.1, 'square', 0.12); }
  punch() { this.blip(70, 0.12, 'sine', 0.25); this.noise(0.06, 0.12, 300); }
  horn() { this.blip(370, 0.28, 'square', 0.1); this.blip(466, 0.28, 'square', 0.08); }
  skid() { this.noise(0.35, 0.1, 2400); }
  crash() { this.noise(0.3, 0.3, 500); this.blip(55, 0.25, 'sine', 0.25); }
  chime() { this.blip(880, 0.15, 'sine', 0.12); this.blip(1318, 0.25, 'sine', 0.1, 0.09); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.14, i * 0.13)); }
  siren() { // two-tone wail while police chase
    if (!this.ctx || this.muted) return;
    this.blip(700, 0.35, 'sine', 0.05);
    this.blip(950, 0.35, 'sine', 0.05, 0.35);
  }

  startMusic() {
    // A slow, simple looping bass line: A minor, one note per beat.
    const bass = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 146.8, 0, 164.8, 0, 130.8, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[this.musicStep % bass.length];
      this.musicStep++;
      if (f) this.blip(f, 0.42, 'triangle', 0.045);
    }, 340);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }
}
