// Solmar 3D — boots the game, owns the frame loop.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Wires every system into one game object G and runs the loop. With
// ?shot=N&seed=1 the game stages a screenshot scene deterministically
// (fixed 1/60 s steps) and sets window.__shotReady when the frame is
// settled; the driver then captures it.

import * as THREE from 'three';
import { SEED, DAY_LENGTH, START_HOUR } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { buildWorld } from './world.js';
import { createVehicles } from './vehicles.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createRank } from './rank.js';
import { createSideJobs } from './sidejobs.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRender } from './render.js';
import { createShots } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const shotParam = parseInt(params.get('shot') || '', 10);
const SEED_USED = Number.isFinite(seedParam) ? seedParam : SEED;
const SHOT = Number.isFinite(shotParam) ? shotParam : 0;

window.addEventListener('error', (e) => {
  window.__shotError = String(e.message || e.error || 'page error');
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game-canvas';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const G = {
  seed: SEED_USED,
  scene, camera, renderer,
  time: 0,
  hour: START_HOUR,
  state: 'menu', // menu | playing | paused | complete
  shotSettled: false,
  save: null,
  input: null, audio: null, world: null, vehicles: null, player: null,
  traffic: null, combat: null, police: null, rank: null, sidejobs: null,
  missions: null, hud: null, render: null, shots: null,
};

G.startGame = function startGame() {
  if (G.state === 'playing') return;
  G.state = 'playing';
  G.hud.hideStart();
  G.missions.startFirst();
};

G.saveGame = function saveGame() {
  storeSave(G.save);
};

G.setHour = function setHour(h) {
  G.hour = h;
};

// ---- wire the systems (creation order matters: world first) ------------
G.input = createInput(renderer.domElement);
G.audio = createAudio();
G.save = loadSave();
G.world = buildWorld(G);
G.vehicles = createVehicles(G);
G.vehicles.spawnParked();
G.player = createPlayer(G);
G.player.money = G.save.money;
G.traffic = createTraffic(G);
G.combat = createCombat(G);
G.combat.scatterPickups();
G.police = createPolice(G);
G.rank = createRank(G);
G.sidejobs = createSideJobs(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.render = createRender(G);
G.shots = createShots(G);

G.hud.setRank(G.rank.level(), G.rank.title(), G.rank.progress(), G.rank.points);
G.hud.setWanted(0);
G.hud.setObjective('Solmar', 'Press Start to begin');

window.__game = G;

// ---- frame loop ---------------------------------------------------------
const clock = new THREE.Clock();
let autosaveT = 0;
let shotSteps = 0;
const SHOT_STEPS = 90;

function step(dt) {
  G.time += dt;
  G.hour = (G.hour + (dt * 24) / DAY_LENGTH) % 24;
  G.world.update(dt, G.hour, G.time);
  G.player.update(dt, G.input, G.render.camYaw);
  G.vehicles.update(dt, G.input);
  G.traffic.update(dt);
  G.police.update(dt);
  G.combat.update(dt);
  G.missions.update(dt);
  G.sidejobs.update(dt);
  G.hud.update(dt);
  G.render.update(dt, G.input);
  G.input.endFrame();
}

function frame() {
  requestAnimationFrame(frame);
  // Global keys work in every state (so Esc can also unpause).
  if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP')) G.hud.togglePause();
  if (G.state === 'paused') {
    // Frozen frame; still render so the pause menu sits over the world.
    if (G.input.wasPressed('KeyM')) { G.hud.showTab('MAP'); }
    if (G.input.wasPressed('KeyL')) { G.hud.showTab('MISSIONS'); }
    renderer.render(scene, camera);
    G.input.endFrame();
    return;
  }
  if (G.state !== 'playing') {
    // Menu / complete: idle camera orbit over the city, world alive.
    const t = G.time;
    G.time += 0.016;
    G.world.update(0.016, G.hour, G.time);
    G.traffic.update(0.016);
    camera.position.set(Math.sin(t * 0.05) * 180, 90, Math.cos(t * 0.05) * 180);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    G.input.endFrame();
    return;
  }
  if (G.input.wasPressed('KeyM')) { G.hud.togglePause(true); G.hud.showTab('MAP'); }
  if (G.input.wasPressed('KeyL')) { G.hud.togglePause(true); G.hud.showTab('MISSIONS'); }
  if (G.input.wasPressed('KeyN')) {
    const muted = G.audio.toggleMute();
    G.hud.banner(muted ? 'MUTED' : 'SOUND ON', '');
  }

  if (SHOT > 0) {
    // Screenshot mode: fixed steps, then freeze the frame.
    if (shotSteps < SHOT_STEPS) {
      step(1 / 60);
      shotSteps++;
      if (shotSteps === SHOT_STEPS) {
        window.__shotReady = true;
      }
    } else {
      renderer.render(scene, camera);
      G.input.endFrame();
    }
    return;
  }

  const dt = Math.min(0.05, clock.getDelta());
  step(dt);
  autosaveT += dt;
  if (autosaveT > 15) {
    autosaveT = 0;
    G.saveGame();
  }
}

// ---- start ---------------------------------------------------------------
if (SHOT > 0) {
  // Screenshot mode: no start screen, stage the scene, play it.
  G.state = 'playing';
  G.hud.hideStart();
  G.shots.stage(SHOT);
  // Missions started by the stage (shot 2) need their first update.
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}
window.__ready = true;
