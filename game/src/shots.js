// Solmar 3D — staging for screenshots: fixed scenes the game can be
// driven into for rendering (chase, on foot, driving, finale).
// Written fresh in this session for the v5 rebuild (prose spec only).
// Each stage sets the time of day, positions the player, cars, police
// and enemies deterministically (fixed seed), and points the camera.
// The driver loads the game with ?shot=N&seed=1 and captures the frame
// once window.__shotReady is set.

export function createShots(G) {
  function placePlayerInCar(modelIndex, x, z, heading, speed) {
    const car = G.vehicles.spawnCar(modelIndex, x, z, heading, false);
    car.stolen = true;
    G.player.enterCar(car);
    car.speed = speed || 0;
    return car;
  }

  function stage(n) {
    const P = G.world.places;
    if (n === 1) {
      // 1-chase.jpg (cover): a 4-star escape at sunset — the player's
      // car speeding with two police cruisers on its tail, the city and
      // harbour behind.
      G.setHour(18.4);
      const car = placePlayerInCar(2, 0, 90, 0, 30); // Falcon, north on Solmar Blvd
      G.police.setWanted(4);
      // All four cruisers close on its tail, staggered across the road.
      const cruiserSpots = [[2, 74], [-3, 66], [5, 58], [-5, 50]];
      G.police.cruisers.forEach((c, i) => {
        const [x, z] = cruiserSpots[i] || [0, 40];
        c.x = x; c.z = z; c.heading = 0; c.speed = 30;
        c.mesh.position.set(x, 0, z);
      });
      G.hud.setObjective('Escape the police', 'Lose the 4-star chase — reach the hideout');
      G.hud.banner('4-STAR ESCAPE', 'Lose the cops — reach the hideout');
      // Camera ahead of the car looking back at it: the Falcon comes
      // toward the camera with the cruisers on its tail.
      G.render.setShotCam(Math.PI, 15, 0.3);
    } else if (n === 2) {
      // 2-walk.jpg: the player on foot in the market plaza, the mission
      // marker pointing at Marlowe Motors, traffic and pedestrians
      // around, the lighthouse in the distance.
      G.setHour(17.5);
      // On foot on the market road, facing Marlowe Motors; fists out,
      // so no crosshair covers the player.
      G.player.x = -120; G.player.z = 2; G.player.y = 0;
      G.player.weapon = 0;
      G.player.heading = Math.atan2(P.garage.x - -120, P.garage.z - 2);
      G.player.mesh.position.set(-120, 0, 2);
      G.player.mesh.rotation.y = G.player.heading;
      G.missions.start(1);
      // Camera behind and above the player, down the road toward the
      // garage marker; the lighthouse headland sits beyond it.
      G.render.setShotCam(G.player.heading, 9, 0.45);
    } else if (n === 3) {
      // 3-drive.jpg: a cross-city drive over the harbour bridge at speed
      // with traffic, the water and marina in frame.
      G.setHour(17.8);
      const car = placePlayerInCar(8, 148, 0, Math.PI / 2, 34); // gold Sunset, east toward the bridge
      // Traffic ahead on the bridge and the far side.
      const t1 = G.traffic.cars[0];
      if (t1) { t1.x = 215; t1.z = 2; t1.heading = Math.PI / 2; t1.vertical = false; t1.road = 0; t1.mesh.position.set(215, 0, 2); }
      const t2 = G.traffic.cars[1];
      if (t2) { t2.x = 228; t2.z = -2; t2.heading = Math.PI / 2; t2.vertical = false; t2.road = 0; t2.mesh.position.set(228, 0, -2); }
      G.hud.setObjective('Cross the harbour', 'Drive east over the bridge to the marina');
      G.render.setCamYaw(Math.PI / 2);
      G.render.setCamPitch(0.28);
    } else if (n === 4) {
      // 4-mission.jpg: the finale shootout on the docks at dusk — the
      // player shooting at the rival crew, the helicopter overhead.
      G.setHour(19.0);
      G.player.x = 180; G.player.z = 100; G.player.y = 0.3;
      G.player.heading = Math.atan2(190 - 180, 86 - 100);
      G.player.weapon = 2; // SMG
      G.player.mesh.position.set(180, 0.3, 100);
      G.player.mesh.rotation.y = G.player.heading;
      G.police.setWanted(5); // helicopter overhead
      // Put the helicopter ahead of the player at capture time so it
      // shows in the frame (it circles 0.5 rad/s; 90 steps = 0.75 rad).
      G.police.setHeliAngle(1.75);
      // The rival crew on the docks.
      const crew = [
        G.combat.spawnEnemy(190, 86, 60),
        G.combat.spawnEnemy(196, 92, 60),
        G.combat.spawnEnemy(184, 84, 60),
      ];
      G.hud.setObjective('The Docks', `Fight Marco Vane's crew — ${crew.length} enemies remaining`);
      G.hud.banner('THE DOCKS', 'Hold the pier — the boat leaves soon');
      // Camera behind the player, low and level, looking at the nearest
      // enemy so the crosshair sits on him; the helicopter shows above.
      G.render.setShotCam(G.player.heading, 8, 0.15);
      G.render.setShotLookAt(190, 1.5, 86);
    }
    // Settle the world for a few frames before the capture.
    G.shotSettled = true;
  }

  return { stage };
}
