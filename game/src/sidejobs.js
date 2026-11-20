// Solmar 3D — side jobs: repeatable taxi fares, hidden packages and
// stunt jumps.
// Written fresh in this session for the v5 rebuild (prose spec only).
// A fare marker appears; drive the customer to the destination and get
// paid plus a tip for speed. Twelve hidden packages are scattered
// around the city (rooftops, alleys, the beach, the pier); each is
// worth $50 and all twelve pay a $500 bonus. Five stunt jumps are
// marked around the city; landing one pays $100 and shows a banner.

import * as THREE from 'three';
import { PACKAGES, PACKAGE_VALUE, PACKAGE_BONUS, JUMPS, JUMP_VALUE, FARE_BASE, FARE_TIP, ROADS_X, ROADS_Z } from './config.js';
import { makeRng, range, pick } from './random.js';

const PACKAGE_SPOTS = [
  [-150, -150], [-40, -150], [120, -150], [150, -40], [-150, 40],
  [40, 120], [150, 120], [-120, 150], [60, 160], [-160, -80],
  [-34, 240], [170, 60],
];
const JUMP_SPOTS = [
  { x: 165, z: -30, name: 'Bridge Jump' },
  { x: -34, z: 200, name: 'Pier Jump' },
  { x: 120, z: -120, name: 'Hills Jump' },
  { x: -120, z: 120, name: 'Beach Jump' },
  { x: 80, z: 160, name: 'Boardwalk Jump' },
];

export function createSideJobs(G) {
  const rng = makeRng(G.seed + 404);
  const packages = [];
  const jumps = [];
  let fare = null; // {x, z, destX, destZ, marker, destMarker, timeLeft, active}
  let fareTimer = 8;

  function markerMesh(color) {
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 10, 1, true), mat);
    m.position.y = 3;
    G.scene.add(m);
    return m;
  }

  // Hidden packages.
  for (let i = 0; i < PACKAGES; i++) {
    const [x, z] = PACKAGE_SPOTS[i];
    const taken = (G.save.packages || []).includes(i);
    if (taken) continue;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0xaa8822, emissiveIntensity: 0.7 }),
    );
    mesh.position.set(x, 0.9, z);
    mesh.castShadow = true;
    G.scene.add(mesh);
    packages.push({ mesh, x, z, index: i, spin: 0 });
  }

  // Stunt jump ramps.
  for (let i = 0; i < JUMPS; i++) {
    const s = JUMP_SPOTS[i];
    const done = (G.save.jumps || []).includes(i);
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.6, 8),
      new THREE.MeshLambertMaterial({ color: done ? 0x666666 : 0xe86a2a }),
    );
    ramp.position.set(s.x, 0.3, s.z);
    ramp.rotation.x = -0.35;
    ramp.castShadow = true;
    G.scene.add(ramp);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.25, 8, 20),
      new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0xaa8822, emissiveIntensity: 0.6 }),
    );
    ring.position.set(s.x, 3.2, s.z);
    G.scene.add(ring);
    jumps.push({ ...s, mesh: ramp, ring, index: i, done, cooldown: 0 });
  }

  function randomFareSpot() {
    const road = pick(rng, ROADS_X);
    return { x: road + (rng() < 0.5 ? -8.5 : 8.5), z: range(rng, -150, 150) };
  }

  function startFare() {
    const spot = randomFareSpot();
    const dest = randomFareSpot();
    if (fare) {
      G.scene.remove(fare.marker);
      if (fare.destMarker) G.scene.remove(fare.destMarker);
    }
    fare = {
      x: spot.x, z: spot.z, destX: dest.x, destZ: dest.z,
      marker: markerMesh(0xffd24a), destMarker: null,
      pickedUp: false, timeLeft: 150, active: true,
    };
    fare.marker.position.set(spot.x, 3, spot.z);
    G.hud.setObjective('Taxi fare', 'Pick up the customer at the yellow marker');
    G.hud.setMarker(spot.x, spot.z, 0xffd24a);
  }

  function update(dt) {
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    // Packages: walk over them.
    for (const pk of [...packages]) {
      pk.spin += dt * 2;
      pk.mesh.rotation.y = pk.spin;
      if (!p.inCar && Math.hypot(p.x - pk.x, p.z - pk.z) < 1.6) {
        G.scene.remove(pk.mesh);
        packages.splice(packages.indexOf(pk), 1);
        G.save.packages.push(pk.index);
        p.money += PACKAGE_VALUE;
        G.rank.add(10);
        G.audio.pickup();
        G.hud.banner('PACKAGE', `+$${PACKAGE_VALUE} — ${G.save.packages.length} of ${PACKAGES} found`);
        if (G.save.packages.length >= PACKAGES) {
          p.money += PACKAGE_BONUS;
          G.hud.banner('ALL PACKAGES', `Bonus +$${PACKAGE_BONUS}`);
        }
      }
    }
    // Stunt jumps: drive over a ramp fast.
    for (const j of jumps) {
      if (j.done) continue;
      j.cooldown -= dt;
      if (p.inCar && j.cooldown <= 0 && Math.hypot(p.inCar.x - j.x, p.inCar.z - j.z) < 4 && Math.abs(p.inCar.speed) > 22) {
        j.done = true;
        j.cooldown = 10;
        G.save.jumps.push(j.index);
        j.mesh.material.color.setHex(0x666666);
        p.money += JUMP_VALUE;
        G.rank.add(15);
        G.audio.fanfare();
        G.hud.banner('STUNT!', `${j.name} — +$${JUMP_VALUE}`);
      }
    }
    // Taxi fares: a new fare appears every so often; pick up and deliver.
    if (!fare && !G.missions.current) {
      fareTimer -= dt;
      if (fareTimer <= 0) startFare();
    }
    if (fare && fare.active) {
      fare.timeLeft -= dt;
      if (fare.timeLeft <= 0) {
        G.scene.remove(fare.marker);
        if (fare.destMarker) G.scene.remove(fare.destMarker);
        fare = null;
        fareTimer = 20;
        G.hud.setObjective('', '');
        G.hud.setMarker(null, null);
        return;
      }
      if (!fare.pickedUp) {
        if (p.inCar && Math.hypot(px - fare.x, pz - fare.z) < 4) {
          fare.pickedUp = true;
          G.scene.remove(fare.marker);
          fare.destMarker = markerMesh(0x66ff66);
          fare.destMarker.position.set(fare.destX, 3, fare.destZ);
          G.hud.setObjective('Taxi fare', 'Drive the customer to the green marker');
          G.hud.setMarker(fare.destX, fare.destZ, 0x66ff66);
          G.hud.banner('FARE', 'Customer aboard — drive to the green marker');
        }
      } else if (p.inCar && Math.hypot(px - fare.destX, pz - fare.destZ) < 5) {
        const tip = fare.timeLeft > 60 ? FARE_TIP : 0;
        p.money += FARE_BASE + tip;
        G.save.fares++;
        G.rank.add(10);
        G.audio.chime();
        G.hud.banner('FARE PAID', `+$${FARE_BASE + tip}${tip ? ' (speed tip!)' : ''}`);
        G.scene.remove(fare.destMarker);
        fare = null;
        fareTimer = 15;
        G.hud.setObjective('', '');
        G.hud.setMarker(null, null);
      }
    }
  }

  return { packages, jumps, update, startFare, get fare() { return fare; } };
}
