// Boot and the one loop: input is read every frame, the game advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, paused, busted, wasted and complete. Busted and wasted are
// brief stops: the police or the hospital take their cut, then play
// resumes. Complete appears once, when the ninth job is done — and then
// free roam carries on.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, loadSave, saveGame, stepGame } from './game.js';
import { MISSION_COUNT } from './missions.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const saved = loadSave();
const game = createGame(seed, null);
game.hasSave = !!saved;
// A debug handle for playtests: window.__solmar is the live game state.
window.__solmar = game;
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function startNewGame() {
    const fresh = createGame(seed, null);
    Object.assign(game, fresh);
    game.hasSave = false;
    screen = SCREEN_PLAY;
    announce('Playing Solmar. Press Enter to start your first job.');
  }

  function continueGame() {
    const resumed = createGame(seed, saved);
    Object.assign(game, resumed);
    game.hasSave = true;
    screen = SCREEN_PLAY;
    announce('Welcome back to Solmar. Press Enter to start your next job.');
  }

  function backToStreet() {
    screen = SCREEN_PLAY;
    announce('Back on the street.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE) {
      const actions = input.takeActions();
      if (actions & 8) game.audio.toggleMute();
      if ((actions & ACTION_CONFIRM) || input.takeClick()) {
        game.audio.unlock();
        if (saved) continueGame();
        else startNewGame();
      }
      // The title screen's city stays alive behind the panel.
      while (accumulator >= STEP) {
        stepGameTitle(game);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      // Play owns the actions: stepGame reads them once per frame.
      while (accumulator >= STEP) {
        const result = stepGame(game, input, renderer.view, STEP);
        accumulator -= STEP;
        if (result.pause) {
          screen = SCREEN_PAUSED;
          saveGame(game);
          announce('Paused. Progress saved.');
          break;
        }
        for (const event of result.events || []) {
          if (event.type === 'busted') screen = SCREEN_BUSTED;
          if (event.type === 'wasted') screen = SCREEN_WASTED;
        }
        // All nine jobs done: celebrate once, then free roam carries on.
        if (screen === SCREEN_PLAY && game.missions.done >= MISSION_COUNT && !game.missions.active && !game.celebrated) {
          game.celebrated = true;
          saveGame(game);
          screen = SCREEN_COMPLETE;
          announce('King of Solmar. The city is yours.');
        }
        if (screen !== SCREEN_PLAY) break;
      }
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      const actions = input.takeActions();
      if (actions & 8) game.audio.toggleMute();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      accumulator = 0;
      const actions = input.takeActions();
      if ((actions & ACTION_CONFIRM) || input.takeClick()) backToStreet();
    } else if (screen === SCREEN_COMPLETE) {
      accumulator = 0;
      const actions = input.takeActions();
      if ((actions & ACTION_CONFIRM) || input.takeClick()) backToStreet();
    }
    renderer.draw(game, screen);
  }

  // Advance the title backdrop: traffic and pedestrians only, no crimes.
  function stepGameTitle(g) {
    g.time += STEP;
    const { stepTraffic } = titleTraffic;
    stepTraffic(g, STEP);
    g.camera.x = g.player.x;
    g.camera.y = g.player.y;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(game);
      announce('Paused.');
    }
  });

  announce('Solmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

import * as titleTraffic from './traffic.js';

if (shot) runShot(shot);
else runGame();
