// HUD: mission box, clock/money/stars, rank + weapons, minimap, menus.
import { CFG } from './config.js';

export function createHUD(G) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="mission-box" class="panel"><div id="mission-name"></div><div id="mission-obj"></div><div id="mission-stage"></div><div id="mission-timer"></div></div>
    <div id="top-right" class="panel"><div id="clock">17:24</div><div id="money">$150</div><div id="stars"></div></div>
    <div id="rank-box" class="panel"><div id="rank-title">Street Rat</div><div id="rank-bar"><div id="rank-fill"></div></div><div id="weapons"></div></div>
    <div id="bottom-left" class="panel"><div id="location">Downtown</div><div id="street"></div><canvas id="minimap" width="150" height="150"></canvas><div id="health-row"><div class="bar"><div id="health-fill"></div></div><div class="bar armour"><div id="armour-fill"></div></div></div><div id="rep-row"><span>REP</span><div class="bar rep"><div id="rep-fill"></div></div></div></div>
    <div id="banner"><div id="banner-title"></div><div id="banner-sub"></div></div>
    <div id="act-title"></div>
    <div id="crosshair">+</div>
    <div id="damage-flash"></div>
    <div id="start-screen"><div class="start-inner"><h1>SOLMAR</h1><p class="tag">A sun-soaked city. Twelve missions. One crown.</p><p class="controls">WASD move · Mouse look · Shift sprint · Space jump / handbrake<br>F punch · E enter car · Click shoot · 1–4 weapons · C camera · H horn<br>M map · L missions · N mute · Esc pause</p><button id="start-btn">START</button><p class="save-note">Progress is saved automatically on this device.</p></div></div>
    <div id="pause-menu" class="hidden"><div class="pause-inner"><h2>PAUSED</h2><div class="tabs"><button data-tab="map" class="tab active">MAP</button><button data-tab="missions" class="tab">MISSIONS</button><button data-tab="controls" class="tab">CONTROLS</button><button data-tab="save" class="tab">SAVE</button></div><div id="tab-map" class="tab-page"><canvas id="fullmap" width="520" height="520"></canvas></div><div id="tab-missions" class="tab-page hidden"><ol id="mission-list"></ol></div><div id="tab-controls" class="tab-page hidden"><p>WASD move · Mouse look · Shift sprint · Space jump / handbrake<br>F punch · E enter car · Click shoot · 1–4 weapons · C camera · H horn<br>M map · L missions · N mute · Esc pause</p></div><div id="tab-save" class="tab-page hidden"><p id="save-info"></p><button id="save-now">SAVE NOW</button> <button id="save-clear">CLEAR SAVE</button></div><button id="resume-btn">RESUME</button></div></div>
    <div id="complete-screen" class="hidden"><div class="start-inner"><h1>KING OF SOLMAR</h1><p class="tag">The city is yours, Dani.</p><p id="complete-stats"></p><button id="again-btn">PLAY AGAIN</button></div></div>
  `;
  const el = (id) => document.getElementById(id);
  const hud = {
    setMission(name, obj, stage) {
      el('mission-name').textContent = name || '';
      el('mission-obj').textContent = obj || '';
      el('mission-stage').textContent = stage || '';
      el('mission-box').style.display = name ? 'block' : 'none';
    },
    setTimer(t) {
      el('mission-timer').textContent = t == null ? '' : '⏱ ' + t + 's';
    },
    showBanner(title, sub) {
      el('banner-title').textContent = title;
      el('banner-sub').textContent = sub || '';
      const b = el('banner');
      b.classList.add('show');
      clearTimeout(this._bt);
      this._bt = setTimeout(() => b.classList.remove('show'), 3200);
      const sr = document.getElementById('sr-status');
      if (sr) sr.textContent = title + (sub ? '. ' + sub : '');
    },
    showAct(title) {
      const a = el('act-title');
      a.textContent = title;
      a.classList.add('show');
      setTimeout(() => a.classList.remove('show'), 3000);
    },
    flashDamage() {
      const f = el('damage-flash');
      f.classList.add('show');
      setTimeout(() => f.classList.remove('show'), 250);
    },
    showCompletion() {
      el('complete-stats').textContent =
        'Missions: 12 / 12 · Kills: ' + G.kills + ' · Fares: ' + G.fares +
        ' · Packages: ' + G.sidejobs.packagesDone.size + ' / 12 · Money: $' + G.money;
      el('complete-screen').classList.remove('hidden');
    },
    update() {
      const p = G.player;
      el('clock').textContent = fmtTime(G.time);
      el('money').textContent = '$' + G.money;
      const w = Math.floor(G.police.wanted);
      el('stars').textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
      el('stars').style.color = w >= 4 ? '#ff5555' : '#ffd94a';
      el('rank-title').textContent = G.rank.title() + ' · RP ' + G.rank.rp +
        (G.rank.nextTitle() ? ' → ' + G.rank.nextTitle() : '');
      el('rank-fill').style.width = Math.round(G.rank.progress() * 100) + '%';
      el('weapons').innerHTML = p.weapons.map((wpn, i) =>
        '<span class="' + (i === p.weapon ? 'sel' : '') + '">' + (i + 1) + ' ' + wpn.name +
        (i === 0 ? '' : ' ' + (wpn.ammo === Infinity ? '∞' : wpn.ammo)) + '</span>').join(' ');
      el('location').textContent = G.world.districtAt(p.car ? p.car.x : p.x, p.car ? p.car.z : p.z);
      el('street').textContent = G.world.streetName(p.car ? p.car.x : p.x, p.car ? p.car.z : p.z);
      el('health-fill').style.width = Math.max(0, p.health) + '%';
      el('armour-fill').style.width = Math.max(0, p.armour) + '%';
      el('rep-fill').style.width = Math.round(G.rank.progress() * 100) + '%';
      el('crosshair').style.display = (G.state === 'playing' && p.weapon > 0 && !p.car) ? 'block' : 'none';
      this.drawMinimap();
      if (!el('pause-menu').classList.contains('hidden')) this.drawFullmap();
    },
    drawMinimap() {
      const c = el('minimap');
      const ctx = c.getContext('2d');
      const S = 150, W = 440;
      const to = (v) => ((v + W / 2) / W) * S;
      ctx.fillStyle = '#1c2b33';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#3f7d8c';
      ctx.fillRect(to(150), 0, S - to(150), S); // harbour water
      ctx.fillStyle = '#e6d3a3';
      ctx.fillRect(0, to(168), S, S - to(168)); // beach
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      for (const r of CFG.roads) {
        ctx.beginPath(); ctx.moveTo(to(r), 0); ctx.lineTo(to(r), S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, to(r)); ctx.lineTo(S, to(r)); ctx.stroke();
      }
      const p = G.player;
      const px = p.car ? p.car.x : p.x;
      const pz = p.car ? p.car.z : p.z;
      if (G.marker) {
        ctx.fillStyle = '#ffe066';
        const mx = to(G.marker.x), my = to(G.marker.z);
        ctx.beginPath(); ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 5, my + 4); ctx.lineTo(mx - 5, my + 4); ctx.fill();
      }
      for (const e of G.enemies) {
        ctx.fillStyle = '#c05ad9';
        ctx.fillRect(to(e.x) - 2, to(e.z) - 2, 4, 4);
      }
      for (const cr of G.police.cruisers) {
        ctx.fillStyle = '#4a90d9';
        ctx.fillRect(to(cr.x) - 2, to(cr.z) - 2, 4, 4);
      }
      if (G.police.heli) {
        ctx.fillStyle = '#ff5555';
        ctx.fillRect(to(G.police.heli.mesh.position.x) - 2, to(G.police.heli.mesh.position.z) - 2, 4, 4);
      }
      ctx.save();
      ctx.translate(to(px), to(pz));
      ctx.rotate(p.car ? p.car.heading : p.heading);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.fill();
      ctx.restore();
    },
    drawFullmap() {
      const c = el('fullmap');
      const ctx = c.getContext('2d');
      const S = 520, W = 440;
      const to = (v) => ((v + W / 2) / W) * S;
      ctx.fillStyle = '#22303a';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#3f7d8c';
      ctx.fillRect(to(150), 0, S - to(150), S);
      ctx.fillStyle = '#e6d3a3';
      ctx.fillRect(0, to(168), S, S - to(168));
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 5;
      for (const r of CFG.roads) {
        ctx.beginPath(); ctx.moveTo(to(r), 0); ctx.lineTo(to(r), S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, to(r)); ctx.lineTo(S, to(r)); ctx.stroke();
      }
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#fff';
      const spots = G.world.spots;
      const labels = [
        ['Marlowe Motors (garage)', spots.garage], ['Bank', spots.bank],
        ['Hospital', spots.hospital], ['Hideout', spots.hideout],
        ['Marina', spots.marina], ['Police station', spots.police],
        ['Pier', spots.pier], ['Lighthouse', [196, -146]],
      ];
      for (const [label, pt] of labels) {
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(to(pt[0]), to(pt[1]), 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, to(pt[0]) + 9, to(pt[1]) + 5);
      }
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#cfe8ef';
      ctx.fillText('Downtown', to(0), to(-37));
      ctx.fillText('Beach District', to(-60), to(185));
      ctx.fillText('Market Quarter', to(-112), to(-37));
      ctx.fillText('Hills', to(0), to(-150));
      ctx.fillText('Marina', to(180), to(-80));
      const p = G.player;
      const px = p.car ? p.car.x : p.x;
      const pz = p.car ? p.car.z : p.z;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(to(px), to(pz), 7, 0, 7); ctx.fill();
      if (G.marker) {
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(to(G.marker.x), to(G.marker.z), 12, 0, 7); ctx.stroke();
      }
    },
    openPause() {
      G.state = 'paused';
      el('pause-menu').classList.remove('hidden');
      const list = el('mission-list');
      list.innerHTML = G.missions.list.map((m, i) =>
        '<li class="' + (i === G.missions.idx ? 'cur' : '') + '">' + (i < G.missions.idx ? '✓ ' : '') +
        'Act ' + m.act + ' — ' + m.name + '</li>').join('');
      el('save-info').textContent = 'Money $' + G.money + ' · Missions ' + G.missions.idx + ' / 12 · RP ' + G.rank.rp;
      this.drawFullmap();
    },
    closePause() {
      el('pause-menu').classList.add('hidden');
      if (G.state === 'paused') G.state = 'playing';
    },
  };

  el('start-btn').addEventListener('click', () => {
    G.audio.ensure();
    G.audio.startMusic();
    el('start-screen').classList.add('hidden');
    G.state = 'playing';
    if (!G.missions.cur) G.missions.start(G.missions.idx);
  });
  el('resume-btn').addEventListener('click', () => hud.closePause());
  el('again-btn').addEventListener('click', () => location.reload());
  el('save-now').addEventListener('click', () => { G.saveGame(); el('save-info').textContent = 'Saved.'; });
  el('save-clear').addEventListener('click', () => { G.clearSave(); location.reload(); });
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.tab-page').forEach((x) => x.classList.add('hidden'));
      t.classList.add('active');
      el('tab-' + t.dataset.tab).classList.remove('hidden');
      if (t.dataset.tab === 'map') hud.drawFullmap();
    });
  });
  return hud;
}

function fmtTime(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
