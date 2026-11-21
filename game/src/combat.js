// Bullets, enemy crews, and pickups (ammo, armour, cash).
import * as THREE from 'three';
import { CFG } from './config.js';
import { damageCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function createCombat(G) {
  return {
    bullets: [],
    pickups: [],
    shootPlayer(G) {
      const p = G.player;
      const w = CFG.weapons[p.weapon];
      const dirX = Math.sin(G.camYaw);
      const dirZ = Math.cos(G.camYaw);
      const n = p.weapon === 3 ? 5 : 1;
      for (let i = 0; i < n; i++) {
        const spread = (G.rng.next() - 0.5) * w.spread * 2;
        const a = Math.atan2(dirX, dirZ) + spread;
        this.spawnBullet(
          p.x + Math.sin(G.camYaw) * 0.5, 1.5 + p.y, p.z + Math.cos(G.camYaw) * 0.5,
          Math.sin(a), 0, Math.cos(a), w.speed, w.dmg, true,
        );
      }
      G.shotFired = true;
      setTimeout(() => { G.shotFired = false; }, 400);
    },
    spawnBullet(x, y, z, dx, dy, dz, speed, dmg, fromPlayer) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xffe066 }),
      );
      mesh.position.set(x, y, z);
      G.scene.add(mesh);
      this.bullets.push({ mesh, x, y, z, dx, dy, dz, speed, dmg, fromPlayer, life: 1.2 });
    },
    nearestEnemy(x, z, maxD) {
      let best = null; let bd = maxD;
      for (const e of G.enemies) {
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < bd) { best = e; bd = d; }
      }
      return best;
    },
    damageEnemy(e, dmg, G) {
      e.hp -= dmg;
      if (e.hp <= 0 && !e.dead) {
        e.dead = true;
        G.scene.remove(e.mesh);
        const i = G.enemies.indexOf(e);
        if (i >= 0) G.enemies.splice(i, 1);
        G.kills++;
        G.rank.addRP(8);
        this.spawnPickup(e.x, e.z, 'cash', 30);
        if (G.rng.chance(0.4)) this.spawnPickup(e.x + 1, e.z, 'ammo', 20);
      }
    },
    spawnPickup(x, z, kind, amount) {
      const colors = { ammo: 0xffe066, armour: 0x4a90d9, cash: 0x51cf66 };
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshLambertMaterial({ color: colors[kind], emissive: colors[kind], emissiveIntensity: 0.4 }),
      );
      mesh.position.set(x, 0.8, z);
      mesh.rotation.y = Math.PI / 4;
      G.scene.add(mesh);
      this.pickups.push({ mesh, kind, amount, x, z, t: 0 });
    },
    spawnEnemy(x, z, hp) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 6),
        new THREE.MeshLambertMaterial({ color: 0x5a2a6a }));
      body.position.y = 0.9;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
      head.position.y = 1.8;
      g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.2, 0.4);
      g.add(gun);
      g.position.set(x, 0, z);
      G.scene.add(g);
      const e = { mesh: g, x, z, hp: hp || 60, shootT: G.rng.range(0.5, 1.5), dead: false };
      G.enemies.push(e);
      return e;
    },
    update(dt, G) {
      // Bullets fly, hit buildings, cars, enemies and the player.
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.dx * b.speed * dt;
        b.y += b.dy * b.speed * dt;
        b.z += b.dz * b.speed * dt;
        b.life -= dt;
        b.mesh.position.set(b.x, b.y, b.z);
        b.mesh.rotation.y = Math.atan2(b.dx, b.dz);
        let dead = b.life <= 0 || b.y < 0;
        if (!dead) {
          const c = G.world.collide(b.x, b.z, 0.2);
          if (c.x !== b.x || c.z !== b.z) dead = true;
        }
        if (!dead && b.fromPlayer) {
          for (const e of [...G.enemies]) {
            if (Math.hypot(e.x - b.x, e.z - b.z) < 1.2 && b.y < 2.4) {
              this.damageEnemy(e, b.dmg, G);
              dead = true;
              break;
            }
          }
          if (!dead) {
            for (const car of G.cars) {
              if (car.isPlayer) continue;
              if (Math.hypot(car.x - b.x, car.z - b.z) < 2.2 && b.y < 2) {
                damageCar(car, 8, G);
                dead = true;
                break;
              }
            }
          }
        }
        if (!dead && !b.fromPlayer) {
          const p = G.player;
          if (!p.car && Math.hypot(p.x - b.x, p.z - b.z) < 1.1 && b.y < 2.4) {
            hurtPlayer(G, b.dmg);
            dead = true;
          }
        }
        if (dead) {
          G.scene.remove(b.mesh);
          this.bullets.splice(i, 1);
        }
      }
      // Enemies advance and shoot at the player.
      for (const e of [...G.enemies]) {
        const p = G.player;
        const px = p.car ? p.car.x : p.x;
        const pz = p.car ? p.car.z : p.z;
        const dx = px - e.x, dz = pz - e.z;
        const d = Math.hypot(dx, dz);
        if (d > 10) {
          e.x += (dx / d) * 3.2 * dt;
          e.z += (dz / d) * 3.2 * dt;
        }
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = Math.atan2(dx, dz);
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 34) {
          e.shootT = G.rng.range(1.2, 2.0);
          const a = Math.atan2(dx, dz) + (G.rng.next() - 0.5) * 0.25;
          this.spawnBullet(e.x, 1.4, e.z, Math.sin(a), 0, Math.cos(a), 55, 6, false);
          G.audio.shot();
        }
      }
      // Pickups bob and get collected.
      const p = G.player;
      const px = p.car ? p.car.x : p.x;
      const pz = p.car ? p.car.z : p.z;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.t += dt;
        pk.mesh.position.y = 0.8 + Math.sin(pk.t * 3) * 0.25;
        pk.mesh.rotation.y += dt * 2;
        if (Math.hypot(pk.x - px, pk.z - pz) < 2.4) {
          if (pk.kind === 'cash') { G.money += pk.amount; G.hud.showBanner('+$' + pk.amount, 'Cash picked up'); }
          if (pk.kind === 'ammo') {
            p.weapons[1].ammo += pk.amount;
            p.weapons[2].ammo += pk.amount;
            G.hud.showBanner('AMMO', '+' + pk.amount + ' rounds');
          }
          if (pk.kind === 'armour') { p.armour = Math.min(100, p.armour + 50); G.hud.showBanner('ARMOUR', 'Armour topped up'); }
          G.audio.chime();
          G.scene.remove(pk.mesh);
          this.pickups.splice(i, 1);
        }
      }
    },
  };
}
