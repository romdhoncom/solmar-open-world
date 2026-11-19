// A small seeded random number generator (mulberry32): the same seed gives
// the same city, the same traffic, the same fares and the same screenshot
// scenes, so a run can be replayed exactly.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from `list` using the seeded generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A number between `low` and `high` from the seeded generator. */
export function range(random, low, high) {
  return low + random() * (high - low);
}

/** True with probability `p` (0..1), from the seeded generator. */
export function chance(random, p) {
  return random() < p;
}

/** A shuffled copy of `list`, drawn with the seeded generator. */
export function shuffle(random, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
