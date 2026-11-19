// Bullets, hits and pickups. A bullet is a short-lived point with a
// direction; it dies on a building, on a person, or on a car. Pickups
// are the ammo and cash the player finds lying around.

import { PLAYER } from './config.js';
import { hitsBuilding } from './world.js';
import { damageCar } from './vehicles.js';
import { addWanted } from './police.js';

/** Fire one bullet from (x, y) along `angle`, from 'player', 'enemy' or 'police'. */
export function fireBullet(G, x, y, angle, from, damage) {
  if (from === 'player') G.shotNoise = 1;
  G.bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    from,
    damage: damage === undefined ? PLAYER.bulletDamage : damage,
    life: 1.4,
  });
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (hitsBuilding(G.city, b.x, b.y, 2)) {
      b.dead = true;
      G.effects.sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25 });
      continue;
    }
    if (b.from === 'player') {
      // Crew members first: they are the mission's fight.
      let hit = false;
      for (const foe of G.crew) {
        if (!foe.alive) continue;
        if (Math.hypot(foe.x - b.x, foe.y - b.y) < 18) {
          foe.hp -= b.damage;
          b.dead = true;
          hit = true;
          if (foe.hp <= 0) {
            foe.alive = false;
            p.kills += 1;
          }
          break;
        }
      }
      if (hit) continue;
      // Then police cruisers and civilian cars.
      for (const car of G.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          damageCar(G, car, b.damage);
          b.dead = true;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const cruiser of G.police.cruisers) {
        if (Math.hypot(cruiser.x - b.x, cruiser.y - b.y) < 30) {
          damageCar(G, cruiser, b.damage);
          b.dead = true;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // And pedestrians: hitting one is a crime.
      for (const ped of G.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.alive = false;
          ped.flee = 6;
          b.dead = true;
          addWanted(G, 1);
          break;
        }
      }
    } else {
      // An enemy or police bullet: only the player can be hurt by it.
      if (!p.car && Math.hypot(p.x - b.x, p.y - b.y) < 16) {
        p.hp -= b.damage;
        b.dead = true;
        G.effects.sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3 });
      } else if (p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 30) {
        damageCar(G, p.car, b.damage);
        b.dead = true;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

/** Drop a pickup: 'ammo' refills bullets, 'cash' pays money. */
export function spawnPickup(G, kind, x, y) {
  G.pickups.push({ kind, x, y, value: kind === 'cash' ? 25 + Math.floor(G.rng() * 50) : 24, bob: 0 });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.bob += dt;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 34) {
      pk.taken = true;
      if (pk.kind === 'ammo') {
        p.ammo = Math.min(PLAYER.ammoMax, p.ammo + pk.value);
      } else {
        p.money += pk.value;
      }
      G.audio.pickup();
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);
}
