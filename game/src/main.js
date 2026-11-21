// Solmar 3D — boots the game, owns the frame loop, wires every system
// together: player and cars, police, missions, side jobs, rank, HUD.

import * as THREE from 'three';
import { WORLD, ROADS, CARS, WEAPONS, TIME } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { loadSave, storeSave, clearSave, defaultSave } from './save.js';
import { buildWorld, districtAt } from './world.js';
import { Player } from './player.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionRunner } from './missions.js';
import { SideJobs } from './sidejobs.js';
import { Rank } from './rank.js';
import { Hud } from './hud.js';
import { Render } from './render.js';
import { stageShot } from './shots.js';

export class Game {
  constructor() {
    this.save = loadSave();
    this.hour = TIME.startHour;
    this.time = 0;
    this.started = false;
    this.paused = false;
    this.shotMode = new URLSearchParams(location.search).get('shot');
    this.shotFreeze = false;
    this.camFar = false;
    this.weaponSlot = 2;
    this.ammo = { 2: 60, 3: 120, 4: 24 };
    this.car = null;
    this.parked = [];
    this.goldCar = null;
    this.sunsetCar = null;
    this.lastWantedAdd = 0;
    this.lastPedHit = 0;
    this.saveTimer = 0;
    this.lastAct = 0;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

    this.input = new Input();
    this.input.attach(canvas);
    this.input.onKey = (code) => this.onKey(code);
    this.audio = new AudioSys();
    this.world = buildWorld(this.scene);
    this.player = new Player(this.scene, 0, 120);
    this.player.money = this.save.money;
    this.player.armour = this.save.armour || 0;
    this.player.health = this.save.health || 100;
    this.traffic = new Traffic(this.scene, WORLD.seed);
    this.police = new Police(this.scene);
    this.combat = new Combat(this.scene);
    this.missions = new MissionRunner(this.scene, this.save);
    this.sidejobs = new SideJobs(this.scene, this.save);
    this.rank = new Rank(this.save);
    this.render = new Render(this.scene, this.camera);
    this.hud = new Hud(this);
    this.spawnParkedCars();
    this.spawnPickups();
    this.wireMissions();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.hud.showStart();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    if (this.shotMode) {
      this.startGame();
      stageShot(this, this.shotMode);
      let frames = 0;
      const settle = () => {
        frames++;
        // A few frames is enough: the first frame already renders the
        // staged scene and the HUD; the rest just lets the camera and
        // the minimap settle. (Headless SwiftShader runs ~1 frame
        // every few seconds, so a long settle would take minutes.)
        if (frames > 5) { this.shotFreeze = true; window.__shotReady = true; return; }
        requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
    }
  }

  spawnParkedCars() {
    const rng = makeRng(99);
    const models = CARS.filter((c) => c.name !== 'Strider' && c.name !== 'Sunset');
    const spots = [
      [-58, 2], [62, -2], [-2, 122], [122, 62], [-122, -58],
      [58, -122], [-122, 118], [2, -62], [178, 58], [-178, -2],
    ];
    for (const [x, z] of spots) {
      const model = rng.pick(models);
      const car = new Car(this.scene, model, x, z, rng.range(0, Math.PI * 2));
      this.parked.push(car);
    }
    // The gold Strider for mission 7, parked at the harbour.
    this.goldCar = new Car(this.scene, CARS.find((c) => c.name === 'Strider'), 150, 30, Math.PI / 2);
    this.parked.push(this.goldCar);
    // The gold Sunset, unlocked at Made rank, parked by the marina.
    this.sunsetCar = new Car(this.scene, CARS.find((c) => c.name === 'Sunset'), 180, 96, 0);
    this.parked.push(this.sunsetCar);
  }

  spawnPickups() {
    const rng = makeRng(7);
    for (let i = 0; i < 8; i++) {
      const kind = ['ammo', 'cash', 'armour'][i % 3];
      this.combat.spawnPickup(kind, rng.range(-170, 170), rng.range(-170, 170));
    }
  }

  wireMissions() {
    this.missions.onStart = (m) => {
      if (m.act !== this.lastAct) {
        this.lastAct = m.act;
        this.hud.actTitle(`Act ${m.act === 1 ? 'I' : m.act === 2 ? 'II' : 'III'} — ${m.name}`);
      }
      this.hud.banner(m.name, m.steps[0].text);
      if (m.name === 'Night Shift') this.hour = 21.5;
    };
    this.missions.onComplete = (m, reward) => {
      this.player.money += reward;
      const up = this.rank.add(100);
      this.audio.fanfare();
      this.hud.banner('MISSION COMPLETE', `${m.name} — +$${reward}`);
      if (up) { this.hud.toast(`Rank up: ${up}`); this.audio.fanfare(); }
      if (this.missions.done) this.hud.showComplete();
      this.saveNow();
    };
    this.missions.onFail = (reason) => {
      this.hud.toast(`${reason} — mission restarted`);
    };
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.audio.ensure();
    this.hud.hideStart();
    this.missions.start(this.ctx());
  }

  ctx() {
    return {
      player: this.player, police: this.police, combat: this.combat,
      inCar: !!this.car, car: this.car,
    };
  }

  onKey(code) {
    if (!this.started) return;
    if (code === 'Escape') { this.togglePause(); return; }
    if (this.paused) return;
    if (code === 'KeyM') { this.togglePause(true); this.hud.mapOpen = true; this.showTab('map'); }
    if (code === 'KeyL') { this.togglePause(true); this.showTab('missions'); this.hud.renderMissionList(); }
    if (code === 'Digit1') this.weaponSlot = 1;
    if (code === 'Digit2') this.weaponSlot = 2;
    if (code === 'Digit3') this.weaponSlot = 3;
    if (code === 'Digit4') this.weaponSlot = 4;
    if (code === 'KeyC') this.camFar = !this.camFar;
    if (code === 'KeyR') {
      const w = WEAPONS[this.weaponSlot - 1];
      if (w.ammo !== Infinity) { this.ammo[this.weaponSlot] = w.ammo; this.hud.toast(`${w.name} reloaded`); }
    }
  }

  showTab(name) {
    this.hud.root.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
    document.getElementById(`tab-${name}`).classList.remove('hidden');
  }

  togglePause(force) {
    const to = force !== undefined ? force : !this.paused;
    if (to === this.paused) return;
    this.paused = to;
    if (to) { this.hud.showPause(); document.exitPointerLock?.(); }
    else this.hud.hidePause();
  }

  nearestCar(maxD = 4.5) {
    let best = null, bd = maxD;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    if (car === this.sunsetCar && !this.rank.madeUnlocked) {
      this.hud.toast('The gold Sunset unlocks at Made rank');
      return false;
    }
    this.car = car;
    this.parked.splice(this.parked.indexOf(car), 1);
    this.player.mesh.visible = false;
    this.police.addWanted(1);
    this.hud.toast(`${car.model.name} — yours now`);
    return true;
  }

  exitCar() {
    if (!this.car) return;
    const c = this.car;
    this.parked.push(c);
    this.player.x = c.x + Math.sin(c.heading + Math.PI / 2) * 3;
    this.player.z = c.z + Math.cos(c.heading + Math.PI / 2) * 3;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
    this.car = null;
    this.audio.setEngine(0);
  }

  shoot() {
    if (this.weaponSlot === 1) return;
    const w = WEAPONS[this.weaponSlot - 1];
    if (this.ammo[this.weaponSlot] <= 0) { this.hud.toast('Out of ammo — press R'); return; }
    const dirX = Math.sin(this.render.camYaw);
    const dirZ = Math.cos(this.render.camYaw);
    const ok = this.combat.shoot(
      this.player.x + dirX, 1.5, this.player.z + dirZ,
      dirX, dirZ, w, this.time
    );
    if (ok) {
      this.ammo[this.weaponSlot]--;
      this.audio.gunshot();
      this.traffic.fleeFrom(this.player.x, this.player.z, this.time);
      if (this.time - this.lastWantedAdd > 5) {
        this.lastWantedAdd = this.time;
        this.police.addWanted(1);
      }
    }
  }

  respawn() {
    this.player.health = 100;
    this.player.armour = 0;
    this.player.dead = false;
    this.player.money = Math.max(0, this.player.money - 50);
    this.player.x = 60; this.player.z = -60;
    this.police.setWanted(0);
    this.hud.hideDead();
    this.paused = false;
  }

  newGame() {
    clearSave();
    location.reload();
  }

  saveNow() {
    this.save = {
      version: 2, money: this.player.money, missionsDone: this.missions.index,
      kills: this.kills || 0, fares: this.sidejobs.faresDone,
      packages: [...this.sidejobs.collected], jumps: [...this.sidejobs.jumpsDone],
      rankPoints: this.rank.points, armour: this.player.armour, health: this.player.health,
    };
    storeSave(this.save);
  }

  saveSummary() {
    return `Money $${this.player.money} · Missions ${this.missions.index}/12 · Rank ${this.rank.title} · Fares ${this.sidejobs.faresDone} · Packages ${this.sidejobs.collected.size}/12 · Jumps ${this.sidejobs.jumpsDone.size}/5`;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, 1 / 60);
    this.time += dt;
    if (!this.started) {
      // Start screen backdrop: slow orbit over the city at sunset.
      const a = this.time * 0.04;
      this.camera.position.set(Math.cos(a) * 260, 110, Math.sin(a) * 260);
      this.camera.lookAt(0, 0, 0);
      this.render.updateDayNight(this.world, this.hour, dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.paused && !this.shotFreeze) this.update(dt);
    this.render.update(dt, this, this.time);
    this.render.updateDayNight(this.world, this.hour, dt);
    this.hud.update(dt, this);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    // Clock advances slowly.
    this.hour += dt * (24 / 480);
    if (this.hour >= 24) this.hour -= 24;

    // Mouse look.
    this.render.camYaw -= this.input.mouseDX * 0.0032;
    this.render.camPitch = Math.max(0.08, Math.min(0.9, this.render.camPitch + this.input.mouseDY * 0.002));

    if (this.car) {
      const car = this.car;
      const res = car.drive(this.input.axis(), dt, this.world, this.audio);
      this.player.x = car.x; this.player.z = car.z;
      if (res.crashed) this.render.addShake(this.time);
      if (this.input.wasPressed('KeyH')) this.audio.horn();
      if (this.input.wasPressed('KeyE')) this.exitCar();
      // Hitting a pedestrian in a car is a crime.
      for (const p of this.traffic.peds) {
        if (Math.hypot(p.x - car.x, p.z - car.z) < 2.4 && Math.abs(car.speed) > 5) {
          if (this.time - this.lastPedHit > 3) {
            this.lastPedHit = this.time;
            this.police.addWanted(1);
            this.traffic.fleeFrom(car.x, car.z, this.time);
          }
        }
      }
      // Repair at Marlowe Motors.
      if (car.damage > 0 && Math.hypot(car.x + 60, car.z - 60) < 8) {
        const cost = Math.floor(car.damage * 0.5);
        if (this.player.money >= cost) {
          this.player.money -= car.repair(cost);
          this.hud.toast(`Repaired at Marlowe Motors — $${cost}`);
        }
      }
    } else {
      this.player.update(dt, this.input, this.render.camYaw, this.world, this.time);
      if (this.input.wasPressed('KeyE')) {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
      if (this.input.wasPressed('KeyF') && this.player.punch()) {
        this.audio.punch();
        for (let i = this.combat.enemies.length - 1; i >= 0; i--) {
          const e = this.combat.enemies[i];
          if (Math.hypot(e.x - this.player.x, e.z - this.player.z) < 2.4) {
            e.health -= 12;
            if (e.health <= 0) { this.combat.removeEnemy(e); this.onEnemyKilled(e); }
          }
        }
      }
      if (this.input.mouseClicked || (this.input.mouseDown && WEAPONS[this.weaponSlot - 1].auto)) this.shoot();
    }

    this.traffic.update(dt, this.player, null, this.time);
    this.police.update(dt, this.player, this.world, this.audio, this.time);
    // Roadblocks at four stars, across the road ahead of the player.
    const heading = this.car ? this.car.heading : this.player.heading;
    if (this.police.wanted >= 4) {
      this.police.setRoadblocks(true, this.player.x + Math.sin(heading) * 45, this.player.z + Math.cos(heading) * 45, heading);
    } else {
      this.police.setRoadblocks(false);
    }
    this.combat.update(dt, this.player, (e) => this.onEnemyKilled(e), (kind) => this.onPickup(kind), this.time);
    this.missions.update(dt, this.ctx());
    this.sidejobs.update(dt, this.player, !!this.car, this.car ? Math.abs(this.car.speed) : 0, (kind, v) => this.onSideJob(kind, v));

    if (this.player.dead) {
      this.hud.showDead();
      this.paused = true;
    }
    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.saveNow(); }
  }

  onEnemyKilled(e) {
    this.kills = (this.kills || 0) + 1;
    this.rank.add(5);
    this.missions.noteKill();
    if (Math.random() < 0.5) this.combat.spawnPickup('cash', e.x, e.z);
  }

  onPickup(kind) {
    if (kind === 'ammo') {
      this.ammo[this.weaponSlot] = (this.ammo[this.weaponSlot] || 0) + 30;
      this.hud.toast('+30 ammo');
    } else if (kind === 'cash') {
      this.player.money += 25;
      this.hud.toast('+$25');
    } else if (kind === 'armour') {
      this.player.addArmour(25);
      this.hud.toast('+25 armour');
    }
    this.audio.chime();
  }

  onSideJob(kind, v) {
    if (kind === 'package') {
      this.player.money += 50;
      this.rank.add(10);
      this.audio.chime();
      this.hud.toast(`Hidden package +$50 (${this.sidejobs.collected.size}/12)`);
      if (this.sidejobs.collected.size === 12) {
        this.player.money += 500;
        this.hud.banner('ALL PACKAGES', 'Bonus +$500');
      }
    } else if (kind === 'jump') {
      this.player.money += 100;
      this.rank.add(15);
      this.audio.chime();
      this.hud.banner('STUNT!', '+$100');
    } else if (kind === 'fare-pickup') {
      this.hud.toast('Passenger aboard — drive to the marker');
    } else if (kind === 'fare-done') {
      this.player.money += v;
      this.rank.add(20);
      this.audio.chime();
      this.hud.toast(`Fare paid +$${v}`);
    }
    this.saveNow();
  }
}

window.__game = new Game();
