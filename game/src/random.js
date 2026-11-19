// One seeded generator (mulberry32) for the whole game. The same seed
// always builds the same city, the same traffic, the same fares and the
// same screenshot scenes, so any run can be replayed exactly.

export function createRandom(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One item from `list`, drawn with the seeded generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A number from `low` to `high`, drawn with the seeded generator. */
export function range(random, low, high) {
  return low + random() * (high - low);
}

/** True with probability `p` (0 to 1), from the seeded generator. */
export function chance(random, p) {
  return random() < p;
}

/** A copy of `list` shuffled with the seeded generator. */
export function shuffle(random, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const held = out[i];
    out[i] = out[j];
    out[j] = held;
  }
  return out;
}
