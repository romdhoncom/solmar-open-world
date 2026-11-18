// Solmar's simulation: one game state and one step. createGame builds the
// city, the streets and Dani; stepGame advances everything by one fixed
// step — the player or their car, the traffic, the police, the combat, the
// missions and the wanted level — and reports what happened as events the
// loop reacts to (busted, wasted, mission started). Nothing here draws.
import { CAR, COMBAT, MONEY, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings, hitsBuilding, paintCity } from './world.js';
import { createAudio } from './audio.js';
import { makeCrime, applyBusted, applyWasted, coolWanted, stepPolice } from './police.js';
import { makePlayer, stepPlayerOnFoot, nearestCarToEnter, enterCar, exitCar, playerCar } from './player.js';
import { makeCar, resetCarIds, scatterParkedCars, stepCar } from './vehicles.js';
import { populateStreets, scatterPeds, stepTraffic } from './traffic.js';
import { playerShoot, stepCombat } from './combat.js';
import { makeMissions, objectiveText, startMission, stepMissions } from './missions.js';
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
    cars: [],
    peds: [],
    officers: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    camera: { x: 1200, y: 1080 },
    aimWorld: { x: 1200, y: 1000 },
    aimScreen: { x: 640, y: 300 },
    events: [],
    stats: { carsStolen: 0, kills: 0, missionsDone: 0 },
    hasSave: !!saved,
  };
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

/**
 * One fixed step of the simulation. `input` is the input device, `view` the
 * renderer's view (for turning the mouse into a world point). The screen is
 * always play here; the loop owns the menus.
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
  if (!game.missions.active && game.missions.done < 5 && (actions & 4)) {
    startMission(game, game.missions.done);
  }

  const move = input.move();
  const car = drivenCar(game);

  if (car) {
    const throttle = move.y === 0 ? 0 : -move.y;
    const steer = move.x;
    stepCar(car, dt, throttle, steer, input.braking());
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Hitting a building or a car at speed costs speed and sparks.
    if (hitsBuilding(game.city, car.x, car.y, CAR.length / 2)) {
      car.speed *= 0.6;
      car.x -= Math.cos(car.angle) * 12;
      car.y -= Math.sin(car.angle) * 12;
      if (Math.abs(car.speed) > 200 && game.random() < dt * 6) game.audio.crash();
    }
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
        if (Math.abs(car.speed) > 150) game.audio.crash();
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
    if (actions & 1) exitCar(game);
  } else {
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

  // Pickups: walk or drive over cash to collect it.
  for (const pickup of game.pickups) {
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 34) {
      pickup.taken = true;
      player.money += pickup.amount;
      game.audio.cash();
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

  // The camera eases toward the player, looking a little ahead when driving.
  const lookX = car ? Math.cos(car.angle) * 90 : 0;
  const lookY = car ? Math.sin(car.angle) * 90 : 0;
  camera.x += (player.x + lookX - camera.x) * Math.min(1, 5 * dt);
  camera.y += (player.y + lookY - camera.y) * Math.min(1, 5 * dt);

  // Audio follows the drive.
  const driven = drivenCar(game);
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
