// Solmar 3D — draws each frame: the 3D scene, camera, lighting,
// shadows, effects (camera shake, crash sparks).
// Written fresh in this session for the v5 rebuild (prose spec only).
// Third-person camera: behind the player on foot, behind the car while
// driving (C toggles near/far); the mouse orbits it.

import * as THREE from 'three';
import { makeRng } from './random.js';

export function createRender(G) {
  let camYaw = 0;
  let camPitch = 0.32;
  let camDist = 7;
  let nearCam = false;
  let shotCam = null; // {yaw, dist, pitch}: fixed camera for screenshot staging
  let shotLookAt = null; // THREE.Vector3: fixed look target for staging
  let shakeT = 0;
  let shakeMag = 0;
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  const shakeRng = makeRng(G.seed + 505);

  function shake(amount) {
    shakeT = Math.max(shakeT, 0.4);
    shakeMag = Math.max(shakeMag, amount);
  }

  function spark(x, y, z) {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMat.clone());
      m.position.set(x, y, z);
      G.scene.add(m);
      sparks.push({
        mesh: m,
        vx: (shakeRng() - 0.5) * 8,
        vy: shakeRng() * 6,
        vz: (shakeRng() - 0.5) * 8,
        life: 0.5,
      });
    }
  }

  function angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function update(dt, input) {
    if (shotCam) {
      // Staged camera: fixed yaw/distance/pitch (e.g. ahead of a chase
      // car looking back at it and its pursuers).
      camYaw = shotCam.yaw;
      camPitch = shotCam.pitch;
      camDist = shotCam.dist;
    } else {
      const mouse = input.consumeMouse();
      camYaw -= mouse.dx * 0.0032;
      camPitch = Math.max(0.05, Math.min(0.9, camPitch + mouse.dy * 0.002));
      if (input.wasPressed('KeyC')) nearCam = !nearCam;
    }

    const p = G.player;
    let target;
    let heading;
    if (p.inCar) {
      const car = p.inCar;
      target = new THREE.Vector3(car.x, 1.6, car.z);
      heading = car.heading;
      if (!shotCam) {
        camDist = nearCam ? 6.5 : 10.5;
        // Ease the camera behind the car while driving.
        camYaw = angleLerp(camYaw, heading, Math.min(1, dt * 1.5));
      }
    } else {
      target = new THREE.Vector3(p.x, 1.8, p.z);
      heading = p.heading;
      if (!shotCam) camDist = 7;
    }
    const height = camDist * Math.sin(camPitch);
    const flat = camDist * Math.cos(camPitch);
    const cx = target.x - Math.sin(camYaw) * flat;
    const cz = target.z - Math.cos(camYaw) * flat;
    const cy = Math.max(0.6, target.y + height);
    G.camera.position.set(cx, cy, cz);
    // Camera shake: a deterministic jitter while shakeT lasts.
    if (shakeT > 0) {
      shakeT -= dt;
      const s = shakeMag * (shakeT / 0.4);
      G.camera.position.x += (shakeRng() - 0.5) * s;
      G.camera.position.y += (shakeRng() - 0.5) * s * 0.6;
      if (shakeT <= 0) shakeMag = 0;
    }
    G.camera.lookAt(shotLookAt || target);
    // Sparks fly out and fade.
    for (const sp of [...sparks]) {
      sp.life -= dt;
      sp.mesh.position.x += sp.vx * dt;
      sp.mesh.position.y += sp.vy * dt;
      sp.mesh.position.z += sp.vz * dt;
      sp.vy -= 12 * dt;
      sp.mesh.material.opacity = Math.max(0, sp.life / 0.5);
      sp.mesh.material.transparent = true;
      if (sp.life <= 0) {
        G.scene.remove(sp.mesh);
        sparks.splice(sparks.indexOf(sp), 1);
      }
    }
    G.renderer.render(G.scene, G.camera);
  }

  function setCamYaw(yaw) { camYaw = yaw; }
  function setCamPitch(pitch) { camPitch = pitch; }
  function setShotCam(yaw, dist, pitch) { shotCam = { yaw, dist, pitch }; }
  function setShotLookAt(x, y, z) { shotLookAt = new THREE.Vector3(x, y, z); }

  return {
    update, shake, spark, setCamYaw, setCamPitch, setShotCam, setShotLookAt,
    get camYaw() { return camYaw; },
  };
}
