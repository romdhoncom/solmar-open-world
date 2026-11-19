// Dani on foot: movement, punching, getting in and out of cars, and
// shooting. The player is one object; whether Dani is on foot or in a
// car is just the `car` field being set or not.

import { LANDMARKS, PLAYER } from './config.js';
import { collideBuildings } from './world.js';
import { tryRepair } from './vehicles.js';
import { fireBullet } from './combat.js';
import { addWanted } from './police.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    hp: PLAYER.hp,
    money: PLAYER.startMoney,
    ammo: PLAYER.startAmmo,
    car: null,
    punchTimer: 0,
    fireTimer: 0,
    kills: 0,
  };
}

/** The nearest car to the player, within reach, or null. */
export function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.wrecked && car.owner !== 'player') continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);

  if (p.car) {
    // Driving is the car's update, run by the main loop; the player
    // rides along. E steps out — unless the car is a wreck at the
    // garage, where E repairs it instead.
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (input.pressed('KeyE')) {
      if (p.car.wrecked && tryRepair(G) > 0) return;
      // Step out beside the car.
      const side = { x: p.x - Math.sin(p.car.angle) * 34, y: p.y + Math.cos(p.car.angle) * 34 };
      const spot = collideBuildings(G.city, side.x, side.y, PLAYER.radius);
      p.x = spot.x;
      p.y = spot.y;
      p.car.owner = 'player';
      p.car.parked = false;
      p.car = null;
    }
    return;
  }

  // On foot: WASD moves, the mouse aims.
  let mx = 0;
  let my = 0;
  if (input.down('KeyW')) my -= 1;
  if (input.down('KeyS')) my += 1;
  if (input.down('KeyA')) mx -= 1;
  if (input.down('KeyD')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * PLAYER.speed * dt;
    const ny = p.y + (my / len) * PLAYER.speed * dt;
    const spot = collideBuildings(G.city, nx, ny, PLAYER.radius);
    p.x = Math.max(20, Math.min(4780, spot.x));
    p.y = Math.max(20, Math.min(3580, spot.y));
  }
  const worldMouse = G.camera.toWorld(input.mouse.x, input.mouse.y);
  p.angle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);

  // Punch: hurts the nearest crew member or pedestrian in reach.
  if (input.pressed('KeyF') && p.punchTimer <= 0) {
    p.punchTimer = PLAYER.punchCooldown;
    G.audio.punch();
    for (const foe of G.crew) {
      if (!foe.alive) continue;
      if (Math.hypot(foe.x - p.x, foe.y - p.y) <= PLAYER.punchRange) {
        foe.hp -= PLAYER.punchDamage;
        if (foe.hp <= 0) {
          foe.alive = false;
          p.kills += 1;
        }
        break;
      }
    }
  }

  // Shoot: a click fires toward the mouse, while ammo lasts.
  if (input.mouse.down && p.fireTimer <= 0) {
    if (p.ammo > 0) {
      p.fireTimer = PLAYER.fireCooldown;
      p.ammo -= 1;
      fireBullet(G, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, 'player');
      G.audio.shot();
    } else {
      p.fireTimer = 0.25;
      G.audio.emptyClick();
    }
  }

  // E: get into the nearest car, or repair a wrecked one at the garage.
  if (input.pressed('KeyE')) {
    const car = nearestCar(G, 64);
    if (car) {
      if (car.wrecked) {
        // A wrecked car at the garage can be repaired instead.
        const dx = car.x - LANDMARKS.garage.x;
        const dy = car.y - LANDMARKS.garage.y;
        if (Math.hypot(dx, dy) <= 130 && car.damage > 0) {
          const cost = Math.ceil(car.damage) * 2;
          if (p.money >= cost) {
            p.money -= cost;
            car.damage = 0;
            car.wrecked = false;
            G.audio.repair();
          }
        }
      } else {
        const stealing = car.owner !== 'player';
        p.car = car;
        car.owner = 'player';
        car.parked = false;
        if (stealing) {
          // Stealing a car is a crime: the wanted level rises.
          addWanted(G, 1);
        }
      }
    }
  }

  // A wrecked player's car left behind stays where it is; the garage
  // repair above is the way back into it.
}
