// Solmar's city: the road grid, the blocks between the roads, the
// buildings and parks that fill them, the beach and the harbour.
// Everything is laid out once, from the seeded generator, and painted
// once to an offscreen canvas, so a frame only has to draw the things
// that move. Nothing here knows about the player, the police or the
// missions.

import { BEACH, HARBOUR, PALETTE, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

// Roof colours, one per district feel: warm terracotta downtown, pale
// pastels by the beach, brick in the market quarter, slate in the hills.
const ROOFS = {
  downtown: ['#b5674a', '#8a6f5c', '#a8543f', '#7d5a6e'],
  beach: ['#e8a34c', '#d97b6b', '#f0c96b', '#c96b4a'],
  market: ['#9a5b3f', '#7a4a3a', '#b0703f', '#6b4a5a'],
  hills: ['#5a6b7a', '#4a5a6b', '#6b7a8a', '#3f4a5a'],
  marina: ['#4a7a8a', '#3f6b7a', '#5a8a9a', '#2f5a6b'],
};

const PARK_TREES = ['#3f7a3a', '#4a8a42', '#5a9a4a', '#357a33'];

/** Which district a point belongs to, for roofs and street names. */
export function districtAt(x, y) {
  if (y >= BEACH.y) return 'beach';
  if (x >= HARBOUR.x - 120) return 'marina';
  if (x < 900 && y < 800) return 'hills';
  if (x < 900) return 'market';
  return 'downtown';
}

/** True when the point is on a road (within half a road width of a centre line). */
export function onRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of ROADS.horizontal) if (Math.abs(y - hy) <= half) return true;
  return false;
}

/** True when the point is on the beach sand or in the water. */
export function onBeach(x, y) {
  return y >= BEACH.y;
}

/** The nearest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of ROADS.vertical) {
    const d = Math.abs(x - vx);
    if (d < bestD) { bestD = d; best = { x: vx, y, axis: 'v', line: vx }; }
  }
  for (const hy of ROADS.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bestD) { bestD = d; best = { x, y: hy, axis: 'h', line: hy }; }
  }
  return best;
}

/** A random intersection, for spawning traffic and placing markers. */
export function randomIntersection(rng) {
  return {
    x: pick(rng, ROADS.vertical),
    y: pick(rng, ROADS.horizontal),
  };
}

/** A point on a road a little way from (x, y), for mission targets. */
export function roadPointNear(rng, x, y, minDistance) {
  for (let tries = 0; tries < 40; tries += 1) {
    const point = randomIntersection(rng);
    const dx = point.x - x;
    const dy = point.y - y;
    if (Math.hypot(dx, dy) >= minDistance) return point;
  }
  return { x: ROADS.vertical[2], y: ROADS.horizontal[2] };
}

/** Build the city from the seeded generator: buildings, parks, trees. */
export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const half = ROADS.width / 2;
  const xs = [0, ...ROADS.vertical, WORLD.width];
  const ys = [0, ...ROADS.horizontal, WORLD.height];
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const left = xs[ix] + half + 14;
      const right = xs[ix + 1] - half - 14;
      const top = ys[iy] + half + 14;
      const bottom = ys[iy + 1] - half - 14;
      if (right - left < 90 || bottom - top < 90) continue;
      if (bottom > BEACH.y) continue;
      if (left > HARBOUR.x - 40 && top > HARBOUR.y - 40 && top < HARBOUR.y + HARBOUR.height) continue;
      const centreX = (left + right) / 2;
      const centreY = (top + bottom) / 2;
      // The block between the third and fourth roads holds the plaza:
      // a park with the fountain the second screenshot is taken at.
      const isPlaza = ix === 3 && iy === 3;
      // One block in six is a park instead of buildings.
      if (isPlaza || rng() < 0.16) {
        parks.push({ x: left, y: top, width: right - left, height: bottom - top });
        const treeCount = 3 + Math.floor(rng() * 5);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: range(rng, left + 20, right - 20), y: range(rng, top + 20, bottom - 20), color: pick(rng, PARK_TREES), radius: 12 + rng() * 10 });
        }
        continue;
      }
      const district = districtAt(centreX, centreY);
      const roofs = ROOFS[district];
      const count = rng() < 0.45 ? 1 : 2;
      if (count === 1) {
        buildings.push({
          x: left + 8, y: top + 8, width: right - left - 16, height: bottom - top - 16,
          color: pick(rng, roofs), district,
        });
      } else if (rng() < 0.5) {
        const mid = left + (right - left) * (0.42 + rng() * 0.16);
        buildings.push({ x: left + 8, y: top + 8, width: mid - left - 16, height: bottom - top - 16, color: pick(rng, roofs), district });
        buildings.push({ x: mid + 8, y: top + 8, width: right - mid - 16, height: bottom - top - 16, color: pick(rng, roofs), district });
      } else {
        const mid = top + (bottom - top) * (0.42 + rng() * 0.16);
        buildings.push({ x: left + 8, y: top + 8, width: right - left - 16, height: mid - top - 16, color: pick(rng, roofs), district });
        buildings.push({ x: left + 8, y: mid + 8, width: right - left - 16, height: bottom - mid - 16, color: pick(rng, roofs), district });
      }
    }
  }
  // Boardwalk palms along the beach.
  for (let x = 120; x < WORLD.width - 60; x += 150) {
    trees.push({ x: x + range(rng, -20, 20), y: BEACH.y + 26, color: pick(rng, PARK_TREES), radius: 13 + rng() * 6 });
  }
  return { buildings, trees, parks };
}

