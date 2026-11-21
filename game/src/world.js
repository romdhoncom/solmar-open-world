// Builds the 3D city once, from a fixed seed. Also owns collision helpers
// and the named spots the missions use.
import * as THREE from 'three';
import { CFG } from './config.js';
import { RNG } from './random.js';

const ROOFS = {
  downtown: 0xc96f3f,
  beach: 0xe8b4b8,
  market: 0x9c4a2f,
  hills: 0x5a6b7d,
  marina: 0x3f7d8c,
};
const WALLS = [0xe8dcc8, 0xd9c9a8, 0xcbb59a, 0xe0d0b8, 0xd4c5a0];

function mat(color, opts) {
  return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
}

export function buildWorld(scene) {
  const rng = new RNG(CFG.seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const lamps = [];

  // Sea and island ground.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.sea, CFG.sea),
    new THREE.MeshLambertMaterial({ color: 0x2a6f8e, transparent: true, opacity: 0.96 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.4;
  group.add(sea);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.island, CFG.island),
    mat(0x8a9a6a),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  group.add(ground);

  // Beach sand along the south edge, and a wooden boardwalk above it.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 44), mat(0xe6d3a3));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.08, 188);
  group.add(sand);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(420, 0.4, 10), mat(0x8a6a45));
  walk.position.set(0, 0.3, 166);
  walk.receiveShadow = true;
  group.add(walk);

  // Harbour channel on the east: a strip of water cutting into the island.
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(70, 140), mat(0x2a6f8e));
  channel.rotation.x = -Math.PI / 2;
  channel.position.set(180, -0.3, 0);
  group.add(channel);
  // Bridge deck across the channel at z = 0, with rails.
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(76, 0.5, 16), mat(0x6a6a72));
  bridge.position.set(182, 0, 0);
  bridge.castShadow = true; bridge.receiveShadow = true;
  group.add(bridge);
  for (const dz of [-7, 7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(76, 1, 0.6), mat(0xd8d8d8));
    rail.position.set(182, 0.85, dz);
    group.add(rail);
  }
  // Bridge approach ramps.
  for (const bx of [140, 224]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 16), mat(0x6a6a72));
    ramp.position.set(bx, 0, 0);
    group.add(ramp);
  }

  // Roads, pavements, centre dashes and crosswalks.
  const roadMat = mat(0x4a4d57);
  const paveMat = mat(0xb8b8ae);
  const dashMat = mat(0xf2f2e8);
  for (const r of CFG.roads) {
    for (const alongZ of [false, true]) {
      const len = CFG.island;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(len, CFG.roadW), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (alongZ) road.rotation.z = Math.PI / 2;
      road.position.set(alongZ ? r : 0, 0.05, alongZ ? 0 : r);
      road.receiveShadow = true;
      group.add(road);
      // Pavements on both sides.
      for (const s of [-1, 1]) {
        const pave = new THREE.Mesh(new THREE.PlaneGeometry(len, CFG.paveW), paveMat);
        pave.rotation.x = -Math.PI / 2;
        if (alongZ) pave.rotation.z = Math.PI / 2;
        const off = s * (CFG.roadW / 2 + CFG.paveW / 2);
        pave.position.set(alongZ ? r + off : 0, 0.06, alongZ ? 0 : r + off);
        group.add(pave);
      }
      // Dashed centre line.
      for (let d = -195; d <= 195; d += 12) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.5), dashMat);
        if (alongZ) dash.rotation.y = Math.PI / 2;
        dash.position.set(alongZ ? r : d, 0.09, alongZ ? d : r);
        group.add(dash);
      }
    }
  }
  // Crosswalks at every intersection.
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 5), dashMat);
        stripe.position.set(rx + i * 2.2, 0.09, rz + CFG.roadW / 2 + 1.5);
        group.add(stripe);
      }
    }
  }

  // City blocks: 4 x 4 blocks between the roads. One in six is a park.
  const blockCenters = [-112.5, -37.5, 37.5, 112.5];
  let blockIndex = 0;
  const treeGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
  const treeTopGeo = new THREE.ConeGeometry(2.6, 6, 7);
  const trunkMat = mat(0x6a4a2a);
  const leafMat = mat(0x3f7a3a);
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      blockIndex++;
      // The harbour eats the far-east blocks near the channel.
      if (bx > 100 && Math.abs(bz) < 80) continue;
      const district = districtFor(bx, bz);
      if (blockIndex % 6 === 0) {
        // Park: grass square with trees and a bench.
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), mat(0x5d8a4a));
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(bx, 0.07, bz);
        group.add(grass);
        for (let t = 0; t < 7; t++) {
          const tx = bx + rng.range(-22, 22);
          const tz = bz + rng.range(-22, 22);
          const trunk = new THREE.Mesh(treeGeo, trunkMat);
          trunk.position.set(tx, 1.5, tz);
          trunk.castShadow = true;
          group.add(trunk);
          const top = new THREE.Mesh(treeTopGeo, leafMat);
          top.position.set(tx, 5.5, tz);
          top.castShadow = true;
          group.add(top);
        }
        continue;
      }
      // Buildings: 1-4 boxes per block, roof colour by district.
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const h = rng.range(8, district === 'downtown' ? 30 : 16);
        const ox = bx + (i % 2 === 0 ? -14 : 14) + rng.range(-4, 4);
        const oz = bz + (i < 2 ? -14 : 14) + rng.range(-4, 4);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(rng.pick(WALLS)));
        b.position.set(ox, h / 2, oz);
        b.castShadow = true; b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.8, d + 1.2), mat(ROOFS[district]));
        roof.position.set(ox, h + 0.4, oz);
        roof.castShadow = true;
        group.add(roof);
        // Dark window band on the street-facing side.
        const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.45, 0.3), mat(0x2a3542));
        win.position.set(ox, h * 0.55, oz + d / 2 + 0.15);
        group.add(win);
        colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
      }
    }
  }

  // Marina: boats in the water east of the channel, and a dock.
  const boatHull = mat(0xf2f2f2);
  const boatSail = mat(0xff8c42);
  for (let i = 0; i < 6; i++) {
    const bx = 208 + rng.range(-6, 6);
    const bz = -110 + i * 38 + rng.range(-6, 6);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), boatHull);
    hull.position.set(bx, 0.4, bz);
    hull.rotation.y = rng.range(-0.3, 0.3);
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), mat(0x5a3a22));
    mast.position.set(bx, 4.5, bz);
    group.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), boatSail);
    sail.position.set(bx, 6.5, bz);
    group.add(sail);
  }
  const dock = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 120), mat(0x8a6a45));
  dock.position.set(152, 0.5, 0);
  group.add(dock);

  // Pier reaching into the sea from the beach.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 70), mat(0x8a6a45));
  pier.position.set(0, 0.6, 232);
  group.add(pier);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), mat(0x5a3a22));
    post.position.set(i % 2 === 0 ? -4.5 : 4.5, 0, 205 + i * 10);
    group.add(post);
  }

  // Lighthouse on the headland, north-east.
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), mat(0xf2f2f2));
  tower.position.y = 13;
  tower.castShadow = true;
  lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4, 10), mat(0xd23c2e));
  band.position.y = 18;
  lh.add(band);
  const lampTop = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc84a }));
  lampTop.position.y = 27.5;
  lh.add(lampTop);
  lh.position.set(196, 0, -146);
  group.add(lh);
  colliders.push({ minX: 191, maxX: 201, minZ: -151, maxZ: -141 });

  // Street lamps at intersections; they light up in the evening.
  const poleMat = mat(0x3a3a3a);
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 5), poleMat);
      pole.position.set(rx + 8, 3, rz + 8);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x000000 }));
      head.position.set(rx + 8, 6.2, rz + 8);
      group.add(head);
      lamps.push(head);
    }
  }

  // Water shimmer: a few pale wave strips drifting on the sea.
  const waves = [];
  const waveMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 10; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(rng.range(8, 20), 0.15, 1), waveMat);
    w.position.set(rng.range(-300, 300), 0.1, rng.range(-300, 300));
    if (Math.abs(w.position.x) < 220 && Math.abs(w.position.z) < 220) w.position.x += 260;
    group.add(w);
    waves.push(w);
  }

  function districtFor(x, z) {
    if (x > 100) return 'marina';
    if (z > 130) return 'beach';
    if (z < -100) return 'hills';
    if (x < -75) return 'market';
    return 'downtown';
  }

  function collide(x, z, r) {
    // Push a circle out of every building AABB it overlaps.
    let px = x; let pz = z;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(px, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - cx; const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * r;
          pz = cz + (dz / d) * r;
        } else {
          pz = c.maxZ + r;
        }
      }
    }
    return { x: px, z: pz };
  }

  function districtAt(x, z) {
    if (z > 168) return 'Beach';
    if (x > 150) return 'Marina';
    if (z < -130) return 'Hills';
    return CFG.districts[districtFor(x, z)].name;
  }

  function streetName(x, z) {
    const ave = CFG.roads.reduce((a, b) => (Math.abs(x - b) < Math.abs(x - a) ? b : a));
    const st = CFG.roads.reduce((a, b) => (Math.abs(z - b) < Math.abs(z - a) ? b : a));
    const aveName = ave === 0 ? 'Solmar Blvd' : ave < 0 ? `West ${Math.abs(ave)} Ave` : `East ${ave} Ave`;
    const stName = st === 0 ? 'Central St' : st < 0 ? `North ${Math.abs(st)} St` : `South ${st} St`;
    return `${aveName} · ${stName}`;
  }

  return {
    group, colliders, lamps, waves,
    collide, districtAt, streetName,
    roads: CFG.roads,
    spots: CFG.spots,
    bounds: 205,
  };
}
