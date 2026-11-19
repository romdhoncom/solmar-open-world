// Street rank: the progression ladder. Points come from missions,
// fares, packages and escapes; each rung is a name the HUD shows with
// a progress bar, and reaching Made unlocks a gold Sunset by the marina.

import { RANKS } from './config.js';
import { makeGoldSunset } from './vehicles.js';

export function createRank() {
  return { points: 0, level: 0, goldSpawned: false };
}

/** The rank the player's points have earned. */
export function rankLevel(points) {
  let level = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (points >= RANKS[i].points) level = i;
  }
  return level;
}

/** The name of the player's current rank. */
export function rankName(G) {
  return RANKS[G.rank.level].name;
}

/** Progress to the next rank, 0..1 (1 when there is no next rank). */
export function rankProgress(G) {
  const level = G.rank.level;
  if (level >= RANKS.length - 1) return 1;
  const from = RANKS[level].points;
  const to = RANKS[level + 1].points;
  return Math.max(0, Math.min(1, (G.rank.points - from) / (to - from)));
}

/** Add rank points, and handle a rank-up (sound, and the gold car). */
export function addRankPoints(G, n) {
  G.rank.points += n;
  const level = rankLevel(G.rank.points);
  if (level > G.rank.level) {
    G.rank.level = level;
    G.audio.fanfare();
    if (level >= 3 && !G.rank.goldSpawned) {
      G.rank.goldSpawned = true;
      G.cars.push(makeGoldSunset());
    }
  }
}
