// Cars: the nine models, driving physics, damage and repair.
// A car is a plain object; the player, the traffic and the police all
// drive the same shape, so stealing a car is just changing its driver.

import { DRIVING, LANDMARKS, ROADS } from './config.js';
import { pick, range } from './random.js';

export const CAR_MODELS = [
  { name: 'Pinto', color: '#7a8a99', topSpeed: 430, accel: 380, handling: 0.55 },
  { name: 'Rondo', color: '#9a5a8a', topSpeed: 480, accel: 420, handling: 0.65 },
  { name: 'Vela', color: '#4a8a9a', topSpeed: 520, accel: 440, handling: 0.7 },
  { name: 'Marlin', color: '#e8e2c8', topSpeed: 540, accel: 450, handling: 0.72 },
  { name: 'Sunset', color: '#e8a34c', topSpeed: 560, accel: 460, handling: 0.75 },
  { name: 'Strider', color: '#d8b13c', topSpeed: 600, accel: 480, handling: 0.8 },
  { name: 'Cruiser', color: '#2f4a6b', topSpeed: 620, accel: 500, handling: 0.85 },
  { name: 'Comet', color: '#c94f3d', topSpeed: 640, accel: 520, handling: 0.9 },
  { name: 'Falcon', color: '#3f5a9a', topSpeed: 680, accel: 560, handling: 0.95 },
];

/** A new car object. `owner` is 'player', 'traffic' or 'parked'. */
export function makeCar(model, x, y, angle, owner) {
  return {
    model, x, y, angle,
    speed: 0,
    damage: 0,
    owner: owner || 'parked',
    parked: owner === 'parked',
    wrecked: false,
    skidTimer: 0,
    smokeTimer: 0,
  };
}

/** The gold Sunset the Made rank unlocks, parked by the marina. */
export function makeGoldSunset() {
  const model = CAR_MODELS.find((m) => m.name === 'Sunset');
  const car = makeCar(model, LANDMARKS.marina.x, LANDMARKS.marina.y, Math.PI / 2, 'parked');
  car.gold = true;
  return car;
}

/**
 * Drive one car for a step. `drive` holds {forward, back, left, right}.
 * Returns 'crash' when the car hit something hard this step.
 */
export function updateCar(G, car, dt, drive) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 4 * dt);
    return null;
  }
  const m = car.model;
  const top = m.topSpeed;
  if (drive.forward) car.speed += m.accel * dt;
  if (drive.back) car.speed -= DRIVING.reverseAccel * dt;
  // Drag and rolling resistance pull the speed back toward zero.
  car.speed -= car.speed * DRIVING.drag * dt;
  if (car.speed > top) car.speed = top;
  if (car.speed < -top * 0.35) car.speed = -top * 0.35;
  // Steering only bites while moving, and more at speed.
  const steer = (drive.left ? -1 : 0) + (drive.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 220);
  car.angle += steer * DRIVING.turnRate * m.handling * speedFactor * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Hard turns at speed leave skid marks and a screech.
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > DRIVING.skidSpeed) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.05;
      G.effects.skids.push({ x1: car.x, y1: car.y, x2: nx, y2: ny, life: 5 });
      G.audio.skid();
    }
  }
  // Walls: a building in the way is a crash, with sparks and a shake.
  const frontX = nx + Math.cos(car.angle) * 26;
  const frontY = ny + Math.sin(car.angle) * 26;
  if (G.city && hitsBuildingAt(G, frontX, frontY)) {
    car.damage += DRIVING.crashDamage;
    car.speed *= -0.25;
    G.effects.sparks.push({ x: frontX, y: frontY, vx: 0, vy: 0, life: 0.4 });
    G.camera.shake = 0.35;
    G.audio.crash();
    if (car.damage >= 100) {
      car.damage = 100;
      car.wrecked = true;
    }
    return 'crash';
  }
  car.x = Math.max(20, Math.min(4780, nx));
  car.y = Math.max(20, Math.min(3580, ny));
  // Smoke when badly damaged.
  if (car.damage > 60) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.25;
      G.effects.smoke.push({ x: car.x, y: car.y - 10, life: 1.2 });
    }
  }
  return null;
}

function hitsBuildingAt(G, x, y) {
  for (const b of G.city.buildings) {
    if (x >= b.x - 8 && x <= b.x + b.width + 8 && y >= b.y - 8 && y <= b.y + b.height + 8) return true;
  }
  return false;
}

/** Damage a car by bullets or a ram; returns true when it just wrecked. */
export function damageCar(G, car, amount) {
  if (car.wrecked) return false;
  car.damage += amount;
  if (car.damage >= 100) {
    car.damage = 100;
    car.wrecked = true;
    G.effects.smoke.push({ x: car.x, y: car.y, life: 1.6 });
    return true;
  }
  return false;
}

/** Repair price for a car, in dollars. */
export function repairCost(car) {
  return Math.ceil(car.damage) * 2;
}

/**
 * Repair the player's car at Marlowe Motors. Returns the price paid,
 * or 0 when there is nothing to repair here.
 */
export function tryRepair(G) {
  const car = G.player.car;
  if (!car || car.damage <= 0) return 0;
  const dx = car.x - LANDMARKS.garage.x;
  const dy = car.y - LANDMARKS.garage.y;
  if (Math.hypot(dx, dy) > 130) return 0;
  const cost = repairCost(car);
  if (G.player.money < cost) return -1;
  G.player.money -= cost;
  car.damage = 0;
  car.wrecked = false;
  G.audio.repair();
  return cost;
}

/** Scatter parked cars around the city for the player to steal. */
export function spawnParkedCars(G) {
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const vertical = G.rng() < 0.5;
    const line = vertical
      ? pick(G.rng, ROADS.vertical)
      : pick(G.rng, ROADS.horizontal);
    const along = range(G.rng, 300, vertical ? 3100 : 4700);
    const edge = (ROADS.width / 2 - 16) * (G.rng() < 0.5 ? -1 : 1);
    const x = vertical ? line + edge : along;
    const y = vertical ? along : line + edge;
    const angle = vertical ? (G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (G.rng() < 0.5 ? 0 : Math.PI);
    // Two of the parked cars are rare: a Falcon and a Strider.
    const model = i === 3
      ? CAR_MODELS.find((m) => m.name === 'Falcon')
      : i === 9
        ? CAR_MODELS.find((m) => m.name === 'Strider')
        : pick(G.rng, CAR_MODELS.slice(0, 6));
    cars.push(makeCar(model, x, y, angle, 'parked'));
  }
  return cars;
}
