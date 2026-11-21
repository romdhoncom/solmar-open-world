// Nine car models, built from boxes in code, plus arcade driving physics.
import * as THREE from 'three';

export const CAR_MODELS = [
  { name: 'Pinto', color: 0x8a8f96, top: 22, accel: 14, grip: 2.6 },
  { name: 'Comet', color: 0xd23c2e, top: 30, accel: 18, grip: 3.0 },
  { name: 'Falcon', color: 0x2e5fd2, top: 32, accel: 19, grip: 3.2 },
  { name: 'Taxi', color: 0xf2c200, top: 26, accel: 15, grip: 2.8 },
  { name: 'Van', color: 0xe8e8e8, top: 20, accel: 12, grip: 2.4 },
  { name: 'Sunset', color: 0xe8912d, top: 34, accel: 20, grip: 3.1 },
  { name: 'Strider', color: 0xd4af37, top: 38, accel: 22, grip: 3.4 },
  { name: 'Raptor', color: 0x1a1a1a, top: 40, accel: 23, grip: 3.5 },
  { name: 'Cruiser', color: 0x222831, top: 34, accel: 21, grip: 3.3 },
];

export function makeCarMesh(model, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xaa8833 });
  for (const lx of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), lightMat);
    l.position.set(lx, 0.7, 2.22);
    g.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000 }));
    bar.position.set(0, 1.75, -0.2);
    g.add(bar);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.4, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    door.position.set(0, 0.7, 0.3);
    g.add(door);
  }
  return { group: g, wheels };
}

export function createCar(model, x, z, heading, opts) {
  const o = opts || {};
  const { group, wheels } = makeCarMesh(model, !!o.police);
  group.position.set(x, 0, z);
  group.rotation.y = heading || 0;
  return {
    mesh: group, wheels, model,
    x, z, heading: heading || 0,
    speed: 0, steer: 0,
    damage: 0, wrecked: false,
    isPlayer: false, isPolice: !!o.police, isTraffic: !!o.traffic,
    smoke: null, smokeT: 0,
    hornT: 0,
  };
}

export function damageCar(car, amount, G) {
  if (car.wrecked) return;
  car.damage += amount;
  if (car.damage >= 55 && !car.smoke) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x777777, transparent: true, opacity: 0.7 }),
    );
    s.position.set(0, 1.6, 1.2);
    car.mesh.add(s);
    car.smoke = s;
  }
  if (car.damage >= 100) {
    car.wrecked = true;
    car.speed = 0;
    if (car === G.player.car) G.hud.showBanner('CAR WRECKED', 'Get it repaired at Marlowe Motors');
  }
}

export function updatePlayerCar(car, input, dt, G) {
  if (!car) return;
  const m = car.model;
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const brake = input.down('Space');
  if (fwd) car.speed += m.accel * dt;
  if (back) car.speed -= m.accel * 0.7 * dt;
  if (!fwd && !back) car.speed *= Math.pow(0.4, dt);
  if (brake) car.speed *= Math.pow(0.05, dt);
  car.speed = Math.max(-m.top * 0.4, Math.min(m.top, car.speed));
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turn = car.steer * m.grip * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
  car.heading += turn;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Bridge: the channel is crossed on the deck (y stays 0; the deck is visual).
  const hit = G.world.collide(nx, nz, 1.6);
  const moved = Math.hypot(hit.x - car.x, hit.z - car.z);
  if (moved < Math.abs(car.speed) * dt * 0.5 && Math.abs(car.speed) > 6) {
    // Crashed into a building: damage, sparks, shake, stop.
    damageCar(car, 12, G);
    G.audio.crash();
    G.shake = 0.5;
    car.speed *= 0.3;
  }
  car.x = hit.x; car.z = hit.z;
  // Skid marks + screech on hard turns at speed.
  if (Math.abs(car.steer) > 0.7 && Math.abs(car.speed) > 14) {
    G.audio.skid();
    G.render.addSkid(car.x, car.z);
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  if (car.smoke) {
    car.smokeT += dt;
    car.smoke.position.y = 1.6 + Math.sin(car.smokeT * 6) * 0.3;
    car.smoke.scale.setScalar(1 + Math.sin(car.smokeT * 4) * 0.2);
  }
  G.audio.engine(Math.abs(car.speed) / m.top);
}
