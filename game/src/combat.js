// Solmar 3D — bullets, hits, enemy gunmen and pickups (ammo, cash, armour).
// Written fresh in this session for the v5 rebuild (prose spec only).
// Bullets are small glowing tracers; enemies are simple low-poly figures
// that approach and shoot. Pickups are spinning markers the player
// walks over to collect.

import * as THREE from 'three';
import { WEAPONS, PICKUPS } from './config.js';
import { makeRng, range } from './random.js';

export function createCombat(G) {
  const bullets = []; // {mesh, x, y, z, vx, vy, vz, life, damage, fromPlayer}
  const enemies = []; // {mesh, x, z, health, speed, shootT, dead}
  const pickups = []; // {mesh, kind, x, z, taken}
  const bulletGeo = new THREE.SphereGeometry(0.09, 6, 4);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const enemyBodyMat = new THREE.MeshLambertMaterial({ color: 0x5a2a5a });
  const enemySkinMat = new THREE.MeshLambertMaterial({ color: 0xc89878 });

  function spawnEnemy(x, z, health) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 3, 6), enemyBodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), enemySkinMat);
    head.position.y = 1.9;
    group.add(head);
    // A gun in the hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    gun.position.set(0.45, 1.2, 0.3);
    group.add(gun);
    group.position.set(x, 0, z);
    G.scene.add(group);
    const e = { mesh: group, x, z, health: health || 60, speed: 3.2, shootT: 1, dead: false };
    enemies.push(e);
    return e;
  }

  function removeEnemy(e) {
    e.dead = true;
    G.scene.remove(e.mesh);
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
    G.player.money += 0; // kills pay rank, not cash
    G.rank.add(5);
    G.save.kills++;
    // Chance to drop a pickup where they fell.
    if (Math.random() < 0.5) spawnPickup(Math.random() < 0.5 ? 'ammo' : 'cash', e.x, e.z);
  }

  function shoot(x, z, heading, weaponIndex, fromPlayer) {
    const w = WEAPONS[weaponIndex];
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    const y = 1.4;
    mesh.position.set(x, y, z);
    G.scene.add(mesh);
    const speed = 70;
    bullets.push({
      mesh, x, y, z,
      vx: Math.sin(heading) * speed,
      vy: 0,
      vz: Math.cos(heading) * speed,
      life: 1.2, damage: w.damage, fromPlayer,
    });
    G.traffic.scare(x, z, 4);
  }

  function enemyShoot(x, z, tx, tz, damage) {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.set(x, 1.4, z);
    G.scene.add(mesh);
    const dx = tx - x;
    const dz = tz - z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 55;
    bullets.push({
      mesh, x, y: 1.4, z,
      vx: (dx / d) * speed, vy: 0, vz: (dz / d) * speed,
      life: 1.2, damage, fromPlayer: false,
    });
  }

  function punch(x, z, heading) {
    // A short-range swing: hurt the nearest enemy or pedestrian in front.
    for (const e of [...enemies]) {
      const dx = e.x - x;
      const dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d < 2.2) {
        const ang = Math.atan2(dx, dz);
        let dh = ang - heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        if (Math.abs(dh) < 1.2) {
          e.health -= WEAPONS[0].damage;
          if (e.health <= 0) removeEnemy(e);
        }
      }
    }
    // Punching a pedestrian is a crime.
    for (const p of G.traffic.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 2) {
        G.police.addWanted(1);
        G.traffic.scare(x, z, 5);
        break;
      }
    }
  }

  function spawnPickup(kind, x, z) {
    const color = kind === 'ammo' ? 0xffe066 : kind === 'armour' ? 0x66aaff : 0x66dd66;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
    mesh.position.set(x, 0.8, z);
    mesh.castShadow = true;
    G.scene.add(mesh);
    pickups.push({ mesh, kind, x, z, taken: false, spin: Math.random() * 6 });
  }

  function scatterPickups() {
    const rng = makeRng(G.seed + 303);
    for (let i = 0; i < 10; i++) {
      const kinds = ['ammo', 'armour', 'cash'];
      spawnPickup(kinds[i % 3], range(rng, -150, 150), range(rng, -150, 150));
    }
  }

  function update(dt) {
    // Bullets fly and hit things.
    for (const b of [...bullets]) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      let hit = b.life <= 0;
      if (!hit) {
        if (b.fromPlayer) {
          for (const e of [...enemies]) {
            if (Math.hypot(e.x - b.x, e.z - b.z) < 0.9) {
              e.health -= b.damage;
              if (e.health <= 0) removeEnemy(e);
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const c of G.vehicles.list) {
              if (c.isPlayer) continue;
              if (Math.hypot(c.x - b.x, c.z - b.z) < 2.2) {
                G.vehicles.damage(c, b.damage * 0.5);
                hit = true;
                break;
              }
            }
          }
          if (!hit) {
            for (const pc of G.police.cruisers) {
              if (Math.hypot(pc.x - b.x, pc.z - b.z) < 2.2) {
                G.police.addWanted(1);
                hit = true;
                break;
              }
            }
          }
        } else {
          // Enemy bullets: hit the player.
          const p = G.player;
          if (!p.inCar && Math.hypot(p.x - b.x, p.z - b.z) < 0.9) {
            p.hurt(b.damage);
            hit = true;
          } else if (p.inCar && Math.hypot(p.inCar.x - b.x, p.inCar.z - b.z) < 2.2) {
            G.vehicles.damage(p.inCar, b.damage * 0.4);
            hit = true;
          }
        }
        // Bullets stop at buildings.
        if (!hit) {
          const fixed = G.world.collideCircle(b.x, b.z, 0.1);
          if (fixed.x !== b.x || fixed.z !== b.z) hit = true;
        }
      }
      if (hit) {
        G.scene.remove(b.mesh);
        bullets.splice(bullets.indexOf(b), 1);
      }
    }
    // Enemies approach the player and shoot.
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    for (const e of [...enemies]) {
      if (e.dead) continue;
      const dx = px - e.x;
      const dz = pz - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 3) {
        e.x += (dx / d) * e.speed * dt;
        e.z += (dz / d) * e.speed * dt;
        const fixed = G.world.collideCircle(e.x, e.z, 0.5);
        e.x = fixed.x; e.z = fixed.z;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 30) {
        e.shootT = 1.1 + Math.random() * 0.8;
        enemyShoot(e.x, e.z, px, pz, 5);
        G.audio.shoot();
      }
    }
    // Pickups spin; the player collects them by walking over them.
    for (const pk of [...pickups]) {
      if (pk.taken) continue;
      pk.spin += dt * 3;
      pk.mesh.rotation.y = pk.spin;
      const d = Math.hypot(p.x - pk.x, p.z - pk.z);
      if (d < 1.4 && !p.inCar) {
        pk.taken = true;
        G.scene.remove(pk.mesh);
        pickups.splice(pickups.indexOf(pk), 1);
        if (pk.kind === 'ammo') {
          for (let i = 1; i < 4; i++) p.ammo[i] += PICKUPS.ammo;
          G.hud.banner('AMMO', `+${PICKUPS.ammo} ammo for each gun`);
        } else if (pk.kind === 'armour') {
          p.armour = Math.min(100, p.armour + PICKUPS.armour);
          G.hud.banner('ARMOUR', `+${PICKUPS.armour} armour`);
        } else {
          p.money += PICKUPS.cash;
          G.hud.banner('CASH', `+$${PICKUPS.cash}`);
        }
        G.audio.pickup();
      }
    }
  }

  return {
    weapons: WEAPONS, bullets, enemies, pickups,
    spawnEnemy, removeEnemy, shoot, enemyShoot, punch, spawnPickup, scatterPickups, update,
  };
}
