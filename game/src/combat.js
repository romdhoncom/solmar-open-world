// Combat: Dani's pistol, the bullets it fires, and the Breakers — the
// rival crew who show up in the beachfront mission and the finale.
// Bullets fly straight and die on buildings, cars and people; enemies
// stand their ground, shoot back, and drop cash or ammo when they fall.
// Three kinds fight: Breakers with pistols, brutes who hit hard and take
// a beating, and runners who close in fast and fire in bursts.
import { COMBAT, MONEY, PLAYER } from './config.js';
import { hitsBuilding } from './world.js';
import { hurtPlayer } from './player.js';

/** A fresh bullet from (x, y) along `angle`. */
export function makeBullet(x, y, angle, friendly) {
  return {
    x,
    y,
    angle,
    speed: COMBAT.bulletSpeed,
    friendly: friendly !== false,
    life: 1.2,
    dead: false,
  };
}

/** Fire the player's pistol toward (targetX, targetY). True when a shot went off. */
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
  game.particles.push({
    x: noseX,
    y: noseY,
    vx: Math.cos(player.angle) * 120,
    vy: Math.sin(player.angle) * 120,
    life: 0.12,
    max: 0.12,
    color: '#ffd76b',
    size: 6,
  });
  return true;
}

/** Spawn an enemy at (x, y) who will fight Dani. `kind` is breaker, brute or runner. */
export function spawnEnemy(game, x, y, kind) {
  const type = kind || 'breaker';
  const stats = {
    breaker: { health: COMBAT.enemyHealth, damage: COMBAT.enemyDamage, range: COMBAT.enemyRange, interval: COMBAT.enemyFireInterval, speed: 55 },
    brute: { health: COMBAT.bruteHealth, damage: COMBAT.bruteDamage, range: COMBAT.bruteRange, interval: COMBAT.bruteFireInterval, speed: 38 },
    runner: { health: COMBAT.runnerHealth, damage: COMBAT.runnerDamage, range: COMBAT.runnerRange, interval: COMBAT.runnerFireInterval, speed: 120 },
  }[type];
  game.enemies.push({
    x,
    y,
    angle: 0,
    kind: type,
    health: stats.health,
    damage: stats.damage,
    range: stats.range,
    fireInterval: stats.interval,
    moveSpeed: stats.speed,
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
  if (distance > 60 && distance < enemy.range * 1.4) {
    const approach = distance > 220 ? 1 : distance < 140 ? -0.4 : 0;
    enemy.x += Math.cos(enemy.angle) * enemy.moveSpeed * approach * dt;
    enemy.y += Math.sin(enemy.angle) * enemy.moveSpeed * approach * dt;
  }
  enemy.x = Math.max(30, Math.min(3170, enemy.x));
  enemy.y = Math.max(30, Math.min(2370, enemy.y));
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && distance < enemy.range && !player.inCar) {
    enemy.fireTimer = enemy.fireInterval;
    const jitter = (game.random() - 0.5) * 0.16;
    game.bullets.push(makeBullet(enemy.x, enemy.y, enemy.angle + jitter, false));
    game.audio.enemyShot();
  }
}

/** A small burst of sparks where a bullet died on a wall. */
function impactSparks(game, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const a = game.random() * Math.PI * 2;
    const speed = 60 + game.random() * 140;
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.2,
      max: 0.2,
      color: '#ffd76b',
      size: 3,
    });
  }
}

/** The damage of the enemy whose bullet this is, by kind. */
function nearestEnemyDamage(game, bullet) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of game.enemies) {
    const d = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best ? best.damage : COMBAT.enemyDamage;
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
      if (hitsBuilding(game.city, bullet.x, bullet.y, 2)) impactSparks(game, bullet.x, bullet.y);
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
          game.particles.push({
            x: bullet.x,
            y: bullet.y,
            vx: 0,
            vy: 0,
            life: 0.25,
            max: 0.25,
            color: '#e5534b',
            size: 8,
          });
          if (enemy.health <= 0) {
            enemy.dead = true;
            game.stats.kills += 1;
            const dropAmmo = game.random() < 0.4;
            game.pickups.push({
              x: enemy.x,
              y: enemy.y,
              kind: dropAmmo ? 'ammo' : 'cash',
              amount: dropAmmo ? MONEY.ammoPickup : 40 + Math.floor(game.random() * 40),
              life: 30,
            });
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
    } else if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER.radius + 4) {
      bullet.dead = true;
      const damage = nearestEnemyDamage(game, bullet);
      if (hurtPlayer(game, damage)) game.events.push({ type: 'wasted', timer: 2 });
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
