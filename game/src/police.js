// Wanted level and police: cruisers that chase and ram, roadblocks at
// four stars, a helicopter at five. Wanted falls when the player stays
// out of sight of the police for a while.

import * as THREE from 'three';
import { POLICE, CARS } from './config.js';
import { buildCarMesh } from './vehicles.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cruisers = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliAngle = 0;
    this.heliHeight = POLICE.heliHeight;
    this.heliOrbit = POLICE.heliOrbit;
    this.unseenTime = 0;
    this.sirenTimer = 0;
  }

  addWanted(n) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.unseenTime = 0;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.unseenTime = 0;
  }

  spawnCruiser(x, z) {
    const mesh = buildCarMesh({ ...CARS[6], color: 0xf5f0e0 }, true);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const c = { mesh, x, z, heading: 0, speed: 0 };
    this.cruisers.push(c);
    return c;
  }

  removeCruiser(c) {
    this.scene.remove(c.mesh);
    this.cruisers.splice(this.cruisers.indexOf(c), 1);
  }

  spawnHelicopter() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5, metalness: 0.4 })
    );
    body.castShadow = true;
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a22 })
    );
    tail.position.set(0, 0.3, -5);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    rotor.position.y = 1.1;
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(6, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
    );
    spot.position.y = -9;
    spot.rotation.x = Math.PI;
    g.add(body); g.add(tail); g.add(rotor); g.add(spot);
    g.userData.rotor = rotor;
    this.scene.add(g);
    this.heli = { group: g, x: 0, z: 0 };
  }

  removeHelicopter() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }

  setRoadblocks(on, x, z, heading) {
    if (on && this.roadblocks.length === 0) {
      for (const off of [-4, 0, 4]) {
        const mesh = buildCarMesh({ ...CARS[6], color: 0xf5f0e0 }, true);
        const px = x + Math.cos(heading) * off;
        const pz = z - Math.sin(heading) * off;
        mesh.position.set(px, 0, pz);
        mesh.rotation.y = heading + Math.PI / 2;
        this.scene.add(mesh);
        this.roadblocks.push({ mesh, x: px, z: pz });
      }
    } else if (!on && this.roadblocks.length > 0) {
      for (const b of this.roadblocks) this.scene.remove(b.mesh);
      this.roadblocks = [];
    }
  }

  update(dt, player, world, audio, time) {
    // Keep the cruiser count matched to the wanted level.
    const want = this.wanted === 0 ? 0 : Math.min(POLICE.maxCruisers, this.wanted + 1);
    while (this.cruisers.length < want) {
      const a = Math.random() * Math.PI * 2;
      this.spawnCruiser(player.x + Math.cos(a) * 60, player.z + Math.sin(a) * 60);
    }
    while (this.cruisers.length > want) this.removeCruiser(this.cruisers[0]);
    if (this.wanted >= 5) this.spawnHelicopter();
    else this.removeHelicopter();

    let nearest = Infinity;
    for (const c of this.cruisers) {
      const dx = player.x - c.x, dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      nearest = Math.min(nearest, d);
      const target = Math.atan2(dx, dz);
      let dh = target - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      c.speed = Math.min(POLICE.chaseSpeed, c.speed + 18 * dt);
      if (d < 4) c.speed *= 0.7;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      if (d < 3.2) {
        // Ram the player.
        player.hurt(POLICE.ramDamage * dt * 2);
        this.unseenTime = 0;
      }
    }
    if (this.heli) {
      this.heliAngle += dt * 0.5;
      this.heli.x = player.x + Math.cos(this.heliAngle) * this.heliOrbit;
      this.heli.z = player.z + Math.sin(this.heliAngle) * this.heliOrbit;
      this.heli.group.position.set(this.heli.x, this.heliHeight, this.heli.z);
      this.heli.group.rotation.y = Math.atan2(player.x - this.heli.x, player.z - this.heli.z);
      this.heli.group.userData.rotor.rotation.y += dt * 30;
    }
    // Wanted decays when no police can see the player.
    if (this.wanted > 0) {
      if (nearest > 45 && !this.heli) this.unseenTime += dt;
      else this.unseenTime = 0;
      if (this.unseenTime > POLICE.decaySeconds) {
        this.wanted--;
        this.unseenTime = 0;
      }
    }
    // Siren wail while a chase is on.
    this.sirenTimer -= dt;
    if (this.wanted > 0 && this.sirenTimer <= 0) {
      this.sirenTimer = 2.2;
      if (audio) audio.siren();
    }
  }
}
