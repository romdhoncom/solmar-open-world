// Draws each frame: renderer, camera, sun/sky by time of day, effects.
import * as THREE from 'three';

export function createRenderer(G) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  G.scene.add(sun);
  G.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95));
  G.scene.add(new THREE.AmbientLight(0x555566, 0.55));
  const skids = [];
  const dayCol = new THREE.Color(0x87b5d6);
  const duskCol = new THREE.Color(0xe8915a);
  const nightCol = new THREE.Color(0x0e1626);

  function updateSky() {
    // Sun angle: 07:00 sunrise, 19:00 sunset, so the golden hour lasts.
    const ang = ((G.time - 7) / 12) * Math.PI;
    const elev = Math.sin(ang);
    sun.position.set(Math.cos(ang) * 220, Math.max(18, elev * 220), 90);
    sun.intensity = 0.6 + 1.8 * Math.max(0, elev);
    sun.color.setHex(elev < 0.25 ? 0xffb36b : 0xffe0b0);
    const bg = new THREE.Color();
    if (elev >= 0.3) bg.copy(dayCol);
    else if (elev > 0) bg.copy(duskCol).lerp(dayCol, elev / 0.3);
    else bg.copy(nightCol).lerp(duskCol, Math.max(0, elev + 0.25) / 0.25);
    G.scene.background = bg;
    const night = G.time >= 19 || G.time < 6;
    for (const lamp of G.world.lamps) {
      lamp.material.emissive.setHex(night ? 0xffc84a : 0x000000);
    }
    // Water shimmer.
    for (let i = 0; i < G.world.waves.length; i++) {
      const w = G.world.waves[i];
      w.position.x += Math.sin(G.now * 0.3 + i * 1.7) * 0.02;
      w.material.opacity = 0.25 + 0.15 * Math.sin(G.now * 0.7 + i);
    }
  }

  return {
    renderer, camera,
    addSkid(x, z) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55 }),
      );
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = G.player.car ? G.player.car.heading : 0;
      s.position.set(x, 0.07, z);
      G.scene.add(s);
      skids.push(s);
      if (skids.length > 120) {
        const old = skids.shift();
        G.scene.remove(old);
      }
    },
    update(dt) {
      updateSky();
      const p = G.player;
      const tx = p.car ? p.car.x : p.x;
      const tz = p.car ? p.car.z : p.z;
      const ty = p.car ? 0 : p.y;
      // Camera: third person behind the player, mouse orbit.
      const dist = p.car ? (G.camFar ? 15 : 10) : 7.5;
      const height = 2.6 + dist * 0.16 - G.camPitch * 3;
      const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
      let cx = tx - fx * dist;
      let cz = tz - fz * dist;
      let cy = ty + height;
      // Keep the camera inside the island.
      cx = Math.max(-215, Math.min(215, cx));
      cz = Math.max(-215, Math.min(215, cz));
      if (G.shake > 0) {
        cx += (G.rng.next() - 0.5) * G.shake;
        cy += (G.rng.next() - 0.5) * G.shake;
        cz += (G.rng.next() - 0.5) * G.shake;
        G.shake = Math.max(0, G.shake - dt * 2.2);
      }
      camera.position.set(cx, cy, cz);
      camera.lookAt(tx + fx * 4, ty + 1.4 - G.camPitch * 2, tz + fz * 4);
      renderer.render(G.scene, camera);
    },
  };
}
