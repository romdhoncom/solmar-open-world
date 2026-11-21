// Seeded random: the whole city is generated once from a fixed seed, so
// every run of the game builds the same Solmar. mulberry32, small and fast.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    range(min, max) { return min + rand() * (max - min); },
    int(min, max) { return Math.floor(min + rand() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(rand() * arr.length)]; },
    chance(p) { return rand() < p; },
    // Deterministic screen-shake offsets for crashes, seeded per crash.
    shake(seedN, t) {
      const r = mulberry32(seedN);
      const a = r() * Math.PI * 2;
      const m = Math.max(0, 1 - t * 3) * 0.35;
      return [Math.cos(a) * m, Math.sin(a) * m];
    },
  };
}
