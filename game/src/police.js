// The wanted level and the police who answer it: cruisers that chase
// and ram, roadblocks at four stars, and a helicopter at five. The
// wanted level is just a number from 0 to 5; everything else follows
// from it.

import { WANTED } from './config.js';
import { makeCar, updateCar } from './vehicles.js';
import { fireBullet } from './combat.js';
import { roadPointNear } from './world.js';

export const POLICE_MODEL = { name: 'Interceptor', color: '#2f4a6b', topSpeed: 660, accel: 540, handling: 0.9 };

export function createPolice() {
  return {
    wanted: 0,
    cruisers: [],
    roadblocks: [],
    heli: null,
    loseTimer: 0,
    blockTimer: 0,
  };
}

/** Raise the wanted level, capped at five stars. */
export function addWanted(G, n) {
  const pol = G.police;
  pol.wanted = Math.min(WANTED.max, pol.wanted + n);
  pol.loseTimer = 0;
}

/** Drop the wanted level to zero: a clean escape. */
export function clearWanted(G) {
  G.police.wanted = 0;
  G.police.cruisers = [];
  G.police.roadblocks = [];
  G.police.heli = null;
  G.police.loseTimer = 0;
}

function spawnCruiser(G) {
  const p = G.player;
  const spot = roadPointNear(G.rng, p.x, p.y, 500);
  const cruiser = makeCar(POLICE_MODEL, spot.x, spot.y, 0, 'police');
  cruiser.shootTimer = 1;
  cruiser.ramTimer = 0;
  G.police.cruisers.push(cruiser);
  G.audio.siren(true);
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  if (pol.wanted <= 0) {
    G.audio.siren(false);
    return;
  }
  G.audio.siren(true);

  // Keep the right number of cruisers on the street.
  const want = WANTED.cruisers[pol.wanted];
  while (pol.cruisers.length < want) spawnCruiser(G);
  while (pol.cruisers.length > want) pol.cruisers.pop();

  // Each cruiser steers at the player and drives at them, using the
  // same car physics as every other car.
  for (const cruiser of pol.cruisers) {
    cruiser.shootTimer -= dt;
    cruiser.ramTimer -= dt;
    const dx = p.x - cruiser.x;
    const dy = p.y - cruiser.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cruiser.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const drive = { forward: dist > 60, back: false, left: diff < -0.08, right: diff > 0.08 };
    updateCar(G, cruiser, dt, drive);
    if (dist < 52 && cruiser.ramTimer <= 0) {
      cruiser.ramTimer = 0.8;
      if (p.car) {
        p.car.damage += 8;
        p.car.speed *= 0.6;
        if (p.car.damage >= 100) {
          p.car.damage = 100;
          p.car.wrecked = true;
        }
        G.effects.sparks.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.4 });
        G.camera.shake = 0.4;
        G.audio.crash();
      } else {
        p.hp -= 10;
        p.x += (dx / (dist || 1)) * -30;
        p.y += (dy / (dist || 1)) * -30;
      }
    }
    // On foot and in range, the police shoot.
    if (!p.car && dist < WANTED.shootRange && cruiser.shootTimer <= 0) {
      cruiser.shootTimer = WANTED.shootCooldown;
      fireBullet(G, cruiser.x, cruiser.y, wantAngle, 'police', 12);
      G.audio.shot();
    }
  }

  // Four stars: roadblocks across the roads ahead of the player.
  if (pol.wanted >= 4) {
    pol.blockTimer -= dt;
    if (pol.blockTimer <= 0) {
      pol.blockTimer = 6;
      pol.roadblocks = [];
      const aheadX = p.x + (p.car ? Math.cos(p.car.angle) * 420 : 0);
      const aheadY = p.y + (p.car ? Math.sin(p.car.angle) * 420 : 0);
      for (let i = 0; i < 2; i += 1) {
        const spot = roadPointNear(G.rng, aheadX, aheadY, 200);
        pol.roadblocks.push({ x: spot.x, y: spot.y, angle: spot.axis === 'v' ? 0 : Math.PI / 2 });
      }
    }
    // Ramming a roadblock hurts.
    for (const block of pol.roadblocks) {
      if (p.car && Math.hypot(p.car.x - block.x, p.car.y - block.y) < 46) {
        p.car.damage += 20;
        p.car.speed *= 0.2;
        G.effects.sparks.push({ x: block.x, y: block.y, vx: 0, vy: 0, life: 0.5 });
        G.camera.shake = 0.5;
        G.audio.crash();
        block.hit = true;
        if (p.car.damage >= 100) {
          p.car.damage = 100;
          p.car.wrecked = true;
        }
      }
    }
    pol.roadblocks = pol.roadblocks.filter((b) => !b.hit);
  } else {
    pol.roadblocks = [];
  }

  // Five stars: a helicopter circles overhead and follows the player.
  if (pol.wanted >= 5) {
    if (!pol.heli) pol.heli = { angle: 0, x: p.x, y: p.y };
    pol.heli.angle += dt * 0.55;
    pol.heli.x = p.x + Math.cos(pol.heli.angle) * 220;
    pol.heli.y = p.y + Math.sin(pol.heli.angle) * 220;
  } else {
    pol.heli = null;
  }

  // Out of sight for a while, and a star drops.
  let seen = false;
  for (const cruiser of pol.cruisers) {
    if (Math.hypot(cruiser.x - p.x, cruiser.y - p.y) < WANTED.sightRange) { seen = true; break; }
  }
  if (!seen) {
    pol.loseTimer += dt;
    if (pol.loseTimer >= WANTED.decaySeconds) {
      pol.loseTimer = 0;
      pol.wanted = Math.max(0, pol.wanted - 1);
    }
  } else {
    pol.loseTimer = 0;
  }
}
