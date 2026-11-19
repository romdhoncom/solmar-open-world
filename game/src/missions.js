// The nine story missions. Each mission is a small state machine:
// it starts, it watches for its objective, and it ends in success or
// failure. The manager owns which mission is current, the timer for
// timed missions, and the banner the HUD shows when one starts.

import { LANDMARKS, MISSION_PAY, MISSION_POINTS } from './config.js';
import { addWanted, clearWanted } from './police.js';
import { makeCar, CAR_MODELS } from './vehicles.js';
import { fireBullet } from './combat.js';
import { roadPointNear } from './world.js';
import { addRankPoints } from './rank.js';
import { saveGame } from './save.js';

export const MISSION_NAMES = [
  'New in Town',
  'Borrowed Wheels',
  'The Drop',
  'Breakers on the Boardwalk',
  'Taxi for Rosa',
  'The Courier Run',
  'Harbour Lights',
  'The Solmar Score',
  'King of Solmar',
];

export function createMissions() {
  return {
    index: 0,
    stage: 'go',
    timer: 0,
    timerMax: 0,
    data: {},
    banner: null,
    bannerUntil: 0,
    done: 0,
  };
}

/** Show a banner: the mission name, big, for a few seconds. */
export function showBanner(G, title, sub) {
  G.missions.banner = { title, sub };
  G.missions.bannerUntil = G.time + 3.2;
}

/** Start mission `i` from its beginning. */
export function startMission(G, i) {
  const m = G.missions;
  m.index = i;
  m.stage = 'go';
  m.timer = 0;
  m.timerMax = 0;
  m.data = {};
  G.crew = [];
  if (i === 0) {
    showBanner(G, 'Mission 1: New in Town', 'Walk to Marlowe Motors and meet the contact.');
  } else if (i === 1) {
    showBanner(G, 'Mission 2: Borrowed Wheels', 'Steal any car and bring it to the garage.');
  } else if (i === 2) {
    m.stage = 'pickup';
    m.data.pickup = roadPointNear(G.rng, G.player.x, G.player.y, 500);
    showBanner(G, 'Mission 3: The Drop', 'Pick up the package, then deliver it on time.');
  } else if (i === 3) {
    m.stage = 'fight';
    spawnCrew(G, LANDMARKS.boardwalk.x, LANDMARKS.boardwalk.y, 5);
    showBanner(G, 'Mission 4: Breakers on the Boardwalk', 'Fight off the rival crew on the beach.');
  } else if (i === 4) {
    m.stage = 'pickup';
    m.data.rosa = roadPointNear(G.rng, G.player.x, G.player.y, 400);
    showBanner(G, 'Mission 5: Taxi for Rosa', 'Pick Rosa up in a car and drive her across town.');
  } else if (i === 5) {
    m.stage = 'run';
    m.data.stops = [
      roadPointNear(G.rng, G.player.x, G.player.y, 600),
      roadPointNear(G.rng, G.player.x, G.player.y, 600),
      roadPointNear(G.rng, G.player.x, G.player.y, 600),
    ];
    m.data.visited = [false, false, false];
    m.timer = 90;
    m.timerMax = 90;
    showBanner(G, 'Mission 6: The Courier Run', 'Three stops, any order, against the clock.');
  } else if (i === 6) {
    m.stage = 'steal';
    const model = CAR_MODELS.find((c) => c.name === 'Strider');
    const gold = makeCar(model, 4150, 700, Math.PI / 2, 'parked');
    gold.gold = true;
    G.cars.push(gold);
    m.data.goldCar = gold;
    showBanner(G, 'Mission 7: Harbour Lights', 'Steal the gold Strider and bring it to the hideout.');
  } else if (i === 7) {
    m.stage = 'bank';
    m.holdup = 0;
    showBanner(G, 'Mission 8: The Solmar Score', 'Hold up the bank, then escape the chase.');
  } else if (i === 8) {
    m.stage = 'fight';
    spawnCrew(G, LANDMARKS.docks.x, LANDMARKS.docks.y, 6);
    showBanner(G, 'Mission 9: King of Solmar', 'Take down Marco Vane\u2019s crew on the docks.');
  }
}

