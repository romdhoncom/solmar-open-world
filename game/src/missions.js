// Solmar 3D — the 12 story missions in 3 acts.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Each mission is a small state machine (start, objectives, success,
// fail) stored in this one module. Completing a mission pays money and
// unlocks the next; a new act shows an act title.

import * as THREE from 'three';
import { MISSIONS, ACT_NAMES } from './config.js';

export function createMissions(G) {
  let current = null; // {def, stage, timer, data, marker}
  let markerMesh = null;

  function marker(x, z, color) {
    clearMarker();
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    markerMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 12, 1, true), mat);
    markerMesh.position.set(x, 3.5, z);
    G.scene.add(markerMesh);
    G.hud.setMarker(x, z, color);
  }

  function clearMarker() {
    if (markerMesh) {
      G.scene.remove(markerMesh);
      markerMesh = null;
    }
    G.hud.setMarker(null, null);
  }

  function objective(text, hint) {
    G.hud.setObjective(current ? current.def.name : '', text, hint || '');
  }

  function playerPos() {
    const p = G.player;
    return p.inCar ? { x: p.inCar.x, z: p.inCar.z } : { x: p.x, z: p.z };
  }

  function at(x, z, r) {
    const pos = playerPos();
    return Math.hypot(pos.x - x, pos.z - z) < r;
  }

  function start(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    current = { def, stage: 0, timer: def.time, data: {}, started: G.time };
    if (def.act > 1 && (id === 5 || id === 9)) {
      G.hud.actTitle(ACT_NAMES[def.act]);
    }
    G.hud.banner(def.name, ACT_NAMES[def.act]);
    G.hud.setMission(def.name, def.act, 0);
    // Per-mission setup.
    if (id === 9) G.setHour(21.2); // Night Shift starts at night.
    if (id === 12) G.police.setWanted(5); // the finale opens on a 5-star chase
    setupStage();
  }

  function setupStage() {
    if (!current) return;
    const id = current.def.id;
    const s = current.stage;
    const P = G.world.places;
    if (id === 1) { marker(P.garage.x, P.garage.z, 0xffd24a); objective('Walk to Marlowe Motors and meet the contact'); }
    else if (id === 2) { marker(P.garage.x, P.garage.z, 0xffd24a); objective('Steal any car and bring it to the garage'); }
    else if (id === 3) {
      if (s === 0) { marker(P.garage.x, P.garage.z, 0xffd24a); objective('Pick up the package at Marlowe Motors'); }
      else { marker(P.safehouse.x, P.safehouse.z, 0x66ff66); objective('Deliver the package to the safehouse — before the clock runs out'); }
    }
    else if (id === 4) { marker(P.boardwalk.x, P.boardwalk.z, 0xff4444); objective('Fight off the Breakers on the boardwalk'); }
    else if (id === 5) {
      if (s === 0) { marker(P.plaza.x, P.plaza.z, 0xffd24a); objective('Pick Rosa up at the Market Plaza (bring a car)'); }
      else { marker(P.hospital.x, P.hospital.z, 0x66ff66); objective('Drive Rosa to St. Coral Hospital — fast, for the tip'); }
    }
    else if (id === 6) {
      if (!current.data.stops) {
        current.data.stops = [
          { x: P.bank.x, z: P.bank.z, done: false },
          { x: P.marina.x, z: P.marina.z, done: false },
          { x: P.hospital.x, z: P.hospital.z, done: false },
        ];
      }
      const stops = current.data.stops;
      const remaining = stops.filter((st) => !st.done);
      if (remaining.length === 0) return;
      const next = remaining[0];
      marker(next.x, next.z, 0x66ff66);
      objective(`Courier run — ${remaining.length} stop${remaining.length > 1 ? 's' : ''} left (any order)`);
    }
    else if (id === 7) {
      if (s === 0) { marker(176, 30, 0xffd24a); objective('Steal the gold Strider parked at the harbour'); }
      else { marker(P.hideout.x, P.hideout.z, 0x66ff66); objective('Bring the Strider to the hideout — do not wreck it'); }
    }
    else if (id === 8) {
      if (s === 0) { marker(P.bank.x, P.bank.z, 0xffd24a); objective('Go to Solmar Bank'); }
      else if (s === 1) { marker(P.bank.x, P.bank.z, 0xff4444); objective('Hold up the bank — stay at the marker'); }
      else { marker(P.hideout.x, P.hideout.z, 0x66ff66); objective('Escape the 4-star chase — reach the hideout'); }
    }
    else if (id === 9) {
      if (s === 0) { marker(P.docks.x, P.docks.z, 0xffd24a); objective('Pick up the shipment at the docks (night)'); }
      else { marker(P.hideout.x, P.hideout.z, 0x66ff66); objective('Deliver before dawn — stay out of the cops\' way'); }
    }
    else if (id === 10) {
      if (s === 0) { marker(P.marina.x, P.marina.z, 0xffd24a); objective('Meet Marco Vane\'s lieutenant at the marina'); }
      else { marker(P.marina.x, P.marina.z, 0xff4444); objective('Refuse his price — fight your way out'); }
    }
    else if (id === 11) {
      if (s === 0) { marker(P.docks.x, P.docks.z, 0xff4444); objective('Fight Marco Vane\'s crew on the docks'); }
      else { marker(-34, 230, 0x66ff66); objective('Hold the pier until the boat leaves'); }
    }
    else if (id === 12) { marker(P.hideout.x, P.hideout.z, 0x66ff66); objective('Escape the 5-star chase — reach the hideout'); }
  }

  function spawnCrew(spots, health) {
    const list = [];
    for (const [x, z] of spots) list.push(G.combat.spawnEnemy(x, z, health || 60));
    return list;
  }

  function complete() {
    const def = current.def;
    clearMarker();
    G.player.money += def.money;
    G.rank.add(def.rank);
    G.save.missionsDone.push(def.id);
    G.audio.mission();
    G.hud.banner('MISSION COMPLETE', `${def.name} — +$${def.money}`);
    G.hud.setMission('', 0, 0);
    G.hud.setObjective('', '');
    current = null;
    const next = MISSIONS.find((m) => m.id === def.id + 1);
    if (next) {
      start(next.id);
    } else {
      // The finale is done: King of Solmar.
      G.state = 'complete';
      G.hud.showComplete();
    }
  }

  function fail(reason) {
    const def = current.def;
    clearMarker();
    G.hud.banner('MISSION FAILED', reason);
    // Enemies from the failed mission go away.
    for (const e of [...G.combat.enemies]) G.combat.removeEnemy(e);
    current = null;
    setTimeout(() => start(def.id), 1200);
  }

  function update(dt) {
    if (!current) return;
    const id = current.def.id;
    const s = current.stage;
    const P = G.world.places;
    if (current.def.time > 0) {
      current.timer -= dt;
      G.hud.setTimer(Math.max(0, current.timer));
      if (current.timer <= 0) {
        fail('Out of time');
        return;
      }
    }
    // Stage logic per mission.
    if (id === 1) {
      if (at(P.garage.x, P.garage.z, 6)) complete();
    } else if (id === 2) {
      if (s === 0 && G.player.inCar) { current.stage = 1; setupStage(); }
      else if (s === 1 && G.player.inCar && at(P.garage.x, P.garage.z, 8)) complete();
    } else if (id === 3) {
      if (s === 0 && at(P.garage.x, P.garage.z, 5)) { current.stage = 1; setupStage(); }
      else if (s === 1 && at(P.safehouse.x, P.safehouse.z, 6)) complete();
    } else if (id === 4) {
      if (s === 0) {
        current.data.crew = spawnCrew([[30, 166], [44, 172], [56, 166], [36, 178]], 50);
        current.stage = 1;
      } else if (current.data.crew.every((e) => e.dead || !G.combat.enemies.includes(e))) {
        complete();
      }
    } else if (id === 5) {
      if (s === 0 && G.player.inCar && at(P.plaza.x, P.plaza.z, 6)) { current.stage = 1; setupStage(); }
      else if (s === 1 && G.player.inCar && at(P.hospital.x, P.hospital.z, 8)) {
        if (current.timer > 40) { G.player.money += 100; G.hud.banner('SPEED TIP', '+$100 for a fast ride'); }
        complete();
      }
    } else if (id === 6) {
      if (!current.data.stops) {
        current.data.stops = [
          { x: P.bank.x, z: P.bank.z, done: false },
          { x: P.marina.x, z: P.marina.z, done: false },
          { x: P.hospital.x, z: P.hospital.z, done: false },
        ];
        setupStage();
      }
      for (const st of current.data.stops) {
        if (!st.done && at(st.x, st.z, 7)) {
          st.done = true;
          G.audio.chime();
          setupStage();
        }
      }
      if (current.data.stops.every((st) => st.done)) complete();
    } else if (id === 7) {
      const strider = G.vehicles.list.find((c) => c.missionCar === 'strider');
      if (s === 0 && G.player.inCar === strider) { current.stage = 1; setupStage(); }
      else if (s === 1) {
        if (strider.wrecked) { fail('You wrecked the Strider'); return; }
        if (at(P.hideout.x, P.hideout.z, 8)) complete();
      }
    } else if (id === 8) {
      if (s === 0 && at(P.bank.x, P.bank.z, 6)) {
        current.stage = 1;
        current.data.holdT = 0;
        setupStage();
      } else if (s === 1) {
        if (at(P.bank.x, P.bank.z, 6)) {
          current.data.holdT += dt;
          G.hud.setObjective('The Solmar Score', `Hold up in progress — ${Math.ceil(5 - current.data.holdT)}s`);
          if (current.data.holdT >= 5) {
            G.player.money += 800;
            G.police.setWanted(4);
            current.stage = 2;
            setupStage();
          }
        } else {
          current.data.holdT = 0;
        }
      } else if (s === 2 && at(P.hideout.x, P.hideout.z, 8)) {
        complete();
      }
    } else if (id === 9) {
      if (s === 0 && at(P.docks.x, P.docks.z, 6)) { current.stage = 1; setupStage(); }
      else if (s === 1) {
        if (G.police.wanted >= 4) { fail('The police caught the shipment'); return; }
        if (at(P.hideout.x, P.hideout.z, 8)) complete();
      }
    } else if (id === 10) {
      if (s === 0 && at(P.marina.x, P.marina.z, 6)) {
        current.data.crew = spawnCrew([[168, 34], [178, 44], [166, 48], [180, 36]], 60);
        current.stage = 1;
        setupStage();
      } else if (s === 1 && current.data.crew.every((e) => e.dead || !G.combat.enemies.includes(e))) {
        complete();
      }
    } else if (id === 11) {
      if (s === 0) {
        current.data.crew = spawnCrew([[180, 84], [190, 92], [176, 96], [194, 86], [184, 96], [188, 82]], 60);
        current.stage = 1;
      } else if (s === 1 && current.data.crew.every((e) => e.dead || !G.combat.enemies.includes(e))) {
        current.stage = 2;
        current.data.holdT = 0;
        current.data.crew2 = spawnCrew([[-28, 220], [-40, 226], [-30, 236]], 50);
        setupStage();
      } else if (s === 2) {
        if (at(-34, 230, 10)) {
          current.data.holdT += dt;
          const left = Math.ceil(30 - current.data.holdT);
          G.hud.setObjective('The Docks', `Hold the pier — the boat leaves in ${left}s`);
          if (current.data.holdT >= 30) complete();
        } else {
          G.hud.setObjective('The Docks', 'Get back to the pier marker and hold it');
        }
      }
    } else if (id === 12) {
      if (at(P.hideout.x, P.hideout.z, 8)) complete();
    }
  }

  function startFirst() {
    const done = G.save.missionsDone || [];
    const nextId = MISSIONS.find((m) => !done.includes(m.id));
    if (nextId) start(nextId.id);
  }

  return {
    get current() { return current; },
    start, startFirst, update, complete, fail,
  };
}
