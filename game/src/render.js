// Draws each frame: the 3D scene, the third-person camera, lighting and
// the day/night cycle. The camera follows behind Dani, orbits with the
// mouse, and pulls back and up when driving.

import * as THREE from 'three';

export class Render {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.camYaw = Math.PI; // behind the player, looking north
    this.camPitch = 0.32;
    this.camDist = 9;
    this.shakeSeed = 0;
    this.shakeT = 99;
  }

  addShake(seed) { this.shakeSeed = seed; this.shakeT = 0; }

  // Sun position and sky colour for an hour of the day.
  updateDayNight(world, hour, dt) {
    const t = ((hour - 6) / 18); // 0 at 06:00, 1 at 24:00
    const sunA = Math.PI * (0.15 + t * 0.7);
    world.sun.position.set(Math.cos(sunA) * 200, Math.sin(sunA) * 160 + 20, 80);
    const day = Math.max(0, Math.sin(sunA));
    const dusk = Math.max(0, 1 - Math.abs(hour - 18.5) / 2.5);
    world.sun.intensity = 0.4 + day * 1.8;
    world.hemi.intensity = 0.35 + day * 0.55;
    const sky = new THREE.Color().setHSL(0.08 + day * 0.02, 0.75, 0.32 + day * 0.25 - dusk * 0.05);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const lampOn = hour > 18.2 || hour < 6.5;
    if (world.lampMat) world.lampMat.emissiveIntensity = lampOn ? 1.6 : 0.2;
  }

  update(dt, g, time) {
    const inCar = !!g.car;
    const targetDist = inCar ? (g.camFar ? 14 : 11) : 9;
    this.camDist += (targetDist - this.camDist) * Math.min(1, dt * 4);
    const px = g.player.x, pz = g.player.z;
    const py = g.player.y + (inCar ? 1.2 : 1.8);
    // Camera sits behind the player at camYaw, looking at the player.
    const cx = px - Math.sin(this.camYaw) * this.camDist;
    const cz = pz - Math.cos(this.camYaw) * this.camDist;
    const cy = py + Math.sin(this.camPitch) * this.camDist + 1.2;
    let ox = 0, oy = 0;
    if (this.shakeT < 1) {
      this.shakeT += dt * 2;
      const r = Math.sin(this.shakeSeed * 12.9898 + this.shakeT * 40) * (1 - this.shakeT) * 0.5;
      ox = r; oy = r * 0.6;
    }
    this.camera.position.set(cx + ox, Math.max(1.2, cy + oy), cz);
    // Shots may override the look target (e.g. to include a helicopter).
    const look = g.shotLook;
    if (look) this.camera.lookAt(look.x, look.y, look.z);
    else this.camera.lookAt(px, py + 0.5, pz);
  }
}
