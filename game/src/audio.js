// Solmar 3D — synthesized sound: no audio files, everything is built
// from WebAudio oscillators and noise in the browser.
// Written fresh in this session for the v5 rebuild (prose spec only).

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass || 1200;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  const musicNotes = [262, 330, 392, 494, 392, 330, 262, 196, 220, 262, 330, 392];
  let musicStep = 0;

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (muted) { this.stopEngine(); this.stopSiren(); }
      return muted;
    },
    shoot() { noise(0.12, 0.3, 3000); tone(180, 0.1, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.25, 500); tone(90, 0.08, 'sine', 0.2, 50); },
    horn() { tone(370, 0.35, 'square', 0.08); tone(466, 0.35, 'square', 0.08); },
    skid() { noise(0.4, 0.12, 2500); },
    crash() { noise(0.3, 0.35, 800); tone(70, 0.25, 'sine', 0.25, 40); },
    chime() { tone(880, 0.15, 'sine', 0.15); setTimeout(() => tone(1318, 0.25, 'sine', 0.15), 120); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.18), i * 140));
    },
    pickup() { tone(660, 0.1, 'sine', 0.14); setTimeout(() => tone(990, 0.15, 'sine', 0.14), 90); },
    mission() { tone(523, 0.2, 'triangle', 0.16); setTimeout(() => tone(784, 0.3, 'triangle', 0.16), 150); },
    startEngine(speed01) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.0;
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        engineOsc.connect(f).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(60 + speed01 * 160, c.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, c.currentTime, 0.05);
    },
    stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch (err) {} engineOsc = null; engineGain = null; }
    },
    startSiren() {
      if (muted) return;
      const c = ensure();
      if (!c || sirenOsc) return;
      sirenOsc = c.createOscillator();
      sirenGain = c.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain.gain.value = 0.03;
      sirenOsc.connect(sirenGain).connect(c.destination);
      sirenOsc.start();
      const wail = () => {
        if (!sirenOsc || muted) return;
        sirenOsc.frequency.linearRampToValueAtTime(1100, c.currentTime + 0.6);
        sirenOsc.frequency.linearRampToValueAtTime(700, c.currentTime + 1.2);
        setTimeout(wail, 1200);
      };
      wail();
    },
    stopSiren() {
      if (sirenOsc) { try { sirenOsc.stop(); } catch (err) {} sirenOsc = null; sirenGain = null; }
    },
    startMusic() {
      if (musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const n = musicNotes[musicStep % musicNotes.length];
        musicStep++;
        tone(n, 0.5, 'triangle', 0.05);
      }, 420);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
}
