// Solmar 3D — traffic cars and pedestrians.
// Written fresh in this session for the v5 rebuild (prose spec only).
// About 30 traffic cars drive the road grid, turning at intersections
// and keeping to their lane; about 48 pedestrians walk the pavements
// and cross at crosswalks. Both react simply: they slow or step aside
// when the player drives at them, and they flee when shots are fired.

import * as THREE from 'three';
import { TRAFFIC_CARS, PEDESTRIANS, TRAFFIC_SPEED, ROADS_X, ROADS_Z, ROAD_HALF } from './config.js';
import { makeRng, range, int, pick } from './random.js';
import { buildCarMesh } from './vehicles.js';
import { CAR_MODELS } from './config.js';

export function createTraffic(G) {
  const rng = makeRng(G.seed + 202);
  const cars = [];
  const peds = [];
  const pedColors = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xd87a4a, 0x4ad8d8, 0xe8e8e8];
  const fleeFrom = { x: 0, z: 0, until: 0 };

  function spawnTrafficCar() {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? ROADS_X : ROADS_Z);
    const along = range(rng, -160, 160);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (rng() < 0.5 ? -1 : 1) * 3;
    const model = CAR_MODELS[int(rng, 0, 5)];
    const mesh = buildCarMesh(model);
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const car = {
      mesh, model, x, z,
      heading: vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      vertical, road, dir, lane,
      speed: range(rng, TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED * 1.1),
      turnAt: null,
    };
    mesh.rotation.y = car.heading;
    cars.push(car);
    return car;
  }

  function spawnPed() {
    const onRoad = pick(rng, ROADS_X);
    const along = range(rng, -160, 160);
    const side = rng() < 0.5 ? -1 : 1;
    const vertical = rng() < 0.5;
    const x = vertical ? onRoad + side * (ROAD_HALF + 2.5) : along;
    const z = vertical ? along : onRoad + side * (ROAD_HALF + 2.5);
    const color = pick(rng, pedColors);
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc89878 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 3, 6), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), skinMat);
    head.position.y = 1.85;
    group.add(head);
    group.position.set(x, 0, z);
    G.scene.add(group);
    const ped = {
      mesh: group, x, z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.2),
      vertical, road: onRoad, side,
      phase: rng() * 6,
      flee: 0,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < TRAFFIC_CARS; i++) spawnTrafficCar();
  for (let i = 0; i < PEDESTRIANS; i++) spawnPed();

  function scare(x, z, seconds) {
    fleeFrom.x = x; fleeFrom.z = z; fleeFrom.until = G.time + seconds;
  }

  function updateTrafficCar(c, dt) {
    // Slow down if the player's car is right ahead.
    const playerCar = G.player.inCar;
    let targetSpeed = c.speed;
    if (playerCar) {
      const d = Math.hypot(playerCar.x - c.x, playerCar.z - c.z);
      if (d < 12) targetSpeed = c.speed * 0.3;
    }
    const step = targetSpeed * dt;
    if (c.vertical) {
      c.z += Math.cos(c.heading) * step;
      // Turn at an intersection sometimes.
      const nearRoad = ROADS_Z.find((rz) => Math.abs(c.z - rz) < 1.2);
      if (nearRoad !== undefined && rng() < 0.02) {
        c.vertical = false;
        c.road = nearRoad;
        c.dir = rng() < 0.5 ? 1 : -1;
        c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        c.x = c.road + c.lane;
      }
      if (c.z > 175 || c.z < -175) { c.z = -c.z * 0.95; c.heading += Math.PI; }
    } else {
      c.x += Math.sin(c.heading) * step;
      const nearRoad = ROADS_X.find((rx) => Math.abs(c.x - rx) < 1.2);
      if (nearRoad !== undefined && rng() < 0.02) {
        c.vertical = true;
        c.road = nearRoad;
        c.dir = rng() < 0.5 ? 1 : -1;
        c.heading = c.dir > 0 ? 0 : Math.PI;
        c.z = c.road + c.lane;
      }
      // East-west traffic can cross the harbour bridge onto the
      // headland strip (x to 245); beyond that it turns back.
      if (c.x > 245 || c.x < -175) { c.x = -c.x * 0.95; c.heading += Math.PI; }
    }
    // Stay in lane: drift back toward the road line.
    if (c.vertical) {
      const target = c.road + c.lane;
      c.x += (target - c.x) * Math.min(1, dt * 2);
    } else {
      const target = c.road + c.lane;
      c.z += (target - c.z) * Math.min(1, dt * 2);
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }

  function updatePed(p, dt) {
    const fleeing = G.time < fleeFrom.until && Math.hypot(p.x - fleeFrom.x, p.z - fleeFrom.z) < 30;
    let speed = p.speed;
    let heading = p.heading;
    if (p.walkDir === undefined) p.walkDir = rng() < 0.5 ? 1 : -1;
    if (fleeing) {
      // Run away from the scare point.
      const dx = p.x - fleeFrom.x;
      const dz = p.z - fleeFrom.z;
      heading = Math.atan2(dx, dz);
      speed = p.speed * 3;
      p.x += Math.sin(heading) * speed * dt;
      p.z += Math.cos(heading) * speed * dt;
      const fixed = G.world.collideCircle(p.x, p.z, 0.5);
      p.x = fixed.x; p.z = fixed.z;
    } else if (p.vertical) {
      // Walk along the pavement beside a vertical road (north/south).
      p.z += p.walkDir * speed * dt;
      if (p.z > 175) { p.z = 175; p.walkDir = -1; }
      if (p.z < -175) { p.z = -175; p.walkDir = 1; }
      p.x = p.road + p.side * (ROAD_HALF + 2.5);
      heading = p.walkDir > 0 ? 0 : Math.PI;
    } else {
      // Walk along the pavement beside a horizontal road (east/west).
      p.x += p.walkDir * speed * dt;
      if (p.x > 175) { p.x = 175; p.walkDir = -1; }
      if (p.x < -175) { p.x = -175; p.walkDir = 1; }
      p.z = p.road + p.side * (ROAD_HALF + 2.5);
      heading = p.walkDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    p.heading = heading;
    p.phase += dt * speed * 2;
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.08, p.z);
    p.mesh.rotation.y = p.heading;
  }

  function update(dt) {
    for (const c of cars) updateTrafficCar(c, dt);
    for (const p of peds) updatePed(p, dt);
  }

  return { cars, peds, update, scare };
}
