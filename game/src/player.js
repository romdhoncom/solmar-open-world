// Dani Vega, on foot: walking and running, aiming with the mouse, punching
// up close, and getting in and out of cars. The player is a circle with a
// facing angle; the car they drive is a separate entity the game keeps in sync.
import { CAR, PLAYER, WORLD } from './config.js';
import { collideBuildings } from './world.js';
import { tailPoint } from './vehicles.js';

/** A fresh player standing on the street outside Marlowe Motors. */
export function makePlayer() {
  return {
    x: 1200,
    y: 1140,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: 150,
    ammo: 24,
    reserveAmmo: 48,
    inCar: null,
    speed: 0,
    invulnerable: 0,
    fireTimer: 0,
    reloadTimer: 0,
    bustTimer: 0,
    punchTimer: 0,
  };
}

/**
 * Move the player on foot by dt. `move` is -1..1 on each axis, `run` is
 * Shift, and `aimAngle` is where the mouse points. Returns the distance moved.
 */
export function stepPlayerOnFoot(game, dt, move, run, aimAngle) {
  const player = game.player;
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let dx = move.x;
  let dy = move.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx = (dx / length) * speed * dt;
    dy = (dy / length) * speed * dt;
    player.angle = Math.atan2(dy, dx);
  }
  player.x += dx;
  player.y += dy;
  player.speed = length > 0 ? speed : 0;
  const fixed = collideBuildings(game.city, player.x, player.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.x = Math.max(20, Math.min(WORLD.width - 20, player.x));
  player.y = Math.max(20, Math.min(WORLD.height - 20, player.y));
  if (length === 0) player.angle = aimAngle;
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (player.fireTimer > 0) player.fireTimer -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const need = 12 - player.ammo;
      const take = Math.min(need, player.reserveAmmo);
      player.ammo += take;
      player.reserveAmmo -= take;
    }
  }
  // Running kicks up a little dust off the sidewalk.
  if (run && length > 0 && game.random() < dt * 8) {
    game.particles.push({
      x: player.x - Math.cos(player.angle) * 12,
      y: player.y - Math.sin(player.angle) * 12,
      vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#c9c4b2', size: 4,
    });
  }
  return length > 0 ? speed * dt : 0;
}

/**
 * Throw a punch at whatever stands in front of Dani: a Breaker, an officer,
 * or a pedestrian who got too close. No ammo, short reach, quick to throw.
 * Returns the thing that was hit, or null.
 */
export function playerPunch(game) {
  const player = game.player;
  if (player.inCar || player.punchTimer > 0) return null;
  player.punchTimer = PLAYER.punchInterval;
  player.angle = Math.atan2(game.aimWorld.y - player.y, game.aimWorld.x - player.x);
  const reach = PLAYER.punchRange;
  const fx = Math.cos(player.angle);
  const fy = Math.sin(player.angle);
  const inFront = (x, y, radius) => {
    const dx = x - player.x;
    const dy = y - player.y;
    const forward = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    return forward > 0 && forward < reach + radius && side < radius + 10;
  };
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    if (inFront(enemy.x, enemy.y, 14)) {
      enemy.health -= PLAYER.punchDamage;
      enemy.flash = 0.15;
      game.audio.punch();
      if (enemy.health <= 0) {
        enemy.dead = true;
        game.stats.kills += 1;
      }
      return enemy;
    }
  }
  for (const officer of game.officers) {
    if (inFront(officer.x, officer.y, 14)) {
      officer.gone = true;
      game.crime.wanted = Math.min(5, game.crime.wanted + 1);
      game.crime.message = 'You punched a cop — wanted level ' + game.crime.wanted;
      game.crime.messageTimer = 4;
      game.audio.punch();
      return officer;
    }
  }
  game.audio.punch();
  return null;
}

/** The nearest car the player can step into, within reach, or null. */
export function nearestCarToEnter(game) {
  const player = game.player;
  let best = null;
  let bestD = 90;
  for (const car of game.cars) {
    if (car.dead || car.kind === 'police') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * Put the player into `car`. A parked car is free; a traffic car has a
 * driver who bails out, and taking it in front of a witness is a crime.
 */
export function enterCar(game, car) {
  const player = game.player;
  player.inCar = car.id;
  car.kind = 'player';
  car.driver = 'player';
  if (car.wasTraffic) {
    game.stats.carsStolen += 1;
    if (witnessNearby(game, car.x, car.y)) {
      game.crime.wanted = Math.min(5, game.crime.wanted + 1);
      game.crime.quietTimer = 0;
      game.crime.message = `Car stolen in front of a witness — wanted level ${game.crime.wanted}`;
      game.crime.messageTimer = 4;
    }
  }
  player.x = car.x;
  player.y = car.y;
}

/** Step out of the car at its tail, leaving it parked where it stands. */
export function exitCar(game) {
  const player = game.player;
  const car = game.cars.find((c) => c.id === player.inCar);
  if (!car) {
    player.inCar = null;
    return;
  }
  const spot = tailPoint(car);
  const fixed = collideBuildings(game.city, spot.x, spot.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.inCar = null;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
}

/** True when a police officer, a police car or a pedestrian can see the spot. */
export function witnessNearby(game, x, y) {
  for (const officer of game.officers) {
    if (Math.hypot(officer.x - x, officer.y - y) < 420) return true;
  }
  for (const car of game.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - x, car.y - y) < 520) return true;
  }
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < 260) return true;
  }
  return false;
}

/** Hurt the player; returns true when the hit puts them down. */
export function hurtPlayer(game, damage) {
  const player = game.player;
  if (player.invulnerable > 0) return false;
  player.health -= damage;
  player.invulnerable = 0.35;
  if (player.health <= 0) {
    player.health = 0;
    return true;
  }
  return false;
}

/** The player's car, or null when they are on foot. */
export function playerCar(game) {
  if (!game.player.inCar) return null;
  return game.cars.find((c) => c.id === game.player.inCar) || null;
}
