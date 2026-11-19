// Solmar's simulation: one game state and one step. createGame builds
// the city, the streets and Dani; stepGame advances everything by one
// fixed step — the player or their car, the traffic, the police, the
// combat, the missions, the side jobs and the wanted level — and reports
// what happened as events the loop reacts to (busted, wasted). Nothing
// here draws.
import { CAR, COMBAT, MONEY, WORLD } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings, hitsBuilding, paintCity } from './world.js';
import { createAudio } from './audio.js';
import { makeCrime, applyBusted, applyWasted, coolWanted, stepPolice } from './police.js';
import { makePlayer, stepPlayerOnFoot, nearestCarToEnter, enterCar, exitCar, playerCar, playerPunch } from './player.js';
import { makeCar, resetCarIds, scatterParkedCars, stepCar, damageCar, repairCar } from './vehicles.js';
import { populateStreets, scatterPeds, stepTraffic } from './traffic.js';
import { playerShoot, stepCombat } from './combat.js';
import { MISSION_COUNT, GARAGE, makeMissions, objectiveText, startMission, stepMissions } from './missions.js';
import { makeSideJobs, stepSideJobs } from './sidejobs.js';
import { stepRank } from './rank.js';
import { readSave, writeSave } from './save.js';

export const EVENT_NONE = 0;

/** Build a fresh game from a seed. `saved` is a save record to resume, or null. */
export function createGame(seed, saved) {
  const random = createRandom(seed);
  resetCarIds();
  const city = buildCity(random);
  const game = {
    seed,
    random,
    city,
    cityCanvas: paintCity(city),
    time: 0,
    audio: createAudio(),
    player: makePlayer(),
    crime: makeCrime(),
    missions: makeMissions(),
    sidejobs: null,
    rank: { index: 0 },
    cars: [],
    peds: [],
    officers: [],
    enemies: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    camera: { x: 1200, y: 1080 },
    aimWorld: { x: 1200, y: 1000 },
    aimScreen: { x: 640, y: 300 },
    events: [],
    stats: { carsStolen: 0, kills: 0, missionsDone: 0, faresDone: 0 },
    shake: 0,
    heli: null,
    sunsetSpawned: false,
    celebrated: false,
    lastSavedMissions: 0,
    hasSave: !!saved,
  };
  game.sidejobs = makeSideJobs(game);
  populateStreets(game);
  // Parked cars along the roads, and a starter Comet outside the garage.
  const parked = scatterParkedCars(random, city);
  game.cars.push(...parked);
  const starter = makeCar(random, 1230, 1080, -Math.PI / 2, 'parked');
  starter.color = '#3d7ac9';
  starter.model = 'Comet';
  game.cars.push(starter);
  // Cash pickups scattered around the city.
  for (let i = 0; i < 10; i += 1) {
    game.pickups.push({
      x: 200 + random() * (WORLD.width - 400),
      y: 200 + random() * (WORLD.height - 400),
      kind: 'cash',
      amount: MONEY.pickup,
      life: 120,
    });
  }
  if (saved) {
    game.player.money = saved.money;
    game.player.x = saved.playerX;
    game.player.y = saved.playerY;
    game.player.health = saved.health;
    game.missions.done = saved.missionsDone;
    game.stats.carsStolen = saved.carsStolen || 0;
    game.stats.missionsDone = saved.missionsDone;
    game.stats.kills = saved.kills || 0;
    game.sidejobs.packagesFound = saved.packagesFound || 0;
    game.sidejobs.faresDone = saved.faresDone || 0;
    game.stats.faresDone = saved.faresDone || 0;
    game.lastSavedMissions = saved.missionsDone;
    game.camera.x = saved.playerX;
    game.camera.y = saved.playerY;
  }
  return game;
}

/** Read the save on this browser, if there is one. */
export function loadSave() {
  return readSave();
}

/** Write the current progress to this browser's storage. */
export function saveGame(game) {
  return writeSave(game);
}

/** The car the player is driving, or null. */
export function drivenCar(game) {
  return playerCar(game);
}

