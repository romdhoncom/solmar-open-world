// The HUD: cash, health, ammo, wanted stars, the mission objective, the
// banner that announces a job, and the minimap — a live thumbnail of the
// whole city with the player, the police, the traffic and the mission
// target drawn on it. Everything is painted on the canvas, in view space.
import { FONT, FONT_DISPLAY, PALETTE, VIEW, WORLD } from './config.js';
import { objectiveText } from './missions.js';
import { playerCar } from './player.js';
import { speedFraction } from './vehicles.js';

const MINIMAP = { size: 190, margin: 14 };

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px ' + FONT;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function star(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Draw the minimap: the static city shrunk down, plus live blips. */
export function drawMinimap(ctx, game) {
  const size = MINIMAP.size;
  const x0 = VIEW.width - size - MINIMAP.margin;
  const y0 = VIEW.height - size - MINIMAP.margin;
  const scale = size / WORLD.width;
  const height = WORLD.height * scale;
  panel(ctx, x0 - 4, y0 - 4, size + 8, height + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, height);
  ctx.clip();
  ctx.drawImage(game.cityCanvas, x0, y0, size, height);
  const blip = (x, y, color, radius) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  // Mission target: a pulsing gold diamond.
  if (game.missions.active && game.missions.target) {
    const pulse = 5 + Math.sin(game.time * 4) * 2;
    const tx = x0 + game.missions.target.x * scale;
    const ty = y0 + game.missions.target.y * scale;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(tx, ty - pulse);
    ctx.lineTo(tx + pulse, ty);
    ctx.lineTo(tx, ty + pulse);
    ctx.lineTo(tx - pulse, ty);
    ctx.closePath();
    ctx.fill();
  }
  for (const car of game.cars) {
    if (car.dead) continue;
    if (car.kind === 'police') blip(car.x, car.y, '#e33f2f', 3);
    else if (car.kind === 'player') blip(car.x, car.y, '#ffffff', 3);
  }
  for (const enemy of game.enemies) blip(enemy.x, enemy.y, '#ff7a3c', 3);
  // The player: a white arrow that turns with them.
  const player = game.player;
  const px = x0 + player.x * scale;
  const py = y0 + player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'SOLMAR', x0, y0 + height + 18, 12, PALETTE.muted, 'left', true);
}

/** Draw the whole HUD over the world view. */
export function drawHud(ctx, game) {
  const player = game.player;
  // Top-left: cash, health, ammo.
  panel(ctx, 14, 14, 250, 96);
  text(ctx, '$' + Math.floor(player.money), 26, 46, 30, PALETTE.gold, 'left', true);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, 56, 226, 12);
  ctx.fillStyle = player.health > 30 ? PALETTE.green : PALETTE.red;
  ctx.fillRect(26, 56, 226 * Math.max(0, player.health / 100), 12);
  text(ctx, 'HEALTH ' + Math.floor(player.health), 26, 88, 13, PALETTE.text, 'left', true);
  if (!player.inCar) {
    text(ctx, 'AMMO ' + player.ammo + ' / ' + player.reserveAmmo, 150, 88, 13, PALETTE.text, 'left', true);
  } else {
    const car = playerCar(game);
    text(ctx, car ? car.model.toUpperCase() : '', 150, 88, 13, PALETTE.text, 'left', true);
  }

  // Top-right: wanted stars.
  const wanted = game.crime.wanted;
  panel(ctx, VIEW.width - 14 - 190, 14, 190, 44);
  for (let i = 0; i < 5; i += 1) {
    star(ctx, VIEW.width - 14 - 190 + 26 + i * 34, 37, 12, i < wanted ? PALETTE.gold : 'rgba(255,255,255,0.16)');
  }

  // Top-centre: the mission objective.
  const objective = objectiveText(game);
  const width = Math.min(640, ctx.measureText(objective).width + 40);
  ctx.font = 'bold 15px ' + FONT;
  const measured = ctx.measureText(objective).width;
  panel(ctx, (VIEW.width - measured - 44) / 2, 14, measured + 44, 40);
  text(ctx, objective, VIEW.width / 2, 40, 15, PALETTE.text, 'center', true);

  // Banner: mission starts and payouts.
  if (game.missions.bannerTimer > 0) {
    ctx.font = 'bold 34px ' + FONT_DISPLAY;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(game.missions.banner, VIEW.width / 2 + 2, 142);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(game.missions.banner, VIEW.width / 2, 140);
  }

  // Crime message under the objective.
  if (game.crime.messageTimer > 0) {
    text(ctx, game.crime.message, VIEW.width / 2, 84, 16, PALETTE.red, 'center', true);
  }

  // Bottom-left: what to press.
  const hint = player.inCar
    ? 'W/S drive · A/D steer · Space handbrake · E get out · P pause · M mute'
    : 'WASD move · Shift run · Mouse aim · Click shoot · R reload · E enter car · P pause';
  text(ctx, hint, 16, VIEW.height - 16, 13, PALETTE.muted, 'left');

  // Speedometer while driving.
  if (player.inCar) {
    const car = playerCar(game);
    const mph = car ? Math.round(Math.abs(car.speed) * 0.12) : 0;
    text(ctx, mph + ' mph', VIEW.width - MINIMAP.size - 30, VIEW.height - 16, 22, PALETTE.text, 'right', true);
    const frac = car ? speedFraction(car) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(VIEW.width - MINIMAP.size - 30 - 140, VIEW.height - 34, 140, 8);
    ctx.fillStyle = PALETTE.blue;
    ctx.fillRect(VIEW.width - MINIMAP.size - 30 - 140, VIEW.height - 34, 140 * frac, 8);
  }

  // Crosshair while on foot.
  if (!player.inCar) {
    const mouse = game.aimScreen;
    ctx.strokeStyle = 'rgba(244, 241, 230, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 14, mouse.y);
    ctx.lineTo(mouse.x - 6, mouse.y);
    ctx.moveTo(mouse.x + 6, mouse.y);
    ctx.lineTo(mouse.x + 14, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 14);
    ctx.lineTo(mouse.x, mouse.y - 6);
    ctx.moveTo(mouse.x, mouse.y + 6);
    ctx.lineTo(mouse.x, mouse.y + 14);
    ctx.stroke();
  }

  drawMinimap(ctx, game);
}
