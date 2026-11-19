// Side jobs: repeatable taxi fares and the twelve hidden packages.
// Fares appear while the player is driving; packages sit in fixed,
// findable spots around the city and pay a bonus when all are found.

import { SIDEJOBS } from './config.js';
import { roadPointNear, hitsBuilding } from './world.js';
import { addRankPoints } from './rank.js';
import { saveGame } from './save.js';

export function createSidejobs() {
  return {
    packages: [],
    collected: 0,
    bonusPaid: false,
    fare: null,
    fareCooldown: 0,
    faresDone: 0,
  };
}

/** Scatter the twelve packages: beach, pier, parks, alleys, marina. */
export function initPackages(G) {
  const spots = [];
  // Beach and pier.
  spots.push({ x: 900, y: 3300 });
  spots.push({ x: 1900, y: 3340 });
  spots.push({ x: 3800, y: 3280 });
  spots.push({ x: 3100, y: 3400 });
  // Parks and the plaza.
  spots.push({ x: 2600, y: 2000 });
  // Alleys: points inside blocks, clear of buildings.
  const tries = [
    { x: 1000, y: 800 }, { x: 1800, y: 1400 }, { x: 2600, y: 800 },
    { x: 3400, y: 1400 }, { x: 1000, y: 2600 }, { x: 3400, y: 2600 },
    { x: 4300, y: 1550 }, { x: 1800, y: 2600 },
  ];
  for (const t of tries) {
    if (!hitsBuilding(G.city, t.x, t.y, 30)) spots.push(t);
  }
  // Fill any shortfall with park centres, so there are always twelve.
  let pi = 0;
  while (spots.length < SIDEJOBS.packageCount && pi < G.city.parks.length) {
    const park = G.city.parks[pi];
    pi += 1;
    const spot = { x: park.x + park.width / 2, y: park.y + park.height / 2 };
    if (!spots.some((s) => Math.hypot(s.x - spot.x, s.y - spot.y) < 120)) spots.push(spot);
  }
  G.sidejobs.packages = spots.slice(0, SIDEJOBS.packageCount).map((s) => ({
    x: s.x, y: s.y, taken: false,
  }));
}

export function updateSidejobs(G, dt) {
  const sj = G.sidejobs;
  const p = G.player;

  // Picking up a package: walk or drive over it.
  for (const pkg of sj.packages) {
    if (!pkg.taken && Math.hypot(pkg.x - p.x, pkg.y - p.y) < 42) {
      pkg.taken = true;
      sj.collected += 1;
      p.money += SIDEJOBS.packagePay;
      addRankPoints(G, 3);
      G.audio.chime();
      if (sj.collected >= SIDEJOBS.packageCount && !sj.bonusPaid) {
        sj.bonusPaid = true;
        p.money += SIDEJOBS.packageBonus;
        G.audio.fanfare();
      }
      saveGame(G);
    }
  }

  // A fare appears once the player is driving and the last one cooled off.
  sj.fareCooldown = Math.max(0, sj.fareCooldown - dt);
  if (!sj.fare && p.car && sj.fareCooldown <= 0 && G.missions.index >= 4) {
    const pickup = roadPointNear(G.rng, p.x, p.y, 350);
    sj.fare = { stage: 'pickup', pickup, dest: null, timer: 0 };
  }
  if (sj.fare) {
    const fare = sj.fare;
    if (fare.stage === 'pickup') {
      if (p.car && Math.hypot(p.car.x - fare.pickup.x, p.car.y - fare.pickup.y) < 70) {
        fare.stage = 'drive';
        fare.dest = roadPointNear(G.rng, p.x, p.y, 700);
        fare.timer = 75;
        G.audio.chime();
      }
    } else {
      fare.timer -= dt;
      if (fare.timer <= 0) {
        sj.fare = null;
        sj.fareCooldown = SIDEJOBS.fareCooldown;
      } else if (p.car && Math.hypot(p.car.x - fare.dest.x, p.car.y - fare.dest.y) < 80) {
        const tip = Math.ceil(fare.timer) * SIDEJOBS.fareTipPerSecond;
        p.money += SIDEJOBS.farePay + tip;
        sj.faresDone += 1;
        addRankPoints(G, 5);
        G.audio.chime();
        sj.fare = null;
        sj.fareCooldown = SIDEJOBS.fareCooldown;
        saveGame(G);
      }
    }
    // A fare is lost if the player gets out of the car mid-job.
    if (sj.fare && !p.car) {
      sj.fare = null;
      sj.fareCooldown = SIDEJOBS.fareCooldown;
    }
  }
}
