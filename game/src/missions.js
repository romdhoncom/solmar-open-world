// The 12 story missions in 3 acts. Each mission is a small state machine
// of steps — go somewhere, drive somewhere, kill a crew, run a taxi,
// escape a chase — with a marker on the map and a timer where it fits.

import * as THREE from 'three';
import { MISSION_REWARD } from './config.js';

export const MISSIONS = [
  { act: 1, name: 'New in Town', steps: [
    { kind: 'goto', x: -60, z: 60, r: 5, text: 'Walk to Marlowe Motors and meet the contact' } ] },
  { act: 1, name: 'Borrowed Wheels', steps: [
    { kind: 'drive', x: -60, z: 60, r: 6, text: 'Steal any car and bring it to the garage' } ] },
  { act: 1, name: 'The Drop', steps: [
    { kind: 'goto', x: -120, z: 0, r: 4, text: 'Pick up the package at the market' },
    { kind: 'goto', x: 60, z: 120, r: 5, seconds: 75, text: 'Deliver the package before the timer ends' } ] },
  { act: 1, name: 'Breakers on the Boardwalk', steps: [
    { kind: 'kill', n: 4, spawn: [[-40, 198], [-10, 204], [20, 198], [50, 204]], text: 'Fight off the rival crew on the boardwalk' } ] },
  { act: 2, name: 'Taxi for Rosa', steps: [
    { kind: 'taxi', px: 60, pz: 60, dx: -120, dz: -120, seconds: 90, text: 'Pick Rosa up, then drive her across town' } ] },
  { act: 2, name: 'The Courier Run', steps: [
    { kind: 'stops', spots: [[120, 60], [-60, -120], [0, 180]], seconds: 120, text: 'Three delivery stops, any order, against the clock' } ] },
  { act: 2, name: 'Harbour Lights', steps: [
    { kind: 'enter', model: 'Strider', x: 150, z: 30, text: 'Steal the gold Strider at the harbour' },
    { kind: 'drive', x: -120, z: 120, r: 6, text: 'Bring it to the hideout without wrecking it' } ] },
  { act: 2, name: 'The Solmar Score', steps: [
    { kind: 'goto', x: 0, z: 0, r: 5, text: 'Hold up the bank' },
    { kind: 'escape', x: -120, z: 120, wanted: 4, text: 'Escape the 4-star chase — reach the hideout' } ] },
  { act: 3, name: 'Night Shift', steps: [
    { kind: 'goto', x: -180, z: -120, r: 5, text: 'Pick up the shipment at the north depot' },
    { kind: 'drive', x: 180, z: 120, r: 6, seconds: 120, text: 'Deliver across the city before dawn — avoid the police' } ] },
  { act: 3, name: "The Rival's Offer", steps: [
    { kind: 'goto', x: 180, z: 90, r: 6, text: 'Meet Marco Vane\u2019s lieutenant at the marina' },
    { kind: 'kill', n: 5, spawn: [[170, 80], [190, 100], [175, 110], [185, 75], [165, 95]], text: 'Refuse his price — fight your way out' } ] },
  { act: 3, name: 'The Docks', steps: [
    { kind: 'kill', n: 6, spawn: [[110, 200], [130, 205], [100, 215], [140, 210], [120, 195], [135, 220]], text: 'Fight Marco Vane\u2019s crew on the docks' },
    { kind: 'hold', seconds: 20, text: 'Hold the pier until the boat leaves' } ] },
  { act: 3, name: 'King of Solmar', steps: [
    { kind: 'escape', x: -120, z: 120, wanted: 5, text: 'Escape the 5-star chase — reach the hideout' } ] },
];

const ACT_TITLES = { 1: 'Act I — New in Town', 2: 'Act II — Rising', 3: 'Act III — King of Solmar' };

export class MissionRunner {
  constructor(scene, save) {
    this.scene = scene;
    this.index = save.missionsDone || 0;
    this.step = 0;
    this.timer = 0;
    this.kills = 0;
    this.stopsLeft = [];
    this.marker = null;
    this.active = false;
    this.done = this.index >= MISSIONS.length;
    this.onStart = null; // (mission) => void
    this.onComplete = null; // (mission, reward) => void
    this.onFail = null; // (reason) => void
  }

  get mission() { return MISSIONS[this.index] || null; }
  get actTitle() { return this.mission ? ACT_TITLES[this.mission.act] : ''; }

  setMarker(x, z, color = 0xf2c200) {
    this.clearMarker();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 8, 14, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    m.position.set(x, 4, z);
    this.scene.add(m);
    this.marker = m;
    return m;
  }

