// Combat: Dani's pistol, the bullets it fires, and the Breakers — the rival
// crew who show up in the beachfront mission. Bullets fly straight and die
// on buildings, cars and people; enemies stand their ground, shoot back,
// and drop cash when they fall.
import { COMBAT, PLAYER } from './config.js';
import { hitsBuilding } from './world.js';
import { hurtPlayer } from './player.js';

/** A fresh bullet from (x, y) along `angle`. */
export function makeBullet(x, y, angle, friendly) {
  return {
    x, y, angle,
    speed: COMBAT.bulletSpeed,
    friendly: friendly !== false,
    life: 1.2,
    dead: false,
  };
}

/** Fire the player's pistol toward (targetX, targetY). Returns true if a shot went off. */
export function playerShoot(game, targetX, targetY) {
  const player = game.player;
  if (player.inCar || player.fireTimer > 0 || player.reloadTimer > 0) return false;
  if (player.ammo <= 0) {
    if (player.reserveAmmo > 0) player.reloadTimer = COMBAT.reloadSeconds;
    return false;
  }
  player.ammo -= 1;
  player.fireTimer = COMBAT.fireInterval;
  player.angle = Math.atan2(targetY - player.y, targetX - player.x);
  const noseX = player.x + Math.cos(player.angle) * (PLAYER.radius + 8);
  const noseY = player.y + Math.sin(player.angle) * (PLAYER.radius + 8);
  game.bullets.push(makeBullet(noseX, noseY, player.angle, true));
  game.audio.gunshot();
  game.particles.push({ x: noseX, y: noseY, vx: Math.cos(player.angle) * 120, vy: Math.sin(player.angle) * 120, life: 0.12, max: 0.12, color: '#ffd76b', size: 6 });
  return true;
}

/** Spawn a Breaker at (x, y) who will fight Dani. */
export function spawnEnemy(game, x, y) {
  game.enemies.push({
    x, y,
    angle: 0,
    health: COMBAT.enemyHealth,
    fireTimer: 0.5 + game.random() * 0.8,
    dead: false,
    flash: 0,
  });
}

/** One enemy's step: face Dani, shoot when in range, strafe a little. */
function stepEnemy(game, enemy, dt) {
  const player = game.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  enemy.angle = Math.atan2(dy, dx);
  if (enemy.flash > 0) enemy.flash -= dt;
  if (distance > 60 && distance < COMBAT.enemyRange * 1.4) {
    const approach = distance > 220 ? 1 : distance < 140 ? -0.4 : 0;
    enemy.x += Math.cos(enemy.angle) * 55 * approach * dt;
    enemy.y += Math.sin(enemy.angle) * 55 * approach * dt;
  }
  enemy.x = Math.max(30, Math.min(3170, enemy.x));
  enemy.y = Math.max(30, Math.min(2370, enemy.y));
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && distance < COMBAT.enemyRange && !player.inCar) {
    enemy.fireTimer = COMBAT.enemyFireInterval;
    const jitter = (game.random() - 0.5) * 0.16;
    game.bullets.push(makeBullet(enemy.x, enemy.y, enemy.angle + jitter, false));
    game.audio.enemyShot();
  }
}

/** Move bullets, test their hits, and step the enemies. */
export function stepCombat(game, dt) {
  const player = game.player;
  for (const bullet of game.bullets) {
    if (bullet.dead) continue;
    bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
    bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || hitsBuilding(game.city, bullet.x, bullet.y, 2)) {
      bullet.dead = true;
      continue;
    }
    if (bullet.friendly) {
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 18) {
          bullet.dead = true;
          enemy.health -= COMBAT.bulletDamage;
          enemy.flash = 0.12;
          game.particles.push({ x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#e5534b', size: 8 });
          if (enemy.health <= 0) {
            enemy.dead = true;
            game.stats.kills += 1;
            game.pickups.push({ x: enemy.x, y: enemy.y, kind: 'cash', amount: 40 + Math.floor(game.random() * 40), life: 30 });
          }
          break;
        }
      }
      if (bullet.dead) continue;
      for (const officer of game.officers) {
        if (Math.hypot(officer.x - bullet.x, officer.y - bullet.y) < 16) {
          bullet.dead = true;
          officer.gone = true;
          game.crime.wanted = Math.min(5, game.crime.wanted + 1);
          game.crime.message = 'You shot a cop — wanted level ' + game.crime.wanted;
          game.crime.messageTimer = 4;
          break;
        }
      }
    } else {
      if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER.radius + 4) {
        bullet.dead = true;
        if (hurtPlayer(game, COMBAT.enemyDamage)) game.events.push({ type: 'wasted', timer: 2 });
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
  for (const enemy of game.enemies) {
    if (!enemy.dead) stepEnemy(game, enemy, dt);
  }
  game.enemies = game.enemies.filter((e) => !e.dead);
  for (const particle of game.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

/** A muzzle-flash particle at the player's gun, for the renderer. */
export function muzzleFlash(game) {
  const player = game.player;
  return {
    x: player.x + Math.cos(player.angle) * (PLAYER.radius + 10),
    y: player.y + Math.sin(player.angle) * (PLAYER.radius + 10),
  };
}
