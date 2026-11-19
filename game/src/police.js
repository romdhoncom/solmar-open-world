// The law in Solmar: the wanted level, the police who answer it, and
// what happens when they catch Dani. Crimes raise the wanted level;
// staying out of sight while the heat cools lowers it again. Police cars
// chase and ram; officers on foot chase and, when they corner Dani, make
// the arrest. At four stars the department blocks the roads ahead; at
// five a helicopter circles overhead and never loses the trail.
import { CAR, MAX_OFFICERS, MAX_POLICE_CARS, WANTED, WORLD } from './config.js';
import { makePoliceCar, stepCar } from './vehicles.js';
import { hurtPlayer, playerCar } from './player.js';
import { collideBuildings, nearestRoadPoint } from './world.js';

/** A fresh wanted record: no heat, no police on the street. */
export function makeCrime() {
  return {
    wanted: 0,
    quietTimer: 0,
    reason: '',
    message: '',
    messageTimer: 0,
  };
}

/** Raise the wanted level by `stars` (at most the max) and show why. */
export function addWanted(game, stars, reason) {
  const crime = game.crime;
  crime.wanted = Math.min(WANTED.max, crime.wanted + stars);
  crime.reason = reason;
  crime.quietTimer = 0;
  const plural = crime.wanted === 1 ? 'star' : 'stars';
  crime.message = `${reason} — wanted level ${crime.wanted} ${plural}`;
  crime.messageTimer = 4;
}

/** Let the heat cool while Dani commits no crime and stays unseen. */
export function coolWanted(game, dt) {
  const crime = game.crime;
  if (crime.wanted === 0) return;
  if (crime.messageTimer > 0) crime.messageTimer -= dt;
  const player = game.player;
  let seen = false;
  for (const car of game.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - player.x, car.y - player.y) < 520) seen = true;
  }
  for (const officer of game.officers) {
    if (Math.hypot(officer.x - player.x, officer.y - player.y) < 420) seen = true;
  }
  if (game.heli) seen = true;
  if (seen) {
    crime.quietTimer = 0;
    return;
  }
  crime.quietTimer += dt;
  if (crime.quietTimer >= WANTED.decaySeconds) {
    crime.wanted -= 1;
    crime.quietTimer = 0;
    crime.message = crime.wanted === 0
      ? 'You lost the cops. Heat is off.'
      : `Heat cooling down — wanted level ${crime.wanted}`;
    crime.messageTimer = 3;
  }
}

/** How many police cars the current wanted level calls for. */
export function wantedPoliceCars(wanted) {
  if (wanted === 0) return 0;
  return Math.min(MAX_POLICE_CARS, wanted + 1);
}

/** Spawn a police car on a road behind the player, out of sight. */
function spawnPoliceCar(game) {
  const player = game.player;
  const angle = game.random() * Math.PI * 2;
  const car = makePoliceCar(
    player.x + Math.cos(angle) * 700,
    player.y + Math.sin(angle) * 700,
    angle,
  );
  car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
  car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
  return car;
}

/** Spawn an officer on foot near the player. */
function spawnOfficer(game) {
  const player = game.player;
  const angle = game.random() * Math.PI * 2;
  return {
    x: player.x + Math.cos(angle) * 420,
    y: player.y + Math.sin(angle) * 420,
    angle,
    speed: 190,
    bustTimer: 0,
  };
}

/** Two cruisers parked across the road ahead of the player, as a roadblock. */
function spawnRoadblock(game) {
  const player = game.player;
  const road = nearestRoadPoint(player.x, player.y);
  const ahead = player.inCar ? playerCar(game) : null;
  const heading = ahead ? ahead.angle : player.angle;
  const dist = 420;
  const cx = player.x + Math.cos(heading) * dist;
  const cy = player.y + Math.sin(heading) * dist;
  const across = road.axis === 'v' ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const cars = [];
  for (const side of [-1, 1]) {
    const car = makePoliceCar(
      cx + across.x * side * 42,
      cy + across.y * side * 42,
      road.axis === 'v' ? 0 : Math.PI / 2,
    );
    car.roadblock = true;
    car.speed = 0;
    cars.push(car);
  }
  return cars;
}

/** Steer a police car toward the player, ramming when it gets close. */
function chaseInCar(game, car, dt) {
  const player = game.player;
  const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const distance = Math.hypot(player.x - car.x, player.y - car.y);
  // The hotter the heat, the harder they drive.
  const aggression = 0.8 + game.crime.wanted * 0.08;
  const throttle = distance > 60 ? aggression : 0.4;
  stepCar(car, dt, throttle, steer, false);
  // A ram hurts a player on foot and shakes a driven car.
  if (distance < CAR.length * 0.75) {
    if (!player.inCar) {
      if (hurtPlayer(game, 18)) game.events.push({ type: 'wasted', timer: 2 });
    } else {
      const driven = playerCar(game);
      if (driven) {
        driven.speed *= 0.82;
        game.shake = Math.max(game.shake, 7);
        if (game.random() < dt * 2) game.audio.crash();
      }
    }
  }
}

