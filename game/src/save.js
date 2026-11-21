// Save to localStorage: money, missions, kills, fares, packages, jumps,
// rank. Loading an older save format (v1, without armour) still works.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    version: 2, money: 150, missionsDone: 0, kills: 0, fares: 0,
    packages: [], jumps: [], rankPoints: 0, armour: 0, health: 100,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    const d = defaultSave();
    // v1 saves had no armour field and stored packages as a count.
    if (typeof s.packages === 'number') s.packages = [];
    return { ...d, ...s, version: 2 };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
