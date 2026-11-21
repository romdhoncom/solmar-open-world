// Solmar boots here and owns the frame loop.
import * as THREE from 'three';
import { CFG } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Save } from './save.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { CAR_MODELS, createCar, updatePlayerCar } from './vehicles.js';
import { createTraffic, updateTraffic, createPeds, updatePeds } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createSidejobs } from './sidejobs.js';
import { createRank } from './rank.js';
import { createHUD } from './hud.js';
import { createRenderer } from './render.js';
import { applyShot } from './shots.js';

const G = {
  now: 0,
  state: 'menu',
  time: CFG.startHour,
  money: 150,
  kills: 0,
  fares: 0,
  camYaw: Math.PI,
  camPitch: 0.1,
  camFar: false,
  shake: 0,
  shotMode: false,
  shotFired: false,
  marker: null,
  goldSunset: null,
  errors: [],
};
window.__solmar = G;
window.addEventListener('error', (e) => G.errors.push(String(e.message || e.error)));

const params = new URLSearchParams(location.search);
const shotParam = parseInt(params.get('shot') || '0', 10);

G.rng = new RNG(CFG.seed + 7);
G.scene = new THREE.Scene();
G.input = new Input(document.getElementById('app'));
G.audio = new AudioSys();
G.saveData = Save.load();
if (G.saveData) G.money = G.saveData.money;

G.world = buildWorld(G.scene);
G.player = createPlayer(G);
G.player.x = 0;
G.player.z = 6;
if (G.saveData) {
  G.player.weapons[1].ammo = 60;
  G.player.weapons[2].ammo = 120;
}
G.scene.add(G.player.mesh);
G.cars = [];
G.traffic = createTraffic(G);
G.peds = createPeds(G);
G.enemies = [];
G.combat = createCombat(G);
G.police = createPolice(G);
G.rank = createRank(G);
G.hud = createHUD(G);
G.missions = createMissions(G);
if (G.saveData && G.saveData.missions > 0) G.missions.idx = Math.min(G.saveData.missions, 11);
G.sidejobs = createSidejobs(G);
G.render = createRenderer(G);

// Parked cars to steal, scattered around the city.
{
  const spots = [[-70, -70], [70, -70], [-70, 70], [70, 70], [-150, 30], [30, -150], [150, 30], [-30, 150], [110, -110], [-110, 110]];
  const models = ['Pinto', 'Comet', 'Falcon', 'Taxi', 'Van', 'Sunset', 'Raptor', 'Pinto', 'Comet', 'Falcon'];
  spots.forEach((s, i) => {
    const model = CAR_MODELS.find((m) => m.name === models[i]);
    const car = createCar(model, s[0], s[1], (i % 4) * Math.PI / 2);
    G.scene.add(car.mesh);
    G.cars.push(car);
  });
}

G.saveGame = function () {
  Save.save({
    money: G.money,
    missions: G.missions.idx,
    kills: G.kills,
    fares: G.fares,
    packages: [...G.sidejobs.packagesDone],
    jumps: [...G.sidejobs.jumpsDone],
    rp: G.rank.rp,
  });
};
G.clearSave = function () { Save.clear(); };

// Spawn a few pickups around the city.
G.combat.spawnPickup(-40, -100, 'armour', 0);
G.combat.spawnPickup(40, -40, 'ammo', 0);
G.combat.spawnPickup(100, 100, 'cash', 50);

if (shotParam >= 1 && shotParam <= 4) {
  applyShot(G, shotParam);
}

let last = performance.now();
let frames = 0;
let hudT = 0;
const keyEdge = new Set();

function edge(code) {
  const down = G.input.down(code);
  const was = keyEdge.has(code);
  if (down && !was) { keyEdge.add(code); return true; }
  if (!down) keyEdge.delete(code);
  return false;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.now += dt;
  G.time = (G.time + dt * CFG.hoursPerSecond) % 24;
  if (G.state === 'playing') {
    if (G.player.car) {
      if (edge('KeyE') && G.now - (G.player.enteredAt || 0) > 0.4) exitCar(G);
      if (edge('KeyC')) G.camFar = !G.camFar;
      if (edge('KeyH')) G.audio.horn();
      if (G.shotMode) {
        // Staged drive: cruise forward at a fixed speed.
        const car = G.player.car;
        car.speed = 22;
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        const hit = G.world.collide(car.x, car.z, 1.6);
        car.x = hit.x; car.z = hit.z;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        // Police cruisers in a staged chase keep their formation behind.
        for (const cr of G.police.cruisers) {
          if (cr.chaseOffset) {
            cr.x = car.x + cr.chaseOffset.dx;
            cr.z = car.z + cr.chaseOffset.dz;
            cr.mesh.position.set(cr.x, 0, cr.z);
            cr.mesh.rotation.y = car.heading;
          }
        }
        G.audio.engine(0.7);
      } else {
        updatePlayerCar(G.player.car, G.input, dt, G);
      }
    } else {
      updatePlayer(dt, G);
    }
    updateTraffic(dt, G);
    updatePeds(dt, G);
    if (!G.shotMode) updatePolice(dt, G);
    G.combat.update(dt, G);
    if (!G.shotMode) {
      G.missions.update(dt);
      G.sidejobs.update(dt);
    }
    // Menu keys.
    if (edge('Escape')) G.hud.openPause();
    if (edge('KeyM')) G.hud.openPause();
    if (edge('KeyL')) { G.hud.openPause(); document.querySelector('[data-tab="missions"]').click(); }
    if (edge('KeyN')) { G.audio.ensure(); G.audio.setMuted(!G.audio.muted); }
    hudT += dt;
    if (hudT > 0.15) { hudT = 0; G.hud.update(); }
  }
  G.render.update(dt);
  frames++;
  if (frames === 5) window.__ready = true;
}

requestAnimationFrame(frame);
