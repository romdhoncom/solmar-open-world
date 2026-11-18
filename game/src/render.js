// Drawing only: the game state and the current screen in, pixels out. The
// 1280 by 720 view is scaled to fit the window and centred. The static
// city is one pre-painted canvas; the cars, people, bullets and effects are
// drawn over it each frame, then the HUD. Title and pause screens are
// panels over a live view of the city.
import { BEACH, CAR, FONT, FONT_DISPLAY, PALETTE, PLAYER, POLICE_LIGHT_A, POLICE_LIGHT_B, VIEW, WORLD } from './config.js';
import { drawHud } from './hud.js';
import { playerCar } from './player.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function drawCarBody(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
  // Wheels.
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 - 3, 12, 7);
  ctx.fillRect(-CAR.length / 2 + 6, CAR.width / 2 - 4, 12, 7);
  ctx.fillRect(CAR.length / 2 - 18, -CAR.width / 2 - 3, 12, 7);
  ctx.fillRect(CAR.length / 2 - 18, CAR.width / 2 - 4, 12, 7);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20, 28, 38, 0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -CAR.width / 2 + 5, 22, CAR.width - 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 245, 0.5)';
  ctx.fillRect(14, -CAR.width / 2 + 6, 4, CAR.width - 12);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 4, 3, 6);
  ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 10, 3, 6);
  if (car.kind === 'police') {
    // Flashing light bar.
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = phase ? POLICE_LIGHT_A : POLICE_LIGHT_B;
    ctx.fillRect(-4, -CAR.width / 2 + 2, 10, 6);
    ctx.fillStyle = phase ? POLICE_LIGHT_B : POLICE_LIGHT_A;
    ctx.fillRect(-4, CAR.width / 2 - 8, 10, 6);
    ctx.fillStyle = '#f4f1e6';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, radius) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, radius, radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  // Facing: a nose and shoulders.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * radius * 0.7, Math.sin(angle) * radius * 0.7, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMarker(ctx, x, y, time, label) {
  const bounce = Math.sin(time * 3) * 6;
  ctx.save();
  ctx.translate(x, y + bounce);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(12, -16);
  ctx.lineTo(0, -8);
  ctx.lineTo(-12, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(label, x + 1, y - 40 + bounce + 1);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(label, x, y - 40 + bounce);
  }
}

