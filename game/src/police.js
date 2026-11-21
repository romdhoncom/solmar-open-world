// Wanted level, police cruisers, roadblocks and the helicopter.
import * as THREE from 'three';
import { CAR_MODELS, createCar, damageCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function createPolice(G) {
  return {
    wanted: 0,
    heat: 0,
    cruisers: [],
    blocks: [],
    heli: null,
    decayT: 0,
    shootT: 0,
    addWanted(n, _reason) {
      this.wanted = Math.max(0, Math.min(5, this.wanted + n));
      this.heat = Math.min(5, this.heat + n);
      this.decayT = 0;
      G.hud.update();
    },
  };
}

function spawnCruiser(G, x, z) {
  const model = CAR_MODELS.find((m) => m.name === 'Cruiser');
  const car = createCar(model, x, z, 0, { police: true });
  car.speed = 0;
  G.scene.add(car.mesh);
  G.cars.push(car);
  G.police.cruisers.push(car);
  return car;
}

function makeHeli(G) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4), body.material);
  tail.position.set(0, 0.2, -4);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffdd55, emissive: 0xaa8800 }));
  light.position.y = -0.9;
  g.add(light);
  g.position.set(0, 42, 0);
  G.scene.add(g);
  return { mesh: g, rotor, angle: 0 };
}

export function updatePolice(dt, G) {
  const pol = G.police;
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const pz = p.car ? p.car.z : p.z;
  const want = Math.floor(pol.wanted);
  // Spawn cruisers up to the wanted level.
  while (pol.cruisers.length < want) {
    const a = G.rng.range(0, Math.PI * 2);
    spawnCruiser(G, px + Math.sin(a) * 45, pz + Math.cos(a) * 45);
  }
  while (pol.cruisers.length > want) {
    const c = pol.cruisers.pop();
    G.scene.remove(c.mesh);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  // Cruisers chase and ram; on foot they stop and shoot.
  for (const c of pol.cruisers) {
    const dx = px - c.x, dz = pz - c.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const wantSpeed = dist > (p.car ? 6 : 14) ? 26 : 0;
    c.speed += (wantSpeed - c.speed) * Math.min(1, dt * 1.5);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    const hit = G.world.collide(c.x, c.z, 1.6);
    c.x = hit.x; c.z = hit.z;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    // Ram the player's car.
    if (p.car && dist < 3.4 && c.speed > 4) {
      damageCar(p.car, 6, G);
      G.audio.crash();
      G.shake = 0.4;
      c.speed *= 0.4;
      p.car.speed *= 0.7;
    }
  }
  // On-foot shooting from nearby cruisers.
  if (!p.car && want > 0) {
    pol.shootT -= dt;
    if (pol.shootT <= 0) {
      pol.shootT = 1.1;
      const near = pol.cruisers.some((c) => Math.hypot(c.x - px, c.z - pz) < 30);
      if (near) {
        hurtPlayer(G, 4 + want);
        G.hud.flashDamage();
      }
    }
  }
  // Roadblocks at 4+ stars: two cruisers parked across the road ahead.
  if (want >= 4 && pol.blocks.length === 0) {
    const fx = Math.sin(p.car ? p.car.heading : p.heading);
    const fz = Math.cos(p.car ? p.car.heading : p.heading);
    for (const s of [-1, 1]) {
      const b = spawnCruiser(G, px + fx * 30 + fz * s * 5, pz + fz * 30 - fx * s * 5);
      b.speed = 0;
      pol.blocks.push(b);
    }
    G.hud.showBanner('ROADBLOCK AHEAD', 'The police sealed the road');
  }
  if (want < 4 && pol.blocks.length > 0) {
    for (const b of pol.blocks) {
      G.scene.remove(b.mesh);
      const i = G.cars.indexOf(b);
      if (i >= 0) G.cars.splice(i, 1);
      const j = pol.cruisers.indexOf(b);
      if (j >= 0) pol.cruisers.splice(j, 1);
    }
    pol.blocks = [];
  }
  // Helicopter at 5 stars.
  if (want >= 5 && !pol.heli) {
    pol.heli = makeHeli(G);
    G.hud.showBanner('HELICOPTER OVERHEAD', 'Five stars — lose them or reach the hideout');
  }
  if (want < 5 && pol.heli) {
    G.scene.remove(pol.heli.mesh);
    pol.heli = null;
  }
  if (pol.heli) {
    pol.heli.angle += dt * 0.35;
    pol.heli.mesh.position.set(
      px + Math.sin(pol.heli.angle) * 26,
      42 + Math.sin(G.now * 0.8) * 2,
      pz + Math.cos(pol.heli.angle) * 26,
    );
    pol.heli.mesh.rotation.y = Math.atan2(px - pol.heli.mesh.position.x, pz - pol.heli.mesh.position.z);
    pol.heli.rotor.rotation.y += dt * 18;
  }
  // Wanted decays when no cruiser is close.
  const nearest = pol.cruisers.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), 999);
  if (nearest > 45) {
    pol.decayT += dt;
    if (pol.decayT > 9 && pol.wanted > 0) {
      pol.wanted = Math.max(0, pol.wanted - 1);
      pol.decayT = 0;
      G.hud.showBanner('YOU LOST THEM', 'Wanted level falling');
    }
  } else {
    pol.decayT = 0;
  }
  G.audio.siren(want > 0 && pol.cruisers.length > 0);
}