/** Step the player's car: throttle, steering, handbrake skids, the horn, crashes. */
function stepDrivenCar(game, car, input, dt, actions) {
  const player = game.player;
  const move = input.move();
  const throttle = move.y === 0 ? 0 : -move.y;
  stepCar(car, dt, throttle, move.x, input.braking());
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  // Handbrake at speed: skid marks, smoke and a screech.
  if (input.braking() && Math.abs(car.speed) > 200) {
    game.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 2.2, max: 2.2 });
    if (game.random() < dt * 20) {
      game.particles.push({
        x: car.x - Math.cos(car.angle) * 30,
        y: car.y - Math.sin(car.angle) * 30,
        vx: 0,
        vy: -20,
        life: 0.4,
        max: 0.4,
        color: '#9a9a9a',
        size: 7,
      });
    }
    game.audio.skid(dt, true);
  } else {
    game.audio.skid(dt, false);
  }
  // The horn: a honk, and the pedestrians nearby get out of the way.
  if (actions & 64) {
    game.audio.honk();
    scatterPeds(game, car.x, car.y, 200);
  }
  // Hitting a building at speed costs speed, dents the car and sparks.
  if (hitsBuilding(game.city, car.x, car.y, CAR.length / 2)) {
    const hard = Math.abs(car.speed) > 200;
    car.speed *= 0.6;
    car.x -= Math.cos(car.angle) * 12;
    car.y -= Math.sin(car.angle) * 12;
    if (hard) {
      damageCar(car, 0.09);
      game.shake = Math.max(game.shake, 6);
      for (let i = 0; i < 6; i += 1) {
        const a = game.random() * Math.PI * 2;
        game.particles.push({
          x: car.x,
          y: car.y,
          vx: Math.cos(a) * 160,
          vy: Math.sin(a) * 160,
          life: 0.25,
          max: 0.25,
          color: '#ffd76b',
          size: 4,
        });
      }
    }
    if (Math.abs(car.speed) > 200 && game.random() < dt * 6) game.audio.crash();
  }
  // Bump into other cars: push apart, lose speed, dent both.
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < CAR.length * 0.8 && d > 0) {
      const push = (CAR.length * 0.8 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      car.speed *= 0.85;
      other.speed *= 0.85;
      if (Math.abs(car.speed) > 150) {
        damageCar(car, 0.04);
        damageCar(other, 0.04);
        game.shake = Math.max(game.shake, 4);
        game.audio.crash();
      }
    }
  }
  // Running over a pedestrian is a crime the whole street sees.
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      game.crime.wanted = Math.min(5, game.crime.wanted + 1);
      game.crime.quietTimer = 0;
      game.crime.message = 'You hit a pedestrian — wanted level ' + game.crime.wanted;
      game.crime.messageTimer = 4;
      scatterPeds(game, ped.x, ped.y, 300);
    }
  }
  // Marlowe Motors fixes the car while it sits by the garage.
  if (Math.hypot(car.x - GARAGE.x, car.y - GARAGE.y) < 140 && Math.abs(car.speed) < 10) {
    repairCar(car, 0.12 * dt);
  }
  if (actions & 1) exitCar(game);
}

/** Step the player on foot: walk, shoot, punch, reload, enter a car. */
function stepOnFoot(game, input, dt, actions) {
  const player = game.player;
  const move = input.move();
  const aimAngle = Math.atan2(game.aimWorld.y - player.y, game.aimWorld.x - player.x);
  stepPlayerOnFoot(game, dt, move, input.running(), aimAngle);
  if (input.firing()) {
    if (playerShoot(game, game.aimWorld.x, game.aimWorld.y)) {
      scatterPeds(game, player.x, player.y, 320);
      if (game.crime.wanted < 1) {
        game.crime.wanted = 1;
        game.crime.quietTimer = 0;
        game.crime.message = 'Shots fired — the cops are coming';
        game.crime.messageTimer = 4;
      }
    }
  }
  if (actions & 32) playerPunch(game);
  if (actions & 16) {
    if (player.ammo < 12 && player.reserveAmmo > 0 && player.reloadTimer <= 0) {
      player.reloadTimer = COMBAT.reloadSeconds;
    }
  }
  if (actions & 1) {
    const near = nearestCarToEnter(game);
    if (near) enterCar(game, near);
  }
}

