// Bullets, hits and pickups: ammo, cash and armour the player collects.

import * as THREE from 'three';
import { WEAPONS } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.lastShot = 0;
  }

  spawnEnemy(x, z, health = 60) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 0.8, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a2a8a, roughness: 0.9 })
    );
    body.position.y = 1.1;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8a080 })
    );
    head.position.y = 1.95;
    g.add(body); g.add(head);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { group: g, x, z, health, maxHealth: health, shootTimer: 1 + Math.random() };
    this.enemies.push(e);
    return e;
  }

  removeEnemy(e) {
    this.scene.remove(e.group);
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  spawnPickup(kind, x, z) {
    const colors = { ammo: 0x2ec22e, cash: 0xf2c200, armour: 0x2e6ac2 };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshStandardMaterial({ color: colors[kind] || 0xffffff, emissive: colors[kind] || 0xffffff, emissiveIntensity: 0.5 })
    );
    mesh.position.set(x, 1, z);
    this.scene.add(mesh);
    const p = { mesh, kind, x, z, t: Math.random() * 6 };
    this.pickups.push(p);
    return p;
  }

  shoot(fromX, fromY, fromZ, dirX, dirZ, weapon, time) {
    if (time - this.lastShot < weapon.rate) return false;
    this.lastShot = time;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    mesh.position.set(fromX, fromY, fromZ);
    this.scene.add(mesh);
    this.bullets.push({ mesh, x: fromX, y: fromY, z: fromZ, dx: dirX, dz: dirZ, damage: weapon.damage, life: 1.2 });
    return true;
  }

  update(dt, player, onEnemyKilled, onPickup, time) {
    // Bullets fly and hit enemies, police cars are ignored.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.dx * 55 * dt;
      b.z += b.dz * 55 * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y = Math.atan2(b.dx, b.dz);
      let dead = b.life <= 0;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - b.x, e.z - b.z) < 1.1) {
          e.health -= b.damage;
          dead = true;
          if (e.health <= 0) {
            this.removeEnemy(e);
            if (onEnemyKilled) onEnemyKilled(e);
          }
          break;
        }
      }
      if (dead) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
    // Enemies walk at the player and shoot back.
    for (const e of this.enemies) {
      const dx = player.x - e.x, dz = player.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) {
        e.x += (dx / d) * 3.2 * dt;
        e.z += (dz / d) * 3.2 * dt;
      }
      e.group.position.set(e.x, 0, e.z);
      e.group.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 26 && d > 2) {
        e.shootTimer = 1.6 + Math.random() * 0.8;
        if (Math.random() < 0.55) player.hurt(6);
      }
    }
    // Pickups spin; the player collects them by walking over them.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.mesh.rotation.y = p.t * 2;
      p.mesh.position.y = 1 + Math.sin(p.t * 3) * 0.25;
      if (Math.hypot(p.x - player.x, p.z - player.z) < 1.6) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        if (onPickup) onPickup(p.kind);
      }
    }
  }

  weaponName(slot) { return WEAPONS[slot - 1]?.name ?? 'Fists'; }
}