/** Chase on foot; cornering Dani starts the arrest timer. */
function chaseOnFoot(game, officer, dt) {
  const player = game.player;
  const distance = Math.hypot(player.x - officer.x, player.y - officer.y);
  const angle = Math.atan2(player.y - officer.y, player.x - officer.x);
  officer.angle = angle;
  officer.x += Math.cos(angle) * officer.speed * dt;
  officer.y += Math.sin(angle) * officer.speed * dt;
  // Officers run around buildings, never through them.
  const fixed = collideBuildings(game.city, officer.x, officer.y, 12);
  officer.x = fixed.x;
  officer.y = fixed.y;
  if (distance < WANTED.bustDistance && !player.inCar) {
    officer.bustTimer += dt;
    if (officer.bustTimer >= WANTED.bustSeconds) {
      game.events.push({ type: 'busted', timer: 2 });
      officer.bustTimer = 0;
    }
  } else {
    officer.bustTimer = Math.max(0, officer.bustTimer - dt);
  }
  // Officers give up and leave once the heat is off.
  if (game.crime.wanted === 0 && distance > 900) officer.gone = true;
}

/** Keep the right number of police on the street and move them. */
export function stepPolice(game, dt) {
  const wanted = game.crime.wanted;
  const policeCars = game.cars.filter((c) => c.kind === 'police' && !c.dead);
  const need = wantedPoliceCars(wanted);
  if (policeCars.length < need && game.random() < dt * 0.8) {
    game.cars.push(spawnPoliceCar(game));
  }
  if (wanted >= 2 && game.officers.length < Math.min(MAX_OFFICERS, wanted) && game.random() < dt * 0.4) {
    game.officers.push(spawnOfficer(game));
  }
  for (const car of policeCars) {
    if (car.roadblock) continue;
    chaseInCar(game, car, dt);
  }
  for (const officer of game.officers) chaseOnFoot(game, officer, dt);
  game.officers = game.officers.filter((o) => !o.gone);
  // Roadblocks: two cruisers across the road ahead, while the heat is high.
  const blockers = game.cars.filter((c) => c.roadblock && !c.dead);
  if (wanted >= WANTED.roadblockAt && blockers.length === 0 && game.random() < dt * 0.25) {
    game.cars.push(...spawnRoadblock(game));
  }
  if (wanted < WANTED.roadblockAt) {
    for (const car of blockers) car.dead = true;
  }
  // The helicopter circles overhead at five stars and never loses Dani.
  if (wanted >= WANTED.heliAt) {
    if (!game.heli) game.heli = { x: game.player.x, y: game.player.y - 300, angle: 0 };
    game.heli.angle += dt * 0.9;
    const hx = game.player.x + Math.cos(game.heli.angle) * 220;
    const hy = game.player.y + Math.sin(game.heli.angle) * 220 - 60;
    game.heli.x += (hx - game.heli.x) * Math.min(1, 1.5 * dt);
    game.heli.y += (hy - game.heli.y) * Math.min(1, 1.5 * dt);
  } else {
    game.heli = null;
  }
  // When the heat is off, the cruisers drive away and despawn far off.
  if (wanted === 0) {
    for (const car of policeCars) {
      const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
      if (d > 1100) car.dead = true;
      else {
        const away = Math.atan2(car.y - game.player.y, car.x - game.player.x);
        stepCar(car, dt, 0.7, Math.max(-1, Math.min(1, (away - car.angle) * 2)), false);
      }
    }
  }
}

/** Pay the fine and walk free: busted. */
export function applyBusted(game) {
  const player = game.player;
  const fine = WANTED.finePerStar * game.crime.wanted;
  player.money = Math.max(0, player.money - fine);
  game.crime.wanted = 0;
  game.crime.quietTimer = 0;
  game.crime.message = `Busted! Fine $${fine}. The cops let you go.`;
  game.crime.messageTimer = 4;
  game.officers = [];
  game.heli = null;
  for (const car of game.cars) if (car.kind === 'police') car.dead = true;
  if (player.inCar) {
    const car = playerCar(game);
    if (car) car.kind = 'parked';
    player.inCar = null;
  }
  player.x = 1200;
  player.y = 1420;
  player.health = Math.max(player.health, 50);
  game.audio.busted();
}

/** Wasted: the hospital takes its cut and Dani wakes up patched up. */
export function applyWasted(game) {
  const player = game.player;
  const loss = Math.floor(player.money * 0.1);
  player.money -= loss;
  player.health = 100;
  game.crime.wanted = 0;
  game.crime.quietTimer = 0;
  game.officers = [];
  game.heli = null;
  for (const car of game.cars) if (car.kind === 'police') car.dead = true;
  if (player.inCar) {
    const car = playerCar(game);
    if (car) car.kind = 'parked';
    player.inCar = null;
  }
  player.x = 1680;
  player.y = 620;
  game.crime.message = `You woke up in Solmar General. Hospital bill: $${loss}.`;
  game.crime.messageTimer = 4;
}
