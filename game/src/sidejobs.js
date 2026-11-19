// Side jobs, for the hours between story missions: taxi fares and hidden
// packages. A fare appears when Dani is driving with no job running — pick
// the passenger up, beat the clock to their stop, and the meter pays out
// with a tip for speed. Twelve gold packages are hidden around Solmar;
// finding them all pays a bonus on top.
import { MONEY, TAXI } from './config.js';
import { roadPointNear } from './world.js';

/** A fresh side-job record: no fare running, packages hidden. */
export function makeSideJobs(game) {
  const packages = [];
  for (let i = 0; i < MONEY.packageCount; i += 1) {
    const point = roadPointNear(game.random, 1600, 1200, 0);
    packages.push({
      x: point.x + (game.random() - 0.5) * 160,
      y: point.y + (game.random() - 0.5) * 160,
      taken: false,
    });
  }
  return {
    fare: null,
    cooldown: 8,
    packages,
    packagesFound: 0,
    faresDone: 0,
  };
}

/** Start a fare right now (the screenshot scenes use this). */
export function startFare(game, pickup, dest, timeLimit) {
  game.sidejobs.fare = {
    stage: 0,
    pickup: { x: pickup.x, y: pickup.y },
    dest: { x: dest.x, y: dest.y },
    timeLeft: timeLimit,
    timeLimit,
  };
  game.missions.banner = 'Fare on the meter — pick them up.';
  game.missions.bannerTimer = 4;
}

/** The objective line the HUD shows while a fare is running. */
export function fareObjective(game) {
  const fare = game.sidejobs.fare;
  if (!fare) return '';
  if (fare.stage === 0) return 'Fare waiting — pick up the passenger.';
  return `Fare aboard — deliver them before the clock runs out (${Math.ceil(fare.timeLeft)}s).`;
}

/** Advance fares and packages by dt. */
export function stepSideJobs(game, dt) {
  const jobs = game.sidejobs;
  const player = game.player;
  if (jobs.cooldown > 0) jobs.cooldown -= dt;

  // Offer a fare: driving, no story job, no fare already running.
  if (!jobs.fare && !game.missions.active && player.inCar && jobs.cooldown <= 0) {
    const pickup = roadPointNear(game.random, player.x, player.y, 450);
    const dest = roadPointNear(game.random, pickup.x, pickup.y, 700);
    startFare(game, pickup, dest, TAXI.fareSeconds);
    game.audio.fare();
  }

  const fare = jobs.fare;
  if (fare) {
    if (fare.stage === 0) {
      if (Math.hypot(player.x - fare.pickup.x, player.y - fare.pickup.y) < TAXI.pickupRadius) {
        fare.stage = 1;
        game.missions.banner = 'Passenger aboard — go!';
        game.missions.bannerTimer = 3;
      }
    } else {
      fare.timeLeft -= dt;
      if (fare.timeLeft <= 0) {
        jobs.fare = null;
        jobs.cooldown = TAXI.cooldownSeconds;
        game.missions.banner = 'The fare gave up and walked off.';
        game.missions.bannerTimer = 4;
      } else if (Math.hypot(player.x - fare.dest.x, player.y - fare.dest.y) < TAXI.destRadius) {
        const tip = Math.round((MONEY.fareTipMax * fare.timeLeft) / fare.timeLimit);
        const pay = MONEY.fareBase + tip;
        player.money += pay;
        jobs.faresDone += 1;
        game.stats.faresDone = jobs.faresDone;
        jobs.fare = null;
        jobs.cooldown = TAXI.cooldownSeconds;
        game.missions.banner = `Fare paid — $${pay} ($${MONEY.fareBase} + $${tip} tip).`;
        game.missions.bannerTimer = 4;
        game.audio.cash();
      }
    }
  }

  // Packages: walk or drive over one to collect it.
  for (const pack of jobs.packages) {
    if (pack.taken) continue;
    if (Math.hypot(pack.x - player.x, pack.y - player.y) < 34) {
      pack.taken = true;
      jobs.packagesFound += 1;
      player.money += MONEY.packageAmount;
      game.audio.pickup();
      if (jobs.packagesFound >= MONEY.packageCount) {
        player.money += MONEY.packageBonus;
        game.missions.banner = `All ${MONEY.packageCount} packages found — $${MONEY.packageBonus} bonus!`;
        game.missions.bannerTimer = 5;
        game.audio.missionDone();
      } else {
        game.missions.banner = `Package ${jobs.packagesFound} of ${MONEY.packageCount} — $${MONEY.packageAmount}.`;
        game.missions.bannerTimer = 3;
      }
    }
  }
}
