// Traffic and pedestrians: the city moving around the player.
// Traffic cars keep to their lane on the road grid and turn at
// intersections; pedestrians walk the pavements and cross at crosswalks.
// Both react to the player in simple ways: traffic slows when something
// is ahead, pedestrians step aside from a fast car and run from gunfire.

import { BEACH, PED_COUNT, ROADS, TRAFFIC_COUNT } from './config.js';
import { pick, range } from './random.js';
import { CAR_MODELS, makeCar } from './vehicles.js';

/** A traffic car: a car plus the road it is following. */
function makeTrafficCar(G, rng) {
  const vertical = rng() < 0.5;
  const line = vertical ? pick(rng, ROADS.vertical) : pick(rng, ROADS.horizontal);
  const along = range(rng, 200, vertical ? 3100 : 4700);
  const lane = (ROADS.width / 2 - 22) * (rng() < 0.5 ? -1 : 1);
  const dir = rng() < 0.5 ? 1 : -1;
  const car = makeCar(pick(rng, CAR_MODELS), vertical ? line + lane : along, vertical ? along : line + lane, 0, 'traffic');
  car.axis = vertical ? 'v' : 'h';
  car.line = line;
  car.dir = dir;
  car.cruise = range(rng, 130, 220);
  car.angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  return car;
}

export function spawnTraffic(G) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(makeTrafficCar(G, G.rng));
  return cars;
}

function nearestCrossing(value, lines) {
  let best = null;
  let bestD = Infinity;
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d < bestD) { bestD = d; best = line; }
  }
  return { line: best, dist: bestD };
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.owner !== 'traffic') continue;
    // Slow down for the car ahead, the player's included.
    let target = car.cruise;
    for (const other of G.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 90 && side < 40) { target = 0; break; }
    }
    if (p.car) {
      const dx = p.car.x - car.x;
      const dy = p.car.y - car.y;
      const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 90 && side < 40) target = 0;
    }
    // Ease toward the target speed, then roll along the road.
    car.speed += (target - car.speed) * Math.min(1, 2.5 * dt);
    if (car.axis === 'v') car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // At an intersection, sometimes turn onto the cross road.
    const pos = car.axis === 'v' ? car.y : car.x;
    const cross = nearestCrossing(pos, car.axis === 'v' ? ROADS.horizontal : ROADS.vertical);
    if (cross.dist < 14 && G.rng() < 0.02) {
      const wasVertical = car.axis === 'v';
      car.axis = wasVertical ? 'h' : 'v';
      car.line = cross.line;
      const lane = (ROADS.width / 2 - 22) * (G.rng() < 0.5 ? -1 : 1);
      if (wasVertical) {
        car.y = cross.line + lane;
        car.dir = G.rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      } else {
        car.x = cross.line + lane;
        car.dir = G.rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // Wrap around the far edge so the streets never empty out.
    if (car.axis === 'v' && (car.y < 60 || car.y > BEACH.y - 40)) {
      car.y = car.dir > 0 ? 80 : BEACH.y - 60;
    }
    if (car.axis === 'h' && (car.x < 60 || car.x > 4740)) {
      car.x = car.dir > 0 ? 80 : 4720;
    }
  }
}

/** A pedestrian: a walker on the pavements. */
function makePed(G, rng) {
  const vertical = rng() < 0.5;
  const line = vertical ? pick(rng, ROADS.vertical) : pick(rng, ROADS.horizontal);
  const along = range(rng, 200, vertical ? 3100 : 4700);
  const side = (ROADS.width / 2 + 14) * (rng() < 0.5 ? -1 : 1);
  return {
    x: vertical ? line + side : along,
    y: vertical ? along : line + side,
    axis: vertical ? 'v' : 'h',
    dir: rng() < 0.5 ? 1 : -1,
    speed: range(rng, 45, 75),
    color: pick(rng, ['#e86a5a', '#5a8a4a', '#4a6a9a', '#c9a34a', '#8a5a9a', '#e8e2c8']),
    alive: true,
    flee: 0,
    fleeX: 0,
    fleeY: 0,
  };
}

export function spawnPeds(G) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(makePed(G, G.rng));
  return peds;
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    // A gunshot nearby, or a fast car bearing down, sends them running.
    if (G.shotNoise > 0 && Math.hypot(ped.x - p.x, ped.y - p.y) < 220) {
      ped.flee = 2;
      ped.fleeX = ped.x - p.x;
      ped.fleeY = ped.y - p.y;
    }
    if (p.car && Math.abs(p.car.speed) > 200 && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 110) {
      ped.flee = 1.2;
      ped.fleeX = ped.x - p.car.x;
      ped.fleeY = ped.y - p.car.y;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
      ped.x += (ped.fleeX / len) * 130 * dt;
      ped.y += (ped.fleeY / len) * 130 * dt;
      ped.x = Math.max(20, Math.min(4780, ped.x));
      ped.y = Math.max(20, Math.min(3580, ped.y));
      continue;
    }
    const step = ped.speed * dt;
    if (ped.axis === 'v') ped.y += ped.dir * step;
    else ped.x += ped.dir * step;
    const pos = ped.axis === 'v' ? ped.y : ped.x;
    const cross = nearestCrossing(pos, ped.axis === 'v' ? ROADS.horizontal : ROADS.vertical);
    if (cross.dist < 10 && G.rng() < 0.015) {
      const wasVertical = ped.axis === 'v';
      ped.axis = wasVertical ? 'h' : 'v';
      const side = (ROADS.width / 2 + 14) * (G.rng() < 0.5 ? -1 : 1);
      if (wasVertical) {
        ped.y = cross.line + side;
        ped.dir = G.rng() < 0.5 ? 1 : -1;
      } else {
        ped.x = cross.line + side;
        ped.dir = G.rng() < 0.5 ? 1 : -1;
      }
    }
    if (ped.axis === 'v' && (ped.y < 40 || ped.y > 3560)) ped.dir *= -1;
    if (ped.axis === 'h' && (ped.x < 40 || ped.x > 4760)) ped.dir *= -1;
  }
  // The dead are picked back up over time, so the streets stay alive.
  for (const ped of G.peds) {
    if (!ped.alive && G.rng() < 0.002) {
      Object.assign(ped, makePed(G, G.rng));
    }
  }
}
