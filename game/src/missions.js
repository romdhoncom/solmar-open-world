// Solmar's story: five jobs for Dani Vega, fresh off the bus with $150 and
// a phone number for Rosa Marlowe, who runs Marlowe Motors. Each mission is
// a small state machine: a target to reach, a thing to do there, and a
// payout when it is done. Finishing one starts the next; finishing all five
// makes Dani the name on the street.
import { MONEY } from './config.js';
import { spawnEnemy } from './combat.js';
import { addWanted } from './police.js';

export const GARAGE = { x: 1200, y: 1000 };
export const BANK = { x: 1680, y: 1420 };
export const DOCKS = { x: 2880, y: 1560 };
export const MOTEL = { x: 620, y: 2180 };
export const HIDEOUT = { x: 260, y: 240 };
export const BOARDWALK = { x: 1560, y: 2310 };

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
    title: 'The Solmar Score',
    brief: 'The big one. Hold up Solmar National Bank, then lose the heat and get to the hideout up north. Rosa says the vault is worth $2,500 to us.',
    target: BANK,
    targetLabel: 'Solmar National Bank',
  },
];

/** A fresh mission record: no job started, nothing finished. */
export function makeMissions() {
  return {
    done: 0,
    active: false,
    index: 0,
    stage: 0,
    timer: 0,
    target: null,
    targetLabel: '',
    text: '',
    banner: '',
    bannerTimer: 0,
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
  missions.target = { x: def.target.x, y: def.target.y };
  missions.targetLabel = def.targetLabel;
  missions.text = def.brief;
  missions.banner = `Mission ${index + 1}: ${def.title}`;
  missions.bannerTimer = 4;
  game.audio.missionDone();
}

/** The objective line the HUD shows for the active mission. */
export function objectiveText(game) {
  const missions = game.missions;
  if (!missions.active) {
    if (missions.done >= MISSION_DEFS.length) return 'Story complete — Solmar is yours. Free roam: steal cars, dodge the cops, collect cash.';
    return 'Press Enter to start the next job.';
  }
  const def = MISSION_DEFS[missions.index];
  if (missions.index === 1 && missions.stage === 0) return 'Steal a car — press E beside any car on the street.';
  if (missions.index === 1 && missions.stage === 1) return 'Bring the car to Marlowe Motors.';
  if (missions.index === 2 && missions.stage === 1) return 'Deliver the package to the Sunset Motel.';
  if (missions.index === 3 && missions.stage === 1) return `Deal with the Breakers — ${game.enemies.length} left.`;
  if (missions.index === 4 && missions.stage === 1) return 'Hold up the bank — stay inside the marker.';
  if (missions.index === 4 && missions.stage === 2) return 'Lose the cops and reach the hideout up north.';
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
  missions.banner = `Job done — $${reward} earned.`;
  missions.bannerTimer = 4;
  game.audio.missionDone();
  game.stats.missionsDone = missions.done;
  return reward;
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

  if (missions.index === 0) {
    if (atTarget(game, 90)) finishMission(game);
    return;
  }
  if (missions.index === 1) {
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
  if (missions.index === 2) {
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
  if (missions.index === 3) {
    if (missions.stage === 0) {
      if (atTarget(game, 160)) {
        missions.stage = 1;
        missions.text = 'Deal with the Breakers.';
        for (let i = 0; i < 5; i += 1) {
          spawnEnemy(game, BOARDWALK.x - 160 + i * 80, BOARDWALK.y - 50 + (i % 2) * 50);
        }
      }
      return;
    }
    if (game.enemies.length === 0) finishMission(game);
    return;
  }
  if (missions.index === 4) {
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
  }
}
