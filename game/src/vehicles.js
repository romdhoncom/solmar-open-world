// Solmar 3D — car models, driving physics, damage and repair.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Nine models built from boxes in code (body, cabin, wheels, lights).
// The player steals parked cars with E; cars take damage, smoke when
// badly hurt, and a wrecked car cannot be driven until repaired at the
// garage (Marlowe Motors).

import * as THREE from 'three';
import { CAR_MODELS, PARKED_CARS, CAR_REPAIR_COST, ROADS_X, ROADS_Z } from './config.js';
import { makeRng, range, int, pick } from './random.js';

export function buildCarMesh(model, colorOverride) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorOverride ?? model.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833, emissiveIntensity: 0.4 });
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  // Body: low and long, cabin on top.
  box(2.0, 0.55, 4.4, bodyMat, 0, 0.55, 0);
  box(1.7, 0.5, 2.2, glassMat, 0, 1.05, -0.2);
  box(1.8, 0.12, 2.3, bodyMat, 0, 1.32, -0.2);
  // Headlights and tail lights.
  box(0.35, 0.18, 0.1, lightMat, -0.65, 0.6, 2.22);
  box(0.35, 0.18, 0.1, lightMat, 0.65, 0.6, 2.22);
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa2222, emissive: 0x550000, emissiveIntensity: 0.5 });
  box(0.4, 0.16, 0.1, tailMat, -0.65, 0.6, -2.22);
  box(0.4, 0.16, 0.1, tailMat, 0.65, 0.6, -2.22);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  // Smoke emitter anchor (a sprite shown when badly damaged).
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0 });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), smokeMat);
  smoke.position.set(0, 1.4, 1.2);
  g.add(smoke);
  g.userData.wheels = wheels;
  g.userData.smoke = smoke;
  g.userData.smokeMat = smokeMat;
  return g;
}

