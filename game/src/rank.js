// Street rank: what Solmar calls Dani, from the jobs done, the fights
// won, the cars stolen, the fares run and the packages found. A new rank
// means a shout from Rosa on the banner — and at Made, a gold Sunset
// convertible appears by the marina, keys in it, because the city rewards
// its own.
import { RANKS } from './config.js';
import { makeCar } from './vehicles.js';

/** Dani's street score: jobs count most, everything else adds up. */
export function rankScore(game) {
  const jobs = game.sidejobs;
  return (
    game.missions.done * 100 +
    game.stats.kills * 10 +
    game.stats.carsStolen * 5 +
    jobs.faresDone * 10 +
    jobs.packagesFound * 15 +
    Math.floor(game.player.money / 500)
  );
}

/** The rank a score buys: name, index, and how far to the next one. */
export function rankFor(game) {
  const score = rankScore(game);
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (score >= RANKS[i].score) index = i;
  }
  const current = RANKS[index];
  const next = RANKS[index + 1] || null;
  const progress = next ? (score - current.score) / (next.score - current.score) : 1;
  return {
    name: current.name,
    index,
    score,
    next: next ? next.name : null,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

/**
 * Check for a rank rise after play: announce it, and at Made leave the
 * gold Sunset by the marina. Returns the new rank's name, or null.
 */
export function stepRank(game) {
  const rank = rankFor(game);
  if (rank.index <= game.rank.index) return null;
  game.rank.index = rank.index;
  game.missions.banner = `New rank: ${rank.name}! Solmar is starting to notice.`;
  game.missions.bannerTimer = 5;
  game.audio.rankUp();
  if (rank.index >= 3 && !game.sunsetSpawned) {
    game.sunsetSpawned = true;
    const sunset = makeCar(game.random, 2880, 1500, Math.PI / 2, 'parked');
    sunset.model = 'Sunset';
    sunset.color = '#f2c94c';
    sunset.top = 1.08;
    sunset.accel = 1.05;
    game.cars.push(sunset);
    game.missions.banner = `New rank: ${rank.name}! A gold Sunset waits by the marina.`;
  }
  return rank.name;
}
