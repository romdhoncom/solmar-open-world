// The HUD: the top-left panel (speed, money, health, wanted stars,
// rank), the objective line, the mission banner, the minimap, the
// crosshair, and the menus (start, pause, finale). All of it is drawn
// on the same canvas, in screen space.

import { LANDMARKS, MISSION_PAY, RANKS } from './config.js';
import { missionMarker, missionObjective, MISSION_NAMES } from './missions.js';
import { rankName, rankProgress } from './rank.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 18, 28, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

/** The whole HUD for a playing frame. */
export function drawHud(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  const p = G.player;

  // Top-left panel: speed, money, health, stars, rank.
  panel(ctx, 14, 14, 248, 132);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 17px sans-serif';
  const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.1) : 0;
  ctx.fillText(p.car ? `${speed} mph  ·  ${p.car.model.name}` : 'On foot', 28, 26);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`$${p.money}`, 28, 50);
  ctx.fillStyle = '#f4f1e6';
  ctx.fillText('HP', 28, 74);
  bar(ctx, 58, 76, 120, 12, p.hp / 100, p.hp > 40 ? '#5ac96a' : '#e84a3a');
  const stars = '★'.repeat(G.police.wanted) + '☆'.repeat(5 - G.police.wanted);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = G.police.wanted > 0 ? '#ff5a4a' : '#8a8a92';
  ctx.fillText(stars, 186, 72);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#bfe6f5';
  ctx.fillText(`${rankName(G)}  ·  ${G.sidejobs.collected}/12 pkgs  ·  ${G.sidejobs.faresDone} fares`, 28, 98);
  bar(ctx, 28, 118, 220, 7, rankProgress(G), '#ffd76a');

  // Objective line, top centre, with the countdown for timed missions.
  const m = G.missions;
  const objective = missionObjective(G);
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = 'rgba(12, 18, 28, 0.78)';
  const line = `Mission ${m.index + 1}: ${MISSION_NAMES[m.index]} — ${objective}`;
  const lineW = ctx.measureText(line).width + 28;
  ctx.beginPath();
  ctx.roundRect(vw / 2 - lineW / 2, 14, lineW, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.fillText(line, vw / 2, 21);
  if (m.timer > 0) {
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = m.timer < 10 ? '#ff5a4a' : '#ffd76a';
    ctx.fillText(`${Math.ceil(m.timer)}s`, vw / 2, 48);
  }

  // An arrow at the screen edge points at the mission marker when the
  // marker itself is off-screen, so the player always knows the way.
  const edgeMarker = missionMarker(G);
  if (edgeMarker && G.mode === 'playing') {
    const mx = edgeMarker.x - G.camera.x;
    const my = edgeMarker.y - G.camera.y;
    if (mx < 0 || mx > vw || my < 0 || my > vh) {
      let cx = Math.max(44, Math.min(vw - 44, mx));
      let cy = Math.max(44, Math.min(vh - 44, my));
      // Keep the arrow out of the top-left HUD panel.
      if (cx < 276 && cy < 160) cx = 276;
      const ang = Math.atan2(my - cy, mx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // The mission banner, big and centre, fading out.
  if (m.banner && G.time < m.bannerUntil) {
    const left = m.bannerUntil - G.time;
    const alpha = Math.min(1, left);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(m.banner.title, vw / 2, vh * 0.15);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#f4f1e6';
    ctx.fillText(m.banner.sub, vw / 2, vh * 0.15 + 44);
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, G);

  // Crosshair on foot, at the mouse.
  if (!p.car && G.mode === 'playing') {
    const mx = G.input.mouse.x;
    const my = G.input.mouse.y;
    ctx.strokeStyle = 'rgba(244, 241, 230, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 11, 0, Math.PI * 2);
    ctx.moveTo(mx - 17, my);
    ctx.lineTo(mx - 6, my);
    ctx.moveTo(mx + 6, my);
    ctx.lineTo(mx + 17, my);
    ctx.moveTo(mx, my - 17);
    ctx.lineTo(mx, my - 6);
    ctx.moveTo(mx, my + 6);
    ctx.lineTo(mx, my + 17);
    ctx.stroke();
  }

  // Repair prompt at the garage.
  if (p.car && p.car.wrecked) {
    const dx = p.car.x - LANDMARKS.garage.x;
    const dy = p.car.y - LANDMARKS.garage.y;
    if (Math.hypot(dx, dy) <= 130) {
      const cost = Math.ceil(p.car.damage) * 2;
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#ffd76a';
      ctx.textAlign = 'center';
      ctx.fillText(`Press E to repair — $${cost}`, vw / 2, vh - 48);
      ctx.textAlign = 'left';
    }
  }
}

function drawMinimap(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  const w = 200;
  const h = 150;
  const x0 = vw - w - 14;
  const y0 = vh - h - 14;
  const sx = w / 4800;
  const sy = h / 3600;
  panel(ctx, x0, y0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 4, y0 + 4, w - 8, h - 8);
  ctx.clip();
  // Water and sand, so the coast reads at a glance.
  ctx.fillStyle = '#2f7ea8';
  ctx.fillRect(x0 + 4200 * sx, y0 + 400 * sy, 600 * sx, 1000 * sy);
  ctx.fillStyle = '#e8c98f';
  ctx.fillRect(x0, y0 + 3200 * sy, w, h - 3200 * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(244, 241, 230, 0.55)';
  ctx.lineWidth = 2;
  for (const vx of [600, 1400, 2200, 3000, 3800]) {
    ctx.beginPath();
    ctx.moveTo(x0 + vx * sx, y0);
    ctx.lineTo(x0 + vx * sx, y0 + 3200 * sy);
    ctx.stroke();
  }
  for (const hy of [500, 1100, 1700, 2300, 2900]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + hy * sy);
    ctx.lineTo(x0 + w, y0 + hy * sy);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const pkg of G.sidejobs.packages) {
    if (!pkg.taken) dot(pkg.x, pkg.y, 2, '#b46ae8');
  }
  if (G.sidejobs.fare) {
    const f = G.sidejobs.fare;
    const spot = f.stage === 'pickup' ? f.pickup : f.dest;
    dot(spot.x, spot.y, 3, '#5ac96a');
  }
  for (const foe of G.crew) {
    if (foe.alive) dot(foe.x, foe.y, 2.5, '#ff7a4a');
  }
  for (const cruiser of G.police.cruisers) dot(cruiser.x, cruiser.y, 3, '#ff3a2a');
  if (G.police.heli) dot(G.police.heli.x, G.police.heli.y, 3, '#ff9a2a');
  const marker = missionMarker(G);
  if (marker) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    dot(marker.x, marker.y, pulse, '#ffd76a');
  }
  // The player, on top of everything.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x0 + 8, y0 + 12);
}

/** The start screen: title, story, controls, and how to begin. */
export function drawStartMenu(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR', vw / 2, vh * 0.26);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '20px sans-serif';
  ctx.fillText('A sun-soaked coastal city. Nine missions. One crown.', vw / 2, vh * 0.26 + 40);
  ctx.font = '17px sans-serif';
  const lines = [
    'Dani is new in town — and means to become King of Solmar.',
    '',
    'W A S D — move / drive      E — enter or leave a car      F — punch',
    'Mouse — aim      Click — shoot      H — horn      P — pause      M — mute',
    '',
    'Steal cars, outrun the police, run the missions, find all 12 packages.',
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, vw / 2, vh * 0.42 + i * 28);
  });
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 22px sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(G.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Press Enter or click to start', vw / 2, vh * 0.78);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/** The pause overlay. */
export function drawPaused(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10, 14, 24, 0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f1e6';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('Paused', vw / 2, vh * 0.45);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to keep playing', vw / 2, vh * 0.45 + 40);
  ctx.textAlign = 'left';
}

/** The finale screen, after the last mission. */
export function drawComplete(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('KING OF SOLMAR', vw / 2, vh * 0.32);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '20px sans-serif';
  ctx.fillText('Marco Vane is finished. The city is yours, Dani.', vw / 2, vh * 0.32 + 42);
  ctx.font = '18px sans-serif';
  const p = G.player;
  const lines = [
    `Money: $${p.money}`,
    `Missions completed: ${G.missions.done} of 9`,
    `Takedowns: ${p.kills}    Fares: ${G.sidejobs.faresDone}    Packages: ${G.sidejobs.collected}/12`,
    `Rank: ${RANKS[G.rank.level].name}`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, vw / 2, vh * 0.48 + i * 30);
  });
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press Enter to play again', vw / 2, vh * 0.72);
  ctx.textAlign = 'left';
  void MISSION_PAY;
}
