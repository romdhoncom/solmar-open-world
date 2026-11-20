// Solmar 3D — builds the 3D city (roads, districts, buildings, parks,
// beach, harbour, lighthouse, bridge, pier, water, sky, lamps) and the
// collision helpers. The city is painted once from the fixed seed; each
// frame only moves the living things.
// Written fresh in this session for the v5 rebuild (prose spec only).

import * as THREE from 'three';
import {
  ISLAND_HALF, ROAD_HALF, ROADS_X, ROADS_Z, BEACH_Z, BOARDWALK_Z,
  CHANNEL_X0, CHANNEL_X1, PIER, BRIDGE, LIGHTHOUSE, PLACES, DISTRICTS,
  PARK_EVERY, STREETS_X, STREETS_Z, COLORS,
} from './config.js';
import { makeRng, range, int, pick, chance } from './random.js';

const WALL_COLORS = [0xe8dcc8, 0xdcc8a8, 0xc8b898, 0xe0c8b0, 0xd0b8a0, 0xf0e0cc];
const TREE_TRUNK = 0x6a4a2a;
const TREE_LEAF = 0x3a7a3a;
const PALM_LEAF = 0x4a8a3a;

function blockRanges() {
  // Block edges between the roads (road half-width 6) and the island edge.
  const edges = [-ISLAND_HALF, ...ROADS_X.flatMap((x) => [x - ROAD_HALF, x + ROAD_HALF]), ISLAND_HALF];
  const ranges = [];
  for (let i = 0; i < edges.length; i += 2) ranges.push([edges[i], edges[i + 1]]);
  return ranges;
}

function districtAt(x, z) {
  if (z >= 80) return 'beach';
  if (x < -80 && Math.abs(z) < 80) return 'market';
  if (x >= 80 && z < -80) return 'hills';
  if (x >= 80) return 'marina';
  return 'downtown';
}

