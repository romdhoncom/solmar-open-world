// Builds the 3D city of Solmar: road grid, districts, buildings, parks,
// beach, harbour channel with a bridge, pier, marina, lighthouse, water
// and sky. Static geometry is instanced so the frame stays cheap; only
// the living things move each frame.

import * as THREE from 'three';
import { WORLD, ROADS, DISTRICTS, STREETS_X, STREETS_Z } from './config.js';
import { makeRng } from './random.js';

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d8cbb2'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2c3440';
  for (let r = 0; r < 4; r++)
    for (let col = 0; col < 4; col++) {
      g.fillRect(14 + col * 28, 14 + r * 28, 16, 18);
      g.fillStyle = '#7a8a9a';
      g.fillRect(14 + col * 28, 14 + r * 28, 16, 6);
      g.fillStyle = '#2c3440';
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function districtAt(x, z) {
  for (const d of Object.values(DISTRICTS)) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS.downtown;
}

export function streetAt(x, z) {
  const ix = ROADS.reduce((b, r, i) => (Math.abs(x - r) < Math.abs(x - ROADS[b]) ? i : b), 0);
  const iz = ROADS.reduce((b, r, i) => (Math.abs(z - r) < Math.abs(z - ROADS[b]) ? i : b), 0);
  return `${STREETS_X[ix]} / ${STREETS_Z[iz]}`;
}

export function buildWorld(scene) {
  const rng = makeRng(WORLD.seed);
  const world = {
    colliders: [],
    landmarks: {
      garage: { x: -60, z: 60, name: 'Marlowe Motors' },
      hospital: { x: 60, z: -60, name: 'St. Anselm Hospital' },
      safehouse: { x: 0, z: 120, name: 'Safehouse' },
      bank: { x: 0, z: 0, name: 'Solmar Bank' },
      marina: { x: 180, z: 90, name: 'Marina' },
      policeStation: { x: 120, z: -60, name: 'Police Station' },
      hideout: { x: -120, z: 120, name: 'Hideout' },
      pier: { x: 120, z: 215, name: 'Pier' },
      bridge: { x: 180, z: 0, name: 'Harbour Bridge' },
    },
    lampHeads: [],
    water: null,
    sun: null,
    hemi: null,
  };
  const addCollider = (x0, z0, x1, z1) => world.colliders.push({ x0, z0, x1, z1 });

  // --- sky, light, water -------------------------------------------------
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xff9e66, 180, 700);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc27a, 2.2);
  sun.position.set(-120, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  world.sun = sun; world.hemi = hemi;

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ color: 0x1a5f8a, roughness: 0.25, metalness: 0.1 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.4;
  scene.add(water);
  world.water = water;

  // --- island ground, sand, roads ---------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    new THREE.MeshStandardMaterial({ color: 0x9aa08a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 34),
    new THREE.MeshStandardMaterial({ color: 0xe8d49a, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 222);
  sand.receiveShadow = true;
  scene.add(sand);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.95 });
  for (const r of ROADS) {
    for (const [w, d, x, z] of [[480, 12, 0, r], [12, 480, r, 0]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.03, z);
      road.receiveShadow = true;
      scene.add(road);
    }
  }

  // Centre dashes (instanced) and crosswalks (instanced).
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 4);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f0dc });
  const dashCount = ROADS.length * 2 * 24;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const e = new THREE.Euler(); const s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const r of ROADS) {
      for (let k = -11; k <= 11; k += 2) {
        e.set(0, 0, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(k * 20, 0.06, r), q, s); dashes.setMatrixAt(i++, m);
        e.set(0, Math.PI / 2, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(r, 0.06, k * 20), q, s); dashes.setMatrixAt(i++, m);
      }
    }
    dashes.count = i;
  }
  scene.add(dashes);

  const crossGeo = new THREE.BoxGeometry(3, 0.06, 1.2);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xf5f0dc });
  // 49 intersections x 4 sides x 5 strips = 980 crosswalk strips.
  const crosses = new THREE.InstancedMesh(crossGeo, crossMat, ROADS.length * ROADS.length * 20);
  {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const e = new THREE.Euler(); const s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const rx of ROADS) for (const rz of ROADS) {
      for (let k = -2; k <= 2; k++) {
        e.set(0, 0, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(rx + k * 2.4, 0.06, rz - 7.5), q, s); crosses.setMatrixAt(i++, m);
        m.compose(new THREE.Vector3(rx + k * 2.4, 0.06, rz + 7.5), q, s); crosses.setMatrixAt(i++, m);
        e.set(0, Math.PI / 2, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(rx - 7.5, 0.06, rz + k * 2.4), q, s); crosses.setMatrixAt(i++, m);
        m.compose(new THREE.Vector3(rx + 7.5, 0.06, rz + k * 2.4), q, s); crosses.setMatrixAt(i++, m);
      }
    }
    crosses.count = i;
  }
  scene.add(crosses);

  // --- harbour channel (east) and bridge ---------------------------------
  const channel = new THREE.Mesh(
    new THREE.PlaneGeometry(62, 120),
    new THREE.MeshStandardMaterial({ color: 0x1a5f8a, roughness: 0.2 })
  );
  channel.rotation.x = -Math.PI / 2;
  channel.position.set(180, 0.05, 0);
  scene.add(channel);

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(64, 0.7, 14),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 })
  );
  bridge.position.set(180, 0.35, 0);
  bridge.castShadow = true; bridge.receiveShadow = true;
  scene.add(bridge);
  for (const dz of [-6.5, 6.5]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(64, 1.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xc2b49a })
    );
    rail.position.set(180, 1.1, dz);
    scene.add(rail);
  }

  // --- pier and boardwalk (south) ----------------------------------------
  const pier = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
  for (let k = 0; k < 10; k++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 3), plankMat);
    p.position.set(0, 0.2, k * 3);
    p.castShadow = true;
    pier.add(p);
  }
  pier.position.set(120, 0, 210);
  scene.add(pier);

  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(480, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xa8824e, roughness: 1 })
  );
  boardwalk.position.set(0, 0.15, 204);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  // --- buildings (instanced bodies + roofs), parks, trees ----------------
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ map: windowTexture(), roughness: 0.9 });
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const bodies = [];
  const roofs = [];
  const treeSpots = [];
  let blockIndex = 0;
  for (let bx = 0; bx < 7; bx++) for (let bz = 0; bz < 7; bz++) {
    const cx = -180 + bx * 60 + 30;
    const cz = -180 + bz * 60 + 30;
    blockIndex++;
    // Harbour channel cuts the two blocks it crosses.
    if (cx > 120 && Math.abs(cz) < 60) continue;
    // One block in six is a park.
    if (blockIndex % 6 === 0) {
      const park = new THREE.Mesh(
        new THREE.PlaneGeometry(46, 46),
        new THREE.MeshStandardMaterial({ color: 0x4a8a3f, roughness: 1 })
      );
      park.rotation.x = -Math.PI / 2;
      park.position.set(cx, 0.04, cz);
      park.receiveShadow = true;
      scene.add(park);
      for (let t = 0; t < 6; t++) treeSpots.push([cx + rng.range(-18, 18), cz + rng.range(-18, 18)]);
      continue;
    }
    const d = districtAt(cx, cz);
    const n = rng.int(2, 4);
    for (let b = 0; b < n; b++) {
      const w = rng.range(10, 18), dep = rng.range(10, 18), h = rng.range(7, 20);
      const x = cx + rng.range(-14, 14), z = cz + rng.range(-14, 14);
      bodies.push({ x, z, w, h, d: dep, tint: rng.range(0.75, 1.05) });
      roofs.push({ x, z, w: w + 1, h: 1.2, d: dep + 1, color: d.roof });
      addCollider(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2);
    }
  }
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, bodies.length);
  const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, roofs.length);
  {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const col = new THREE.Color();
    bodies.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      bodyMesh.setMatrixAt(i, m);
      bodyMesh.setColorAt(i, col.setScalar(b.tint));
    });
    roofs.forEach((r, i) => {
      m.compose(new THREE.Vector3(r.x, bodies[i].h + 0.6, r.z), q, new THREE.Vector3(r.w, r.h, r.d));
      roofMesh.setMatrixAt(i, m);
      roofMesh.setColorAt(i, col.setHex(r.color));
    });
  }
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  roofMesh.castShadow = true;
  scene.add(bodyMesh); scene.add(roofMesh);

  // Trees: instanced trunks and foliage cones.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const leafGeo = new THREE.ConeGeometry(2.6, 6, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
  {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    treeSpots.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, 1.5, z), q, new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 5.5, z), q, new THREE.Vector3(1, 1, 1));
      leaves.setMatrixAt(i, m);
    });
  }
  trunks.castShadow = true; leaves.castShadow = true;
  scene.add(trunks); scene.add(leaves);

  // --- lighthouse on the headland ----------------------------------------
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(14, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6a62, roughness: 1 })
  );
  rock.position.set(200, 5, -200);
  scene.add(rock);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 22, 10),
    new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.8 })
  );
  tower.position.set(200, 20, -200);
  tower.castShadow = true;
  scene.add(tower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0xc22e2e, emissive: 0xffcc44, emissiveIntensity: 0.8 })
  );
  lampRoom.position.set(200, 32, -200);
  scene.add(lampRoom);
  world.lampHeads.push(lampRoom);

  // --- boats in the channel and marina -----------------------------------
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.7 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 9), hullMat);
    hull.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 3), boatMat);
    cabin.position.set(0, 1.6, -1);
    g.add(hull); g.add(cabin);
    const inChannel = i < 5;
    g.position.set(
      inChannel ? rng.range(160, 200) : rng.range(195, 225),
      0,
      inChannel ? rng.range(-45, 45) : rng.range(100, 160)
    );
    g.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(g);
  }

  // --- street lamps along the roads --------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 7, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.8 });
  const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc84a, emissiveIntensity: 0.2 });
  const lampCount = 56;
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampCount);
  {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    for (let i = 0; i < lampCount; i++) {
      const road = ROADS[i % ROADS.length];
      const along = -180 + Math.floor(i / ROADS.length) * 60 + (i % 2) * 30;
      const horiz = i % 2 === 0;
      const x = horiz ? along : road + 7;
      const z = horiz ? road + 7 : along;
      m.compose(new THREE.Vector3(x, 3.5, z), q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 7.1, z), q, new THREE.Vector3(1, 1, 1));
      heads.setMatrixAt(i, m);
    }
  }
  scene.add(poles); scene.add(heads);
  world.lampMat = headMat;

  return world;
}

// Push a circle (player, car, pedestrian) out of building colliders.
export function resolveCollisions(world, x, z, r) {
  for (const c of world.colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    } else if (d2 <= 0.0001 && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) {
      // Inside the box: push out along the smallest penetration.
      const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
      else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
    }
  }
  const H = WORLD.half - 6;
  x = Math.max(-H, Math.min(H, x));
  z = Math.max(-H, Math.min(H, z));
  return [x, z];
}
