// Car models: nine cars built from boxes in code, with driving physics,
// a damage model, smoke when wrecked, and repair at Marlowe Motors.

import * as THREE from 'three';
import { CARS } from './config.js';
import { resolveCollisions } from './world.js';

export function buildCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: model.color, roughness: 0.35, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.15, metalness: 0.6 })
  );
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffdf6a, emissiveIntensity: 0.7 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    l.position.set(x, 0.6, 2.22);
    g.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2233ff, emissive: 0x2244ff, emissiveIntensity: 1.2 })
    );
    bar.position.set(0, 1.55, -0.2);
    g.add(bar);
  }
  g.userData.model = model;
  return g;
}

export class Car {
  constructor(scene, model, x, z, heading = 0, isPolice = false) {
    this.model = model;
    this.mesh = buildCarMesh(model, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.damage = 0; // 0..100, wrecked at 100
    this.isPolice = isPolice;
    this.smoke = null;
  }

  get wrecked() { return this.damage >= 100; }

  drive(axis, dt, world, audio) {
    if (this.wrecked) { this.speed *= 0.9; return { crashed: false, speed: 0 }; }
    const top = this.model.top * (1 - this.damage / 250);
    const accel = this.model.accel;
    if (axis.z < 0) this.speed += accel * dt;
    else if (axis.z > 0) this.speed -= accel * 0.7 * dt;
    else this.speed -= Math.sign(this.speed) * 6 * dt;
    if (axis.handbrake) this.speed -= Math.sign(this.speed) * 26 * dt;
    this.speed = Math.max(-top * 0.4, Math.min(top, this.speed));
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    const steer = (axis.x || 0) * this.model.grip * 0.55 * Math.min(1, Math.abs(this.speed) / 8);
    this.heading -= steer * dt * Math.sign(this.speed || 1);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const [rx, rz] = resolveCollisions(world, nx, nz, 2.2);
    if ((rx !== nx || rz !== nz) && Math.abs(this.speed) > 6) {
      this.damage += Math.abs(this.speed) * 0.6;
      this.speed *= 0.4;
      if (audio) { audio.crash(); }
      return { crashed: true, speed: Math.abs(this.speed) };
    }
    this.x = rx; this.z = rz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (audio) audio.setEngine(Math.abs(this.speed) / this.model.top);
    if (this.damage > 55 && !this.smoke) {
      const s = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x777777, transparent: true, opacity: 0.55 })
      );
      s.position.set(0, 1.8, -0.5);
      this.mesh.add(s);
      this.smoke = s;
    }
    if (this.smoke) this.smoke.rotation.y += dt * 3;
    return { crashed: false, speed: Math.abs(this.speed) };
  }

  repair(cost) { this.damage = 0; if (this.smoke) { this.mesh.remove(this.smoke); this.smoke = null; } return cost; }
}