/** Place `n` rival crew members around (x, y). */
export function spawnCrew(G, x, y, n) {
  G.crew = [];
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * Math.PI * 2;
    G.crew.push({
      x: x + Math.cos(angle) * (60 + i * 18),
      y: y + Math.sin(angle) * (60 + i * 18),
      hp: 60,
      angle: 0,
      shootTimer: 1 + i * 0.4,
      alive: true,
    });
  }
}

/** Crew members walk at the player and shoot when close enough. */
export function updateCrew(G, dt) {
  const p = G.player;
  for (const foe of G.crew) {
    if (!foe.alive) continue;
    const dx = p.x - foe.x;
    const dy = p.y - foe.y;
    const dist = Math.hypot(dx, dy);
    foe.angle = Math.atan2(dy, dx);
    if (dist > 120) {
      foe.x += Math.cos(foe.angle) * 95 * dt;
      foe.y += Math.sin(foe.angle) * 95 * dt;
    }
    foe.shootTimer -= dt;
    if (dist < 320 && foe.shootTimer <= 0) {
      foe.shootTimer = 1.5;
      fireBullet(G, foe.x, foe.y, foe.angle, 'enemy', 12);
    }
  }
}

function near(x1, y1, x2, y2, r) {
  return Math.hypot(x1 - x2, y1 - y2) <= r;
}

function completeMission(G) {
  const m = G.missions;
  const i = m.index;
  const pay = MISSION_PAY[i];
  G.player.money += pay;
  addRankPoints(G, MISSION_POINTS[i]);
  m.done += 1;
  G.crew = [];
  clearWanted(G);
  saveGame(G);
  if (i >= 8) {
    G.mode = 'complete';
    G.audio.fanfare();
    return;
  }
  showBanner(G, `Mission ${i + 1} complete`, `+$${pay} — next: ${MISSION_NAMES[i + 1]}`);
  startMission(G, i + 1);
}

function failMission(G, why) {
  showBanner(G, 'Mission failed', why);
  startMission(G, G.missions.index);
}

