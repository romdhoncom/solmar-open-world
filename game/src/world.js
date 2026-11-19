// Solmar's city: the road grid, the blocks between the roads, the
// buildings and parks that fill them, the plaza fountain, the beach and
// the harbour. The layout is built once from the seeded generator and
// painted once to an offscreen canvas, so each frame only has to draw the
// things that move. Nothing in this file knows about the player, the
// police or the missions.
import { BEACH, HARBOUR, PALETTE, PLAZA, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

// Roof colours, one set per district: warm terracotta downtown, pale
// pastels by the beach, brick in the market quarter, slate in the hills.
const ROOFS = {
  downtown: ['#b5674a', '#8a6f5c', '#a8543f', '#7d5a6e'],
  beach: ['#e8a34c', '#d97b6b', '#f0c96b', '#c96b4a'],
  market: ['#9a5b3f', '#7a4a3a', '#b0703f', '#6b4a5a'],
  hills: ['#5a6b7a', '#4a5a6b', '#6b7a8a', '#3f4a5a'],
  marina: ['#4a7a8a', '#3f6b7a', '#5a8a9a', '#2f5a6b'],
};

const PARK_TREES = ['#3f7a3a', '#4a8a42', '#5a9a4a', '#357a33'];
const UMBRELLA_COLORS = ['#e5534b', '#f2c94c', '#4f8ff7', '#58b368', '#f27bb1'];

/** The district a point sits in, which decides its roofs and street names. */
export function districtAt(x, y) {
  if (y >= BEACH.y) return 'beach';
  if (x >= HARBOUR.x - 120) return 'marina';
  if (x < 900 && y < 800) return 'hills';
  if (x < 900) return 'market';
  return 'downtown';
}

/** True when the point is on a road, within half a road width of a centre line. */
export function onRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) {
    if (Math.abs(x - vx) <= half) return true;
  }
  for (const hy of ROADS.horizontal) {
    if (Math.abs(y - hy) <= half) return true;
  }
  return false;
}

/** True when the point is on the beach sand or in the water. */
export function onBeach(x, y) {
  return y >= BEACH.y;
}

/** The closest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of ROADS.vertical) {
    const d = Math.abs(x - vx);
    if (d < bestD) {
      bestD = d;
      best = { x: vx, y, axis: 'v', line: vx };
    }
  }
  for (const hy of ROADS.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bestD) {
      bestD = d;
      best = { x, y: hy, axis: 'h', line: hy };
    }
  }
  return best;
}

/** A random intersection, for spawning traffic and placing markers. */
export function randomIntersection(random) {
  return {
    x: pick(random, ROADS.vertical),
    y: pick(random, ROADS.horizontal),
  };
}

/** A road point some distance away from (x, y), for mission targets. */
export function roadPointNear(random, x, y, minDistance) {
  for (let tries = 0; tries < 40; tries += 1) {
    const point = randomIntersection(random);
    const dx = point.x - x;
    const dy = point.y - y;
    if (Math.hypot(dx, dy) >= minDistance) return point;
  }
  return { x: ROADS.vertical[2], y: ROADS.horizontal[2] };
}

/** Lay the city out from the seeded generator: buildings, parks, trees, plaza. */
export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const plazas = [];
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
      // The block around the plaza point becomes a fountain square.
      if (Math.abs(centreX - PLAZA.x) < 200 && Math.abs(centreY - PLAZA.y) < 200) {
        plazas.push({ x: left, y: top, width: right - left, height: bottom - top, cx: centreX, cy: centreY });
        for (let t = 0; t < 6; t += 1) {
          trees.push({
            x: range(random, left + 24, right - 24),
            y: range(random, top + 24, bottom - 24),
            color: pick(random, PARK_TREES),
            radius: 11 + random() * 7,
          });
        }
        continue;
      }
      // About one block in six is a park instead of buildings.
      if (random() < 0.16) {
        parks.push({ x: left, y: top, width: right - left, height: bottom - top });
        const treeCount = 3 + Math.floor(random() * 5);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({
            x: range(random, left + 20, right - 20),
            y: range(random, top + 20, bottom - 20),
            color: pick(random, PARK_TREES),
            radius: 12 + random() * 10,
          });
        }
        continue;
      }
      const district = districtAt(centreX, centreY);
      const roofs = ROOFS[district];
      if (random() < 0.45) {
        buildings.push({
          x: left + 8,
          y: top + 8,
          width: right - left - 16,
          height: bottom - top - 16,
          color: pick(random, roofs),
          district,
        });
      } else if (random() < 0.5) {
        const mid = left + (right - left) * (0.42 + random() * 0.16);
        buildings.push({
          x: left + 8, y: top + 8, width: mid - left - 16, height: bottom - top - 16,
          color: pick(random, roofs), district,
        });
        buildings.push({
          x: mid + 8, y: top + 8, width: right - mid - 16, height: bottom - top - 16,
          color: pick(random, roofs), district,
        });
      } else {
        const mid = top + (bottom - top) * (0.42 + random() * 0.16);
        buildings.push({
          x: left + 8, y: top + 8, width: right - left - 16, height: mid - top - 16,
          color: pick(random, roofs), district,
        });
        buildings.push({
          x: left + 8, y: mid + 8, width: right - left - 16, height: bottom - mid - 16,
          color: pick(random, roofs), district,
        });
      }
    }
  }
  // Boardwalk palms along the beach.
  for (let x = 120; x < WORLD.width - 60; x += 150) {
    trees.push({
      x: x + range(random, -20, 20),
      y: BEACH.y + 26,
      color: pick(random, PARK_TREES),
      radius: 13 + random() * 6,
    });
  }
  return { buildings, trees, parks, plazas };
}

