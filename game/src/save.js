// Saving and loading: one localStorage key, versioned, so an older
// save still loads. The game saves on mission completion, on a fare,
// on a package and on a rank-up — never in the middle of a frame.

const KEY = 'solmar-save-v2';
const OLD_KEY = 'solmar-save';

/** Write the current progress. Never throws. */
export function saveGame(G) {
  try {
    const data = {
      v: 2,
      money: G.player.money,
      missionsDone: G.missions.done,
      kills: G.player.kills,
      fares: G.sidejobs.faresDone,
      packages: G.sidejobs.packages.map((p) => p.taken),
      rankPoints: G.rank.points,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // Storage unavailable (a private window, say): the game still plays.
  }
}

/** Read a save, migrating the older shape. Returns null when none. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number') return null;
    return {
      money: d.money,
      missionsDone: d.missionsDone || 0,
      kills: d.kills || 0,
      fares: d.fares || 0,
      packages: Array.isArray(d.packages) ? d.packages : [],
      rankPoints: d.rankPoints || 0,
      version: d.v || 1,
    };
  } catch (e) {
    return null;
  }
}

/** Forget the save entirely (a fresh start after the finale). */
export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch (e) {
    // Nothing to forget.
  }
}
