// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh game for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame. The
// autopilot drives along the roads toward a waypoint, and in the chase and
// mission scenes the wanted level and the enemies are set up first, so the
// screenshot shows the systems working.
import { STEP } from './config.js';
import { startMission } from './missions.js';
import { enterCar, playerCar } from './player.js';
import { stepCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 14;
const CHASE_SECONDS = 12;
const MISSION_SECONDS = 10;

/** Steer a car toward (x, y) and keep it on the road. */
function driveToward(game, car, target, dt) {
  const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  stepCar(car, dt, 0.9, steer, false);
}

/** Run the game forward for `seconds`, driving the player's car if any. */
function simulate(game, seconds, driveTarget) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = playerCar(game);
    if (car && driveTarget) driveToward(game, car, driveTarget, STEP);
    // Step the world without input: traffic, police, combat, missions.
    game.time += STEP;
    const { stepTraffic } = trafficModule;
    stepTraffic(game, STEP);
    policeModule.stepPolice(game, STEP);
    policeModule.coolWanted(game, STEP);
    combatModule.stepCombat(game, STEP);
    missionsModule.stepMissions(game, STEP);
    const driven = playerCar(game);
    if (driven) {
      game.player.x = driven.x;
      game.player.y = driven.y;
      game.player.angle = driven.angle;
    }
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
  }
}

// The traffic, police, combat and mission modules are imported below the
// simulate helper: ES module imports are hoisted, so they are available
// when simulate runs, and this keeps the staging logic at the top of the file.
import * as trafficModule from './traffic.js';
import * as policeModule from './police.js';
import * as combatModule from './combat.js';
import * as missionsModule from './missions.js';

/**
 * Set `game` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name === 'drive') {
    const car = game.cars.find((c) => c.model === 'Comet' && c.kind === 'parked');
    if (car) enterCar(game, car);
    simulate(game, DRIVE_SECONDS, { x: 1680, y: 1020 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    const car = game.cars.find((c) => c.model === 'Comet' && c.kind === 'parked');
    if (car) enterCar(game, car);
    game.crime.wanted = 3;
    game.crime.message = 'Bank robbery — wanted level 3';
    game.crime.messageTimer = 10;
    simulate(game, CHASE_SECONDS, { x: 2160, y: 1420 });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(game, 3);
    game.player.x = 1560;
    game.player.y = 2180;
    game.player.health = 100;
    game.camera.x = 1560;
    game.camera.y = 2180;
    // Walk Dani onto the boardwalk so the Breakers spawn, then let the
    // fight run a few seconds with shots in the air.
    simulate(game, 2, null);
    game.missions.bannerTimer = 0;
    simulate(game, MISSION_SECONDS, null);
    // The staged fight must not leave Dani down: the screenshot shows the
    // fight in progress, not its ending.
    if (game.player.health < 40) game.player.health = 100;
    return { screen: SCREEN_PLAY };
  }
  // start: the title screen over a living street, Dani on foot by a car.
  simulate(game, START_SECONDS, null);
  return { screen: SCREEN_TITLE };
}
