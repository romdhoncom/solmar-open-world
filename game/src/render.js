// The frame: the painted city, then everything that moves, then the
// golden-hour light, then the HUD. The camera follows the player and
// shakes (deterministically, from the frame count) when something hits.

import { WORLD } from './config.js';
import { drawHud, drawStartMenu, drawPaused, drawComplete } from './hud.js';
import { missionMarker } from './missions.js';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/** Draw one car, rotated to its heading. */
function drawCar(ctx, car, frame) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const wrecked = car.wrecked;
  ctx.fillStyle = wrecked ? '#3a3a42' : car.model.color;
  roundRectPath(ctx, -24, -12, 48, 24, 6);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(-8, -9, 16, 18);
  ctx.fillStyle = '#1c2430';
  ctx.fillRect(10, -9, 8, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -9, 3, 5);
  ctx.fillRect(22, 4, 3, 5);
  if (car.gold) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -24, -12, 48, 24, 6);
    ctx.stroke();
  }
  if (car.owner === 'police') {
    // White doors and a flashing light bar.
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(-8, -12, 14, 24);
    ctx.fillStyle = frame % 30 < 15 ? '#ff3a2a' : '#2a6aff';
    ctx.fillRect(-4, -13, 8, 4);
  }
  ctx.restore();
}

export function drawFrame(ctx, G) {
  const vw = ctx.canvas.width;
  const vh = ctx.canvas.height;
  const p = G.player;

  // The camera follows the player, clamped to the world.
  let camX = p.x - vw / 2;
  let camY = p.y - vh / 2;
  camX = vw >= WORLD.width ? (WORLD.width - vw) / 2 : Math.max(0, Math.min(WORLD.width - vw, camX));
  camY = vh >= WORLD.height ? (WORLD.height - vh) / 2 : Math.max(0, Math.min(WORLD.height - vh, camY));
  if (G.camera.shake > 0.01) {
    camX += Math.sin(G.frame * 1.9) * G.camera.shake * 14;
    camY += Math.cos(G.frame * 1.3) * G.camera.shake * 14;
  }
  G.camera.x = camX;
  G.camera.y = camY;

  ctx.clearRect(0, 0, vw, vh);
  ctx.drawImage(G.cityCanvas, -camX, -camY);

  ctx.save();
  ctx.translate(-camX, -camY);

  // Skid marks, fading.
  for (const skid of G.effects.skids) {
    ctx.strokeStyle = `rgba(20, 20, 20, ${Math.max(0, skid.life / 5) * 0.5})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(skid.x1, skid.y1);
    ctx.lineTo(skid.x2, skid.y2);
    ctx.stroke();
  }

  // Pickups: ammo and cash, bobbing.
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.bob * 4) * 3;
    if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', pk.x, pk.y - 1 + bob);
    } else {
      ctx.fillStyle = '#5ac96a';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    }
    ctx.textAlign = 'left';
  }

  // Hidden packages, still waiting to be found.
  for (const pkg of G.sidejobs.packages) {
    if (pkg.taken) continue;
    const glow = 0.6 + 0.4 * Math.sin(G.time * 4 + pkg.x);
    ctx.fillStyle = `rgba(180, 106, 232, ${glow})`;
    ctx.fillRect(pkg.x - 9, pkg.y - 9, 18, 18);
    ctx.strokeStyle = '#f4f1e6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pkg.x - 9, pkg.y - 9, 18, 18);
  }

  // The mission marker: a pulsing ring and a diamond.
  const marker = missionMarker(G);
  if (marker && G.mode === 'playing') {
    const pulse = 22 + Math.sin(G.time * 5) * 7;
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  // The fare marker and Rosa, when a job is live.
  if (G.sidejobs.fare) {
    const fare = G.sidejobs.fare;
    const spot = fare.stage === 'pickup' ? fare.pickup : fare.dest;
    ctx.strokeStyle = '#5ac96a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 20 + Math.sin(G.time * 5) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#5ac96a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', spot.x, spot.y + 6);
    ctx.textAlign = 'left';
  }

  // Cars: civilians, parked, and the police.
  for (const car of G.cars) drawCar(ctx, car, G.frame);
  for (const cruiser of G.police.cruisers) drawCar(ctx, cruiser, G.frame);

  // Roadblocks: striped barriers across the road.
  for (const block of G.police.roadblocks) {
    ctx.save();
    ctx.translate(block.x, block.y);
    ctx.rotate(block.angle);
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#e84a3a' : '#f4f1e6';
      ctx.fillRect(i * 12 - 6, -16, 12, 32);
    }
    ctx.restore();
  }

  // Pedestrians.
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // The rival crew, with health bars.
  for (const foe of G.crew) {
    if (!foe.alive) continue;
    ctx.fillStyle = '#c94f3d';
    ctx.beginPath();
    ctx.arc(foe.x, foe.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2430';
    ctx.beginPath();
    ctx.arc(foe.x, foe.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(foe.x - 14, foe.y - 22, 28, 5);
    ctx.fillStyle = '#e84a3a';
    ctx.fillRect(foe.x - 14, foe.y - 22, 28 * Math.max(0, foe.hp / 60), 5);
  }

  // Dani on foot.
  if (!p.car) {
    ctx.fillStyle = '#3f6a9a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // The gun, pointing where the mouse aims.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    ctx.stroke();
  }

  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Sparks and smoke.
  for (const spark of G.effects.sparks) {
    ctx.fillStyle = `rgba(255, 220, 100, ${Math.max(0, spark.life * 2)})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 3 + spark.life * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const puff of G.effects.smoke) {
    ctx.fillStyle = `rgba(120, 120, 120, ${Math.max(0, puff.life * 0.35)})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, 10 + (1.6 - puff.life) * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // The helicopter: its shadow, then the machine, rotor turning.
  if (G.police.heli) {
    const heli = G.police.heli;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(heli.x + 34, heli.y + 34, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f4a6b';
    ctx.beginPath();
    ctx.arc(heli.x, heli.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4f1e6';
    ctx.lineWidth = 3;
    const rotor = G.time * 9;
    ctx.beginPath();
    ctx.moveTo(heli.x - Math.cos(rotor) * 26, heli.y - Math.sin(rotor) * 26);
    ctx.lineTo(heli.x + Math.cos(rotor) * 26, heli.y + Math.sin(rotor) * 26);
    ctx.stroke();
  }

  ctx.restore();

  // Golden-hour light: warm edges over the whole screen.
  const glow = ctx.createRadialGradient(
    vw / 2, vh / 2, Math.min(vw, vh) * 0.42,
    vw / 2, vh / 2, Math.max(vw, vh) * 0.75,
  );
  glow.addColorStop(0, 'rgba(255, 170, 80, 0)');
  glow.addColorStop(1, 'rgba(255, 150, 50, 0.13)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, vw, vh);

  // HUD and menus, in screen space.
  if (G.mode === 'menu') {
    drawStartMenu(ctx, G);
  } else if (G.mode === 'paused') {
    drawHud(ctx, G);
    drawPaused(ctx, G);
  } else if (G.mode === 'complete') {
    drawComplete(ctx, G);
  } else {
    drawHud(ctx, G);
  }
}
