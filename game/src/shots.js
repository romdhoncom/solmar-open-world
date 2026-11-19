// Screenshot staging: each shot drives the game into one fixed scene,
// deterministically, so the headless driver can capture the same frame
// every run. The scenes are the four the entry is judged on: a chase,
// the player on foot, a drive, and the finale fight.

import { LANDMARKS } from './config.js';
import { CAR_MODELS, makeCar } from './vehicles.js';
import { POLICE_MODEL } from './police.js';
import { startMission, spawnCrew, showBanner } from './missions.js';
import { addWanted } from './police.js';
import { spawnPickup } from './combat.js';

export const SHOT_NAMES = ['chase', 'walk', 'drive', 'mission'];

// How many fixed frames each scene simulates before the capture.
export const SHOT_FRAMES = { chase: 90, walk: 30, drive: 90, mission: 24 };

function putPlayerInCar(G, modelName, x, y, angle, speed) {
  const model = CAR_MODELS.find((m) => m.name === modelName);
  const car = makeCar(model, x, y, angle, 'player');
  car.speed = speed;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

/** Drive the game into the named scene. */
export function applyShot(G, name) {
  G.mode = 'playing';
  if (name === 'chase') {
    // The bank-job escape: four stars, two cruisers on the tail, the
    // hideout as the objective, the player barrelling down the road.
    startMission(G, 7);
    G.missions.stage = 'escape';
    addWanted(G, 4);
    showBanner(G, 'Mission 8: The Solmar Score', 'Escape the 4-star chase to the hideout.');
    putPlayerInCar(G, 'Comet', 2200, 2000, Math.PI / 2, 560);
    const tail1 = makeCar(POLICE_MODEL, 2200, 1910, Math.PI / 2, 'police');
    tail1.speed = 600;
    const tail2 = makeCar(POLICE_MODEL, 2200, 1840, Math.PI / 2, 'police');
    tail2.speed = 580;
    G.police.cruisers.push(tail1, tail2);
    G.shotDrive = { forward: true, back: false, left: false, right: false };
  } else if (name === 'walk') {
    // Dani on foot by the plaza fountain, mission one pointing at the
    // garage, pedestrians and traffic going about their day.
    startMission(G, 0);
    G.player.x = 2600;
    G.player.y = 2140;
    G.shotAim = { x: LANDMARKS.fountain.x, y: LANDMARKS.fountain.y };
    const near = G.peds.slice(0, 4);
    const spots = [[2500, 2120], [2700, 2060], [2550, 2160], [2680, 2140]];
    near.forEach((ped, i) => {
      ped.x = spots[i][0];
      ped.y = spots[i][1];
      ped.flee = 0;
    });
    // Traffic on the roads flanking the plaza, for life in the frame.
    const flank = G.cars.filter((c) => c.owner === 'traffic').slice(0, 2);
    const lanes = [[2200, 1900, Math.PI / 2, 1], [3000, 2100, -Math.PI / 2, -1]];
    flank.forEach((car, i) => {
      car.axis = 'v';
      car.line = lanes[i][0];
      car.x = lanes[i][0];
      car.y = lanes[i][1];
      car.angle = lanes[i][2];
      car.dir = lanes[i][3];
      car.speed = 170;
    });
  } else if (name === 'drive') {
    // A cross-city drive at speed: traffic ahead, a package and a cash
    // pickup sitting by the road in frame.
    startMission(G, 1);
    putPlayerInCar(G, 'Comet', 2400, 1700, 0, 550);
    const ahead = G.cars.filter((c) => c.owner === 'traffic').slice(0, 3);
    const lanes = [[2620, 1700, 0], [2900, 1700, 0], [3150, 1748, Math.PI]];
    ahead.forEach((car, i) => {
      car.axis = 'h';
      car.line = 1700;
      car.x = lanes[i][0];
      car.y = lanes[i][1];
      car.angle = lanes[i][2];
      car.dir = car.angle === 0 ? 1 : -1;
      car.speed = 180;
    });
    if (G.sidejobs.packages[0]) {
      G.sidejobs.packages[0].x = 3560;
      G.sidejobs.packages[0].y = 1760;
    }
    spawnPickup(G, 'cash', 3500, 1760);
    G.shotDrive = { forward: true, back: false, left: false, right: false };
  } else if (name === 'mission') {
    // The finale: Dani on the docks, shooting at Marco Vane's crew,
    // one already down, the crosshair on the nearest Breaker.
    startMission(G, 8);
    if (G.crew[0]) G.crew[0].alive = false;
    G.player.x = 4080;
    G.player.y = 900;
    const nearest = G.crew.filter((f) => f.alive).sort((a, b) => {
      return Math.hypot(a.x - G.player.x, a.y - G.player.y) - Math.hypot(b.x - G.player.x, b.y - G.player.y);
    })[0];
    if (nearest) {
      G.shotAim = { x: nearest.x, y: nearest.y };
      G.input.mouse.down = true;
    }
  }
}