/**
 * One fixed step of the simulation. `input` is the input device, `view`
 * the renderer's view (for turning the mouse into a world point). The
 * screen is always play here; the loop owns the menus.
 */
export function stepGame(game, input, view, dt) {
  game.time += dt;
  const player = game.player;
  const actions = input.takeActions();

  if (actions & 8) game.audio.toggleMute();
  if (actions & 2) return { pause: true };

  // Aim: the mouse in view space becomes a point in the world.
  const mouse = input.mouse();
  const scale = view.scale;
  const ratio = window.devicePixelRatio || 1;
  const viewX = (mouse.x - view.x / ratio) / scale;
  const viewY = (mouse.y - view.y / ratio) / scale;
  game.aimScreen = { x: viewX, y: viewY };
  const camera = game.camera;
  const vx = Math.max(0, Math.min(WORLD.width - 1280, camera.x - 640));
  const vy = Math.max(0, Math.min(WORLD.height - 720, camera.y - 360));
  game.aimWorld = { x: vx + viewX, y: vy + viewY };

  // Enter starts the next job when none is running.
  if (!game.missions.active && game.missions.done < MISSION_COUNT && (actions & 4)) {
    startMission(game, game.missions.done);
  }

  const car = drivenCar(game);
  if (car) stepDrivenCar(game, car, input, dt, actions);
  else stepOnFoot(game, input, dt, actions);

  // Pickups: walk or drive over cash or ammo to collect it.
  for (const pickup of game.pickups) {
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 34) {
      pickup.taken = true;
      if (pickup.kind === 'ammo') {
        player.reserveAmmo += pickup.amount;
        game.audio.pickup();
      } else {
        player.money += pickup.amount;
        game.audio.cash();
      }
    }
    pickup.life -= dt;
  }
  game.pickups = game.pickups.filter((p) => !p.taken && p.life > 0);
  if (game.pickups.length < 6 && game.random() < dt * 0.1) {
    game.pickups.push({
      x: 200 + game.random() * (WORLD.width - 400),
      y: 200 + game.random() * (WORLD.height - 400),
      kind: 'cash',
      amount: MONEY.pickup,
      life: 120,
    });
  }

  stepTraffic(game, dt);
  stepPolice(game, dt);
  coolWanted(game, dt);
  stepCombat(game, dt);
  stepMissions(game, dt);
  stepSideJobs(game, dt);
  stepRank(game);

  // Save whenever a story job is finished.
  if (game.missions.done > game.lastSavedMissions) {
    game.lastSavedMissions = game.missions.done;
    saveGame(game);
  }

  // Skid marks fade, and the camera shake settles.
  for (const skid of game.skids) skid.life -= dt;
  game.skids = game.skids.filter((s) => s.life > 0);
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 22);

  // The camera eases toward the player, looking a little ahead when driving.
  const driven = drivenCar(game);
  const lookX = driven ? Math.cos(driven.angle) * 90 : 0;
  const lookY = driven ? Math.sin(driven.angle) * 90 : 0;
  camera.x += (player.x + lookX - camera.x) * Math.min(1, 5 * dt);
  camera.y += (player.y + lookY - camera.y) * Math.min(1, 5 * dt);

  // Audio follows the drive.
  game.audio.engine(driven ? Math.min(1, Math.abs(driven.speed) / 560) : 0, !!driven);
  const policeNear = game.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - player.x, c.y - player.y) < 600);
  game.audio.siren(dt, policeNear);
  game.audio.music(dt);

  // Events the loop must act on.
  const events = game.events.splice(0);
  for (const event of events) {
    if (event.type === 'busted') applyBusted(game);
    if (event.type === 'wasted') applyWasted(game);
  }
  return { pause: false, events };
}

export { objectiveText };
