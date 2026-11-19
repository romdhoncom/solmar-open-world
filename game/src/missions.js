// Solmar's story: nine jobs for Dani Vega, fresh off the bus with $150
// and a phone number for Rosa Marlowe, who runs Marlowe Motors. Each
// mission is a small state machine: a target to reach, a thing to do
// there, and a payout when it is done. Finishing one starts the next;
// finishing all nine makes Dani the King of Solmar. One job is timed —
// miss the clock and the fare walks away, and the job can be tried again.
import { MONEY, TAXI } from './config.js';
import { spawnEnemy } from './combat.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { playerCar } from './player.js';

export const GARAGE = { x: 1200, y: 1000 };
export const BANK = { x: 1680, y: 1420 };
export const DOCKS = { x: 2880, y: 1560 };
export const MOTEL = { x: 620, y: 2180 };
export const HIDEOUT = { x: 260, y: 240 };
export const BOARDWALK = { x: 1560, y: 2310 };
export const MARINA = { x: 2880, y: 1560 };
export const PLAZA_POINT = { x: 1440, y: 1220 };

export const COURIER_STOPS = [
  { x: 720, y: 620, label: 'North Market' },
  { x: 2160, y: 1820, label: 'East Flats' },
  { x: 2640, y: 220, label: 'Hilltop' },
];

export const MISSION_DEFS = [
  {
    title: 'New in Town',
    brief: 'Rosa Marlowe runs the garage on 3rd Avenue. Go and meet her — she has work for a driver who asks no questions.',
    target: GARAGE,
    targetLabel: 'Marlowe Motors',
  },
  {
    title: 'Borrowed Wheels',
    brief: 'Rosa needs a Comet for a client who pays cash and never checks the plates. Take any car on the street — press E beside one — and bring it to the garage.',
    target: GARAGE,
    targetLabel: 'Marlowe Motors',
  },
  {
    title: 'The Drop',
    brief: 'A package is waiting at the docks. Pick it up, then run it to the Sunset Motel on the beach. The cops are watching the docks — keep it quiet.',
    target: DOCKS,
    targetLabel: 'The Docks',
  },
  {
    title: 'Breakers on the Boardwalk',
    brief: 'The Breakers are shaking down Rosa’s friends on the boardwalk. Go down there and settle it. They will not talk first.',
    target: BOARDWALK,
    targetLabel: 'The Boardwalk',
  },
  {
    title: 'Taxi for Rosa',
    brief: 'Rosa’s best cabbie called in sick. Pick up the fare waiting at the plaza and get them to the marina — the meter is running and the clock is not kind.',
    target: PLAZA_POINT,
    targetLabel: 'The Plaza',
  },
  {
    title: 'The Courier Run',
    brief: 'Three parcels, three corners of Solmar, one afternoon. North Market, then East Flats, then the Hilltop. Rosa trusts you with the route — don’t trust the traffic.',
    target: COURIER_STOPS[0],
    targetLabel: 'North Market',
  },
  {
    title: 'Harbour Lights',
    brief: 'A gold Strider sits by the harbour pier, and its owner is not the careful type. The Breakers posted two runners to watch it. Take the car and bring it home to the garage.',
    target: MARINA,
    targetLabel: 'The Marina',
  },
  {
    title: 'The Solmar Score',
    brief: 'The big one. Hold up Solmar National Bank, then lose the heat and get to the hideout up north. Rosa says the vault is worth $2,500 to us.',
    target: BANK,
    targetLabel: 'Solmar National Bank',
  },
  {
    title: 'King of Solmar',
    brief: 'Marco Vane, the Breakers’ boss, is holding court at the docks with his whole crew. End it there — then shake five stars of heat and reach the hideout. After tonight, Solmar is yours.',
    target: DOCKS,
    targetLabel: 'The Docks',
  },
];

export const MISSION_COUNT = MISSION_DEFS.length;

/** A fresh mission record: no job started, nothing finished. */
export function makeMissions() {
  return {
    done: 0,
    active: false,
    index: 0,
    stage: 0,
    timer: 0,
    timeLeft: 0,
    timeLimit: 0,
    target: null,
    targetLabel: '',
    text: '',
    banner: '',
    bannerTimer: 0,
    stealCarId: 0,
  };
}

/** Start mission `index` (0-based) and set its first target. */
export function startMission(game, index) {
  const def = MISSION_DEFS[index];
  const missions = game.missions;
  missions.active = true;
  missions.index = index;
  missions.stage = 0;
  missions.timer = 0;
  missions.timeLeft = 0;
  missions.timeLimit = 0;
  missions.target = { x: def.target.x, y: def.target.y };
  missions.targetLabel = def.targetLabel;
  missions.text = def.brief;
  missions.banner = `Mission ${index + 1}: ${def.title}`;
  missions.bannerTimer = 4;
  missions.stealCarId = 0;
  game.audio.missionDone();
}

