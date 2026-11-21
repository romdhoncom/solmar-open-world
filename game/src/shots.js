// Staging for screenshots: drives the game into a fixed scene for each
// of the four screenshots, deterministically, from a fixed seed. The
// headless driver loads ?shot=<name> and captures the frame.

import { CARS } from './config.js';

export function stageShot(g, name) {
  const placeCruisersBehind = (car, n) => {
    g.police.cruisers.forEach((c, i) => {
      if (i >= n) return;
      const back = 9 + i * 7;
      c.x = car.x - Math.sin(car.heading) * back + (i % 2 === 0 ? -3 : 3);
      c.z = car.z - Math.cos(car.heading) * back;
      c.heading = car.heading;
      c.speed = 20;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
  };

  if (name === '1-chase') {
    // Cover: a 4-star escape at sunset, cruisers on the tail.
    g.hour = 18.3;
    const car = new Car(g.scene, CARS.find((c) => c.name === 'Falcon'), 0, 60, 0);
    g.parked.push(car);
    g.enterCar(car);
    g.police.setWanted(4);
    // Spawn the cruisers, then line them up behind the player's car.
    g.police.update(0.01, g.player, g.world, null, 0);
    placeCruisersBehind(car, 4);
    g.render.camYaw = Math.PI; // camera ahead, looking back at the chase
    g.render.camPitch = 0.28;
    g.render.camDist = 16;
    g.missions.index = 7;
    g.missions.active = true;
    g.missions.step = 1;
    g.missions.beginStep(g.ctx());
    g.hud.banner('The Solmar Score', 'Escape the 4-star chase — reach the hideout');
  } else if (name === '2-walk') {
    // On foot in the market plaza, mission marker to Marlowe Motors.
    g.hour = 17.6;
    g.player.x = -140; g.player.z = 60;
    g.player.heading = Math.PI / 2;
    g.render.camYaw = Math.PI / 2 - 0.22; // looking east-north, lighthouse far right
    g.render.camPitch = 0.3;
    g.missions.index = 0;
    g.missions.active = true;
    g.missions.step = 0;
    g.missions.beginStep(g.ctx());
  } else if (name === '3-drive') {
    // Cross-city drive over the harbour bridge at speed.
    g.hour = 17.8;
    const car = new Car(g.scene, CARS.find((c) => c.name === 'Sunset'), 170, 0, Math.PI / 2);
    g.parked.push(car);
    g.enterCar(car);
    car.speed = 24;
    // Put two traffic cars on the bridge ahead, for life in the shot.
    const vertical = g.traffic.cars.filter((c) => !c.horiz).slice(0, 2);
    vertical.forEach((c, i) => {
      c.road = 180;
      c.x = 180 + (i === 0 ? -3 : 3);
      c.z = i === 0 ? -45 : 45;
      c.dir = i === 0 ? 1 : -1;
      c.mesh.position.set(c.x, 0, c.z);
    });
    g.render.camYaw = Math.PI / 2; // behind the car, looking east over the bridge
    g.render.camPitch = 0.14;
    g.render.camDist = 11;
    g.missions.index = 5;
    g.missions.active = true;
    g.missions.step = 0;
    g.missions.beginStep(g.ctx());
    g.hud.banner('The Courier Run', 'Three delivery stops, any order, against the clock');
  } else if (name === '4-mission') {
    // Finale shootout on the docks at dusk, helicopter overhead.
    g.hour = 19.1;
    g.player.x = 108; g.player.z = 195;
    g.player.heading = 0.3;
    g.weaponSlot = 3;
    g.police.setWanted(5);
    g.police.update(0.01, g.player, g.world, null, 0);
    if (g.police.heli) {
      g.police.heliHeight = 16;
      g.police.heliOrbit = 20;
      g.police.heliAngle = Math.PI / 2; // ahead of the player, in frame
    }
    for (const [x, z] of [[112, 208], [128, 212], [120, 218]]) g.combat.spawnEnemy(x, z, 60);
    g.render.camYaw = 0.15; // behind the player, looking south down the pier
    g.render.camPitch = 0.42;
    // Look between the player and the helicopter so both are in frame.
    g.shotLook = { x: 108, y: 6, z: 200 };
    g.missions.index = 10;
    g.missions.active = true;
    g.missions.step = 0;
    g.missions.beginStep(g.ctx());
    g.hud.banner('The Docks', 'Fight Marco Vane\u2019s crew on the docks');
  }
  // Hide the act title: its wall-clock fade is throttled headlessly and
  // it would otherwise show the wrong act for staged missions.
  g.hud.el['act-title'].classList.remove('show');
}

// Car is imported lazily to avoid a cycle at module load: main.js imports
// shots.js, and shots.js needs the Car class from vehicles.js.
import { Car } from './vehicles.js';
