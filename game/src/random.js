// The game's only source of chance: a small seeded generator.
// The world, the traffic, the mission targets and every effect that
// needs a number all draw from it, so the same seed plays the same game
// every run. Nothing in the game calls Math.random.

// mulberry32: a tiny, well-behaved 32-bit generator.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A number in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] inclusive.
export function intIn(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of an array, picked by the generator.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// True with probability p (0..1).
export function chance(rng, p) {
  return rng() < p;
}

// A shuffled copy of a list (Fisher-Yates, driven by the generator).
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