/** Push a circle at (x, y) with `radius` out of every building it overlaps. */
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
    if (d2 === 0) {
      py = b.y - radius;
      continue;
    }
    const d = Math.sqrt(d2);
    px = nearestX + (dx / d) * radius;
    py = nearestY + (dy / d) * radius;
  }
  return { x: px, y: py };
}

/** True when a circle at (x, y) with `radius` overlaps any building. */
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

  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.width, park.height);
  }

  // The plaza: pale paving, a fountain basin and benches around it.
  for (const plaza of city.plazas) {
    ctx.fillStyle = '#d8cdb4';
    ctx.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
    ctx.fillStyle = '#8fb8c9';
    ctx.beginPath();
    ctx.arc(plaza.cx, plaza.cy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8f2f5';
    ctx.beginPath();
    ctx.arc(plaza.cx, plaza.cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8fb8c9';
    ctx.beginPath();
    ctx.arc(plaza.cx, plaza.cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a6a52';
    for (const [bx, by] of [[-70, -70], [70, -70], [-70, 70], [70, 70]]) {
      ctx.fillRect(plaza.cx + bx - 14, plaza.cy + by - 5, 28, 10);
    }
  }

  // Harbour water, then the beach: sand, shallows, deep water, boardwalk.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(HARBOUR.x, HARBOUR.y, HARBOUR.width, HARBOUR.height);
  ctx.fillStyle = BEACH.sand;
  ctx.fillRect(0, BEACH.y, WORLD.width, WORLD.height - BEACH.y);
  ctx.fillStyle = BEACH.water;
  ctx.fillRect(0, BEACH.y + 96, WORLD.width, WORLD.height - BEACH.y - 96);
  ctx.fillStyle = BEACH.deep;
  ctx.fillRect(0, BEACH.y + 130, WORLD.width, WORLD.height - BEACH.y - 130);
  ctx.fillStyle = '#c9a06b';
  ctx.fillRect(0, BEACH.y - 14, WORLD.width, 14);
  // Beach umbrellas and towels: a little life on the sand.
  for (let x = 180; x < WORLD.width - 120; x += 260) {
    const color = UMBRELLA_COLORS[Math.floor(x / 260) % UMBRELLA_COLORS.length];
    const ux = x + 40;
    const uy = BEACH.y + 52;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ux, uy, 22, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ux, uy, 22, Math.PI, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(ux + 30, uy + 4, 34, 14);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(ux + 30, uy + 4, 34, 4);
  }

  // Roads: asphalt, a pale edge, then the dashed centre line.
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

  // Buildings: soft shadow, roof, lighter inner roof, door, rooftop boxes.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(b.x + 8, b.y + 10, b.width, b.height);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(b.x + 10, b.y + 10, b.width - 20, b.height - 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(b.x + b.width / 2 - 9, b.y + b.height - 6, 18, 6);
    if (b.width > 120 && b.height > 120) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(b.x + 18, b.y + 18, 22, 16);
      ctx.fillRect(b.x + b.width - 40, b.y + b.height - 34, 22, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(b.x + b.width / 2 - 14, b.y + b.height / 2 - 10, 28, 20);
    }
  }

  // Trees, each with a shadow and a highlight.
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

  // Harbour pier and boats.
  ctx.fillStyle = '#a8825a';
  ctx.fillRect(HARBOUR.x - 90, HARBOUR.y + 180, 90, 16);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(HARBOUR.x + 40, HARBOUR.y + 60, 70, 22);
  ctx.fillRect(HARBOUR.x + 150, HARBOUR.y + 200, 60, 20);
  ctx.fillRect(HARBOUR.x + 60, HARBOUR.y + 320, 80, 24);
  ctx.fillStyle = '#c94f3d';
  ctx.fillRect(HARBOUR.x + 60, HARBOUR.y + 52, 30, 10);
  ctx.fillStyle = '#3d7ac9';
  ctx.fillRect(HARBOUR.x + 160, HARBOUR.y + 192, 24, 8);
  return canvas;
}
