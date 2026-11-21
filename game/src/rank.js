// Street rank: a ladder from Street Rat to King of Solmar. Rank points
// come from missions, fares, packages, jumps and escapes; reaching Made
// unlocks the gold Sunset car parked by the marina.

import { RANKS } from './config.js';

export class Rank {
  constructor(save) {
    this.points = save.rankPoints || 0;
  }

  get level() {
    let l = 0;
    RANKS.forEach((r, i) => { if (this.points >= r.points) l = i; });
    return l;
  }

  get title() { return RANKS[this.level].title; }

  get progress() {
    const l = this.level;
    if (l >= RANKS.length - 1) return 1;
    const cur = RANKS[l].points, next = RANKS[l + 1].points;
    return Math.min(1, (this.points - cur) / (next - cur));
  }

  get nextTitle() {
    return this.level >= RANKS.length - 1 ? null : RANKS[this.level + 1].title;
  }

  // Returns the new title when a rank-up happens, else null.
  add(points) {
    const before = this.title;
    this.points += points;
    return this.title !== before ? this.title : null;
  }

  get madeUnlocked() { return this.level >= 3; }
}
