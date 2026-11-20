// Solmar 3D — the street rank ladder and its rewards.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Rank points come from missions, fares, packages, jumps and escapes.
// Reaching Made unlocks a gold Sunset car parked by the marina.

import { RANKS } from './config.js';

export function createRank(G) {
  let points = G.save.rankPoints || 0;

  function level() {
    let lv = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (points >= RANKS[i].points) lv = i;
    }
    return lv;
  }

  function title() {
    return RANKS[level()].title;
  }

  function progress() {
    const lv = level();
    if (lv >= RANKS.length - 1) return 1;
    const cur = RANKS[lv].points;
    const next = RANKS[lv + 1].points;
    return Math.max(0, Math.min(1, (points - cur) / (next - cur)));
  }

  function add(n) {
    const before = level();
    points += n;
    G.save.rankPoints = points;
    const after = level();
    if (after > before) {
      G.audio.fanfare();
      G.hud.banner('RANK UP', `You are now ${RANKS[after].title}`);
      if (RANKS[after].title === 'Made') {
        // Unlock the gold Sunset by the marina.
        const sunset = G.vehicles.list.find((c) => c.missionCar === 'sunset');
        if (sunset) {
          sunset.locked = false;
          G.hud.banner('UNLOCKED', 'The gold Sunset by the marina is yours');
        }
      }
    }
    G.hud.setRank(level(), title(), progress(), points);
  }

  return {
    get points() { return points; },
    level, title, progress, add,
  };
}
