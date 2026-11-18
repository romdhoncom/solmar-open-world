// Cars: their physics and their kinds. A car is a point with a heading and
// a speed along that heading; steering turns the heading, the throttle adds
// speed, and the grip pulls the velocity back toward the heading so a car
// slides a little before it grips. The same step drives the player's car,
// the traffic and the police — only the steering input differs.
import { CAR, CAR_MODELS, WORLD } from './config.js';
import { pick, range } from './random.js';

let nextCarId = 1;

/** Make a car of a random model at (x, y), facing `angle`. */
export function makeCar(random, x, y, angle, kind) {
  const model = pick(random, CAR_MODELS);
  const car = {
    id: nextCarId,
    kind: kind || 'parked',
    model: model.name,
    color: model.color,
    top: model.top,
    accel: model.accel,
    x, y, angle,
    speed: 0,
    steer: 0,
    driver: kind === 'traffic' ? 'traffic' : null,
    wanted: false,
    siren: false,
    stuck: 0,
    dead: false,
  };
  nextCarId += 1;
  return car;
}

/** Make a police cruiser at (x, y), facing `angle`. */
export function makePoliceCar(x, y, angle) {
  const car = {
    id: nextCarId,
    kind: 'police',
    model: 'Interceptor',
    color: '#20242e',
    top: 1.08,
    accel: 1.08,
    x, y, angle,
    speed: 0,
    steer: 0,
    driver: 'police',
    wanted: false,
    siren: true,
    stuck: 0,
    dead: false,
  };
  nextCarId += 1;
  return car;
}

/** Reset the id counter when a fresh game starts. */
export function resetCarIds() {
  nextCarId = 1;
}

/**
 * Advance one car by dt. `throttle` is -1..1, `steer` is -1..1, and
 * `handbrake` loosens the grip so the tail slides.
 */
export function stepCar(car, dt, throttle, steer, handbrake) {
  const maxSpeed = CAR.maxSpeed * car.top;
  const maxReverse = CAR.maxReverse * car.top;
  if (throttle > 0) car.speed += CAR.accel * car.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * car.accel * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxReverse) car.speed = -maxReverse;
  const direction = car.speed >= 0 ? 1 : -1;
  const slide = handbrake ? 1.5 : 1;
  const turn = CAR.turnRate * slide * steer * direction * Math.min(1, Math.abs(car.speed) / 120);
  car.angle += turn * dt;
  if (handbrake) car.speed *= Math.max(0, 1 - 0.9 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  car.steer = steer;
}

/** The car's speed as a 0..1 fraction of its top speed, for the HUD and audio. */
export function speedFraction(car) {
  return Math.min(1, Math.abs(car.speed) / (CAR.maxSpeed * car.top));
}

/** A point just ahead of the car's nose. */
export function nosePoint(car) {
  return {
    x: car.x + Math.cos(car.angle) * (CAR.length / 2),
    y: car.y + Math.sin(car.angle) * (CAR.length / 2),
  };
}

/** A point just behind the car's tail, where a driver steps out. */
export function tailPoint(car) {
  return {
    x: car.x - Math.cos(car.angle) * (CAR.length / 2 + 24),
    y: car.y - Math.sin(car.angle) * (CAR.length / 2 + 24),
  };
}

/** Scatter parked cars along the roads, plus the player's starting car. */
export function scatterParkedCars(random, city) {
  const cars = [];
  const spots = [];
  for (const vx of [240, 720, 1200, 1680, 2160, 2640]) {
    for (const hy of [220, 620, 1020, 1420, 1820, 2120]) {
      spots.push({ x: vx + 78, y: hy + range(random, -300, 300), angle: Math.PI / 2 });
      spots.push({ x: vx - 78, y: hy + range(random, -300, 300), angle: -Math.PI / 2 });
    }
  }
  for (const spot of spots) {
    if (random() < 0.45) continue;
    const car = makeCar(random, spot.x, spot.y, spot.angle, 'parked');
    cars.push(car);
  }
  return cars;
}
