// The HUD: mission box, clock/money/wanted, rank and weapon slots,
// location + minimap + health/armour, banners, start screen, pause menu
// with MAP / MISSIONS / CONTROLS / SAVE tabs, full city map, mission list.

import { WEAPONS, RANKS } from './config.js';
import { MISSIONS } from './missions.js';
import { districtAt, streetAt } from './world.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.buildDom();
    this.mapOpen = false;
    this.missionsOpen = false;
    this.paused = false;
    this.bannerTimer = 0;
  }

  buildDom() {
    this.root.innerHTML = `
    <div id="mission-box" class="panel"><div id="mission-name"></div><div id="mission-obj"></div><div id="mission-timer"></div></div>
    <div id="stats" class="panel"><div id="clock">18:00</div><div id="money">$150</div><div id="stars"></div></div>
    <div id="rank-box" class="panel"><div id="rank-title">Street Rat (Lv 1)</div><div class="bar"><div id="rank-fill"></div></div><div id="weapons"></div></div>
    <div id="loc-box" class="panel"><div id="location">Downtown</div><canvas id="minimap" width="180" height="180"></canvas><div class="bar hp"><div id="hp-fill"></div></div><div class="bar ar"><div id="ar-fill"></div></div></div>
    <div id="banner"></div><div id="act-title"></div>
    <div id="toast"></div>
    <div id="start-screen"><h1>SOLMAR</h1><p class="tag">A 3D open-world crime game — become the King of Solmar.</p>
      <p class="controls">WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; Space jump<br>
      F punch &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; 1–4 weapons &nbsp;·&nbsp; R reload<br>
      H horn &nbsp;·&nbsp; C camera &nbsp;·&nbsp; M map &nbsp;·&nbsp; L missions &nbsp;·&nbsp; Esc pause</p>
      <button id="start-btn">START</button>
      <p class="save-note">Progress is saved automatically on this device.</p></div>
    <div id="pause-menu" class="hidden"><h2>PAUSED</h2>
      <div class="tabs"><button data-tab="map">MAP</button><button data-tab="missions">MISSIONS</button><button data-tab="controls">CONTROLS</button><button data-tab="save">SAVE</button></div>
      <div id="tab-map" class="tab"><canvas id="bigmap" width="520" height="520"></canvas></div>
      <div id="tab-missions" class="tab hidden"><ol id="mission-list"></ol></div>
      <div id="tab-controls" class="tab hidden"><p>WASD move · Mouse look · Shift sprint · Space jump<br>F punch · E enter/exit car · Click shoot · R reload<br>1–4 weapon slots · H horn · Space handbrake (in car)<br>C camera · M map · L mission list · Esc pause</p></div>
      <div id="tab-save" class="tab hidden"><p id="save-info"></p><button id="save-btn">SAVE NOW</button> <button id="reset-btn">NEW GAME</button></div>
      <button id="resume-btn">RESUME</button></div>
    <div id="complete-screen" class="hidden"><h1>KING OF SOLMAR</h1><p>You own this city now.</p><button id="again-btn">KEEP PLAYING</button></div>
    <div id="dead-screen" class="hidden"><h1>BUSTED</h1><p>Dani is down. The city keeps moving.</p><button id="retry-btn">TRY AGAIN</button></div>`;
    this.el = {};
    for (const id of ['mission-name', 'mission-obj', 'mission-timer', 'clock', 'money', 'stars', 'rank-title', 'rank-fill', 'weapons', 'location', 'hp-fill', 'ar-fill', 'banner', 'act-title', 'toast', 'start-screen', 'pause-menu', 'complete-screen', 'dead-screen', 'mission-list', 'save-info']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = document.getElementById('minimap');
    this.bigmap = document.getElementById('bigmap');
    document.getElementById('start-btn').addEventListener('click', () => this.game.startGame());
    document.getElementById('resume-btn').addEventListener('click', () => this.game.togglePause(false));
    document.getElementById('again-btn').addEventListener('click', () => this.el['complete-screen'].classList.add('hidden'));
    document.getElementById('retry-btn').addEventListener('click', () => this.game.respawn());
    document.getElementById('save-btn').addEventListener('click', () => { this.game.saveNow(); this.toast('Saved.'); });
    document.getElementById('reset-btn').addEventListener('click', () => { this.game.newGame(); });
    this.root.querySelectorAll('.tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        this.root.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
        document.getElementById(`tab-${b.dataset.tab}`).classList.remove('hidden');
        if (b.dataset.tab === 'missions') this.renderMissionList();
        if (b.dataset.tab === 'save') this.el['save-info'].textContent = this.game.saveSummary();
      });
    });
  }

  renderMissionList() {
    this.el['mission-list'].innerHTML = MISSIONS.map((m, i) => {
      const state = i < this.game.missions.index ? 'done' : i === this.game.missions.index ? 'current' : 'locked';
      return `<li class="${state}">Act ${m.act} — ${m.name} ${state === 'done' ? '✓' : ''}</li>`;
    }).join('');
  }

  banner(text, sub = '') {
    this.el.banner.innerHTML = `<strong>${text}</strong>${sub ? `<span>${sub}</span>` : ''}`;
    this.el.banner.classList.add('show');
    this.bannerTimer = 3;
  }

  actTitle(text) {
    this.el['act-title'].textContent = text;
    this.el['act-title'].classList.add('show');
    setTimeout(() => this.el['act-title'].classList.remove('show'), 4000);
  }

  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    setTimeout(() => this.el.toast.classList.remove('show'), 2500);
  }

  update(dt, g) {
    const p = g.player;
    const m = g.missions;
    this.el['mission-name'].textContent = m.done ? 'King of Solmar' : `${m.mission.name} — Act ${m.mission.act}`;
    this.el['mission-obj'].textContent = m.objective;
    this.el['mission-timer'].textContent = m.timerLeft > 0 ? `⏱ ${Math.ceil(m.timerLeft)}s` : '';
    const h = Math.floor(g.hour), min = Math.floor((g.hour - h) * 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    this.el.money.textContent = `$${p.money}`;
    this.el.stars.innerHTML = '★'.repeat(g.police.wanted) + '<span class="dim">' + '★'.repeat(5 - g.police.wanted) + '</span>';
    const r = g.rank;
    this.el['rank-title'].textContent = `${r.title} (Lv ${r.level + 1})${r.nextTitle ? ` — ${Math.round(r.progress * 100)}% to ${r.nextTitle}` : ''}`;
    this.el['rank-fill'].style.width = `${r.progress * 100}%`;
    this.el.weapons.innerHTML = WEAPONS.map((w, i) => {
      const ammo = w.ammo === Infinity ? '∞' : g.ammo[i + 1];
      return `<div class="${g.weaponSlot === i + 1 ? 'sel' : ''}">${w.slot} ${w.name} (${ammo})</div>`;
    }).join('');
    const d = districtAt(p.x, p.z);
    this.el.location.textContent = `${d.name} — ${streetAt(p.x, p.z)}`;
    this.el['hp-fill'].style.width = `${p.health}%`;
    this.el['ar-fill'].style.width = `${p.armour}%`;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
    this.drawMinimap(g);
    if (this.mapOpen) this.drawBigMap(g);
  }

  drawMinimap(g) {
    const c = this.minimap.getContext('2d');
    const S = 180, H = 480;
    c.fillStyle = '#0c1a12';
    c.fillRect(0, 0, S, S);
    c.strokeStyle = '#4a5a4a';
    c.lineWidth = 2;
    for (const r of [-180, -120, -60, 0, 60, 120, 180]) {
      const v = ((r + H / 2) / H) * S;
      c.beginPath(); c.moveTo(v, 0); c.lineTo(v, S); c.stroke();
      c.beginPath(); c.moveTo(0, v); c.lineTo(S, v); c.stroke();
    }
    const px = ((g.player.x + H / 2) / H) * S;
    const pz = ((g.player.z + H / 2) / H) * S;
    const mark = (x, z, color, r = 4) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(((x + H / 2) / H) * S, ((z + H / 2) / H) * S, r, 0, Math.PI * 2);
      c.fill();
    };
    const step = g.missions.currentStep;
    if (step && (step.x !== undefined)) mark(step.x, step.z, '#f2c200', 5);
    if (step && step.px !== undefined) mark(step.pickedUp ? step.dx : step.px, step.pickedUp ? step.dz : step.pz, '#2ec22e', 5);
    mark(0, 120, '#7ec8ff', 3); // safehouse
    for (const cr of g.police.cruisers) mark(cr.x, cr.z, '#ff4444', 3);
    if (g.police.heli) mark(g.police.heli.x, g.police.heli.z, '#ff8844', 3);
    // Player arrow.
    c.save();
    c.translate(px, pz);
    c.rotate(-g.camYaw);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }

  drawBigMap(g) {
    const c = this.bigmap.getContext('2d');
    const S = 520, H = 480;
    c.fillStyle = '#101a14';
    c.fillRect(0, 0, S, S);
    // Districts.
    const cols = { downtown: '#3a2a1a', beach: '#5a4a2a', market: '#4a2a1a', hills: '#2a3a4a', harbour: '#1a3a4a' };
    for (const [key, d] of Object.entries({ downtown: { x0: -90, z0: -90, x1: 90, z1: 90 }, beach: { x0: -240, z0: 90, x1: 240, z1: 240 }, market: { x0: -240, z0: -90, x1: -90, z1: 90 }, hills: { x0: -90, z0: -240, x1: 240, z1: -90 }, harbour: { x0: 90, z0: -90, x1: 240, z1: 90 } })) {
      c.fillStyle = cols[key];
      c.fillRect(((d.x0 + H / 2) / H) * S, ((d.z0 + H / 2) / H) * S, ((d.x1 - d.x0) / H) * S, ((d.z1 - d.z0) / H) * S);
    }
    c.strokeStyle = '#6a7a6a';
    c.lineWidth = 3;
    for (const r of [-180, -120, -60, 0, 60, 120, 180]) {
      const v = ((r + H / 2) / H) * S;
      c.beginPath(); c.moveTo(v, 0); c.lineTo(v, S); c.stroke();
      c.beginPath(); c.moveTo(0, v); c.lineTo(S, v); c.stroke();
    }
    const mark = (x, z, label, color) => {
      const mx = ((x + H / 2) / H) * S, mz = ((z + H / 2) / H) * S;
      c.fillStyle = color;
      c.beginPath(); c.arc(mx, mz, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.font = '13px sans-serif';
      c.fillText(label, mx + 9, mz + 4);
    };
    mark(-60, 60, 'Garage', '#f2c200');
    mark(60, -60, 'Hospital', '#ff8888');
    mark(0, 120, 'Safehouse', '#7ec8ff');
    mark(0, 0, 'Bank', '#ffd24a');
    mark(180, 90, 'Marina', '#7ec8ff');
    mark(120, -60, 'Police', '#ff4444');
    mark(-120, 120, 'Hideout', '#b07eff');
    const step = g.missions.currentStep;
    if (step && step.x !== undefined) mark(step.x, step.z, 'Next mission', '#ffffff');
    mark(g.player.x, g.player.z, 'You', '#ffffff');
  }

  showStart() { this.el['start-screen'].classList.remove('hidden'); }
  hideStart() { this.el['start-screen'].classList.add('hidden'); }
  showPause() { this.el['pause-menu'].classList.remove('hidden'); }
  hidePause() { this.el['pause-menu'].classList.add('hidden'); this.mapOpen = false; }
  showComplete() { this.el['complete-screen'].classList.remove('hidden'); }
  showDead() { this.el['dead-screen'].classList.remove('hidden'); }
  hideDead() { this.el['dead-screen'].classList.add('hidden'); }
}
