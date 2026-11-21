// Dani on foot: third-person movement, sprint, jump, punch, entering
// cars, shooting, health and armour. Built from boxes and capsules.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCollisions } from './world.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: 0xc22e2e, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirt);
  torso.position.y = 1.25;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e6ac2, roughness: 0.8 })
  );
  cap.position.y = 2.15;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), cap.material);
  brim.position.set(0, 2.1, 0.3);
  g.add(brim);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants);
  const legR = legL.clone();
  legL.position.set(-0.18, 0.42, 0);
  legR.position.set(0.18, 0.42, 0);
  legL.castShadow = true; legR.castShadow = true;
  g.add(legL); g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  const armR = armL.clone();
  armL.position.set(-0.48, 1.25, 0);
  armR.position.set(0.48, 1.25, 0);
  g.add(armL); g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.y = 0; this.vy = 0;
    this.heading = 0; // facing, radians
    this.health = PLAYER.health;
    this.armour = PLAYER.armour;
    this.money = PLAYER.startMoney;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.dead = false;
  }

  update(dt, input, camYaw, world, time) {
    if (this.dead) return;
    const axis = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    // Camera-relative movement.
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    let mx = axis.x * cos - axis.z * sin;
    let mz = axis.x * sin + axis.z * cos;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.x += mx * speed * dt;
      this.z += mz * speed * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
    }
    [this.x, this.z] = resolveCollisions(world, this.x, this.z, PLAYER.radius);
    // Jump and gravity.
    if (input.wasPressed('Space') && this.y <= 0.01) this.vy = PLAYER.jumpSpeed;
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y < 0) { this.y = 0; this.vy = 0; }
    if (this.punchTimer > 0) this.punchTimer -= dt;
    // Pose.
    const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
    if (this.punchTimer > 0) u.armR.rotation.x = -1.6;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
  }

  punch() {
    if (this.punchTimer > 0) return false;
    this.punchTimer = 0.35;
    return true;
  }

  hurt(amount) {
    if (this.dead) return;
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest * 0.7);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }

  heal(amount) { this.health = Math.min(PLAYER.health, this.health + amount); }
  addArmour(amount) { this.armour = Math.min(100, this.armour + amount); }
}
