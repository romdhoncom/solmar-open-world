// Solmar 3D — wanted level and police: cruisers, roadblocks, helicopter.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Crimes (stealing a car, shooting, hitting a pedestrian) raise the
// wanted level from 0 to 5 stars. At 1 star a cruiser chases; more join
// as stars rise. At 4 stars roadblocks appear ahead of the player. At
// 5 stars a helicopter circles overhead. The level falls when the player
// stays out of sight of police for a while, and drops after an escape.

import * as THREE from 'three';
import { WANTED_MAX, POLICE_DECAY_TIME, CRUISER_COLOR } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { CAR_MODELS } from './config.js';

export function createPolice(G) {
  let wanted = 0;
  let unseenTimer = 0;
  const cruisers = [];
  const roadblocks = [];
  let heli = null;
  let heliAngle = 0;
  let sirenOn = false;

  function cruiserMesh() {
    const mesh = buildCarMesh(CAR_MODELS[1], CRUISER_COLOR);
    // Light bar on the roof.
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2244aa, emissive: 0x2244aa, emissiveIntensity: 0.8 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.5), barMat);
    bar.position.set(0, 1.45, -0.2);
    mesh.add(bar);
    mesh.userData.lightBar = bar;
    mesh.userData.lightMat = barMat;
    return mesh;
  }

  function spawnCruiser() {
    const mesh = cruiserMesh();
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    const angle = Math.random() * Math.PI * 2;
    const x = px + Math.sin(angle) * 45;
    const z = pz + Math.cos(angle) * 45;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const c = { mesh, x, z, heading: 0, speed: 0 };
    cruisers.push(c);
    return c;
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(WANTED_MAX, n));
    unseenTimer = 0;
    // Match cruiser count to stars (one per star, up to 4 on the ground).
    const want = Math.min(4, wanted);
    while (cruisers.length < want) spawnCruiser();
    while (cruisers.length > want) {
      const c = cruisers.pop();
      G.scene.remove(c.mesh);
    }
    if (wanted >= 5 && !heli) spawnHeli();
    if (wanted < 5 && heli) {
      G.scene.remove(heli);
      heli = null;
      G.audio.stopSiren();
      sirenOn = false;
    }
    if (wanted > 0 && !sirenOn) {
      G.audio.startSiren();
      sirenOn = true;
    }
    if (wanted === 0 && sirenOn) {
      G.audio.stopSiren();
      sirenOn = false;
    }
    G.hud.setWanted(wanted);
  }

  function addWanted(n) {
    setWanted(wanted + n);
  }

  function spawnHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6), bodyMat);
    body.castShadow = true;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), bodyMat);
    tail.position.set(0, 0.3, -5);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.2;
    g.add(rotor);
    g.userData.rotor = rotor;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }));
    light.position.set(0, -1, 0);
    g.add(light);
    g.position.set(0, 40, 0);
    G.scene.add(g);
    heli = g;
  }

  function spawnRoadblock() {
    // A line of striped barriers across the road ahead of the player.
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const bx = px + Math.sin(heading) * 40;
    const bz = pz + Math.cos(heading) * 40;
    const g = new THREE.Group();
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
    for (let i = -1; i <= 1; i++) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.4), i === 0 ? redMat : stripeMat);
      barrier.position.set(i * 3.8, 0.55, 0);
      barrier.castShadow = true;
      g.add(barrier);
    }
    g.position.set(bx, 0, bz);
    g.rotation.y = heading + Math.PI / 2;
    G.scene.add(g);
    const rb = { mesh: g, x: bx, z: bz, until: G.time + 30 };
    roadblocks.push(rb);
    return rb;
  }

  function nearestPoliceDist() {
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    let best = 1e9;
    for (const c of cruisers) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
    if (heli) best = Math.min(best, 30);
    return best;
  }

  function update(dt) {
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    // Wanted decay: out of sight of police for a while loses a star.
    if (wanted > 0) {
      if (nearestPoliceDist() > 60) {
        unseenTimer += dt;
        if (unseenTimer > POLICE_DECAY_TIME) {
          setWanted(wanted - 1);
          G.hud.banner('ESCAPED', 'You lost the cops — wanted level down');
          G.rank.add(15);
        }
      } else {
        unseenTimer = 0;
      }
    }
    // Cruisers chase: steer toward the player, ram the player's car,
    // shoot at the player on foot.
    for (const c of cruisers) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      const speed = Math.min(34, 16 + wanted * 3);
      c.speed = Math.min(speed, c.speed + 12 * dt);
      if (dist < 4) c.speed = Math.max(0, c.speed - 20 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      const fixed = G.world.collideCircle(c.x, c.z, 1.6);
      c.x = fixed.x; c.z = fixed.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Flash the light bar.
      c.mesh.userData.lightMat.emissiveIntensity = (Math.sin(G.time * 12) > 0 ? 1 : 0.2);
      // Ram the player's car.
      if (p.inCar && dist < 3.4) {
        G.vehicles.damage(p.inCar, 8 * dt);
        G.render.shake(0.15);
      }
      // Shoot at the player on foot.
      if (!p.inCar && dist < 28 && Math.random() < dt * 0.6) {
        G.combat.enemyShoot(c.x, c.z, px, pz, 6);
      }
    }
    // Roadblocks at 4+ stars: keep one ahead of the player.
    if (wanted >= 4) {
      const active = roadblocks.filter((r) => G.time < r.until);
      if (active.length === 0) spawnRoadblock();
      for (const r of roadblocks) {
        if (G.time >= r.until) {
          G.scene.remove(r.mesh);
          roadblocks.splice(roadblocks.indexOf(r), 1);
        }
      }
    } else if (roadblocks.length > 0) {
      for (const r of roadblocks) G.scene.remove(r.mesh);
      roadblocks.length = 0;
    }
    // Helicopter circles overhead and follows the player.
    if (heli) {
      heliAngle += dt * 0.5;
      heli.position.set(
        px + Math.sin(heliAngle) * 24,
        15 + Math.sin(G.time * 0.8) * 2,
        pz + Math.cos(heliAngle) * 24,
      );
      heli.rotation.y = heliAngle + Math.PI;
      heli.userData.rotor.rotation.y += dt * 22;
    }
  }

  return {
    get wanted() { return wanted; },
    cruisers, roadblocks,
    get heli() { return heli; },
    setWanted, addWanted, update,
    setHeliAngle(a) { heliAngle = a; },
  };
}
