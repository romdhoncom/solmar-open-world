// Traffic cars that follow the road grid and pedestrians on the pavements.
// Both react simply: they slow or step aside when the player drives at
// them, and they flee when shots are fired nearby.

import * as THREE from 'three';
import { ROADS, CARS } from './config.js';
import { makeRng } from './random.js';
import { buildCarMesh } from './vehicles.js';

const PALETTE = [0xd8d0c0, 0xc22e2e, 0x2e6ac2, 0x2ec2a8, 0xd8a13c, 0x8a8f96, 0xe86ab0, 0x3a3f46];

export class Traffic {
  constructor(scene, seed) {
    this.rng = makeRng(seed + 77);
    this.cars = [];
    this.peds = [];
    this.scene = scene;
    for (let i = 0; i < 30; i++) this.spawnCar();
    for (let i = 0; i < 48; i++) this.spawnPed();
  }

  spawnCar() {
    const horiz = this.rng.chance(0.5);
    const road = this.rng.pick(ROADS);
    const along = this.rng.range(-180, 180);
    const model = { ...this.rng.pick(CARS), color: this.rng.pick(PALETTE) };
    const mesh = buildCarMesh(model);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const x = horiz ? along : road + (dir > 0 ? 3 : -3);
    const z = horiz ? road + (dir > 0 ? 3 : -3) : along;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = horiz ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    this.scene.add(mesh);
    this.cars.push({
      mesh, model, x, z, horiz, road, dir,
      speed: this.rng.range(8, 14), slowUntil: 0,
    });
  }

  spawnPed() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: this.rng.pick(PALETTE), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 3, 6), shirt);
    body.position.y = 1.1;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.8 })
    );
    head.position.y = 1.95;
    g.add(body); g.add(head);
    const x = this.rng.range(-180, 180);
    const z = this.rng.range(-180, 180);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.peds.push({
      group: g, x, z,
      tx: x + this.rng.range(-40, 40), tz: z + this.rng.range(-40, 40),
      speed: this.rng.range(1.2, 2.2), fleeUntil: 0, fleeX: 0, fleeZ: 0,
    });
  }

  update(dt, playerPos, gunshotAt, time) {
    for (const c of this.cars) {
      let speed = c.speed;
      if (time < c.slowUntil) speed *= 0.25;
      const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 14 && c.speed > 0) { // slow for the player in the way
        const ahead = c.horiz ? dx * c.dir : dz * c.dir;
        if (ahead > 0 && ahead < 14) speed *= 0.2;
      }
      if (gunshotAt) {
        const gd = Math.hypot(gunshotAt.x - c.x, gunshotAt.z - c.z);
        if (gd < 30) speed = c.speed * 1.6; // traffic flees gunfire
      }
      if (c.horiz) {
        c.x += c.dir * speed * dt;
        if (c.x > 186) c.x = -186; else if (c.x < -186) c.x = 186;
      } else {
        c.z += c.dir * speed * dt;
        if (c.z > 186) c.z = -186; else if (c.z < -186) c.z = 186;
      }
      c.mesh.position.set(c.x, 0, c.z);
    }
    for (const p of this.peds) {
      let tx = p.tx, tz = p.tz;
      if (time < p.fleeUntil) { tx = p.fleeX; tz = p.fleeZ; }
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        p.tx = p.x + this.rng.range(-50, 50);
        p.tz = p.z + this.rng.range(-50, 50);
        p.tx = Math.max(-200, Math.min(200, p.tx));
        p.tz = Math.max(-200, Math.min(200, p.tz));
        continue;
      }
      const sp = time < p.fleeUntil ? p.speed * 2.6 : p.speed;
      p.x += (dx / d) * sp * dt;
      p.z += (dz / d) * sp * dt;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = Math.atan2(dx, dz);
      p.group.position.y = Math.abs(Math.sin(time * 6 + p.x)) * 0.06; // walking bob
    }
  }

  fleeFrom(x, z, time) {
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 26) {
        p.fleeUntil = time + 3;
        const a = Math.atan2(p.z - z, p.x - x);
        p.fleeX = p.x + Math.cos(a) * 40;
        p.fleeZ = p.z + Math.sin(a) * 40;
      }
    }
  }
}
