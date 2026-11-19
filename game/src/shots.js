// The screenshot scenes behind ?shot=start|drive|chase|mission|walk.
// Each one plays the real rules forward from a fresh game for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same
// frame. The autopilot drives along the roads toward a waypoint, and in
// the chase and mission scenes the wanted level, the police and the
// enemies are set up first, so the screenshot shows the systems working:
// the chase frame carries four stars, a roadblock ahead and the bank-job
// escape objective on the HUD; the mission frame is the finale, with Dani
// shooting at Marco Vane's crew on the docks.
import { ROADS, STEP } from './config.js';
import { DOCKS, HIDEOUT, startMission } from './missions.js';
import { enterCar, playerCar } from './player.js';
import { makeBullet, spawnEnemy } from './combat.js';
import { makePoliceCar, stepCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import * as trafficModule from './traffic.js';
import * as policeModule from './police.js';
import * as combatModule from './combat.js';
import * as missionsModule from './missions.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 16;
const CHASE_SECONDS = 3;
const MISSION_SECONDS = 10;

function nearestVertical(x) {
  let best = ROADS.vertical[0];
  for (const vx of ROADS.vertical) {
    if (Math.abs(vx - x) < Math.abs(best - x)) best = vx;
  }
  return best;
}

function nearestHorizontal(y) {
  let best = ROADS.horizontal[0];
  for (const hy of ROADS.horizontal) {
    if (Math.abs(hy - y) < Math.abs(best - y)) best = hy;
  }
  return best;
}

/**
 * Steer a car toward (x, y) along the roads, not across the blocks: the
 * waypoint is the intersection on the way there, so the car stays on the
 * asphalt and turns at corners instead of cutting through parks.
 */
function driveToward(game, car, target, dt) {
  const tx = nearestVertical(target.x);
  const ty = nearestHorizontal(target.y);
  const vx = nearestVertical(car.x);
  const hy = nearestHorizontal(car.y);
  let waypoint;
  if (Math.abs(car.x - vx) < 40) {
    // On a vertical road: drive along it to the target's street, then turn.
    waypoint = { x: vx, y: ty };
  } else if (Math.abs(car.y - hy) < 40) {
    // On a horizontal road: drive along it to the target's avenue.
    waypoint = { x: tx, y: hy };
  } else {
    // Off the roads: head for the nearest intersection to get back on one.
    waypoint = { x: vx, y: hy };
  }
  const wantAngle = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  stepCar(car, dt, 0.9, steer, false);
}

/**
 * Run the game forward for `seconds`, driving the player's car if any.
 * `act` runs once per step, for scripted behaviour such as shooting.
 */
function simulate(game, seconds, driveTarget, act) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = playerCar(game);
    if (car && driveTarget) driveToward(game, car, driveTarget, STEP);
    if (act) act(game, i * STEP);
    // Step the world without input: traffic, police, combat, missions.
    game.time += STEP;
    trafficModule.stepTraffic(game, STEP);
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

/** Pick the nearest enemy to the player, or null when none are left. */
function nearestEnemy(game) {
  let nearest = null;
  let bestD = Infinity;
  for (const enemy of game.enemies) {
    const d = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
    if (d < bestD) {
      bestD = d;
      nearest = enemy;
    }
  }
  return nearest;
}

/**
 * Set `game` to the named scene (start, drive, chase or mission; any
 * other name is start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name === 'walk') {
    // The city on foot: Dani by the plaza, mission one running, the gold
    // marker pointing at Marlowe Motors, pedestrians and traffic going by.
    startMission(game, 0);
    game.player.x = 1300;
    game.player.y = 1250;
    game.player.angle = -Math.PI / 2;
    game.camera.x = 1300;
    game.camera.y = 1250;
    simulate(game, 4, null);
    game.missions.bannerTimer = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    const car = game.cars.find((c) => c.model === 'Comet' && c.kind === 'parked');
    if (car) enterCar(game, car);
    // A cross-city drive: past the plaza, down 4th Avenue, toward the
    // flats — and when the corner is reached, back across town, so the car
    // is still moving on a road when the frame is taken.
    const patrol = { x: 2160, y: 1820 };
    simulate(game, DRIVE_SECONDS, patrol, (g) => {
      const driven = playerCar(g);
      if (driven && Math.hypot(driven.x - patrol.x, driven.y - patrol.y) < 120) {
        patrol.x = patrol.x === 2160 ? 240 : 2160;
        patrol.y = patrol.y === 1820 ? 220 : 1820;
      }
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    const car = game.cars.find((c) => c.model === 'Comet' && c.kind === 'parked');
    if (car) enterCar(game, car);
    // The bank job, mid-escape: four stars, a roadblock ahead somewhere,
    // and the escape objective on the HUD. The fleeing car weaves across
    // town, so the police stay in the frame.
    startMission(game, 7);
    game.missions.stage = 2;
    game.missions.target = { x: HIDEOUT.x, y: HIDEOUT.y };
    game.missions.targetLabel = 'The Hideout';
    game.missions.text = 'Lose the cops and reach the hideout.';
    game.crime.wanted = 4;
    game.crime.message = 'Bank robbery — wanted level 4';
    game.crime.messageTimer = 10;
    // Four cruisers are already on Dani's tail, on the same road the
    // escape takes — three behind on 3rd Avenue, one waiting ahead on
    // 4th Street — so the chase is running, not still forming up.
    game.cars.push(makePoliceCar(1200, 800, Math.PI / 2));
    game.cars.push(makePoliceCar(1200, 640, Math.PI / 2));
    game.cars.push(makePoliceCar(1260, 950, Math.PI / 2));
    game.cars.push(makePoliceCar(1900, 1420, Math.PI));
    const patrol = { x: 2160, y: 1420 };
    simulate(game, CHASE_SECONDS, patrol, (g) => {
      const driven = playerCar(g);
      if (driven && Math.hypot(driven.x - patrol.x, driven.y - patrol.y) < 120) {
        // Inset corners, so the fleeing car turns around well inside the
        // city and the camera keeps it in the frame.
        patrol.x = patrol.x === 2160 ? 720 : 2160;
        patrol.y = patrol.y === 1420 ? 1020 : 1420;
      }
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // The finale: King of Solmar. Dani walks onto the docks, Marco Vane's
    // crew is already there, and the fight is running with shots in the
    // air. The crew is placed by hand so Dani can stand a little back
    // from the water, near the centre of the frame.
    startMission(game, 8);
    game.missions.stage = 1;
    game.missions.text = 'End Marco Vane’s crew.';
    spawnEnemy(game, DOCKS.x - 160, DOCKS.y - 60, 'breaker');
    spawnEnemy(game, DOCKS.x - 80, DOCKS.y + 40, 'breaker');
    spawnEnemy(game, DOCKS.x, DOCKS.y - 60, 'runner');
    spawnEnemy(game, DOCKS.x + 80, DOCKS.y + 30, 'runner');
    spawnEnemy(game, DOCKS.x + 160, DOCKS.y - 40, 'brute');
    spawnEnemy(game, DOCKS.x + 40, DOCKS.y - 100, 'brute');
    game.player.x = 2620;
    game.player.y = 1500;
    game.player.health = 100;
    game.camera.x = 2620;
    game.camera.y = 1500;
    simulate(game, 2, null);
    game.missions.bannerTimer = 0;
    let shotTimer = 0;
    simulate(game, MISSION_SECONDS, null, (g, t) => {
      // Dani fires at the nearest Breaker every quarter of a second, for
      // the first six seconds — enough for a live firefight, not enough
      // to finish the crew before the frame is taken.
      if (t > 6) return;
      shotTimer -= STEP;
      if (shotTimer > 0 || g.enemies.length === 0) return;
      shotTimer = 0.25;
      const target = nearestEnemy(g);
      if (!target) return;
      const angle = Math.atan2(target.y - g.player.y, target.x - g.player.x);
      g.player.angle = angle;
      g.bullets.push(makeBullet(
        g.player.x + Math.cos(angle) * 22,
        g.player.y + Math.sin(angle) * 22,
        angle,
        true,
      ));
    });
    // The staged fight must not leave Dani down: the screenshot shows
    // the fight in progress, not its ending.
    if (game.player.health < 40) game.player.health = 100;
    // Aim the crosshair at the nearest Breaker, so it sits on the fight.
    const target = nearestEnemy(game);
    if (target) {
      const vx = Math.max(0, Math.min(3200 - 1280, game.camera.x - 640));
      const vy = Math.max(0, Math.min(2400 - 720, game.camera.y - 360));
      game.aimScreen = { x: target.x - vx, y: target.y - vy };
    }
    return { screen: SCREEN_PLAY };
  }
  // start: the title screen over a living street, Dani on foot by a car.
  simulate(game, START_SECONDS, null);
  return { screen: SCREEN_TITLE };
}
