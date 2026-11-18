// Saving Solmar: money, finished missions and where the player stands, in
// this browser's local storage. A save is written whenever a mission is
// finished and whenever the player pauses; loading it puts the player back
// on the street with their progress intact. Nothing here touches the game
// while a screenshot scene is staged.
import { SAVE_KEY } from './config.js';

/** The save record for a game state. */
export function makeSave(game) {
  return {
    version: 1,
    money: Math.floor(game.player.money),
    missionsDone: game.missions.done,
    playerX: Math.floor(game.player.x),
    playerY: Math.floor(game.player.y),
    health: Math.floor(game.player.health),
    carsStolen: game.stats.carsStolen,
    savedAt: Date.now(),
  };
}

export function writeSave(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(makeSave(game)));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: there is then nothing to clear.
  }
}
