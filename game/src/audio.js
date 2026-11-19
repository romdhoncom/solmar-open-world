// Solmar's sound: everything is synthesized with WebAudio, no audio files.
// A low engine hum that follows the car's speed, a two-tone police siren, a
// noise-burst gunshot, a punch thump, a horn, a tyre screech for the
// handbrake, chimes for pickups, fares and rank-ups, and a small looping
// bass-and-lead groove for the drive. Nothing starts until the player first
// interacts, and M mutes it all.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let musicStep = 0;
  let musicTimer = 0;
  let skidTimer = 0;
  let started = false;

  // A minor-key bass line and a sparse lead, one step every 0.22 s.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  const LEAD = [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 329.6, 0];

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, volume, when) {
    if (!context || muted) return;
    const start = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume || 0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noise(seconds, volume, lowpass) {
    if (!context || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1800;
    const gain = context.createGain();
    gain.gain.value = volume || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any user gesture: creates the audio graph. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** speed01 is 0..1: the engine hum follows the car's speed. */
    engine(speed01, driving) {
      if (!context || muted) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, context.currentTime, 0.08);
    },
    /** dt advances the siren's two-tone wail while police are near. */
    siren(dt, active) {
      if (!context || muted) return;
      sirenTimer += dt;
      if (!active) {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        return;
      }
      sirenGain.gain.setTargetAtTime(0.035, context.currentTime, 0.1);
      const phase = Math.floor(sirenTimer / 0.42) % 2;
      sirenOsc.frequency.setTargetAtTime(phase === 0 ? 720 : 540, context.currentTime, 0.05);
    },
    gunshot() {
      noise(0.14, 0.5, 2400);
    },
    enemyShot() {
      noise(0.1, 0.22, 1600);
    },
    crash() {
      noise(0.25, 0.4, 700);
    },
    /** A short low thump for a punch. */
    punch() {
      tone(120, 0.08, 'square', 0.25, 0);
      noise(0.06, 0.2, 500);
    },
    /** The car's horn: two notes, held briefly. */
    honk() {
      tone(370, 0.18, 'square', 0.12, 0);
      tone(466, 0.18, 'square', 0.12, 0);
    },
    /** Tyre screech while the handbrake is held at speed. */
    skid(dt, active) {
      if (!context || muted) return;
      if (!active) {
        skidTimer = 0;
        return;
      }
      skidTimer -= dt;
      if (skidTimer <= 0) {
        skidTimer = 0.12;
        noise(0.1, 0.12, 900);
      }
    },
    /** A fare is on the meter. */
    fare() {
      tone(784, 0.1, 'triangle', 0.2, 0);
      tone(988, 0.14, 'triangle', 0.18, 0.08);
    },
    /** A new street rank: a rising arpeggio. */
    rankUp() {
      tone(523, 0.12, 'triangle', 0.22, 0);
      tone(659, 0.12, 'triangle', 0.22, 0.1);
      tone(784, 0.12, 'triangle', 0.22, 0.2);
      tone(1046, 0.28, 'triangle', 0.22, 0.3);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.22, 0);
      tone(1318, 0.18, 'sine', 0.2, 0.08);
    },
    cash() {
      tone(1046, 0.1, 'triangle', 0.22, 0);
      tone(1568, 0.16, 'triangle', 0.18, 0.07);
    },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.25, 0);
      tone(659, 0.14, 'triangle', 0.25, 0.12);
      tone(784, 0.22, 'triangle', 0.25, 0.24);
      tone(1046, 0.3, 'triangle', 0.22, 0.36);
    },
    busted() {
      tone(392, 0.2, 'square', 0.14, 0);
      tone(311, 0.35, 'square', 0.14, 0.18);
    },
    click() {
      tone(660, 0.06, 'square', 0.1, 0);
    },
    /** Advance the music sequencer by dt seconds. */
    music(dt) {
      if (!context || muted || !started) return;
      musicTimer += dt;
      const stepSeconds = 0.22;
      while (musicTimer >= stepSeconds) {
        musicTimer -= stepSeconds;
        const bass = BASS[musicStep % BASS.length];
        const lead = LEAD[musicStep % LEAD.length];
        if (bass) tone(bass, 0.2, 'triangle', 0.3, 0);
        if (lead && musicStep % 2 === 0) tone(lead, 0.16, 'sine', 0.1, 0);
        musicStep += 1;
      }
    },
  };
}
