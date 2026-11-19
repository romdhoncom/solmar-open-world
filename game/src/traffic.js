// Solmar's streets, alive: traffic cars that drive the road grid, yellow
// taxis that work the same roads, and pedestrians who stroll the sidewalks.
// Traffic cars pick a road, drive along it, and turn at intersections;
// pedestrians walk beside a road and turn at its ends. Neither knows about
// the player — they only slow down for the car ahead of them and scatter
// when a gun goes off.
import { CAR, PED_COUNT, ROADS, TRAFFIC_COUNT, WORLD } from './config.js';
import { pick, range } from './random.js';
import { makeCar, stepCar } from './vehicles.js';
import { nearestRoadPoint, randomIntersection } from './world.js';

const PED_COLORS = ['#e8e3d0', '#d9a05a', '#7a9ac9', '#c97a8a', '#8ac97a', '#b09ac9'];

/** A fresh traffic car on a random road, already moving. */
function spawnTrafficCar(game) {
  const random = game.random;
  const point = randomIntersection(random);
  const vertical = random() < 0.5;
  const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
  const car = makeCar(random, point.x, point.y, angle, 'traffic');
  car.wasTraffic = true;
  car.speed = range(random, 120, 200);
  car.cruise = car.speed;
  return car;
}

/** A yellow taxi, working the same roads as the traffic around it. */
function spawnTaxi(game) {
  const car = spawnTrafficCar(game);
  car.taxi = true;
  car.color = '#f2c94c';
  car.model = 'Cab';
  return car;
}

/** A fresh pedestrian on a sidewalk beside a road. */
function spawnPed(game) {
  const random = game.random;
  const point = randomIntersection(random);
  const vertical = random() < 0.5;
  const side = random() < 0.5 ? 1 : -1;
  return {
    x: vertical ? point.x + side * (ROADS.width / 2 + 14) : point.x + range(random, -200, 200),
    y: vertical ? point.y + range(random, -200, 200) : point.y + side * (ROADS.width / 2 + 14),
    angle: random() * Math.PI * 2,
    speed: range(random, 34, 62),
    color: pick(random, PED_COLORS),
    axis: vertical ? 'v' : 'h',
    dir: random() < 0.5 ? 1 : -1,
    flee: 0,
    dead: false,
  };
}

/** Fill the streets with traffic, taxis and pedestrians. */
export function populateStreets(game) {
  game.cars = [];
  game.peds = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    game.cars.push(i % 7 === 3 ? spawnTaxi(game) : spawnTrafficCar(game));
  }
  for (let i = 0; i < PED_COUNT; i += 1) game.peds.push(spawnPed(game));
}

/**
 * Drive one traffic car: keep to its road, slow for the car ahead, and at
 * an intersection sometimes turn onto the crossing road.
 */
function stepTrafficCar(game, car, dt) {
  const random = game.random;
  // Slow down when another car is close ahead.
  let ahead = Infinity;
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 130 && side < 40) ahead = Math.min(ahead, forward);
  }
  let throttle = 0.55;
  if (ahead < 90) throttle = 0;
  if (ahead < 45) throttle = -0.6;
  // Steer back onto the road centre line.
  const road = nearestRoadPoint(car.x, car.y);
  const wantAngle = road.axis === 'v'
    ? (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2)
    : (Math.cos(car.angle) >= 0 ? 0 : Math.PI);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let steer = Math.max(-1, Math.min(1, diff * 2));
  // At an intersection, sometimes turn.
  const nearX = ROADS.vertical.some((vx) => Math.abs(car.x - vx) < 26);
  const nearY = ROADS.horizontal.some((hy) => Math.abs(car.y - hy) < 26);
  if (nearX && nearY && random() < dt * 0.35) {
    const turnTo = road.axis === 'v' ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    car.angle = turnTo;
  }
  stepCar(car, dt, throttle, steer, false);
  // Keep the car on the road: nudge it back toward the centre line.
  const after = nearestRoadPoint(car.x, car.y);
  if (after.axis === 'v') car.x += (after.x - car.x) * Math.min(1, 1.6 * dt);
  else car.y += (after.y - car.y) * Math.min(1, 1.6 * dt);
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
}

/** Walk one pedestrian along its sidewalk, fleeing from gunfire. */
function stepPed(game, ped, dt) {
  if (ped.flee > 0) {
    ped.flee -= dt;
    ped.x += Math.cos(ped.angle) * 150 * dt;
    ped.y += Math.sin(ped.angle) * 150 * dt;
  } else {
    if (ped.axis === 'v') ped.y += ped.dir * ped.speed * dt;
    else ped.x += ped.dir * ped.speed * dt;
  }
  if (ped.x < 60 || ped.x > WORLD.width - 60 || ped.y < 60 || ped.y > WORLD.height - 60) {
    ped.dir *= -1;
    ped.angle = Math.atan2(ped.dir * (ped.axis === 'v' ? 1 : 0), ped.dir * (ped.axis === 'h' ? 1 : 0));
  }
  // Turn around at random, so the crowd never marches in lockstep.
  if (game.random() < dt * 0.02) ped.dir *= -1;
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.height - 30, ped.y));
}

/** Advance all traffic and pedestrians by dt. */
export function stepTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    stepTrafficCar(game, car, dt);
  }
  for (const ped of game.peds) {
    if (!ped.dead) stepPed(game, ped, dt);
  }
  // Keep the streets full: replace traffic that left the map or was wrecked.
  const alive = game.cars.filter((c) => c.kind === 'traffic' && !c.dead).length;
  if (alive < TRAFFIC_COUNT && game.random() < dt * 0.5) {
    const car = spawnTrafficCar(game);
    const player = game.player;
    if (Math.hypot(car.x - player.x, car.y - player.y) > 700) game.cars.push(car);
  }
}

/** Every pedestrian near (x, y) runs away from it. */
export function scatterPeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    const d = Math.hypot(dx, dy);
    if (d < radius) {
      ped.flee = 2.5;
      ped.angle = Math.atan2(dy, dx);
    }
  }
}
