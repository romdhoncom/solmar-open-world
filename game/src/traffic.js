// Traffic cars driving the grid and pedestrians on the pavements.
import * as THREE from 'three';
import { CAR_MODELS, createCar } from './vehicles.js';

export function createTraffic(G) {
  const list = [];
  for (let i = 0; i < 30; i++) {
    const model = G.rng.pick(CAR_MODELS.filter((m) => m.name !== 'Cruiser'));
    const axis = G.rng.chance(0.5) ? 'x' : 'z';
    const line = G.rng.pick(G.world.roads);
    const pos = G.rng.range(-180, 180);
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? pos : line + (dir > 0 ? 3 : -3);
    const z = axis === 'x' ? line + (dir > 0 ? -3 : 3) : pos;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(model, x, z, heading, { traffic: true });
    car.speed = G.rng.range(8, 13);
    G.scene.add(car.mesh);
    G.cars.push(car);
    list.push({ car, axis, line, dir, speed: car.speed });
  }
  return list;
}

export function updateTraffic(dt, G) {
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const pz = p.car ? p.car.z : p.z;
  for (const t of G.traffic) {
    const c = t.car;
    // Slow down for the player ahead.
    const dx = px - c.x, dz = pz - c.z;
    const ahead = Math.sin(c.heading) * dx + Math.cos(c.heading) * dz;
    const dist = Math.hypot(dx, dz);
    let sp = t.speed;
    if (ahead > 0 && dist < 12) sp = Math.max(0, t.speed * (dist / 12));
    c.speed = sp;
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    // Turn at an intersection sometimes, or wrap at the island edge.
    const along = t.axis === 'x' ? c.x : c.z;
    if (Math.abs(along) > 185) {
      if (t.axis === 'x') c.x = -Math.sign(along) * 185; else c.z = -Math.sign(along) * 185;
    }
    for (const r of G.world.roads) {
      const near = Math.abs(along - r) < 1.2;
      if (near && G.rng.chance(dt * 0.12)) {
        // Turn onto the crossing road.
        const newAxis = t.axis === 'x' ? 'z' : 'x';
        const newDir = G.rng.chance(0.5) ? 1 : -1;
        t.axis = newAxis;
        t.dir = newDir;
        t.line = r;
        c.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
        if (newAxis === 'x') { c.z = r + (newDir > 0 ? -3 : 3); } else { c.x = r + (newDir > 0 ? 3 : -3); }
        break;
      }
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
}

const PED_COLORS = [0xe8b4b8, 0x7fb069, 0x4a6fa5, 0xf2c200, 0x9c4a2f, 0xe8e8e8, 0x6a4a8a];

export function createPeds(G) {
  const list = [];
  for (let i = 0; i < 48; i++) {
    const g = new THREE.Group();
    const color = G.rng.pick(PED_COLORS);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 6),
      new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.7;
    g.add(head);
    const x = G.rng.range(-170, 170);
    const z = G.rng.range(-170, 170);
    g.position.set(x, 0, z);
    G.scene.add(g);
    list.push({
      mesh: g, x, z, heading: G.rng.range(0, Math.PI * 2),
      speed: G.rng.range(1.2, 2.4),
      tx: G.rng.range(-170, 170), tz: G.rng.range(-170, 170),
      flee: false,
    });
  }
  return list;
}

export function updatePeds(dt, G) {
  const px = G.player.car ? G.player.car.x : G.player.x;
  const pz = G.player.car ? G.player.car.z : G.player.z;
  for (const p of G.peds) {
    const d = Math.hypot(px - p.x, pz - p.z);
    if (G.shotFired && d < 25) p.flee = true;
    if (p.flee) {
      // Run away from the player.
      const a = Math.atan2(p.x - px, p.z - pz);
      p.x += Math.sin(a) * 5 * dt;
      p.z += Math.cos(a) * 5 * dt;
      p.heading = a;
      if (d > 45) p.flee = false;
    } else {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        p.tx = G.rng.range(-170, 170);
        p.tz = G.rng.range(-170, 170);
      } else {
        p.heading = Math.atan2(dx, dz);
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
      }
    }
    // Hit by the player's car: wanted up, ped falls and gets up.
    if (G.player.car && d < 2.2) {
      G.police.addWanted(1, 'hit a pedestrian');
      p.x += Math.sin(p.heading) * 6;
      p.z += Math.cos(p.heading) * 6;
      p.tx = G.rng.range(-170, 170);
      p.tz = G.rng.range(-170, 170);
    }
    p.mesh.position.set(p.x, Math.abs(Math.sin(G.now * 6 + p.x)) * 0.05, p.z);
    p.mesh.rotation.y = p.heading;
  }
}
