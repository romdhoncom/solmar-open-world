// Side jobs: repeatable taxi fares, twelve hidden packages and five
// stunt jumps, each with its marker in the world and the HUD.

import * as THREE from 'three';
import { ROADS } from './config.js';
import { makeRng } from './random.js';

const PACKAGE_SPOTS = [
  [-170, 170], [-120, -170], [-60, 170], [0, -170], [60, 170], [120, -170],
  [170, 120], [-170, -120], [120, 210], [-30, 30], [150, -120], [90, 150],
];
const JUMP_SPOTS = [
  { x: 150, z: 0, name: 'Bridge Jump' },
  { x: 120, z: 200, name: 'Pier Jump' },
  { x: -150, z: -150, name: 'Hill Jump' },
  { x: 60, z: 120, name: 'Beach Jump' },
  { x: -60, z: -60, name: 'Market Jump' },
];

export class SideJobs {
  constructor(scene, save) {
    this.scene = scene;
    this.rng = makeRng(4242);
    this.packages = [];
    this.jumps = [];
    this.fare = null; // {x,z,dx,dz,timer,marker}
    this.fareTimer = 8;
    this.collected = new Set(save.packages || []);
    this.jumpsDone = new Set(save.jumps || []);
    this.faresDone = save.fares || 0;
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xf2c200, transparent: true, opacity: 0.75 });
    this.buildPackages();
    this.buildJumps();
  }

  makeMarker(x, z, color = 0xf2c200) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 5, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    m.position.set(x, 2.5, z);
    this.scene.add(m);
    return m;
  }

  buildPackages() {
    PACKAGE_SPOTS.forEach(([x, z], i) => {
      if (this.collected.has(i)) return;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf2c200, emissive: 0xf2c200, emissiveIntensity: 0.6 })
      );
      mesh.position.set(x, 1, z);
      this.scene.add(mesh);
      this.packages.push({ mesh, x, z, i, t: 0 });
    });
  }

  buildJumps() {
    for (const j of JUMP_SPOTS) {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xd84a2a, roughness: 0.8 })
      );
      ramp.position.set(j.x, 0.6, j.z);
      ramp.rotation.x = -0.35;
      ramp.castShadow = true;
      this.scene.add(ramp);
      this.jumps.push({ ...j, done: this.jumpsDone.has(j.name), ramp });
    }
  }

  spawnFare(playerX, playerZ) {
    if (this.fare) return;
    const road = this.rng.pick(ROADS);
    const x = this.rng.pick(ROADS);
    const z = road;
    const dx = this.rng.pick(ROADS);
    const dz = this.rng.pick(ROADS);
    if (Math.hypot(dx - x, dz - z) < 60) return;
    this.fare = { x, z, dx, dz, timer: 90, marker: this.makeMarker(x, z, 0x2ec22e), destMarker: null };
  }

  update(dt, player, inCar, speed, onEvent) {
    // Packages.
    for (let i = this.packages.length - 1; i >= 0; i--) {
      const p = this.packages[i];
      p.t += dt;
      p.mesh.rotation.y = p.t * 2;
      if (Math.hypot(p.x - player.x, p.z - player.z) < 2) {
        this.scene.remove(p.mesh);
        this.packages.splice(i, 1);
        this.collected.add(p.i);
        onEvent('package', p.i);
      }
    }
    // Stunt jumps: fast in a car over a ramp.
    for (const j of this.jumps) {
      if (j.done) continue;
      if (inCar && speed > 18 && Math.hypot(j.x - player.x, j.z - player.z) < 4) {
        j.done = true;
        this.jumpsDone.add(j.name);
        onEvent('jump', j.name);
      }
    }
    // Taxi fares.
    this.fareTimer -= dt;
    if (!this.fare && this.fareTimer <= 0) {
      this.fareTimer = 6;
      this.spawnFare(player.x, player.z);
    }
    if (this.fare) {
      const f = this.fare;
      f.timer -= dt;
      if (f.timer <= 0) {
        this.scene.remove(f.marker);
        if (f.destMarker) this.scene.remove(f.destMarker);
        this.fare = null;
        return;
      }
      if (!f.pickedUp) {
        if (Math.hypot(f.x - player.x, f.z - player.z) < 3) {
          f.pickedUp = true;
          this.scene.remove(f.marker);
          f.destMarker = this.makeMarker(f.dx, f.dz, 0x2ec22e);
          onEvent('fare-pickup', null);
        }
      } else if (inCar && Math.hypot(f.dx - player.x, f.dz - player.z) < 4) {
        this.scene.remove(f.destMarker);
        const tip = Math.max(0, Math.floor(f.timer / 10)) * 10;
        this.fare = null;
        this.faresDone++;
        onEvent('fare-done', 40 + tip);
      }
    }
  }
}