  clearMarker() {
    if (this.marker) { this.scene.remove(this.marker); this.marker = null; }
  }

  start(ctx) {
    if (this.done) return;
    this.active = true;
    this.step = 0;
    this.beginStep(ctx);
    if (this.onStart) this.onStart(this.mission);
  }

  beginStep(ctx) {
    const s = this.mission.steps[this.step];
    this.timer = s.seconds || 0;
    this.kills = 0;
    this.stopsLeft = s.spots ? [...s.spots] : [];
    if (s.kind === 'goto' || s.kind === 'drive') this.setMarker(s.x, s.z);
    else if (s.kind === 'escape') { this.setMarker(s.x, s.z); ctx.police.setWanted(s.wanted); }
    else if (s.kind === 'enter') this.setMarker(s.x, s.z, 0xf2c200);
    else if (s.kind === 'taxi') this.setMarker(s.px, s.pz, 0x2ec22e);
    else if (s.kind === 'stops' && this.stopsLeft.length) this.setMarker(this.stopsLeft[0][0], this.stopsLeft[0][1], 0x2ec22e);
    else if (s.kind === 'kill') {
      this.clearMarker();
      for (const [x, z] of s.spawn) ctx.combat.spawnEnemy(x, z, 60);
    } else if (s.kind === 'hold') this.clearMarker();
  }

  advance(ctx) {
    this.step++;
    if (this.step >= this.mission.steps.length) this.complete(ctx);
    else this.beginStep(ctx);
  }

  complete(ctx) {
    const reward = MISSION_REWARD[this.index] || 100;
    this.active = false;
    this.clearMarker();
    this.index++;
    this.done = this.index >= MISSIONS.length;
    if (this.onComplete) this.onComplete(this.mission, reward);
    if (!this.done) this.start(ctx);
  }

  fail(reason, ctx) {
    this.active = false;
    this.clearMarker();
    if (this.onFail) this.onFail(reason);
    this.active = true;
    this.step = 0;
    this.beginStep(ctx);
  }

  update(dt, ctx) {
    if (!this.active || this.done) return;
    const s = this.mission.steps[this.step];
    if (this.marker) this.marker.rotation.y += dt;
    if (s.seconds) {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (s.kind === 'hold') { this.advance(ctx); return; }
        this.fail('Out of time', ctx); return;
      }
    }
    const near = (x, z, r) => Math.hypot(ctx.player.x - x, ctx.player.z - z) < r;
    switch (s.kind) {
      case 'goto':
        if (near(s.x, s.z, s.r)) this.advance(ctx);
        break;
      case 'drive':
        if (ctx.inCar && near(s.x, s.z, s.r)) {
          if (this.mission.name === 'Harbour Lights' && ctx.car && ctx.car.wrecked) { this.fail('The Strider is wrecked', ctx); return; }
          this.advance(ctx);
        }
        break;
      case 'enter':
        if (ctx.inCar && ctx.car && ctx.car.model.name === s.model) this.advance(ctx);
        break;
      case 'kill':
        if (this.kills >= s.n) this.advance(ctx);
        break;
      case 'taxi': {
        if (!s.pickedUp) {
          if (near(s.px, s.pz, 4)) { s.pickedUp = true; this.setMarker(s.dx, s.dz, 0x2ec22e); }
        } else if (ctx.inCar && near(s.dx, s.dz, 5)) this.advance(ctx);
        break;
      }
      case 'stops': {
        for (let i = this.stopsLeft.length - 1; i >= 0; i--) {
          const [x, z] = this.stopsLeft[i];
          if (near(x, z, 5)) {
            this.stopsLeft.splice(i, 1);
            if (this.stopsLeft.length === 0) { this.advance(ctx); return; }
            this.setMarker(this.stopsLeft[0][0], this.stopsLeft[0][1], 0x2ec22e);
            break;
          }
        }
        break;
      }
      case 'escape':
        if (ctx.police.wanted >= s.wanted) s.chaseOn = true;
        if (s.chaseOn && ctx.police.wanted === 0 && near(s.x, s.z, 6)) this.advance(ctx);
        break;
      case 'hold':
        if (this.timer <= 0) this.advance(ctx);
        break;
    }
  }

  // Called by the game when an enemy dies during a kill step.
  noteKill() { this.kills++; }

  get currentStep() {
    return this.active && !this.done ? this.mission.steps[this.step] : null;
  }

  get objective() {
    const s = this.currentStep;
    return s ? s.text : (this.done ? 'You are the King of Solmar.' : '');
  }

  get timerLeft() {
    const s = this.currentStep;
    return s && s.seconds ? Math.max(0, this.timer) : 0;
  }
}
