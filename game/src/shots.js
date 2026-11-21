// Screenshot staging: drives the game into four fixed scenes (fixed seed).
import * as THREE from 'three';
import { CAR_MODELS, createCar } from './vehicles.js';

function spawnCruiser(G, x, z, heading) {
  const model = CAR_MODELS.find((m) => m.name === 'Cruiser');
  const car = createCar(model, x, z, heading || 0, { police: true });
  G.scene.add(car.mesh);
  G.cars.push(car);
  G.police.cruisers.push(car);
  return car;
}

function spawnHeli(G, x, y, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  g.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  g.position.set(x, y, z);
  G.scene.add(g);
  return { mesh: g, rotor };
}

export function applyShot(G, n) {
  G.shotMode = true;
  document.getElementById('start-screen').classList.add('hidden');
  G.state = 'playing';
  const p = G.player;
  if (n === 1) {
    // Cover: 4-star sunset escape, cruisers on the player's tail.
    G.time = 18.43;
    const model = CAR_MODELS.find((m) => m.name === 'Comet');
    const car = createCar(model, 0, -22, 0);
    car.speed = 22;
    G.scene.add(car.mesh);
    G.cars.push(car);
    p.car = car;
    car.isPlayer = true;
    p.mesh.visible = false;
    G.camYaw = 0;
    G.camPitch = 0.1;
    G.camFar = true;
    spawnCruiser(G, -8, -27, 0).chaseOffset = { dx: -8, dz: -5 };
    spawnCruiser(G, 8, -28, 0).chaseOffset = { dx: 8, dz: -6 };
    spawnCruiser(G, -5, -31, 0).chaseOffset = { dx: -5, dz: -9 };
    spawnCruiser(G, 5, -26, 0).chaseOffset = { dx: 5, dz: -4 };
    G.police.wanted = 4;
    G.hud.setMission('4-STAR ESCAPE', 'Lose the 4-star chase, reach the hideout', 'Stage 1 of 1');
    const h = G.world.spots.hideout;
    G.missions.setMarker(h[0], h[1], 'Hideout');
    G.hud.update();
  } else if (n === 2) {
    // On foot in the market plaza, marker to Marlowe Motors, lighthouse ahead.
    G.time = 17.0;
    p.x = 0; p.z = 10; p.heading = Math.PI;
    p.mesh.position.set(0, 0, 10);
    G.camYaw = Math.PI;
    G.camPitch = 0.12;
    const s = G.world.spots.garage;
    G.missions.setMarker(s[0], s[1], 'Marlowe Motors');
    G.hud.setMission('New in Town', 'Walk to Marlowe Motors and meet the contact', '1 stage');
    G.hud.update();
  } else if (n === 3) {
    // Cross-city drive over the harbour bridge, water and marina ahead.
    G.time = 18.0;
    const model = CAR_MODELS.find((m) => m.name === 'Sunset');
    const car = createCar(model, 175, 0, Math.PI / 2);
    car.speed = 24;
    G.scene.add(car.mesh);
    G.cars.push(car);
    p.car = car;
    car.isPlayer = true;
    p.mesh.visible = false;
    G.camYaw = Math.PI / 2 - 0.1;
    G.camPitch = 0.08;
    G.camFar = false;
    const t1 = createCar(CAR_MODELS.find((m) => m.name === 'Comet'), 200, -3, Math.PI / 2, { traffic: true });
    const t2 = createCar(CAR_MODELS.find((m) => m.name === 'Van'), 212, 3, Math.PI / 2, { traffic: true });
    G.scene.add(t1.mesh); G.scene.add(t2.mesh);
    G.cars.push(t1, t2);
    G.hud.setMission('Harbour Lights', 'Cross the bridge — the marina is ahead', 'Stage 1 of 1');
    G.hud.update();
  } else if (n === 4) {
    // Finale shootout on the docks at dusk, helicopter overhead.
    G.time = 18.6;
    p.x = 170; p.z = 55; p.heading = Math.PI / 4;
    p.weapon = 2;
    p.mesh.position.set(170, 0, 55);
    G.camYaw = Math.PI / 4;
    G.camPitch = -0.05;
    const e1 = G.combat.spawnEnemy(178, 62, 70);
    const e2 = G.combat.spawnEnemy(175, 70, 70);
    const e3 = G.combat.spawnEnemy(182, 58, 70);
    e1.shootT = 10; e2.shootT = 10; e3.shootT = 10;
    const heli = spawnHeli(G, 196, 12, 72);
    G.police.heli = heli;
    G.police.wanted = 5;
    G.hud.setMission('The Docks', 'Fight Marco Vane’s crew — 3 enemies remaining', 'Finale');
    G.hud.update();
  }
}