export function createVehicles(G) {
  const rng = makeRng(G.seed + 101);
  const list = []; // every drivable car: {model, mesh, pos, heading, speed, damage, parked, isPlayer, smoke}
  const skidMarks = [];
  let skidGeo = null;
  let skidMat = null;

  function spawnCar(modelIndex, x, z, heading, parked) {
    const model = CAR_MODELS[modelIndex];
    const mesh = buildCarMesh(model);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    const car = {
      model, modelIndex, mesh, x, z, heading,
      speed: 0, damage: 0, parked: !!parked, isPlayer: false,
      steer: 0, wrecked: false, smokeT: 0,
    };
    list.push(car);
    return car;
  }

  function spawnParked() {
    // Parked cars along road edges and in the marina/garage lots.
    let placed = 0;
    let guard = 0;
    while (placed < PARKED_CARS && guard++ < 400) {
      const vertical = rng() < 0.5;
      const road = pick(rng, vertical ? ROADS_X : ROADS_Z);
      const along = range(rng, -150, 150);
      const side = rng() < 0.5 ? -1 : 1;
      const x = vertical ? road + side * 8.5 : along;
      const z = vertical ? along : road + side * 8.5;
      if (G.world.isWater(x, z)) continue;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue; // keep the centre clear
      const modelIndex = rng() < 0.12 ? int(rng, 6, 8) : int(rng, 0, 5);
      spawnCar(modelIndex, x, z, vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2), true);
      placed++;
    }
    // The gold Strider at the harbour (mission 7 target) and the gold
    // Sunset by the marina (rank reward, locked until Made).
    const strider = spawnCar(6, 176, 30, Math.PI / 2, true);
    strider.missionCar = 'strider';
    const sunset = spawnCar(8, 176, 52, Math.PI / 2, true);
    sunset.missionCar = 'sunset';
    sunset.locked = true;
    return { strider, sunset };
  }

  function nearestCar(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of list) {
      if (c.wrecked) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function drive(car, dt, input) {
    if (car.wrecked) { car.speed = 0; return; }
    const m = car.model;
    const fwd = input.down('KeyW') || input.down('ArrowUp');
    const back = input.down('KeyS') || input.down('ArrowDown');
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const handbrake = input.down('Space');
    let accel = 0;
    if (fwd) accel += m.accel;
    if (back) accel -= m.accel * 0.7;
    car.speed += accel * dt;
    // Drag and rolling resistance.
    car.speed -= car.speed * 0.6 * dt;
    if (handbrake) car.speed -= car.speed * 3.5 * dt;
    car.speed = Math.max(-m.top * 0.4, Math.min(m.top, car.speed));
    if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
    // Steering: stronger at speed, weaker in reverse.
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
    car.heading += steerInput * m.grip * speedFactor * dt * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Skid marks and screech on hard turns at speed.
    if (Math.abs(steerInput) > 0 && Math.abs(car.speed) > 18) {
      addSkid(car.x, car.z, car.heading);
      if (Math.random() < 0.3) G.audio.skid();
    }
    const fixed = G.world.collideCircle(nx, nz, 1.6);
    if (G.world.isWater(fixed.x, fixed.z)) {
      // Bounce off the water edge: stop and push back.
      car.speed *= -0.3;
      G.audio.crash();
      damage(car, 5);
    } else {
      const moved = Math.hypot(fixed.x - car.x, fixed.z - car.z);
      const wanted = Math.hypot(nx - car.x, nz - car.z);
      if (wanted > 0.01 && moved < wanted * 0.5) {
        // Hit a building: crash, damage, shake.
        if (Math.abs(car.speed) > 8) {
          G.audio.crash();
          damage(car, Math.abs(car.speed) * 0.6);
          G.render.shake(Math.min(0.5, Math.abs(car.speed) * 0.02));
          if (G.police) G.police.addWanted(0); // a crash is not a crime by itself
        }
        car.speed *= 0.4;
      }
      car.x = fixed.x;
      car.z = fixed.z;
    }
    car.mesh.position.set(car.x, G.world.groundHeight(car.x, car.z), car.z);
    car.mesh.rotation.y = car.heading;
    // Wheel spin.
    const spin = (car.speed * dt) / 0.38;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    // Smoke when badly damaged.
    if (car.damage > 55) {
      car.smokeT += dt;
      car.mesh.userData.smokeMat.opacity = 0.35 + Math.sin(car.smokeT * 9) * 0.15;
      car.mesh.userData.smoke.scale.setScalar(1 + Math.sin(car.smokeT * 5) * 0.2);
    } else {
      car.mesh.userData.smokeMat.opacity = 0;
    }
    // Engine hum follows speed.
    if (car.isPlayer) G.audio.startEngine(Math.abs(car.speed) / car.model.top);
  }

  function addSkid(x, z, heading) {
    if (!skidGeo) {
      skidGeo = new THREE.BoxGeometry(0.35, 0.02, 1.1);
      skidMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
    }
    if (skidMarks.length > 120) {
      const old = skidMarks.shift();
      G.scene.remove(old);
    }
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.position.set(x, G.world.groundHeight(x, z) + 0.06, z);
    m.rotation.y = heading;
    G.scene.add(m);
    skidMarks.push(m);
  }

  function damage(car, amount) {
    car.damage = Math.min(100, car.damage + amount);
    if (car.damage >= 100 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      if (car.isPlayer) {
        G.hud.banner('WRECKED', 'Your car is wrecked — repair it at Marlowe Motors');
      }
    }
  }

  function repair(car) {
    if (G.player.money < CAR_REPAIR_COST) {
      G.hud.banner('NO CASH', `Repair costs $${CAR_REPAIR_COST} — you have $${G.player.money}`);
      return false;
    }
    G.player.money -= CAR_REPAIR_COST;
    car.damage = 0;
    car.wrecked = false;
    G.audio.chime();
    G.hud.banner('REPAIRED', 'Marlowe Motors fixed your car');
    return true;
  }

  function update(dt, input) {
    for (const c of list) {
      if (c.isPlayer) drive(c, dt, input);
    }
  }

  return {
    list, spawnCar, spawnParked, nearestCar, drive, damage, repair, update,
  };
}
