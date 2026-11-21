// Dani on foot: movement, jump, punch, entering cars, shooting, health.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xd23c2e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const cap = new THREE.MeshLambertMaterial({ color: 0x2e5fd2 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), shirt);
  torso.position.y = 1.35;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
  head.position.y = 2.15;
  head.castShadow = true;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.65), cap);
  hat.position.y = 2.48;
  g.add(hat);
  for (const lx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
    leg.position.set(lx, 0.42, 0);
    leg.castShadow = true;
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
    arm.position.set(lx * 2.4, 1.35, 0);
    g.add(arm);
  }
  g.position.set(0, 0, 0);
  return {
    mesh: g,
    x: 0, z: 0, y: 0, vy: 0, onGround: true,
    heading: 0,
    health: 100, armour: 0,
    weapons: CFG.weapons.map((w, i) => ({
      name: w.name, ammo: i === 0 ? Infinity : [0, 60, 120, 24][i],
    })),
    weapon: 1,
    car: null,
    lastShot: 0, lastPunch: 0,
    walkT: 0,
  };
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  let a = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, a * 0.6);
    p.armour -= absorbed;
    a -= absorbed;
  }
  p.health -= a;
  if (p.health <= 0) {
    p.health = 0;
    // Wanted reset, respawn at the hospital with half the money.
    G.money = Math.floor(G.money / 2);
    p.health = 100;
    p.armour = 0;
    p.x = G.world.spots.hospital[0];
    p.z = G.world.spots.hospital[1];
    p.y = 0; p.vy = 0;
    G.police.wanted = 0;
    G.hud.showBanner('WASTED', 'You woke up at the hospital — half your cash is gone');
    G.hud.update();
  }
}

export function updatePlayer(dt, G) {
  const p = G.player;
  const input = G.input;
  if (p.car) return; // driving is handled by vehicles.js
  const look = input.consumeLook();
  G.camYaw -= look.dx * 0.0032;
  G.camPitch = Math.max(-0.5, Math.min(0.6, G.camPitch + look.dy * 0.0025));
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
  let mx = 0, mz = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    const dx = (mx * cos - mz * sin) * speed * dt;
    const dz = (mx * sin + mz * cos) * speed * dt;
    const hit = G.world.collide(p.x + dx, p.z + dz, CFG.playerRadius);
    p.x = hit.x; p.z = hit.z;
    p.heading = Math.atan2(dx, dz);
    p.walkT += dt * speed;
  }
  // Jump and gravity.
  if (input.down('Space') && p.onGround) {
    p.vy = CFG.jumpVel;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= CFG.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  p.mesh.position.set(p.x, p.y + Math.abs(Math.sin(p.walkT * 2)) * 0.06, p.z);
  p.mesh.rotation.y = p.heading;
  // Punch.
  if (input.down('KeyF') && G.now - p.lastPunch > 0.45) {
    p.lastPunch = G.now;
    G.audio.punch();
    const target = G.combat.nearestEnemy(p.x, p.z, 2.6);
    if (target) G.combat.damageEnemy(target, 25, G);
  }
  // Enter / leave a car.
  if (input.down('KeyE') && !p._eLock) {
    p._eLock = true;
    enterNearestCar(G);
  }
  if (!input.down('KeyE')) p._eLock = false;
  // Weapon switch 1-4.
  for (let i = 0; i < 4; i++) {
    if (input.down('Digit' + (i + 1))) p.weapon = i;
  }
  // Shoot with the mouse.
  const w = CFG.weapons[p.weapon];
  const wantFire = w.auto ? input.mouseDown : input.consumeClick();
  if (wantFire && p.weapon > 0 && G.now - p.lastShot > w.rate) {
    const ammo = p.weapons[p.weapon].ammo;
    if (ammo > 0) {
      p.lastShot = G.now;
      p.weapons[p.weapon].ammo = ammo - 1;
      G.audio.shot();
      G.combat.shootPlayer(G);
      G.police.addWanted(0.4, 'shooting');
    }
  }
}

export function enterNearestCar(G) {
  const p = G.player;
  let best = null; let bestD = 4.5;
  for (const c of G.cars) {
    if (c.wrecked || c.isTraffic) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) return;
  p.car = best;
  p.enteredAt = G.now;
  best.isPlayer = true;
  p.mesh.visible = false;
  G.audio.engine(0);
  if (!best.stolen) {
    best.stolen = true;
    G.police.addWanted(1, 'stolen car');
    G.hud.showBanner('CAR STOLEN', best.model.name + ' — the police noticed');
  }
  G.hud.update();
}

export function exitCar(G) {
  const p = G.player;
  const c = p.car;
  if (!c) return;
  c.isPlayer = false;
  p.car = null;
  p.x = c.x + Math.sin(c.heading + Math.PI / 2) * 3;
  p.z = c.z + Math.cos(c.heading + Math.PI / 2) * 3;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  G.audio.engine(0);
}
