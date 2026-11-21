// The 12 story missions in 3 acts. Each is a small state machine.
import * as THREE from 'three';
import { CFG } from './config.js';
import { CAR_MODELS, createCar } from './vehicles.js';

function near(G, x, z, r) {
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const pz = p.car ? p.car.z : p.z;
  return Math.hypot(px - x, pz - z) < r;
}

export function createMissions(G) {
  // Mission beacon: a glowing pillar marking the objective.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 15;
  beacon.add(pillar);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  arrow.position.y = 6;
  arrow.rotation.x = Math.PI;
  beacon.add(arrow);
  beacon.visible = false;
  G.scene.add(beacon);

  function setMarker(x, z, label) {
    G.marker = { x, z, label };
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }
  function clearMarker() {
    G.marker = null;
    beacon.visible = false;
  }

  const DEFS = [
    {
      act: 1, name: 'New in Town',
      start(G, m) {
        const s = G.world.spots.garage;
        setMarker(s[0], s[1], 'Marlowe Motors');
        G.hud.setMission('New in Town', 'Walk to Marlowe Motors and meet the contact', '1 stage');
      },
      update(G, m) {
        const s = G.world.spots.garage;
        return near(G, s[0], s[1], 5) ? 'done' : null;
      },
    },
    {
      act: 1, name: 'Borrowed Wheels',
      start(G, m) {
        const s = G.world.spots.garage;
        setMarker(s[0], s[1], 'Marlowe Motors');
        G.hud.setMission('Borrowed Wheels', 'Steal any car and bring it to the garage', '1 stage');
      },
      update(G, m) {
        const s = G.world.spots.garage;
        if (G.player.car && near(G, s[0], s[1], 6)) return 'done';
        return null;
      },
    },
    {
      act: 1, name: 'The Drop',
      start(G, m) {
        m.data = { stage: 0, timer: 95 };
        const s = G.world.spots.market;
        setMarker(s[0], s[1], 'Pick up the package');
        G.hud.setMission('The Drop', 'Pick up the package, then deliver it', '2 stages');
      },
      update(G, m, dt) {
        m.data.timer -= dt;
        if (m.data.timer <= 0) return 'fail';
        G.hud.setTimer(Math.ceil(m.data.timer));
        if (m.data.stage === 0) {
          const s = G.world.spots.market;
          if (near(G, s[0], s[1], 5)) {
            m.data.stage = 1;
            const d = G.world.spots.hills;
            setMarker(d[0], d[1], 'Deliver the package');
            G.hud.setMission('The Drop', 'Deliver the package to the hills', 'Stage 2 of 2');
          }
        } else {
          const d = G.world.spots.hills;
          if (near(G, d[0], d[1], 5)) return 'done';
        }
        return null;
      },
    },
    {
      act: 1, name: 'Breakers on the Boardwalk',
      start(G, m) {
        const s = G.world.spots.boardwalk;
        setMarker(s[0], s[1], 'Boardwalk');
        for (let i = 0; i < 4; i++) G.combat.spawnEnemy(s[0] - 12 + i * 8, s[1] + 4, 60);
        G.hud.setMission('Breakers on the Boardwalk', 'Fight off the rival crew on the beach', '4 enemies');
      },
      update(G, m) {
        return G.enemies.length === 0 ? 'done' : null;
      },
    },
    {
      act: 2, name: 'Taxi for Rosa',
      start(G, m) {
        m.data = { stage: 0, timer: 80 };
        const s = G.world.spots.plaza;
        setMarker(s[0], s[1], 'Pick up Rosa');
        G.hud.setMission('Taxi for Rosa', 'Pick Rosa up and drive her across town', '2 stages');
      },
      update(G, m, dt) {
        m.data.timer -= dt;
        if (m.data.timer <= 0) return 'fail';
        G.hud.setTimer(Math.ceil(m.data.timer));
        if (m.data.stage === 0) {
          const s = G.world.spots.plaza;
          if (near(G, s[0], s[1], 5)) {
            m.data.stage = 1;
            const d = G.world.spots.hospital;
            setMarker(d[0], d[1], 'Drop Rosa off');
            G.hud.setMission('Taxi for Rosa', 'Drive Rosa to the hospital', 'Stage 2 of 2');
          }
        } else {
          const d = G.world.spots.hospital;
          if (near(G, d[0], d[1], 5)) {
            G.money += Math.floor(m.data.timer / 2);
            return 'done';
          }
        }
        return null;
      },
    },
    {
      act: 2, name: 'The Courier Run',
      start(G, m) {
        m.data = { timer: 150, stops: [false, false, false] };
        const pts = [G.world.spots.bank, G.world.spots.marina, G.world.spots.beach];
        m.data.points = pts;
        setMarker(pts[0][0], pts[0][1], 'Delivery 1 of 3');
        G.hud.setMission('The Courier Run', 'Three delivery stops, in any order', '0 of 3 stops');
      },
      update(G, m, dt) {
        m.data.timer -= dt;
        if (m.data.timer <= 0) return 'fail';
        G.hud.setTimer(Math.ceil(m.data.timer));
        let n = 0;
        m.data.points.forEach((pt, i) => {
          if (!m.data.stops[i] && near(G, pt[0], pt[1], 6)) {
            m.data.stops[i] = true;
            G.audio.chime();
          }
          if (m.data.stops[i]) n++;
        });
        G.hud.setMission('The Courier Run', 'Three delivery stops, in any order', n + ' of 3 stops');
        const next = m.data.points.find((_, i) => !m.data.stops[i]);
        if (next) setMarker(next[0], next[1], 'Next delivery');
        return n === 3 ? 'done' : null;
      },
    },
    {
      act: 2, name: 'Harbour Lights',
      start(G, m) {
        const model = CAR_MODELS.find((x) => x.name === 'Strider');
        const s = G.world.spots.marina;
        const car = createCar(model, s[0] - 6, s[1] + 4, Math.PI / 2);
        G.scene.add(car.mesh);
        G.cars.push(car);
        m.data = { car };
        setMarker(s[0], s[1], 'The gold Strider');
        G.hud.setMission('Harbour Lights', 'Steal the gold Strider and bring it to the hideout', '1 stage');
      },
      update(G, m) {
        const car = m.data.car;
        if (car.damage >= 90) return 'fail';
        const h = G.world.spots.hideout;
        if (G.player.car === car && near(G, h[0], h[1], 7)) return 'done';
        return null;
      },
    },
    {
      act: 2, name: 'The Solmar Score',
      start(G, m) {
        m.data = { stage: 0, hold: 0 };
        const s = G.world.spots.bank;
        setMarker(s[0], s[1], 'The bank');
        G.hud.setMission('The Solmar Score', 'Hold up the bank, then escape the chase', '2 stages');
      },
      update(G, m, dt) {
        if (m.data.stage === 0) {
          const s = G.world.spots.bank;
          if (near(G, s[0], s[1], 5)) {
            m.data.hold += dt;
            G.hud.setMission('The Solmar Score', 'Hold up the bank — stay in the marker', Math.ceil(5 - m.data.hold) + 's');
            if (m.data.hold >= 5) {
              m.data.stage = 1;
              G.police.addWanted(4, 'bank robbery');
              const h = G.world.spots.hideout;
              setMarker(h[0], h[1], 'Escape to the hideout');
              G.hud.setMission('The Solmar Score', 'Escape the 4-star chase to the hideout', 'Stage 2 of 2');
            }
          } else {
            m.data.hold = 0;
          }
        } else {
          const h = G.world.spots.hideout;
          if (near(G, h[0], h[1], 7)) {
            G.police.wanted = 0;
            return 'done';
          }
        }
        return null;
      },
    },
    {
      act: 3, name: 'Night Shift',
      start(G, m) {
        G.time = 23.0;
        m.data = { timer: 180, stage: 0 };
        const s = G.world.spots.docks;
        setMarker(s[0], s[1], 'Pick up the shipment');
        G.hud.setMission('Night Shift', 'Drive the shipment across the city before dawn', '2 stages');
      },
      update(G, m, dt) {
        m.data.timer -= dt;
        if (m.data.timer <= 0) return 'fail';
        G.hud.setTimer(Math.ceil(m.data.timer));
        if (m.data.stage === 0) {
          const s = G.world.spots.docks;
          if (near(G, s[0], s[1], 6)) {
            m.data.stage = 1;
            const d = G.world.spots.garage;
            setMarker(d[0], d[1], 'Deliver the shipment');
            G.hud.setMission('Night Shift', 'Deliver the shipment to the garage', 'Stage 2 of 2');
          }
        } else {
          const d = G.world.spots.garage;
          if (near(G, d[0], d[1], 6)) return 'done';
        }
        return null;
      },
    },
    {
      act: 3, name: "The Rival's Offer",
      start(G, m) {
        m.data = { stage: 0 };
        const s = G.world.spots.marina;
        setMarker(s[0], s[1], 'Meet the lieutenant');
        G.hud.setMission("The Rival's Offer", 'Meet Marco Vane’s lieutenant at the marina', '2 stages');
      },
      update(G, m) {
        if (m.data.stage === 0) {
          const s = G.world.spots.marina;
          if (near(G, s[0], s[1], 5)) {
            m.data.stage = 1;
            G.hud.showBanner('THE RIVAL’S OFFER', '“Pay up or bleed.” — You refuse. Fight!');
            for (let i = 0; i < 5; i++) G.combat.spawnEnemy(s[0] - 10 + i * 6, s[1] + 8, 70);
            G.hud.setMission("The Rival's Offer", 'Fight your way out of the marina', '5 enemies');
          }
        } else {
          return G.enemies.length === 0 ? 'done' : null;
        }
        return null;
      },
    },
    {
      act: 3, name: 'The Docks',
      start(G, m) {
        m.data = { stage: 0, hold: 0 };
        const s = G.world.spots.docks;
        setMarker(s[0], s[1], 'The docks');
        for (let i = 0; i < 6; i++) G.combat.spawnEnemy(s[0] - 12 + i * 6, s[1] + 6, 70);
        G.hud.setMission('The Docks', 'Fight Marco Vane’s crew on the docks', '6 enemies');
      },
      update(G, m, dt) {
        if (m.data.stage === 0) {
          if (G.enemies.length === 0) {
            m.data.stage = 1;
            const s = G.world.spots.pier;
            setMarker(s[0], s[1], 'Hold the pier');
            G.hud.setMission('The Docks', 'Hold the pier until the boat leaves', '30s');
          }
        } else {
          const s = G.world.spots.pier;
          if (near(G, s[0], s[1], 6)) {
            m.data.hold += dt;
            G.hud.setMission('The Docks', 'Hold the pier until the boat leaves', Math.ceil(30 - m.data.hold) + 's');
            if (m.data.hold >= 30) return 'done';
          }
        }
        return null;
      },
    },
    {
      act: 3, name: 'King of Solmar',
      start(G, m) {
        G.police.addWanted(5, 'finale');
        const h = G.world.spots.hideout;
        setMarker(h[0], h[1], 'Reach the hideout');
        G.hud.setMission('King of Solmar', 'Escape the 5-star chase and reach the hideout', 'Finale');
      },
      update(G, m) {
        const h = G.world.spots.hideout;
        if (near(G, h[0], h[1], 7)) {
          G.police.wanted = 0;
          return 'done';
        }
        return null;
      },
    },
  ];

  const sys = {
    list: DEFS,
    idx: 0,
    cur: null,
    actShown: 0,
    start(i) {
      this.idx = i;
      const def = DEFS[i];
      this.cur = { def, data: {} };
      if (def.act !== this.actShown) {
        this.actShown = def.act;
        const titles = { 1: 'ACT I — NEW IN TOWN', 2: 'ACT II — RISING', 3: 'ACT III — KING OF SOLMAR' };
        G.hud.showAct(titles[def.act]);
      }
      G.hud.showBanner(def.name.toUpperCase(), 'Act ' + def.act + ' · Mission ' + (i + 1) + ' of 12');
      G.hud.setTimer(null);
      def.start(G, this.cur);
    },
    update(dt) {
      if (!this.cur || G.state !== 'playing') return;
      const r = this.cur.def.update(G, this.cur, dt);
      if (r === 'done') {
        const i = this.idx;
        const pay = CFG.missionPay[i];
        const rp = CFG.missionRP[i];
        G.money += pay;
        G.rank.addRP(rp);
        G.audio.fanfare();
        clearMarker();
        G.hud.setTimer(null);
        if (i + 1 >= DEFS.length) {
          this.cur = null;
          G.state = 'done';
          G.hud.showCompletion();
          G.saveGame();
          return;
        }
        G.hud.showBanner('MISSION COMPLETE', '+' + pay + ' · +' + rp + ' RP');
        this.start(i + 1);
      } else if (r === 'fail') {
        G.hud.showBanner('MISSION FAILED', 'Try again');
        this.start(this.idx);
      }
    },
    setMarker, clearMarker,
  };
  return sys;
}
