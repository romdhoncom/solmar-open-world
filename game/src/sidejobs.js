// Repeatable taxi fares, 12 hidden packages, 5 stunt jumps.
import * as THREE from 'three';
import { CFG } from './config.js';

const PACKAGE_SPOTS = [
  [-112, -37], [-37, 37], [37, -112], [112, -37],
  [-150, 150], [150, -112], [-75, 150], [75, 185],
  [-185, 0], [0, 232], [185, 100], [-37, -150],
];
const JUMP_SPOTS = [
  { x: 140, z: 0, label: 'Bridge jump' },
  { x: 0, z: 210, label: 'Pier jump' },
  { x: -37, z: -150, label: 'Hills jump' },
  { x: 112, z: 75, label: 'Downtown jump' },
  { x: -150, z: -75, label: 'Market jump' },
];

export function createSidejobs(G) {
  const sys = {
    fare: null,
    fareCooldown: 0,
    packages: [],
    jumpsDone: new Set(G.saveData ? G.saveData.jumps : []),
    packagesDone: new Set(G.saveData ? G.saveData.packages : []),
    init() {
      // Package markers: glowing yellow boxes.
      PACKAGE_SPOTS.forEach((pt, i) => {
        if (this.packagesDone.has(i)) return;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0xcc9900, emissiveIntensity: 0.6 }),
        );
        mesh.position.set(pt[0], 1.2, pt[1]);
        mesh.rotation.y = Math.PI / 4;
        G.scene.add(mesh);
        this.packages.push({ mesh, x: pt[0], z: pt[1], i, t: G.rng.range(0, 6) });
      });
      // Jump ramps: angled wedges with a striped marker.
      for (const j of JUMP_SPOTS) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 8),
          new THREE.MeshLambertMaterial({ color: 0xff8c42 }));
        ramp.position.set(j.x, 0.7, j.z);
        ramp.rotation.x = -0.35;
        ramp.castShadow = true;
        G.scene.add(ramp);
      }
    },
    update(dt) {
      const p = G.player;
      const px = p.car ? p.car.x : p.x;
      const pz = p.car ? p.car.z : p.z;
      // Packages.
      for (let i = this.packages.length - 1; i >= 0; i--) {
        const pk = this.packages[i];
        pk.t += dt;
        pk.mesh.position.y = 1.2 + Math.sin(pk.t * 2.5) * 0.3;
        pk.mesh.rotation.y += dt;
        if (Math.hypot(pk.x - px, pk.z - pz) < 2.6) {
          G.money += CFG.packagePay;
          this.packagesDone.add(pk.i);
          G.rank.addRP(10);
          G.audio.chime();
          G.hud.showBanner('PACKAGE FOUND', '+' + CFG.packagePay + ' · ' + this.packagesDone.size + ' of 12');
          G.scene.remove(pk.mesh);
          this.packages.splice(i, 1);
          if (this.packagesDone.size === 12) {
            G.money += CFG.packageBonus;
            G.hud.showBanner('ALL PACKAGES!', '+$' + CFG.packageBonus + ' bonus');
            G.audio.fanfare();
          }
          G.saveGame();
        }
      }
      // Stunt jumps: fast car crossing a ramp pays out.
      if (p.car && Math.abs(p.car.speed) > 15) {
        for (const j of JUMP_SPOTS) {
          if (this.jumpsDone.has(j.label)) continue;
          if (Math.hypot(j.x - px, j.z - pz) < 4) {
            this.jumpsDone.add(j.label);
            G.money += CFG.jumpPay;
            G.rank.addRP(15);
            G.audio.fanfare();
            G.hud.showBanner('STUNT!', '+' + CFG.jumpPay + ' · ' + j.label);
            G.saveGame();
          }
        }
      }
      // Taxi fares: only while driving, between missions' taxi jobs.
      this.fareCooldown -= dt;
      if (!this.fare && p.car && this.fareCooldown <= 0 && !G.missions.cur) {
        // Offer a fare near the player.
        const a = G.rng.range(0, Math.PI * 2);
        const fx = Math.max(-180, Math.min(180, px + Math.sin(a) * 40));
        const fz = Math.max(-180, Math.min(180, pz + Math.cos(a) * 40));
        this.fare = { stage: 0, x: fx, z: fz, timer: 90 };
        G.missions.setMarker(fx, fz, 'Fare — pick up');
        G.hud.setMission('Taxi fare', 'Pick up the fare', 'Side job');
      }
      if (this.fare) {
        const f = this.fare;
        f.timer -= dt;
        if (f.timer <= 0) {
          this.fare = null;
          this.fareCooldown = 20;
          G.missions.clearMarker();
          G.hud.setMission('', '', '');
        } else if (f.stage === 0) {
          if (Math.hypot(f.x - px, f.z - pz) < 6) {
            f.stage = 1;
            const dx = G.rng.pick(G.world.roads);
            const dz = G.rng.pick(G.world.roads);
            f.dx = dx; f.dz = dz;
            G.missions.setMarker(dx, dz, 'Fare destination');
            G.hud.setMission('Taxi fare', 'Drive the fare to the destination', 'Side job');
          }
        } else if (Math.hypot(f.dx - px, f.dz - pz) < 6) {
          const tip = Math.floor(f.timer / 4);
          G.money += CFG.farePay + tip;
          G.fares++;
          G.rank.addRP(10);
          G.audio.chime();
          G.hud.showBanner('FARE PAID', '+$' + (CFG.farePay + tip) + ' (tip $' + tip + ')');
          this.fare = null;
          this.fareCooldown = 15;
          G.missions.clearMarker();
          G.hud.setMission('', '', '');
          G.saveGame();
        }
      }
    },
  };
  sys.init();
  return sys;
}
