// Every sound is synthesized in the browser with WebAudio: no audio
// files, no network. The context starts on the first key or click, so
// a page that never hears a gesture stays silent; every method is a
// no-op until then, and a failed context never breaks the game.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicStep: 0,
    musicTimer: 0,
    sirenOn: false,

    /** Create the context on a user gesture; safe to call any time. */
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // The engine hum: a sawtooth through a low pass, always running.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // The siren: a sine that wobbles, silent until wanted.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch (e) {
        this.ctx = null;
      }
    },

    /** A short tone: frequency, length in seconds, shape, volume. */
    tone(freq, seconds, type, volume, when) {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime + (when || 0);
        const osc = this.ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume || 0.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + seconds + 0.02);
      } catch (e) { /* a failed blip never stops the game */ }
    },

    /** A burst of noise: the gunshot, the crash, the skid. */
    noise(seconds, volume, filterFreq) {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * seconds);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq || 1200;
        const gain = this.ctx.createGain();
        gain.gain.value = volume || 0.3;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start(t0);
      } catch (e) { /* ignore */ }
    },

    shot() { this.noise(0.12, 0.35, 2400); },
    emptyClick() { this.tone(1400, 0.05, 'square', 0.08); },
    punch() { this.tone(90, 0.12, 'sine', 0.35); },
    horn() { this.tone(233, 0.16, 'square', 0.14); this.tone(294, 0.16, 'square', 0.12, 0.02); },
    crash() { this.noise(0.3, 0.4, 500); this.tone(70, 0.2, 'sine', 0.3); },
    skid() { this.noise(0.18, 0.1, 3000); },
    chime() { this.tone(880, 0.12, 'sine', 0.2); this.tone(1318, 0.2, 'sine', 0.2, 0.1); },
    pickup() { this.tone(660, 0.08, 'sine', 0.18); this.tone(990, 0.12, 'sine', 0.18, 0.07); },
    repair() { this.tone(520, 0.1, 'sine', 0.2); this.tone(780, 0.14, 'sine', 0.2, 0.09); },
    fanfare() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.22, i * 0.13));
    },

    siren(on) {
      this.sirenOn = on;
    },

    /** The engine hum follows the player's speed, 0..1. */
    engine(speed01) {
      if (!this.ctx || !this.engineGain) return;
      const target = this.muted ? 0 : 0.02 + speed01 * 0.06;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    },

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    },

    /** Called every frame: siren wobble and the bassline. */
    update(dt, time) {
      if (!this.ctx) return;
      if (this.sirenGain) {
        const target = this.sirenOn && !this.muted ? 0.045 : 0;
        this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
        this.sirenOsc.frequency.value = 750 + Math.sin(time * 5.2) * 260;
      }
      // A simple looping bassline: eight steps, one every 0.24 s.
      this.musicTimer += dt;
      if (this.musicTimer >= 0.24) {
        this.musicTimer -= 0.24;
        const line = [55, 0, 65.41, 0, 49, 0, 58.27, 73.42];
        const note = line[this.musicStep % line.length];
        this.musicStep += 1;
        if (note > 0) this.tone(note, 0.22, 'triangle', 0.07);
      }
    },
  };
  return audio;
}