/** The objective line the HUD shows for the active mission. */
export function objectiveText(game) {
  const missions = game.missions;
  if (!missions.active) {
    if (missions.done >= MISSION_DEFS.length) return 'Story complete — Solmar is yours. Free roam: fares, packages, cars, cops.';
    return 'Press Enter to start the next job.';
  }
  const def = MISSION_DEFS[missions.index];
  if (missions.index === 1 && missions.stage === 0) return 'Steal a car — press E beside any car on the street.';
  if (missions.index === 1 && missions.stage === 1) return 'Bring the car to Marlowe Motors.';
  if (missions.index === 2 && missions.stage === 1) return 'Deliver the package to the Sunset Motel.';
  if (missions.index === 3 && missions.stage === 1) return `Deal with the Breakers — ${game.enemies.length} left.`;
  if (missions.index === 4 && missions.stage === 0) return 'Pick up the fare at the plaza.';
  if (missions.index === 4 && missions.stage === 1) return 'Get the fare to the marina — beat the clock!';
  if (missions.index === 5) {
    const stop = COURIER_STOPS[missions.stage];
    return `Courier stop ${missions.stage + 1} of 3 — ${stop.label}.`;
  }
  if (missions.index === 6 && missions.stage === 0) return 'Reach the marina — the gold Strider is by the pier.';
  if (missions.index === 6 && missions.stage === 1) return 'Take the Strider — the runners will not like it.';
  if (missions.index === 6 && missions.stage === 2) return 'Bring the Strider to Marlowe Motors.';
  if (missions.index === 7 && missions.stage === 1) return 'Hold up the bank — stay inside the marker.';
  if (missions.index === 7 && missions.stage === 2) return 'Lose the cops and reach the hideout up north.';
  if (missions.index === 8 && missions.stage === 1) return `End Marco Vane’s crew — ${game.enemies.length} left.`;
  if (missions.index === 8 && missions.stage === 2) return 'Lose five stars of heat and reach the hideout.';
  return `Go to ${missions.targetLabel}.`;
}

/** Pay out a finished mission and queue the next one. */
function finishMission(game) {
  const missions = game.missions;
  const reward = MONEY.missionReward[missions.index];
  game.player.money += reward;
  missions.done += 1;
  missions.active = false;
  missions.stage = 0;
  missions.timeLeft = 0;
  missions.timeLimit = 0;
  missions.banner = `Job done — $${reward} earned.`;
  missions.bannerTimer = 4;
  game.audio.missionDone();
  game.stats.missionsDone = missions.done;
  return reward;
}

/** Fail a timed mission: the job stays open and can be tried again. */
function failMission(game, reason) {
  const missions = game.missions;
  missions.active = false;
  missions.stage = 0;
  missions.timeLeft = 0;
  missions.timeLimit = 0;
  missions.banner = reason;
  missions.bannerTimer = 4;
}

/** True when the player (on foot or in a car) is within reach of the target. */
function atTarget(game, radius) {
  const player = game.player;
  const target = game.missions.target;
  return Math.hypot(player.x - target.x, player.y - target.y) < radius;
}