export function updateMissions(G, dt) {
  const m = G.missions;
  const p = G.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer = 0;
      failMission(G, 'Out of time — try it again.');
      return;
    }
  }
  const i = m.index;
  if (i === 0) {
    if (near(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y, 70)) completeMission(G);
  } else if (i === 1) {
    if (p.car && near(p.car.x, p.car.y, LANDMARKS.garage.x, LANDMARKS.garage.y, 90)) completeMission(G);
  } else if (i === 2) {
    if (m.stage === 'pickup') {
      if (near(p.x, p.y, m.data.pickup.x, m.data.pickup.y, 60)) {
        m.stage = 'deliver';
        m.data.dest = roadPointNear(G.rng, p.x, p.y, 900);
        m.timer = 75;
        m.timerMax = 75;
        showBanner(G, 'Package collected', 'Deliver it to the marked address — fast.');
      }
    } else if (near(p.x, p.y, m.data.dest.x, m.data.dest.y, 70)) {
      completeMission(G);
    }
  } else if (i === 3) {
    if (G.crew.length > 0 && G.crew.every((f) => !f.alive)) completeMission(G);
  } else if (i === 4) {
    if (m.stage === 'pickup') {
      if (p.car && near(p.car.x, p.car.y, m.data.rosa.x, m.data.rosa.y, 70)) {
        m.stage = 'drive';
        m.data.dest = roadPointNear(G.rng, p.x, p.y, 1000);
        m.timer = 60;
        m.timerMax = 60;
        showBanner(G, 'Rosa is in', 'Drive her to the destination before the clock runs out.');
      }
    } else if (p.car && near(p.car.x, p.car.y, m.data.dest.x, m.data.dest.y, 80)) {
      const tip = Math.ceil(m.timer) * 2;
      p.money += tip;
      showBanner(G, 'Rosa dropped off', `Tip: $${tip} for speed.`);
      completeMission(G);
    }
  } else if (i === 5) {
    let all = true;
    for (let s = 0; s < 3; s += 1) {
      if (!m.data.visited[s] && near(p.x, p.y, m.data.stops[s].x, m.data.stops[s].y, 70)) {
        m.data.visited[s] = true;
        G.audio.chime();
      }
      if (!m.data.visited[s]) all = false;
    }
    if (all) completeMission(G);
  } else if (i === 6) {
    if (m.stage === 'steal' && p.car === m.data.goldCar) {
      m.stage = 'deliver';
      showBanner(G, 'Gold Strider stolen', 'Bring it to the hideout — don\u2019t wreck it.');
    } else if (m.stage === 'deliver' && p.car === m.data.goldCar && near(p.car.x, p.car.y, LANDMARKS.hideout.x, LANDMARKS.hideout.y, 90)) {
      if (p.car.damage >= 90) {
        failMission(G, 'The Strider arrived wrecked — try again.');
      } else {
        completeMission(G);
      }
    }
  } else if (i === 7) {
    if (m.stage === 'bank') {
      if (near(p.x, p.y, LANDMARKS.bank.x, LANDMARKS.bank.y, 70)) {
        m.holdup = (m.holdup || 0) + dt;
        if (m.holdup >= 3) {
          m.stage = 'escape';
          addWanted(G, 4);
          showBanner(G, 'The vault is open — run!', 'Escape the 4-star chase to the hideout.');
        }
      } else {
        m.holdup = 0;
      }
    } else if (near(p.x, p.y, LANDMARKS.hideout.x, LANDMARKS.hideout.y, 90)) {
      completeMission(G);
    }
  } else if (i === 8) {
    if (m.stage === 'fight') {
      if (G.crew.length > 0 && G.crew.every((f) => !f.alive)) {
        m.stage = 'escape';
        addWanted(G, 5);
        showBanner(G, 'Vane\u2019s crew is down', 'Escape the 5-star chase to the hideout.');
      }
    } else if (near(p.x, p.y, LANDMARKS.hideout.x, LANDMARKS.hideout.y, 90)) {
      completeMission(G);
    }
  }
}

/** The current objective line for the HUD. */
export function missionObjective(G) {
  const m = G.missions;
  const i = m.index;
  if (i === 0) return 'Walk to Marlowe Motors';
  if (i === 1) return 'Steal a car, bring it to the garage';
  if (i === 2) return m.stage === 'pickup' ? 'Pick up the package' : 'Deliver the package';
  if (i === 3) return `Fight off the Breakers (${G.crew.filter((f) => f.alive).length} left)`;
  if (i === 4) return m.stage === 'pickup' ? 'Pick Rosa up — in a car' : 'Drive Rosa to her destination';
  if (i === 5) return `Courier stops: ${m.data.visited.filter(Boolean).length} of 3`;
  if (i === 6) return m.stage === 'steal' ? 'Steal the gold Strider at the harbour' : 'Bring the Strider to the hideout';
  if (i === 7) return m.stage === 'bank' ? 'Hold up the bank — stand at the door' : 'Escape to the hideout';
  return m.stage === 'fight' ? `Fight Vane\u2019s crew (${G.crew.filter((f) => f.alive).length} left)` : 'Escape to the hideout';
}

/** The current map marker for the HUD and minimap, or null. */
export function missionMarker(G) {
  const m = G.missions;
  const i = m.index;
  if (i === 0 || i === 1) return LANDMARKS.garage;
  if (i === 2) return m.stage === 'pickup' ? m.data.pickup : m.data.dest;
  if (i === 3) return LANDMARKS.boardwalk;
  if (i === 4) return m.stage === 'pickup' ? m.data.rosa : m.data.dest;
  if (i === 5) {
    for (let s = 0; s < 3; s += 1) if (!m.data.visited[s]) return m.data.stops[s];
    return null;
  }
  if (i === 6) return m.stage === 'steal' ? { x: 4150, y: 700 } : LANDMARKS.hideout;
  if (i === 7) return m.stage === 'bank' ? LANDMARKS.bank : LANDMARKS.hideout;
  return m.stage === 'fight' ? LANDMARKS.docks : LANDMARKS.hideout;
}
