// Solmar 3D — HUD panels, minimap, banners, menus, full map, mission list.
// Written fresh in this session for the v5 rebuild (prose spec only).
// All DOM is built here and appended to the page; the game canvas stays
// underneath. The minimap is a 2D canvas drawn from the world each frame.

import { MISSIONS, ACT_NAMES, WEAPONS, RANKS } from './config.js';

export function createHud(G) {
  const doc = document;
  function el(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const root = el('div', 'hud', doc.body);
  // Top-left: mission box.
  const missionBox = el('div', 'panel mission-box', root);
  const missionName = el('div', 'mission-name', missionBox, 'Solmar');
  const missionObj = el('div', 'mission-obj', missionBox, 'Press Start to begin');
  const missionHint = el('div', 'mission-hint', missionBox, '');
  const missionTimer = el('div', 'mission-timer', missionBox, '');
  // Top-right: clock, money, stars.
  const topRight = el('div', 'panel top-right', root);
  const clockEl = el('div', 'clock', topRight, '17:30');
  const moneyEl = el('div', 'money', topRight, '$150');
  const starsEl = el('div', 'stars', topRight, '☆☆☆☆☆');
  // Right side: rank and weapons.
  const rightPanel = el('div', 'panel right-panel', root);
  const rankTitle = el('div', 'rank-title', rightPanel, 'Street Rat');
  const rankBar = el('div', 'bar rank-bar', rightPanel);
  const rankFill = el('div', 'fill', rankBar);
  const rankPts = el('div', 'rank-pts', rightPanel, '0 pts');
  const weaponBox = el('div', 'weapons', rightPanel);
  const weaponSlots = WEAPONS.map((w, i) => {
    const s = el('div', 'weapon', weaponBox, `${i + 1} ${w.name}`);
    return s;
  });
  // Bottom-left: location, minimap, health/armour.
  const bottomLeft = el('div', 'panel bottom-left', root);
  const locationEl = el('div', 'location', bottomLeft, 'Solmar');
  const minimap = el('canvas', 'minimap', bottomLeft);
  minimap.width = 190; minimap.height = 190;
  const mmCtx = minimap.getContext('2d');
  const healthBar = el('div', 'bar health-bar', bottomLeft);
  const healthFill = el('div', 'fill', healthBar);
  const armourBar = el('div', 'bar armour-bar', bottomLeft);
  const armourFill = el('div', 'fill', armourBar);
  // Bottom-centre: act title. Centre: banner. Crosshair.
  const actEl = el('div', 'act-title', root, '');
  const bannerEl = el('div', 'banner', root, '');
  const bannerSub = el('div', 'banner-sub', root, '');
  const crosshair = el('div', 'crosshair', root, '+');
  crosshair.style.display = 'none';

  let marker = null; // {x, z, color}
  let bannerT = 0;
  let actT = 0;

  // ---- start screen ----------------------------------------------------
  const startScreen = el('div', 'overlay start-screen', doc.body);
  el('h1', 'game-title', startScreen, 'SOLMAR');
  el('div', 'tagline', startScreen, 'A newcomer. A city. A crown to take.');
  el('div', 'controls-list', startScreen,
    'W A S D move · Mouse look · Shift sprint · Space jump · F punch · E enter / leave car · Click shoot · 1-4 weapons · C camera · H horn · M map · L missions · Esc pause · Mute: N');
  el('div', 'save-note', startScreen, 'Progress is saved automatically on this device.');
  const startBtn = el('button', 'start-btn', startScreen, 'START');
  startBtn.addEventListener('click', () => {
    G.audio.unlock();
    G.audio.startMusic();
    startScreen.style.display = 'none';
    G.startGame();
  });

  // ---- pause menu ------------------------------------------------------
  const pauseMenu = el('div', 'overlay pause-menu', doc.body);
  pauseMenu.style.display = 'none';
  el('h2', '', pauseMenu, 'PAUSED');
  const tabBar = el('div', 'tabs', pauseMenu);
  const tabPanels = {};
  const tabs = ['MAP', 'MISSIONS', 'CONTROLS', 'SAVE'];
  const tabBtns = {};
  for (const t of tabs) {
    const b = el('button', 'tab', tabBar, t);
    tabBtns[t] = b;
    b.addEventListener('click', () => showTab(t));
    const panel = el('div', 'tab-panel', pauseMenu);
    panel.style.display = 'none';
    tabPanels[t] = panel;
  }
  // MAP tab: full city map canvas.
  const mapCanvas = el('canvas', 'fullmap', tabPanels.MAP);
  mapCanvas.width = 620; mapCanvas.height = 620;
  el('div', 'map-legend', tabPanels.MAP, 'Yellow = mission · Green = safehouse · Red = police · Blue = you');
  // MISSIONS tab.
  const missionList = el('div', 'mission-list', tabPanels.MISSIONS);
  // CONTROLS tab.
  el('div', '', tabPanels.CONTROLS,
    'W A S D move / drive · Mouse orbit · Shift sprint · Space jump / handbrake · F punch · E enter / leave car · Click shoot · 1-4 weapons · C camera near / far · H horn · M map · L missions · N mute · Esc pause');
  // SAVE tab.
  const saveInfo = el('div', '', tabPanels.SAVE, '');
  const saveBtn = el('button', 'save-btn', tabPanels.SAVE, 'SAVE NOW');
  saveBtn.addEventListener('click', () => {
    G.saveGame();
    saveInfo.textContent = 'Saved.';
  });
  const resumeBtn = el('button', 'resume-btn', pauseMenu, 'RESUME');
  resumeBtn.addEventListener('click', () => togglePause(false));

  function showTab(t) {
    for (const k of tabs) {
      tabPanels[k].style.display = k === t ? 'block' : 'none';
      tabBtns[k].classList.toggle('active', k === t);
    }
    if (t === 'MAP') drawFullMap();
    if (t === 'MISSIONS') drawMissionList();
    if (t === 'SAVE') saveInfo.textContent = `Money $${G.player.money} · Missions ${G.save.missionsDone.length}/12 · Rank ${G.rank.title()} · Packages ${G.save.packages.length}/12 · Fares ${G.save.fares}`;
  }

  function togglePause(force) {
    const show = force !== undefined ? force : pauseMenu.style.display === 'none';
    if (G.state !== 'playing' && show) return;
    pauseMenu.style.display = show ? 'flex' : 'none';
    G.state = show ? 'paused' : 'playing';
    if (show) showTab('MAP');
  }

  // ---- completion screen ------------------------------------------------
  const completeScreen = el('div', 'overlay complete-screen', doc.body);
  completeScreen.style.display = 'none';
  el('h1', 'game-title', completeScreen, 'KING OF SOLMAR');
  el('div', 'tagline', completeScreen, 'Dani Vega owns the city. The crown is yours.');
  const againBtn = el('button', 'start-btn', completeScreen, 'KEEP PLAYING');
  againBtn.addEventListener('click', () => {
    completeScreen.style.display = 'none';
    G.state = 'playing';
  });

  // ---- drawing ----------------------------------------------------------
  function mapXY(x, z, size) {
    // World x -260..260, z -260..290 -> canvas.
    const s = size / 560;
    return [(x + 260) * s, (z + 260) * s];
  }

  function drawMinimap() {
    const ctx = mmCtx;
    const S = 190;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#3a5a3a';
    ctx.fillRect(0, 0, S, S);
    // Water around the island.
    ctx.fillStyle = '#2e6f9e';
    ctx.fillRect(0, 0, S, 3);
    ctx.fillRect(0, S - 3, S, 3);
    ctx.fillRect(S - 3, 0, 3, S);
    // Roads.
    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 4;
    const roadsX = [-160, -80, 0, 80, 160];
    const roadsZ = [-160, -80, 0, 80, 160];
    for (const x of roadsX) {
      const [mx] = mapXY(x, 0, S);
      ctx.beginPath(); ctx.moveTo(mx, mapXY(0, -170, S)[1]); ctx.lineTo(mx, mapXY(0, 170, S)[1]); ctx.stroke();
    }
    for (const z of roadsZ) {
      const [, my] = mapXY(0, z, S);
      ctx.beginPath(); ctx.moveTo(mapXY(-170, 0, S)[0], my); ctx.lineTo(mapXY(170, 0, S)[0], my); ctx.stroke();
    }
    // Safehouse.
    const [hx, hy] = mapXY(G.world.places.safehouse.x, G.world.places.safehouse.z, S);
    ctx.fillStyle = '#66ff66';
    ctx.fillRect(hx - 3, hy - 3, 6, 6);
    // Mission marker.
    if (marker) {
      const [mx, my] = mapXY(marker.x, marker.z, S);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#ff4444';
    for (const c of G.police.cruisers) {
      const [cx, cy] = mapXY(c.x, c.z, S);
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (G.police.heli) {
      const [hx2, hy2] = mapXY(G.police.heli.position.x, G.police.heli.position.z, S);
      ctx.fillStyle = '#ff8844';
      ctx.beginPath(); ctx.arc(hx2, hy2, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const px = G.player.inCar ? G.player.inCar.x : G.player.x;
    const pz = G.player.inCar ? G.player.inCar.z : G.player.z;
    const [ax, ay] = mapXY(px, pz, S);
    const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFullMap() {
    const ctx = mapCanvas.getContext('2d');
    const S = 620;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#202a20';
    ctx.fillRect(0, 0, S, S);
    // Districts as tinted blocks.
    const districtColors = { downtown: '#6a5a4a', beach: '#c8b898', market: '#7a4a3a', hills: '#4a5a6a', marina: '#3a5a7a' };
    for (let gx = -200; gx < 200; gx += 80) {
      for (let gz = -200; gz < 200; gz += 80) {
        const d = G.world.districtAt(gx + 40, gz + 40);
        const [x, y] = mapXY(gx, gz, S);
        ctx.fillStyle = districtColors[d] || '#555';
        ctx.fillRect(x, y, 80 * (S / 560), 80 * (S / 560));
      }
    }
    // Roads.
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 8;
    for (const x of [-160, -80, 0, 80, 160]) {
      const [mx] = mapXY(x, 0, S);
      ctx.beginPath(); ctx.moveTo(mx, mapXY(0, -170, S)[1]); ctx.lineTo(mx, mapXY(0, 170, S)[1]); ctx.stroke();
    }
    for (const z of [-160, -80, 0, 80, 160]) {
      const [, my] = mapXY(0, z, S);
      ctx.beginPath(); ctx.moveTo(mapXY(-170, 0, S)[0], my); ctx.lineTo(mapXY(170, 0, S)[0], my); ctx.stroke();
    }
    // Place icons.
    ctx.font = 'bold 15px sans-serif';
    for (const [key, p] of Object.entries(G.world.places)) {
      const [x, y] = mapXY(p.x, p.z, S);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(p.name, x + 10, y + 5);
    }
    // Next mission marker.
    if (marker) {
      const [mx, my] = mapXY(marker.x, marker.z, S);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Player.
    const px = G.player.inCar ? G.player.inCar.x : G.player.x;
    const pz = G.player.inCar ? G.player.inCar.z : G.player.z;
    const [ax, ay] = mapXY(px, pz, S);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ax, ay, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  function drawMissionList() {
    missionList.innerHTML = '';
    for (const m of MISSIONS) {
      const done = G.save.missionsDone.includes(m.id);
      const isCurrent = G.missions.current && G.missions.current.def.id === m.id;
      const div = el('div', 'mission-row', missionList);
      div.textContent = `${done ? '✓' : isCurrent ? '▶' : '·'} ${ACT_NAMES[m.act]} — ${m.name} (+$${m.money})`;
      if (done) div.style.opacity = '0.6';
      if (isCurrent) div.style.color = '#ffd24a';
    }
  }

  // ---- public API -------------------------------------------------------
  function banner(title, sub) {
    bannerEl.textContent = title;
    bannerSub.textContent = sub || '';
    bannerEl.style.opacity = '1';
    bannerSub.style.opacity = '1';
    bannerT = 3;
    const status = document.getElementById('status');
    if (status) status.textContent = `${title}. ${sub || ''}`;
  }

  function actTitle(text) {
    actEl.textContent = text;
    actEl.style.opacity = '1';
    actT = 4;
  }

  function update(dt) {
    // Clock: hour from G.hour.
    const h = Math.floor(G.hour);
    const m = Math.floor((G.hour - h) * 60);
    clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    moneyEl.textContent = `$${G.player.money}`;
    const loc = G.world.streetAt(G.player.inCar ? G.player.inCar.x : G.player.x, G.player.inCar ? G.player.inCar.z : G.player.z);
    const districtName = { downtown: 'Downtown', beach: 'Beach District', market: 'Market Quarter', hills: 'The Hills', marina: 'Marina' }[loc.district] || loc.district;
    locationEl.textContent = `${districtName} — ${loc.street}`;
    healthFill.style.width = `${Math.max(0, G.player.health)}%`;
    armourFill.style.width = `${Math.max(0, G.player.armour)}%`;
    // Weapon slots.
    weaponSlots.forEach((s, i) => {
      const ammo = G.player.ammo[i];
      s.textContent = `${i + 1} ${WEAPONS[i].name}${ammo === Infinity ? '' : ` (${ammo})`}`;
      s.classList.toggle('active', G.player.weapon === i);
    });
    // Crosshair: show on foot with a gun.
    crosshair.style.display = (!G.player.inCar && G.player.weapon > 0 && G.state === 'playing') ? 'block' : 'none';
    drawMinimap();
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) {
        bannerEl.style.opacity = '0';
        bannerSub.style.opacity = '0';
      }
    }
    if (actT > 0) {
      actT -= dt;
      if (actT <= 0) actEl.style.opacity = '0';
    }
  }

  return {
    banner, actTitle, update, togglePause, showTab,
    setObjective(name, text, hint) {
      missionName.textContent = name || 'Solmar';
      missionObj.textContent = text || '';
      missionHint.textContent = hint || '';
    },
    setMission(name, act, stage) {
      missionName.textContent = name || 'Solmar';
    },
    setTimer(seconds) {
      missionTimer.textContent = seconds > 0 ? `⏱ ${Math.ceil(seconds)}s` : '';
    },
    setWanted(n) {
      starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      starsEl.style.color = n > 0 ? '#ff4444' : '#fff';
    },
    setRank(level, title, progress, points) {
      rankTitle.textContent = `${RANKS[level].title} (Lv ${level + 1})`;
      rankFill.style.width = `${Math.round(progress * 100)}%`;
      rankPts.textContent = `${points} pts`;
    },
    setMarker(x, z, color) {
      marker = x === null ? null : { x, z, color };
    },
    showComplete() {
      completeScreen.style.display = 'flex';
    },
    hideStart() { startScreen.style.display = 'none'; },
    get paused() { return pauseMenu.style.display !== 'none'; },
  };
}