/** Advance the active mission by dt, watching its objectives. */
export function stepMissions(game, dt) {
  const missions = game.missions;
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
  if (!missions.active) return;
  const player = game.player;
  const index = missions.index;

  if (index === 0) {
    if (atTarget(game, 90)) finishMission(game);
    return;
  }
  if (index === 1) {
    if (missions.stage === 0) {
      if (player.inCar) {
        missions.stage = 1;
        missions.text = 'Bring the car to Marlowe Motors.';
      }
      return;
    }
    if (atTarget(game, 110) && player.inCar) finishMission(game);
    return;
  }
  if (index === 2) {
    if (missions.stage === 0) {
      if (atTarget(game, 90)) {
        missions.stage = 1;
        missions.target = { x: MOTEL.x, y: MOTEL.y };
        missions.targetLabel = 'Sunset Motel';
        missions.text = 'Deliver the package to the Sunset Motel.';
        addWanted(game, 1, 'Spotted at the docks');
      }
      return;
    }
    if (atTarget(game, 90)) finishMission(game);
    return;
  }
  if (index === 3) {
    if (missions.stage === 0) {
      if (atTarget(game, 160)) {
        missions.stage = 1;
        missions.text = 'Deal with the Breakers.';
        spawnEnemy(game, BOARDWALK.x - 160, BOARDWALK.y - 50, 'breaker');
        spawnEnemy(game, BOARDWALK.x - 80, BOARDWALK.y, 'breaker');
        spawnEnemy(game, BOARDWALK.x, BOARDWALK.y - 50, 'breaker');
        spawnEnemy(game, BOARDWALK.x + 80, BOARDWALK.y, 'breaker');
        spawnEnemy(game, BOARDWALK.x + 160, BOARDWALK.y - 40, 'brute');
      }
      return;
    }
    if (game.enemies.length === 0) finishMission(game);
    return;
  }
  if (index === 4) {
    if (missions.stage === 0) {
      if (atTarget(game, 90)) {
        missions.stage = 1;
        missions.target = { x: MARINA.x, y: MARINA.y };
        missions.targetLabel = 'The Marina';
        missions.text = 'Get the fare to the marina — beat the clock!';
        missions.timeLimit = TAXI.fareSeconds;
        missions.timeLeft = TAXI.fareSeconds;
      }
      return;
    }
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      failMission(game, 'The fare walked away — press Enter to try again.');
      return;
    }
    if (atTarget(game, 100)) finishMission(game);
    return;
  }
  if (index === 5) {
    if (atTarget(game, 100)) {
      missions.stage += 1;
      if (missions.stage >= COURIER_STOPS.length) {
        finishMission(game);
        return;
      }
      const next = COURIER_STOPS[missions.stage];
      missions.target = { x: next.x, y: next.y };
      missions.targetLabel = next.label;
      missions.text = `Next stop: ${next.label}.`;
    }
    return;
  }
  if (index === 6) {
    if (missions.stage === 0) {
      if (atTarget(game, 140)) {
        missions.stage = 1;
        missions.text = 'Take the Strider — the runners will not like it.';
        const strider = makeCar(game.random, MARINA.x - 40, MARINA.y + 30, Math.PI / 2, 'parked');
        strider.model = 'Strider';
        strider.color = '#f2c94c';
        strider.top = 1.12;
        strider.accel = 1.1;
        game.cars.push(strider);
        missions.stealCarId = strider.id;
        spawnEnemy(game, MARINA.x + 60, MARINA.y - 60, 'runner');
        spawnEnemy(game, MARINA.x + 120, MARINA.y + 40, 'runner');
      }
      return;
    }
    if (missions.stage === 1) {
      const car = playerCar(game);
      if (car && car.id === missions.stealCarId) {
        missions.stage = 2;
        missions.target = { x: GARAGE.x, y: GARAGE.y };
        missions.targetLabel = 'Marlowe Motors';
        missions.text = 'Bring the Strider to Marlowe Motors.';
        addWanted(game, 2, 'Grand theft Strider');
      }
      return;
    }
    if (atTarget(game, 110) && player.inCar) finishMission(game);
    return;
  }
  if (index === 7) {
    if (missions.stage === 0) {
      if (atTarget(game, 120)) {
        missions.stage = 1;
        missions.timer = 0;
        missions.text = 'Hold up the bank — stay inside the marker.';
      }
      return;
    }
    if (missions.stage === 1) {
      if (atTarget(game, 130)) {
        missions.timer += dt;
        if (missions.timer >= 8) {
          missions.stage = 2;
          missions.target = { x: HIDEOUT.x, y: HIDEOUT.y };
          missions.targetLabel = 'The Hideout';
          missions.text = 'Lose the cops and reach the hideout.';
          addWanted(game, 3, 'Bank robbery');
        }
      } else {
        missions.timer = Math.max(0, missions.timer - dt * 2);
      }
      return;
    }
    if (atTarget(game, 110) && game.crime.wanted === 0) finishMission(game);
    return;
  }
  if (index === 8) {
    if (missions.stage === 0) {
      if (atTarget(game, 160)) {
        missions.stage = 1;
        missions.text = 'End Marco Vane’s crew.';
        spawnEnemy(game, DOCKS.x - 160, DOCKS.y - 60, 'breaker');
        spawnEnemy(game, DOCKS.x - 80, DOCKS.y + 40, 'breaker');
        spawnEnemy(game, DOCKS.x, DOCKS.y - 60, 'runner');
        spawnEnemy(game, DOCKS.x + 80, DOCKS.y + 30, 'runner');
        spawnEnemy(game, DOCKS.x + 160, DOCKS.y - 40, 'brute');
        spawnEnemy(game, DOCKS.x + 40, DOCKS.y - 100, 'brute');
      }
      return;
    }
    if (missions.stage === 1) {
      if (game.enemies.length === 0) {
        missions.stage = 2;
        missions.target = { x: HIDEOUT.x, y: HIDEOUT.y };
        missions.targetLabel = 'The Hideout';
        missions.text = 'Lose the heat and reach the hideout.';
        addWanted(game, 5, 'Marco Vane is down');
      }
      return;
    }
    if (atTarget(game, 110) && game.crime.wanted === 0) finishMission(game);
  }
}
