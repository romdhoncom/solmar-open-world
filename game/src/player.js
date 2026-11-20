// Solmar 3D — the player on foot: movement, sprint, jump, punch,
// entering cars, shooting, health and armour.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Dani is a simple stylised low-poly figure built from boxes and
// capsules in code — no external models.

import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayer(G) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe85d3d });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x2a5a8a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirt);
  torso.position.y = 1.25;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 10), capMat);
  cap.position.y = 2.12;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants);
  legL.position.set(-0.18, 0.43, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants);
  legR.position.set(0.18, 0.43, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.3, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armR.position.set(0.48, 1.3, 0);
  group.add(armR);
  G.scene.add(group);

  const state = {
    mesh: group,
    x: -60, z: -60, y: 0, vy: 0, heading: 0,
    health: PLAYER.health, armour: 0, money: PLAYER.startMoney,
    inCar: null, weapon: 1, ammo: [Infinity, 60, 120, 24],
    onGround: true, walkPhase: 0, punchT: 0, shootCooldown: 0,
    dead: false,
  };

  function move(dt, input, camYaw) {
    if (state.inCar || state.dead) return;
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    // Movement relative to the camera: forward is (sin yaw, cos yaw) on
    // the ground plane, right is forward rotated -90° about Y.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let mx = sin * fwd - cos * strafe;
    let mz = cos * fwd + sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const nx = state.x + mx * speed * dt;
    const nz = state.z + mz * speed * dt;
    const fixed = G.world.collideCircle(nx, nz, PLAYER.radius);
    if (G.world.isWater(fixed.x, fixed.z)) {
      // Stay on dry land (the beach and pier are dry).
    } else {
      state.x = fixed.x;
      state.z = fixed.z;
    }
    if (len > 0) {
      state.heading = Math.atan2(mx, mz);
      state.walkPhase += dt * speed * 1.6;
      legL.rotation.x = Math.sin(state.walkPhase) * 0.6;
      legR.rotation.x = -Math.sin(state.walkPhase) * 0.6;
      armL.rotation.x = -Math.sin(state.walkPhase) * 0.5;
      armR.rotation.x = Math.sin(state.walkPhase) * 0.5;
    } else {
      legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
      armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
    }
    // Jump and gravity.
    if (input.wasPressed('Space') && state.onGround) {
      state.vy = PLAYER.jumpSpeed;
      state.onGround = false;
    }
    state.vy -= PLAYER.gravity * dt;
    state.y += state.vy * dt;
    const ground = G.world.groundHeight(state.x, state.z);
    if (state.y <= ground) {
      state.y = ground;
      state.vy = 0;
      state.onGround = true;
    }
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.heading;
    // Punch.
    if (input.wasPressed('KeyF') && state.punchT <= 0) {
      state.punchT = 0.35;
      G.audio.punch();
      G.combat.punch(state.x, state.z, state.heading);
    }
    if (state.punchT > 0) {
      state.punchT -= dt;
      armR.rotation.x = -1.6 * Math.max(0, state.punchT / 0.35);
    }
    // Shooting.
    state.shootCooldown -= dt;
    if (input.mouseDown && state.weapon > 0 && state.shootCooldown <= 0) {
      const w = G.combat.weapons[state.weapon];
      if (state.ammo[state.weapon] > 0) {
        state.ammo[state.weapon]--;
        state.shootCooldown = w.rate;
        G.combat.shoot(state.x, state.z, state.heading, state.weapon, true);
        G.audio.shoot();
        if (G.police) G.police.addWanted(1);
      }
    }
    // Weapon slots 1-4.
    for (let i = 0; i < 4; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) state.weapon = i;
    }
  }

  function enterCar(car) {
    if (!car || car.locked) {
      if (car && car.locked) G.hud.banner('LOCKED', 'Reach Made rank to unlock the gold Sunset');
      return false;
    }
    if (car.wrecked) {
      G.hud.banner('WRECKED', 'This car is wrecked — repair it at Marlowe Motors');
      return false;
    }
    state.inCar = car;
    car.isPlayer = true;
    car.parked = false;
    group.visible = false;
    G.audio.startEngine(0);
    if (!car.stolen) {
      car.stolen = true;
      G.police.addWanted(1); // stealing a car is a crime
      G.hud.banner('STOLEN', `You stole a ${car.model.name}`);
    }
    return true;
  }

  function exitCar() {
    const car = state.inCar;
    if (!car) return;
    car.isPlayer = false;
    state.inCar = null;
    // Step out to the side of the car.
    const sx = car.x + Math.cos(car.heading) * 2.2;
    const sz = car.z - Math.sin(car.heading) * 2.2;
    const fixed = G.world.collideCircle(sx, sz, PLAYER.radius);
    state.x = G.world.isWater(fixed.x, fixed.z) ? car.x : fixed.x;
    state.z = G.world.isWater(fixed.x, fixed.z) ? car.z : fixed.z;
    state.y = G.world.groundHeight(state.x, state.z);
    group.visible = true;
    group.position.set(state.x, state.y, state.z);
    G.audio.stopEngine();
  }

  function hurt(amount) {
    if (state.dead) return;
    let rest = amount;
    if (state.armour > 0) {
      const absorbed = Math.min(state.armour, rest);
      state.armour -= absorbed;
      rest -= absorbed;
    }
    state.health -= rest;
    if (state.health <= 0) {
      state.health = 0;
      state.dead = true;
      G.hud.banner('WASTED', 'You were wasted — you wake up at the hospital');
      setTimeout(() => respawn(), 1500);
    }
  }

  function respawn() {
    state.dead = false;
    state.health = PLAYER.health;
    state.armour = 0;
    if (state.inCar) {
      state.inCar.isPlayer = false;
      state.inCar = null;
    }
    state.x = G.world.places.hospital.x;
    state.z = G.world.places.hospital.z;
    state.y = 0;
    group.visible = true;
    group.position.set(state.x, 0, state.z);
    G.audio.stopEngine();
    if (G.police) G.police.setWanted(0);
    G.hud.banner('HOSPITAL', 'You woke up at St. Coral Hospital');
  }

  function update(dt, input, camYaw) {
    move(dt, input, camYaw);
    // E to enter/exit a car.
    if (input.wasPressed('KeyE')) {
      if (state.inCar) exitCar();
      else {
        const car = G.vehicles.nearestCar(state.x, state.z, 4.5);
        if (car) enterCar(car);
      }
    }
  }

  // Return the live state object itself (not a copy) so every module
  // reads the player's current position, health and money.
  return Object.assign(state, { move, enterCar, exitCar, hurt, respawn, update });
}