/** Push a circle (x, y, radius) out of every building it overlaps. */
export function collideBuildings(city, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(px, b.x + b.width));
    const nearestY = Math.max(b.y, Math.min(py, b.y + b.height));
    const dx = px - nearestX;
    const dy = py - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) { py = b.y - radius; continue; }
    const d = Math.sqrt(d2);
    px = nearestX + (dx / d) * radius;
    py = nearestY + (dy / d) * radius;
  }
  return { x: px, y: py };
}

/** True when a circle overlaps any building. */
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(x, b.x + b.width));
    const nearestY = Math.max(b.y, Math.min(y, b.y + b.height));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** Paint the whole city once, to an offscreen canvas the renderer reuses. */
export function paintCity(city) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.width, park.height);
  }

  // Harbour water and the beach.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(HARBOUR.x, HARBOUR.y, HARBOUR.width, HARBOUR.height);
  ctx.fillStyle = BEACH.sand;
  ctx.fillRect(0, BEACH.y, WORLD.width, WORLD.height - BEACH.y);
  ctx.fillStyle = BEACH.water;
  ctx.fillRect(0, BEACH.y + 96, WORLD.width, WORLD.height - BEACH.y - 96);
  ctx.fillStyle = BEACH.deep;
  ctx.fillRect(0, BEACH.y + 130, WORLD.width, WORLD.height - BEACH.y - 130);
  // Boardwalk along the sand.
  ctx.fillStyle = PALETTE.boardwalk;
  ctx.fillRect(0, BEACH.y - 14, WORLD.width, 14);

  // Roads: asphalt, then a pale edge, then the dashed centre line.
  ctx.fillStyle = PALETTE.road;
  for (const vx of ROADS.vertical) ctx.fillRect(vx - ROADS.width / 2, 0, ROADS.width, BEACH.y);
  for (const hy of ROADS.horizontal) ctx.fillRect(0, hy - ROADS.width / 2, WORLD.width, ROADS.width);
  ctx.fillStyle = PALETTE.roadEdge;
  for (const vx of ROADS.vertical) {
    ctx.fillRect(vx - ROADS.width / 2, 0, 4, BEACH.y);
    ctx.fillRect(vx + ROADS.width / 2 - 4, 0, 4, BEACH.y);
  }
  for (const hy of ROADS.horizontal) {
    ctx.fillRect(0, hy - ROADS.width / 2, WORLD.width, 4);
    ctx.fillRect(0, hy + ROADS.width / 2 - 4, WORLD.width, 4);
  }
  ctx.fillStyle = PALETTE.lane;
  for (const vx of ROADS.vertical) {
    for (let y = 20; y < BEACH.y; y += 56) ctx.fillRect(vx - 2, y, 4, 28);
  }
  for (const hy of ROADS.horizontal) {
    for (let x = 20; x < WORLD.width; x += 56) ctx.fillRect(x, hy - 2, 28, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(244, 241, 230, 0.55)';
  for (const vx of ROADS.vertical) {
    for (const hy of ROADS.horizontal) {
      for (let s = -48; s <= 48; s += 24) {
        ctx.fillRect(vx + s - 5, hy - ROADS.width / 2 + 8, 10, 18);
        ctx.fillRect(vx + s - 5, hy + ROADS.width / 2 - 26, 10, 18);
      }
    }
  }

  // Buildings: a soft shadow, the roof, a lighter inner roof and a door.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(b.x + 8, b.y + 10, b.width, b.height);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(b.x + 10, b.y + 10, b.width - 20, b.height - 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(b.x + b.width / 2 - 9, b.y + b.height - 6, 18, 6);
  }

  // Trees.
  for (const tree of city.trees) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.arc(tree.x + 4, tree.y + 5, tree.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tree.color;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(tree.x - tree.radius * 0.3, tree.y - tree.radius * 0.3, tree.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Harbour boats.
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(HARBOUR.x + 40, HARBOUR.y + 60, 70, 22);
  ctx.fillRect(HARBOUR.x + 150, HARBOUR.y + 200, 60, 20);
  ctx.fillRect(HARBOUR.x + 60, HARBOUR.y + 320, 80, 24);
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(HARBOUR.x + 60, HARBOUR.y + 52, 30, 10);

  // The docks: a wooden deck over the harbour water at the east edge.
  ctx.fillStyle = '#8a6b4a';
  ctx.fillRect(4180, 840, 260, 120);
  ctx.fillStyle = '#6b4a2a';
  for (let x = 4190; x < 4440; x += 22) ctx.fillRect(x, 840, 4, 120);

  // The plaza fountain: a stone ring and blue water.
  ctx.fillStyle = '#8a8a92';
  ctx.beginPath();
  ctx.arc(2600, 2000, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5db4d8';
  ctx.beginPath();
  ctx.arc(2600, 2000, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#bfe6f5';
  ctx.beginPath();
  ctx.arc(2600, 2000, 14, 0, Math.PI * 2);
  ctx.fill();

  // Beach umbrellas.
  for (const ux of [700, 1500, 2600, 3600]) {
    ctx.fillStyle = '#e86a5a';
    ctx.beginPath();
    ctx.arc(ux, BEACH.y + 55, 26, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    ctx.arc(ux, BEACH.y + 55, 26, Math.PI, Math.PI * 1.5);
    ctx.fill();
  }

  // The pier: planks out into the water at the south edge.
  ctx.fillStyle = '#8a6b4a';
  ctx.fillRect(3060, BEACH.y + 40, 80, 190);
  ctx.fillStyle = '#6b4a2a';
  for (let y = BEACH.y + 50; y < BEACH.y + 230; y += 22) {
    ctx.fillRect(3060, y, 80, 4);
  }
  return canvas;
}