function drawPanel(ctx, title, lines, prompt, accent) {
  const width = 620;
  const lineHeight = 30;
  const height = 150 + lines.length * lineHeight + 64;
  const x = (VIEW.width - width) / 2;
  const y = (VIEW.height - height) / 2;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.font = 'bold 44px ' + FONT_DISPLAY;
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || PALETTE.text;
  ctx.fillText(title, VIEW.width / 2, y + 72);
  ctx.font = '17px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], VIEW.width / 2, y + 122 + i * lineHeight);
  }
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(prompt, VIEW.width / 2, y + height - 28);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  /** Convert a mouse position in canvas CSS pixels to view coordinates. */
  function toView(mouse) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (mouse.x - view.x / (window.devicePixelRatio || 1)) / view.scale,
      y: (mouse.y - view.y / (window.devicePixelRatio || 1)) / view.scale,
    };
  }

  function drawWorld(game) {
    const camera = game.camera;
    const vx = Math.max(0, Math.min(WORLD.width - VIEW.width, camera.x - VIEW.width / 2));
    const vy = Math.max(0, Math.min(WORLD.height - VIEW.height, camera.y - VIEW.height / 2));
    context.save();
    context.translate(-vx, -vy);
    context.drawImage(game.cityCanvas, 0, 0);
    // Cash pickups.
    for (const pickup of game.pickups) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(pickup.x, pickup.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5c00';
      context.font = 'bold 11px ' + FONT;
      context.textAlign = 'center';
      context.fillText('$', pickup.x, pickup.y + 4);
    }
    // Mission target marker.
    if (game.missions.active && game.missions.target) {
      drawMarker(context, game.missions.target.x, game.missions.target.y, game.time, game.missions.targetLabel);
    }
    // Bank hold-up progress ring.
    if (game.missions.active && game.missions.index === 4 && game.missions.stage === 1) {
      const player = game.player;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(player.x, player.y, 40, -Math.PI / 2, -Math.PI / 2 + (game.missions.timer / 8) * Math.PI * 2);
      context.stroke();
    }
    // Pedestrians.
    for (const ped of game.peds) {
      if (ped.dead) continue;
      drawPerson(context, ped.x, ped.y, ped.angle, ped.color, 9);
    }
    // Enemies.
    for (const enemy of game.enemies) {
      drawPerson(context, enemy.x, enemy.y, enemy.angle, enemy.flash > 0 ? '#ffffff' : '#d94f2f', 13);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(enemy.x - 16, enemy.y - 24, 32, 5);
      context.fillStyle = PALETTE.red;
      context.fillRect(enemy.x - 16, enemy.y - 24, 32 * Math.max(0, enemy.health / 70), 5);
    }
    // Officers.
    for (const officer of game.officers) {
      drawPerson(context, officer.x, officer.y, officer.angle, '#20242e', 12);
      context.fillStyle = '#f4f1e6';
      context.font = 'bold 8px ' + FONT;
      context.textAlign = 'center';
      context.fillText('PD', officer.x, officer.y + 3);
    }
    // Cars: parked and traffic first, then the player's, then police.
    const cars = game.cars.filter((c) => !c.dead);
    for (const car of cars) if (car.kind !== 'player' && car.kind !== 'police') drawCarBody(context, car, game.time);
    for (const car of cars) if (car.kind === 'player') drawCarBody(context, car, game.time);
    for (const car of cars) if (car.kind === 'police') drawCarBody(context, car, game.time);
    // The player on foot.
    const player = game.player;
    if (!player.inCar) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) {
        drawPerson(context, player.x, player.y, player.angle, '#f2c94c', PLAYER.radius);
        context.fillStyle = '#20242e';
        context.font = 'bold 9px ' + FONT;
        context.textAlign = 'center';
        context.fillText('DANI', player.x, player.y + 3);
      }
    }
    // Bullets and particles.
    for (const bullet of game.bullets) {
      context.fillStyle = '#ffd76b';
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const particle of game.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.max);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    // Beach umbrellas for a little life on the sand.
    context.restore();
  }

  function drawTitle(game) {
    drawWorld(game);
    const lines = [
      'A sun-soaked open-world crime story. Fresh off the bus with $150,',
      'Dani Vega owes Rosa Marlowe a favour — and Solmar owes Dani a living.',
      'Steal cars, outrun the cops, run five jobs and take the city.',
      '',
      'WASD move · Shift run · Mouse aim · Click shoot · E enter a car · P pause',
      game.hasSave ? 'Save found — press Enter to continue your story.' : 'Press Enter or click to start a new story.',
    ];
    drawPanel(context, 'SOLMAR', lines, 'Press Enter or click to play', PALETTE.gold);
  }

  function draw(game, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(game);
      return;
    }
    drawWorld(game);
    drawHud(context, game);
    if (screen === SCREEN_PAUSED) {
      drawPanel(context, 'Paused', [
        'The city waits for you.',
        'Missions finished: ' + game.missions.done + ' of 5 · Cars stolen: ' + game.stats.carsStolen,
        'Progress saves when a job is finished and when you pause.',
      ], 'Press P to keep playing');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel(context, 'Busted', [
        'The Solmar PD caught up with you. Fine paid, heat off.',
        'You wake up outside the station with your pride bruised.',
      ], 'Press Enter to get back on the street', PALETTE.blue);
    } else if (screen === SCREEN_WASTED) {
      drawPanel(context, 'Wasted', [
        'Solmar General patched you up — and sent the bill.',
        'You wake up at the hospital, poorer but breathing.',
      ], 'Press Enter to get back on the street', PALETTE.red);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toView, view };
}
