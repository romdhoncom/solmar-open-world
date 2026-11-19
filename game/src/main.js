// Solmar boots here: it builds the world from its seed, owns the frame
// loop, and wires every module together. The loop runs at a fixed step
// of one sixtieth of a second, so the game plays the same at any frame
// rate, and a screenshot run can simulate a fixed number of steps.

import { LANDMARKS, SEED, WORLD } from './config.js';
import { makeRng } from './random.js';
import { buildCity, paintCity } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnParkedCars, updateCar } from './vehicles.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { createPolice, updatePolice, clearWanted } from './police.js';
import { createMissions, startMission, updateMissions, updateCrew, missionObjective } from './missions.js';
import { createSidejobs, initPackages, updateSidejobs } from './sidejobs.js';
import { createRank, rankLevel } from './rank.js';
import { updateBullets, updatePickups } from './combat.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadGame, clearSave } from './save.js';
import { drawFrame } from './render.js';
import { applyShot, SHOT_FRAMES } from './shots.js';

const DT = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

/** Build a fresh game: world, player, streets, jobs, rank, effects. */
function createGame() {
  const rng = makeRng(SEED);
  const city = buildCity(rng);
  const G = {
    rng,
    time: 0,
    frame: 0,
    mode: 'menu',
    city,
    cityCanvas: paintCity(city),
    player: createPlayer(LANDMARKS.garage.x + 120, LANDMARKS.garage.y + 60),
    cars: [],
    peds: [],
    bullets: [],
    pickups: [],
    crew: [],
    police: createPolice(),
    missions: createMissions(),
    sidejobs: createSidejobs(),
    rank: createRank(),
    effects: { skids: [], sparks: [], smoke: [] },
    camera: { x: 0, y: 0, shake: 0 },
    input: createInput(canvas),
    audio: createAudio(),
    shotNoise: 0,
    shotDrive: null,
    shotAim: null,
  };
  G.camera.toWorld = (sx, sy) => ({ x: sx + G.camera.x, y: sy + G.camera.y });
  G.cars = [...spawnParkedCars(G), ...spawnTraffic(G)];
  G.peds = spawnPeds(G);
  initPackages(G);
  return G;
}

const G = createGame();

// Errors go where a test driver can read them.
window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(String(e.reason));
});

/** Lay a save over a fresh game: money, progress, packages, rank. */
function applySave(save) {
  G.player.money = save.money;
  G.player.kills = save.kills || 0;
  G.sidejobs.faresDone = save.fares || 0;
  G.rank.points = save.rankPoints || 0;
  G.rank.level = rankLevel(G.rank.points);
  save.packages.forEach((taken, i) => {
    if (taken && G.sidejobs.packages[i]) G.sidejobs.packages[i].taken = true;
  });
  G.sidejobs.collected = G.sidejobs.packages.filter((p) => p.taken).length;
  const done = Math.min(save.missionsDone || 0, 8);
  G.missions.done = save.missionsDone || 0;
  startMission(G, done);
}

function startGame() {
  G.audio.init();
  const save = loadGame();
  if (save) applySave(save);
  else startMission(G, 0);
  G.mode = 'playing';
}

/** One fixed step of the simulation. */
function update(dt) {
  G.time += dt;
  G.frame += 1;
  G.shotNoise = Math.max(0, G.shotNoise - dt);

  // In a staged shot, the mouse sits on the aim target.
  if (G.shotAim) {
    G.input.mouse.x = G.shotAim.x - G.camera.x;
    G.input.mouse.y = G.shotAim.y - G.camera.y;
  }

  updatePlayer(G, dt);
  if (G.player.car) {
    const drive = G.shotDrive || {
      forward: G.input.down('KeyW'),
      back: G.input.down('KeyS'),
      left: G.input.down('KeyA'),
      right: G.input.down('KeyD'),
    };
    updateCar(G, G.player.car, dt, drive);
    if (G.input.pressed('KeyH')) G.audio.horn();
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCrew(G, dt);
  updateMissions(G, dt);
  updateSidejobs(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);

  // Effects fade out; the skid list is capped so it cannot grow forever.
  for (const s of G.effects.skids) s.life -= dt;
  for (const s of G.effects.sparks) s.life -= dt;
  for (const s of G.effects.smoke) s.life -= dt;
  G.effects.skids = G.effects.skids.filter((s) => s.life > 0).slice(-200);
  G.effects.sparks = G.effects.sparks.filter((s) => s.life > 0);
  G.effects.smoke = G.effects.smoke.filter((s) => s.life > 0);
  G.camera.shake = Math.max(0, G.camera.shake - dt * 1.4);

  const speed01 = G.player.car ? Math.abs(G.player.car.speed) / 680 : 0;
  G.audio.engine(speed01);
  G.audio.update(dt, G.time);

  // Downed: back on your feet at the garage, a hundred dollars lighter.
  if (G.player.hp <= 0) {
    G.player.hp = 100;
    G.player.money = Math.max(0, G.player.money - 100);
    G.player.x = LANDMARKS.garage.x + 120;
    G.player.y = LANDMARKS.garage.y + 60;
    if (G.player.car) {
      G.player.car.owner = 'player';
      G.player.car = null;
    }
    clearWanted(G);
    G.crew = [];
  }
}

/** One step of the outer loop: menus first, then the simulation. */
function step() {
  const input = G.input;
  if (input.pressed('KeyM')) G.audio.toggleMute();
  if (G.mode === 'menu') {
    G.time += DT;
    G.frame += 1;
    if (input.pressed('Enter') || input.mouse.down) startGame();
  } else if (G.mode === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape')) G.mode = 'playing';
  } else if (G.mode === 'complete') {
    G.time += DT;
    if (input.pressed('Enter')) {
      clearSave();
      location.reload();
    }
  } else if (G.mode === 'playing') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      G.mode = 'paused';
    } else {
      update(DT);
    }
  }
  input.endFrame();
  // The read-aloud line keeps screen readers on the objective.
  if (G.frame % 60 === 0 && G.mode === 'playing') {
    statusEl.textContent = missionObjective(G);
  }
}

// The audio context needs a gesture; these are the gestures.
window.addEventListener('keydown', () => G.audio.init());
canvas.addEventListener('mousedown', () => G.audio.init());

// A handle for playtests and the screenshot driver.
window.__solmar = { G, start: startGame, step, DT };

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: stage the scene, simulate a fixed number of
  // steps, put the mouse where the aim belongs, draw once, and say
  // the frame is ready for the driver to capture.
  applyShot(G, shot);
  const frames = SHOT_FRAMES[shot] || 60;
  for (let i = 0; i < frames; i += 1) step();
  if (G.shotAim) {
    const vw = canvas.width;
    const vh = canvas.height;
    let camX = G.player.x - vw / 2;
    let camY = G.player.y - vh / 2;
    camX = vw >= WORLD.width ? (WORLD.width - vw) / 2 : Math.max(0, Math.min(WORLD.width - vw, camX));
    camY = vh >= WORLD.height ? (WORLD.height - vh) / 2 : Math.max(0, Math.min(WORLD.height - vh, camY));
    G.input.mouse.x = G.shotAim.x - camX;
    G.input.mouse.y = G.shotAim.y - camY;
  }
  drawFrame(ctx, G);
  window.__shotReady = true;
} else {
  let last = 0;
  let acc = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!last) last = t;
    acc += Math.min(0.1, (t - last) / 1000);
    last = t;
    while (acc >= DT) {
      step();
      acc -= DT;
    }
    drawFrame(ctx, G);
  }
  requestAnimationFrame(loop);
}