export function buildWorld(G) {
  const rng = makeRng(G.seed);
  const scene = G.scene;
  const colliders = []; // {x0,z0,x1,z1} building footprints
  const lamps = [];
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe8a0, emissive: 0xffc860, emissiveIntensity: 0 });

  // ---- lights and sky -------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  scene.background = new THREE.Color(COLORS.skyDay);
  scene.fog = new THREE.Fog(COLORS.skyDay, 320, 900);

  const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, material, x, y, z, parent) {
    const m = new THREE.Mesh(boxGeo, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }

  // ---- ground, water, beach, boardwalk, pier, channel ----------------
  const groundMat = mat(0x9aa078);
  box(ISLAND_HALF * 2, 0.4, ISLAND_HALF * 2, groundMat, 0, -0.2, 0).receiveShadow = true;
  // Eastern headland strip (lighthouse) beyond the harbour channel.
  box(30, 0.4, ISLAND_HALF * 2, mat(0x8a9078), 230, -0.2, 0).receiveShadow = true;
  // Sea.
  const waterMat = mat(COLORS.water);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.45;
  scene.add(water);
  // Harbour channel basin (water inside the island edge).
  const channelMat = mat(COLORS.waterDeep);
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(CHANNEL_X1 - CHANNEL_X0, 320), channelMat);
  channel.rotation.x = -Math.PI / 2;
  channel.position.set((CHANNEL_X0 + CHANNEL_X1) / 2, 0.1, 0);
  scene.add(channel);
  // Beach sand (south edge).
  const sandMat = mat(COLORS.sand);
  box(395, 0.12, 35, sandMat, -12.5, 0.03, BEACH_Z + 17.5).receiveShadow = true;
  // Boardwalk along the beach.
  const walkMat = mat(COLORS.boardwalk);
  box(320, 0.16, 8, walkMat, 0, 0.04, BOARDWALK_Z).receiveShadow = true;
  // Pier into the sea.
  box(PIER.x1 - PIER.x0, 0.5, PIER.z1 - PIER.z0, walkMat, (PIER.x0 + PIER.x1) / 2, 0.15, (PIER.z0 + PIER.z1) / 2).receiveShadow = true;
  // Docks platform on the harbour edge (mission 11 fight ground).
  box(36, 0.5, 12, walkMat, 186, 0.15, 90).receiveShadow = true;
  // Bridge deck over the channel at z = 0.
  box(BRIDGE.x1 - BRIDGE.x0, 0.7, BRIDGE.z1 - BRIDGE.z0, mat(0x5a5a60), (BRIDGE.x0 + BRIDGE.x1) / 2, 0, 0).receiveShadow = true;
  box(BRIDGE.x1 - BRIDGE.x0, 0.3, 1, mat(0x8a8a90), (BRIDGE.x0 + BRIDGE.x1) / 2, 0.5, -7.5);
  box(BRIDGE.x1 - BRIDGE.x0, 0.3, 1, mat(0x8a8a90), (BRIDGE.x0 + BRIDGE.x1) / 2, 0.5, 7.5);

  // ---- roads, markings, crosswalks ------------------------------------
  const roadMat = mat(COLORS.asphalt);
  const lineMat = mat(0xd8d8c8);
  const walk = mat(0xe8e8e0);
  for (const x of ROADS_X) {
    const r = box(ROAD_HALF * 2, 0.06, 340, roadMat, x, 0.03, 0);
    r.receiveShadow = true;
    box(0.3, 0.02, 340, lineMat, x - ROAD_HALF + 0.4, 0.07, 0);
    box(0.3, 0.02, 340, lineMat, x + ROAD_HALF - 0.4, 0.07, 0);
    for (let z = -165; z <= 165; z += 16) box(0.4, 0.02, 6, lineMat, x, 0.07, z);
  }
  for (const z of ROADS_Z) {
    const r = box(340, 0.06, ROAD_HALF * 2, roadMat, 0, 0.03, z);
    r.receiveShadow = true;
    box(340, 0.02, 0.3, lineMat, 0, 0.07, z - ROAD_HALF + 0.4);
    box(340, 0.02, 0.3, lineMat, 0, 0.07, z + ROAD_HALF - 0.4);
    for (let x = -165; x <= 165; x += 16) box(6, 0.02, 0.4, lineMat, x, 0.07, z);
  }
  // Crosswalks at every intersection.
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      for (let k = -1; k <= 1; k++) {
        box(1.2, 0.02, 3, walk, x + k * 2.2, 0.08, z - ROAD_HALF - 1.5);
        box(1.2, 0.02, 3, walk, x + k * 2.2, 0.08, z + ROAD_HALF + 1.5);
      }
    }
  }

  // ---- blocks: buildings and parks ------------------------------------
  const xRanges = blockRanges();
  const zRanges = blockRanges();
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
  const leafGeo = new THREE.ConeGeometry(2.2, 5, 7);
  const palmTrunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 6, 6);
  const palmLeafGeo = new THREE.SphereGeometry(2.4, 7, 5);
  const trunkMat = mat(TREE_TRUNK);
  const leafMat = mat(TREE_LEAF);
  const palmLeafMat = mat(PALM_LEAF);
  function tree(x, z, palm) {
    const t = new THREE.Mesh(palm ? palmTrunkGeo : trunkGeo, trunkMat);
    t.position.set(x, palm ? 3 : 1.5, z);
    t.castShadow = true;
    scene.add(t);
    const l = new THREE.Mesh(palm ? palmLeafGeo : leafGeo, palm ? palmLeafMat : leafMat);
    l.position.set(x, palm ? 6.4 : 5, z);
    if (palm) l.scale.set(1, 0.45, 1);
    l.castShadow = true;
    scene.add(l);
  }

  let blockIndex = 0;
  for (const [x0, x1] of xRanges) {
    for (const [z0, z1] of zRanges) {
      blockIndex++;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // Skip blocks swallowed by the harbour channel or the sea, and
      // the easternmost column: the waterfront stays open for the docks
      // and marina, with no buildings rising out of the channel.
      if (x0 >= 160) continue;
      if (z0 >= BEACH_Z) continue;
      const district = districtAt(cx, cz);
      const d = DISTRICTS[district];
      if (blockIndex % PARK_EVERY === 0) {
        // Park: grass pad and trees.
        box(x1 - x0 - 4, 0.1, z1 - z0 - 4, mat(COLORS.grass), cx, 0.05, cz).receiveShadow = true;
        const n = int(rng, 4, 7);
        for (let i = 0; i < n; i++) tree(range(rng, x0 + 6, x1 - 6), range(rng, z0 + 6, z1 - 6), false);
        continue;
      }
      // Block pad.
      box(x1 - x0 - 2, 0.1, z1 - z0 - 2, mat(0xb0aca0), cx, 0.05, cz).receiveShadow = true;
      const count = int(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 12, Math.min(24, x1 - x0 - 10));
        const dep = range(rng, 12, Math.min(24, z1 - z0 - 10));
        const h = range(rng, d.hMin, d.hMax);
        const bx = range(rng, x0 + w / 2 + 4, x1 - w / 2 - 4);
        const bz = range(rng, z0 + dep / 2 + 4, z1 - dep / 2 - 4);
        const wall = mat(pick(rng, WALL_COLORS));
        const body = box(w, h, dep, wall, bx, h / 2, bz);
        body.castShadow = true;
        body.receiveShadow = true;
        const roof = box(w + 0.8, 0.9, dep + 0.8, mat(pick(rng, d.roofs)), bx, h + 0.45, bz);
        roof.castShadow = true;
        // Dark glass panels on the two street-facing sides.
        const glass = mat(0x2a3540);
        box(w * 0.7, h * 0.55, 0.2, glass, bx, h * 0.5, bz + dep / 2 + 0.05);
        box(w * 0.7, h * 0.55, 0.2, glass, bx, h * 0.5, bz - dep / 2 - 0.05);
        colliders.push({ x0: bx - w / 2, z0: bz - dep / 2, x1: bx + w / 2, z1: bz + dep / 2 });
      }
    }
  }

  // Palm trees along the boardwalk and beach.
  for (let x = -150; x <= 150; x += 18) {
    tree(x + range(rng, -4, 4), BOARDWALK_Z + 6, true);
  }
  // Trees along the marina edge.
  for (let z = -140; z <= 140; z += 26) {
    if (chance(rng, 0.6)) tree(176, z + range(rng, -6, 6), false);
  }

  // ---- street lamps ----------------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = mat(0x2a2a30);
  const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const x of ROADS_X) {
    for (const z of [-140, -60, 20, 100]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(x + ROAD_HALF + 1, 3, z);
      scene.add(p);
      const head = new THREE.Mesh(headGeo, lampHeadMat);
      head.position.set(x + ROAD_HALF + 1, 6.2, z);
      scene.add(head);
      lamps.push(head);
    }
  }

  // ---- lighthouse ------------------------------------------------------
  const lh = new THREE.Group();
  const lhWhite = mat(0xf0ead8);
  const lhRed = mat(0xc23b2e);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.5, 26, 10), lhWhite);
  base.position.y = 13;
  base.castShadow = true;
  lh.add(base);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.6, 5, 10), lhRed);
  band.position.y = 16;
  lh.add(band);
  const top = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffe8a0, emissive: 0xffd860, emissiveIntensity: 1 }));
  top.position.y = 27.5;
  lh.add(top);
  lh.position.set(LIGHTHOUSE.x, 0, LIGHTHOUSE.z);
  scene.add(lh);
  colliders.push({ x0: LIGHTHOUSE.x - 6, z0: LIGHTHOUSE.z - 6, x1: LIGHTHOUSE.x + 6, z1: LIGHTHOUSE.z + 6 });

  // ---- boats in the harbour and the sea --------------------------------
  const hullMat = mat(0x8a5a3a);
  const hullMat2 = mat(0xe8e8e0);
  const mastMat = mat(0x5a4a30);
  function boat(x, z, rot, big) {
    const g = new THREE.Group();
    const hull = box(big ? 10 : 6, 1.6, big ? 3.4 : 2.2, big ? hullMat2 : hullMat, 0, 0.4, 0, g);
    hull.castShadow = true;
    box(big ? 4 : 2.5, 1.4, big ? 2.4 : 1.6, mat(0x3a5a7a), 0, 1.6, 0, g);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, big ? 9 : 6, 6), mastMat);
    mast.position.set(0, big ? 6 : 4.4, 0);
    g.add(mast);
    g.position.set(x, 0.1, z);
    g.rotation.y = rot;
    scene.add(g);
  }
  boat(196, -40, 0.4, true);
  boat(200, 20, -0.3, false);
  boat(194, 120, 0.9, true);
  boat(260, -60, 1.2, true);
  boat(270, 80, -0.8, false);
  boat(-80, 240, 0.2, true);

  // ---- helpers ---------------------------------------------------------
  function groundHeight(x, z) {
    if (x >= BRIDGE.x0 && x <= BRIDGE.x1 && z >= BRIDGE.z0 && z <= BRIDGE.z1) return BRIDGE.y;
    if (x >= PIER.x0 && x <= PIER.x1 && z >= PIER.z0 && z <= PIER.z1) return 0.35;
    if (x >= 168 && x <= 204 && z >= 84 && z <= 96) return 0.3; // docks platform
    return 0;
  }

  function isWater(x, z) {
    if (x >= PIER.x0 && x <= PIER.x1 && z >= PIER.z0 && z <= PIER.z1) return false;
    if (x < -ISLAND_HALF || x > 245 || z < -ISLAND_HALF || z > ISLAND_HALF) return true;
    if (z >= BEACH_Z + 35) return true; // sea beyond the sand
    if (x >= CHANNEL_X0 && x <= CHANNEL_X1 && z >= -160 && z <= 160) {
      if (x >= BRIDGE.x0 && x <= BRIDGE.x1 && z >= BRIDGE.z0 && z <= BRIDGE.z1) return false;
      if (x >= 168 && x <= 204 && z >= 84 && z <= 96) return false;
      return true;
    }
    return false;
  }

  function onRoad(x, z) {
    for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
    for (const rz of ROADS_Z) if (Math.abs(z - rz) <= ROAD_HALF) return true;
    return false;
  }

  function streetAt(x, z) {
    let bestX = 0; let bestXd = 1e9;
    ROADS_X.forEach((rx, i) => { const d = Math.abs(x - rx); if (d < bestXd) { bestXd = d; bestX = i; } });
    let bestZ = 0; let bestZd = 1e9;
    ROADS_Z.forEach((rz, i) => { const d = Math.abs(z - rz); if (d < bestZd) { bestZd = d; bestZ = i; } });
    const street = bestXd < bestZd ? STREETS_X[bestX] : STREETS_Z[bestZ];
    return { street, district: districtAt(x, z) };
  }

  function collideCircle(x, z, r) {
    // Push a circle out of building footprints; returns corrected {x, z}.
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = x - c.x0; const pr = c.x1 - x;
          const pt = z - c.z0; const pb = c.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r;
          else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r;
          else z = c.z1 + r;
        }
      }
    }
    return { x, z };
  }

  function update(dt, hour, time) {
    // Water shimmer: slow drift of the channel plane and a gentle
    // brightening pulse on the sea.
    channel.position.y = 0.1 + Math.sin(time * 0.5) * 0.02;
    waterMat.color.setHex(COLORS.water);
    // Sun position and colour by hour; lamps on after dark.
    const el = Math.max(0.06, Math.sin(((hour - 6) / 12) * Math.PI));
    const az = -1.1;
    sun.position.set(Math.cos(az) * 320 * Math.max(0.2, Math.cos(((hour - 6) / 12) * Math.PI)), el * 320, Math.sin(az) * 320);
    const day = hour >= 6 && hour < 17.5;
    const sunset = hour >= 17.5 && hour < 19.5;
    const night = hour >= 19.5 || hour < 6;
    if (day) {
      sun.color.setHex(COLORS.sunDay); sun.intensity = 1.25;
      scene.background.setHex(COLORS.skyDay);
      scene.fog.color.setHex(COLORS.skyDay);
      hemi.intensity = 0.9;
    } else if (sunset) {
      sun.color.setHex(COLORS.sunSunset); sun.intensity = 1.0;
      scene.background.setHex(COLORS.skySunset);
      scene.fog.color.setHex(COLORS.skySunset);
      hemi.intensity = 0.6;
    } else {
      sun.color.setHex(COLORS.sunNight); sun.intensity = 0.35;
      scene.background.setHex(COLORS.skyNight);
      scene.fog.color.setHex(COLORS.skyNight);
      hemi.intensity = 0.3;
    }
    lampHeadMat.emissiveIntensity = night ? 1.2 : 0;
  }

  return {
    colliders, lamps, sun, hemi, water, channel,
    groundHeight, isWater, onRoad, streetAt, districtAt, collideCircle,
    places: PLACES, update,
  };
}
