// Solmar 3D — saving and loading (localStorage).
// Written fresh in this session for the v5 rebuild (prose spec only).
// Saves money, missions completed, kills, fares, packages, jumps and
// rank. Loading an older save format (v1, without rank points or the
// jumps list) still works: missing fields fall back to defaults.

const KEY = 'solmar3d-save-v2';
const OLD_KEY = 'solmar-save-v1';

export function defaultSave() {
  return {
    version: 2,
    money: 150,
    missionsDone: [],
    kills: 0,
    fares: 0,
    packages: [],
    jumps: [],
    rankPoints: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const d = defaultSave();
    if (typeof data.money === 'number') d.money = data.money;
    if (Array.isArray(data.missionsDone)) d.missionsDone = data.missionsDone;
    if (typeof data.kills === 'number') d.kills = data.kills;
    if (typeof data.fares === 'number') d.fares = data.fares;
    if (Array.isArray(data.packages)) d.packages = data.packages;
    if (Array.isArray(data.jumps)) d.jumps = data.jumps;
    if (typeof data.rankPoints === 'number') d.rankPoints = data.rankPoints;
    return d;
  } catch (err) {
    return defaultSave();
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: 2 }));
    return true;
  } catch (err) {
    return false;
  }
}
