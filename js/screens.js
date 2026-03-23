// ============================================================
// screens.js  —  All screens, fully matching the visual guide
// ============================================================
const Screens = (() => {

  const E = TactixEngine;

  // ── DOM helper ────────────────────────────────────────────
  function el(tag, styles) {
    const d = document.createElement(tag);
    if (styles) Object.assign(d.style, styles);
    return d;
  }

  // ── Shared CSS ────────────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('tx-styles')) return;
    const s = document.createElement('style');
    s.id = 'tx-styles';
    s.textContent = `
      .tx-btn {
        font-family:'Iceberg',monospace; font-size:12px; letter-spacing:2px;
        color:#9ab8c8; background:transparent;
        border:1.5px solid #2e4858; padding:6px 18px; cursor:pointer;
        transition:background .12s,border-color .12s,color .12s;
        text-transform:uppercase;
      }
      .tx-btn:hover { background:rgba(58,120,160,.22); border-color:#5a9ab8; color:#d8eaf6; }
      .tx-btn.primary { border-color:#1a7a3a; color:#2acc60; }
      .tx-btn.primary:hover { background:rgba(26,122,58,.22); border-color:#3aec78; }
      .tx-btn:disabled { opacity:.28; pointer-events:none; }

      .phase-btn {
        font-family:'Iceberg',monospace; font-size:12px; letter-spacing:2px;
        padding:6px 20px; cursor:pointer; border:1.5px solid; background:transparent;
        transition:background .1s, opacity .15s;
      }
      .phase-btn.move    { border-color:#2a8a2a; color:#3ad84a; }
      .phase-btn.attack  { border-color:#a07810; color:#d8a820; }
      .phase-btn.endturn { border-color:#7a2a2a; color:#c84040; }
      .phase-btn:hover   { background:rgba(255,255,255,.07); }
      .phase-btn.dimmed  { opacity:.25; pointer-events:none; }
      .phase-btn.active  { background:rgba(255,255,255,.1); }

      .pu-icon {
        width:34px; height:34px; border-radius:50%;
        border:1.5px solid #2a3e50;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; font-size:14px; color:#8ab0c4;
        background:rgba(6,16,26,.85);
        transition:border-color .12s,background .12s;
        user-select:none;
      }
      .pu-icon:hover  { border-color:#5a9ab8; background:rgba(16,48,72,.8); }
      .pu-icon.active { border-color:#f0e040; background:rgba(48,38,0,.8); color:#f0e040; }
      .pu-icon.enemy  { opacity:.55; cursor:default; pointer-events:none; }

      .tx-overlay {
        position:absolute; inset:0;
        background:rgba(0,0,0,.74);
        display:flex; align-items:center; justify-content:center; z-index:50;
      }
      .tx-panel {
        background:rgba(4,12,20,.97);
        border:1px solid #1a3040;
      }
      .menu-tab {
        font-family:'Iceberg',monospace; font-size:13px; letter-spacing:2px;
        padding:13px 22px; background:transparent;
        border:none; border-right:1px solid #0e1e2c; border-bottom:2px solid transparent;
        color:#2e4858; cursor:pointer; transition:color .12s; text-align:left;
      }
      .menu-tab:hover  { color:#7a9aaa; }
      .menu-tab.active { color:#c0d8e4; border-bottom-color:#3a7898; }
      .squad-card {
        display:flex; align-items:center; gap:12px;
        padding:9px 11px; margin-bottom:6px;
        background:rgba(6,18,30,.72); border:1px solid #162438;
        transition:background .1s;
      }
      .squad-card:hover { background:rgba(16,44,72,.72); }
      .roster-row {
        display:flex; align-items:center; gap:9px;
        padding:5px 9px; margin-bottom:4px;
        background:rgba(6,18,30,.6); border:1px solid #0c1c2c;
      }
    `;
    document.head.appendChild(s);
  })();

  // ──────────────────────────────────────────────────────────
  // TITLE SCREEN
  // ──────────────────────────────────────────────────────────
  function Title() {
    let fade = 0;

    function handleClick() { E.unlockAudio(); E.setScreen(GameSelect()); }

    function enter() {
      E.playMusic('score');
      E.getCanvas().addEventListener('click', handleClick, { once: true });
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
    }
    function update(dt) { fade = Math.min(1, fade + dt * 1.5); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg1', 1);
      ctx.save(); ctx.globalAlpha = fade;

      // Logo
      const logo = E.getImage('logo');
      if (logo) {
        const lw = 600, lh = logo.height * (600 / logo.width);
        ctx.drawImage(logo, (1280 - lw) / 2, 130, lw, lh);
      }

      // "TURN-BASED COMBAT" — large, clearly legible
      ctx.font = '22px Iceberg'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(440, 358, 400, 34);
      ctx.fillStyle = '#8ecce8';
      ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 0;
      ctx.fillText('TURN-BASED COMBAT', 640, 375);
      ctx.shadowBlur = 0;

      // START button
      const bw = 170, bh = 44, bx = 640 - bw/2, by = 430;
      ctx.fillStyle = 'rgba(30,52,68,.88)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#4a7a92'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.font = '17px Iceberg'; ctx.fillStyle = '#c0d8e8';
      ctx.fillText('START', 640, by + bh / 2);

      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // GAME SELECT  — pointy-top hexes, SVG icons
  // ──────────────────────────────────────────────────────────
  function GameSelect() {
    let fade = 0;
    let hovered = null;
    const MELEE_CX = 370, CTF_CX = 850, CARD_CY = 400, CARD_R = 145;

    function canvasMouse(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      return { mx:(e.clientX-rect.left)*(1280/rect.width), my:(e.clientY-rect.top)*(720/rect.height) };
    }
    function handleClick(e) {
      const {mx,my} = canvasMouse(e);
      if (Math.hypot(mx-MELEE_CX,my-CARD_CY)<CARD_R) E.setScreen(TeamSelect('melee'));
      else if (Math.hypot(mx-CTF_CX,my-CARD_CY)<CARD_R) E.setScreen(TeamSelect('ctf'));
    }
    function handleMove(e) {
      const {mx,my} = canvasMouse(e);
      hovered = Math.hypot(mx-MELEE_CX,my-CARD_CY)<CARD_R ? 'melee'
              : Math.hypot(mx-CTF_CX,my-CARD_CY)<CARD_R   ? 'ctf' : null;
    }
    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      // Back button
      const ui = E.getUI(); ui.innerHTML = '';
      const back = txBtn('BACK', () => E.setScreen(Title()));
      Object.assign(back.style, { position:'absolute', top:'18px', right:'24px', fontSize:'11px' });
      ui.appendChild(back);
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }
    function update(dt) { fade = Math.min(1, fade + dt * 2); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.52);
      ctx.save(); ctx.globalAlpha = fade;

      ctx.font = '28px Iceberg'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#c8dce8'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=10;
      ctx.fillText('CHOOSE YOUR GAME', 640, 155);
      ctx.shadowBlur = 0;

      drawGameHex(ctx, MELEE_CX, CARD_CY, CARD_R, 'melee',  hovered==='melee');
      drawGameHex(ctx, CTF_CX,   CARD_CY, CARD_R, 'ctf',    hovered==='ctf');

      ctx.restore();
    }

    // Pointy-top hex (points at top and bottom, as required)
    function pointyHexPath(ctx, cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;   // 30°,90°,150°,210°,270°,330°
        i === 0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
                : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
      }
      ctx.closePath();
    }

    function drawGameHex(ctx, cx, cy, r, mode, hot) {
      pointyHexPath(ctx, cx, cy, r);
      ctx.fillStyle = hot ? 'rgba(28,58,88,.82)' : 'rgba(10,22,36,.74)';
      ctx.fill();
      if (hot) { ctx.shadowColor='rgba(80,160,220,.55)'; ctx.shadowBlur=20; }
      ctx.strokeStyle = hot ? '#5aaece' : '#2a4a60';
      ctx.lineWidth   = hot ? 2 : 1.5;
      ctx.stroke(); ctx.shadowBlur=0;

      // Icon — drawn as canvas paths matching the visual guide
      ctx.save(); ctx.translate(cx, cy - 22);
      ctx.fillStyle = hot ? '#d8f0ff' : '#78b8d4';
      if (mode === 'melee') drawGunIcon(ctx, 0, 0, 56);
      else                  drawFlagIcon(ctx, 0, 0, 56);
      ctx.restore();

      ctx.font = '16px Iceberg'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = hot ? '#ffffff' : '#a8ccd8';
      ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=5;
      ctx.fillText(mode === 'melee' ? 'MELEE' : 'CAPTURE THE FLAG', cx, cy + r * 0.6);
      ctx.shadowBlur = 0;
    }

    // Crossed rifles icon (matching guide)
    function drawGunIcon(ctx, cx, cy, size) {
      const s = size / 56;
      ctx.save(); ctx.scale(s, s); ctx.translate(cx/s, cy/s);
      ctx.fillStyle = ctx.fillStyle; // inherit

      // Two crossed rifles drawn as thick strokes
      function drawRifle(angle) {
        ctx.save(); ctx.rotate(angle);
        ctx.strokeStyle = ctx.fillStyle || '#78b8d4';
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        // Stock
        ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(10, -2); ctx.stroke();
        // Barrel
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(26, -10); ctx.stroke();
        // Body bulk
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(12, -4); ctx.stroke();
        ctx.restore();
      }
      drawRifle(-Math.PI/6);
      drawRifle( Math.PI/6);
      ctx.restore();
    }

    // Two crossed flags icon (matching guide)
    function drawFlagIcon(ctx, cx, cy, size) {
      const s = size / 56;
      ctx.save(); ctx.scale(s, s); ctx.translate(cx/s, cy/s);
      ctx.strokeStyle = ctx.fillStyle || '#78b8d4';

      function drawFlag(angle) {
        ctx.save(); ctx.rotate(angle);
        // Pole
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -18); ctx.stroke();
        // Flag shape
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(20, -10); ctx.lineTo(0, -2); ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      drawFlag(-Math.PI / 10);
      drawFlag( Math.PI / 10);
      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // TEAM SELECT  — pointy-top hexes, team portrait zoom on hover
  // ──────────────────────────────────────────────────────────
  function TeamSelect(mode) {
    let fade = 0;
    let hovered = null;
    const teams = Object.values(Data.TEAMS);

    // Arrangement from the visual guide: 2 top, 3 bottom, centered group
    // Guide: Virent(top-L), Magma(top-R), Azure(bot-L), Phlox(bot-C), Vermillion(bot-R)
    const R_HEX = 105;
    const positions = [
      { x: 355, y: 275 },   // Virent      (top-left)
      { x: 720, y: 275 },   // Magma       (top-right — shifted in closer)
      { x: 180, y: 450 },   // Azure       (bottom-left)
      { x: 548, y: 460 },   // Phlox       (bottom-center)
      { x: 920, y: 450 },   // Vermillion  (bottom-right)
    ];

    function canvasMouse(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      return { mx:(e.clientX-rect.left)*(1280/rect.width), my:(e.clientY-rect.top)*(720/rect.height) };
    }
    function handleClick(e) {
      const {mx,my} = canvasMouse(e);
      teams.forEach((team, i) => {
        const p = positions[i]; if (!p) return;
        if (Math.hypot(mx-p.x, my-p.y) < R_HEX) E.setScreen(SquadBuilder(mode, team.id));
      });
    }
    function handleMove(e) {
      const {mx,my} = canvasMouse(e);
      hovered = null;
      teams.forEach((team, i) => {
        const p = positions[i]; if (!p) return;
        if (Math.hypot(mx-p.x, my-p.y) < R_HEX) hovered = team.id;
      });
    }
    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      const ui = E.getUI(); ui.innerHTML = '';
      const back = txBtn('BACK', () => E.setScreen(GameSelect()));
      Object.assign(back.style, { position:'absolute', top:'18px', right:'24px', fontSize:'11px' });
      ui.appendChild(back);
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }
    function update(dt) { fade = Math.min(1, fade + dt * 2); }

    function render(ctx) {
      // Use bg2 (the darker rubble scene) — same as game select
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.46);
      ctx.save(); ctx.globalAlpha = fade;

      ctx.font='26px Iceberg'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#c8dce8'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=10;
      ctx.fillText('SELECT YOUR TEAM', 640, 95);
      ctx.shadowBlur=0;

      teams.forEach((team, i) => {
        const p = positions[i]; if (!p) return;
        drawTeamHex(ctx, p.x, p.y, R_HEX, team, hovered === team.id);
      });

      ctx.restore();
    }

    function pointyHexPath(ctx, cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI/3)*i + Math.PI/6;
        i===0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
              : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
      }
      ctx.closePath();
    }

    function drawTeamHex(ctx, cx, cy, r, team, hot) {
      const portrait = E.getImage(team.portrait);
      const rr = hot ? r + 5 : r;
      ctx.save();

      // Portrait — zoom in when hovered
      if (portrait) {
        // Clip to hex shape first
        pointyHexPath(ctx, cx, cy, rr - 1);
        ctx.clip();
        const zoom = hot ? 1.15 : 1.0;
        const sz   = rr * 2.2 * zoom;
        ctx.drawImage(portrait, cx - sz/2, cy - sz * 0.52, sz, sz);
      }

      ctx.restore();
      ctx.save();

      // Hex border
      pointyHexPath(ctx, cx, cy, rr);
      if (hot) { ctx.shadowColor = team.glowColor || team.color; ctx.shadowBlur = 26; }
      ctx.strokeStyle = team.color;
      ctx.lineWidth   = hot ? 3 : 2;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Team name at bottom
      ctx.font = `${hot?14:12}px Iceberg`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = hot ? '#ffffff' : '#b0ccd8';
      ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 8;
      ctx.fillText(team.name, cx, cy + rr * 0.72);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // SQUAD BUILDER
  // ──────────────────────────────────────────────────────────
  function SquadBuilder(mode, teamId) {
    const team = Data.TEAMS[teamId];
    let roster   = [];
    let powerups = [];

    function totalCost() {
      return roster.reduce((s,id)  => s + Data.UNITS[id].cost, 0)
           + powerups.reduce((s,id) => s + Data.POWERUPS[id].cost, 0);
    }
    function addUnit(id)    { if (totalCost()+Data.UNITS[id].cost <= Data.SQUAD_BUDGET) { roster.push(id); rebuildUI(); } }
    function removeUnit(i)  { roster.splice(i,1); rebuildUI(); }
    function addPU(id)      { if (powerups.length<Data.POWERUP_CAP && totalCost()+Data.POWERUPS[id].cost<=Data.SQUAD_BUDGET) { powerups.push(id); rebuildUI(); } }
    function removePU(i)    { powerups.splice(i,1); rebuildUI(); }

    function rebuildUI() {
      const ui = E.getUI(); ui.innerHTML = '';
      const cost = totalCost(), rem = Data.SQUAD_BUDGET - cost;
      const canReady = roster.length > 0;

      // ── Top bar ─────────────────────────────────────────
      const nav = el('div', {
        position:'absolute', top:'0', left:'0', right:'0', height:'48px',
        background:'rgba(2,8,16,.95)', borderBottom:'1px solid #101e2c',
        display:'flex', alignItems:'center', padding:'0 20px', gap:'14px'
      });
      const titleEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'15px',
        letterSpacing:'4px', color:'#a8c4d4' });
      titleEl.textContent = 'BUILD YOUR SQUAD';
      const ptsEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'13px',
        color:'#d4b820', marginLeft:'auto' });
      ptsEl.textContent = `${cost} / ${Data.SQUAD_BUDGET} PTS`;
      const backBtn = txBtn('BACK', () => E.setScreen(TeamSelect(mode)));
      const readyBtn = txBtn('READY', () => {
        if (canReady) E.setScreen(Battle(mode, teamId, [...roster], [...powerups]));
      });
      readyBtn.classList.add('primary');
      if (!canReady) readyBtn.disabled = true;
      nav.append(titleEl, ptsEl, backBtn, readyBtn);
      ui.appendChild(nav);

      // ── Two-panel layout ─────────────────────────────────
      const body = el('div', { position:'absolute', top:'48px', left:'0', right:'0', bottom:'0', display:'flex' });

      // LEFT — available units
      const left = el('div', { width:'44%', padding:'16px 18px',
        background:'rgba(3,10,18,.92)', borderRight:'1px solid #101e2c', overflowY:'auto' });

      sectionHeader(left, 'SOLDIERS');
      team.units.forEach(uid => left.appendChild(buildUnitCard(uid, rem)));
      sectionHeader(left, 'POWER UPS', { marginTop:'16px' });
      Object.values(Data.POWERUPS).forEach(pu => left.appendChild(buildPUCard(pu, rem, powerups.length)));

      // RIGHT — squad list
      const right = el('div', { flex:'1', padding:'16px 18px',
        background:'rgba(4,12,22,.88)', overflowY:'auto' });

      const squadTop = el('div', { display:'flex', justifyContent:'space-between',
        marginBottom:'12px', fontFamily:'Iceberg,monospace', fontSize:'11px',
        letterSpacing:'3px', color:'#2a4050' });
      squadTop.innerHTML = `<span>YOUR SQUAD</span><span style="color:#d4b820">${cost}/${Data.SQUAD_BUDGET} PTS</span>`;
      right.appendChild(squadTop);

      if (!roster.length && !powerups.length) {
        const hint = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'11px',
          color:'#1e2e3c', marginTop:'18px' });
        hint.textContent = 'Add soldiers and power-ups from the left panel.';
        right.appendChild(hint);
      }
      roster.forEach((uid, i) => {
        const u = Data.UNITS[uid];
        right.appendChild(rosterRow(u.name, u.cost, team.color, () => removeUnit(i)));
      });
      if (powerups.length) {
        sectionHeader(right, 'POWER UPS', { marginTop:'12px' });
        powerups.forEach((pid, i) => {
          const pu = Data.POWERUPS[pid];
          right.appendChild(rosterRow(pu.name, pu.cost, '#c8a028', () => removePU(i)));
        });
      }

      body.append(left, right);
      ui.appendChild(body);
    }

    // Pointy-top SVG hex clip path for icons
    function hexIconEl(size, borderColor) {
      // Draw as canvas-clipped div — we use a canvas element inline for the hex icon
      const wrap = el('div', { width:size+'px', height:size+'px', flexShrink:'0', position:'relative' });
      const c = document.createElement('canvas'); c.width=size; c.height=size;
      const ctx2 = c.getContext('2d');
      const r = size/2 - 2;
      ctx2.beginPath();
      for (let i=0;i<6;i++) { const a=(Math.PI/3)*i+Math.PI/6; i===0?ctx2.moveTo(size/2+r*Math.cos(a),size/2+r*Math.sin(a)):ctx2.lineTo(size/2+r*Math.cos(a),size/2+r*Math.sin(a)); }
      ctx2.closePath();
      ctx2.fillStyle='rgba(8,20,34,.85)'; ctx2.fill();
      ctx2.strokeStyle=borderColor||'#2a4050'; ctx2.lineWidth=1.5; ctx2.stroke();
      wrap.appendChild(c);
      return wrap;
    }

    function buildUnitCard(uid, rem) {
      const u = Data.UNITS[uid];
      const card = el('div'); card.className='squad-card';

      const iconBox = hexIconEl(42, team.color);
      // Unit type icon drawn on the canvas inside iconBox
      const icanvas = iconBox.querySelector('canvas');
      const ic = icanvas.getContext('2d');
      ic.font='16px sans-serif'; ic.textAlign='center'; ic.textBaseline='middle';
      ic.fillStyle=team.color;
      ic.fillText(unitIconChar(u.id), 21, 21);

      const info = el('div', { flex:'1' });
      const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'13px',
        color:'#b0c8d4', letterSpacing:'1px' });
      nm.textContent = u.name;
      const st = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px',
        color:'#3a5868', marginTop:'2px' });
      st.textContent = `SPEED ${u.speed}  RANGE ${u.range}  ATK +${u.atk}  DEF +${u.def}  DMG ${u.dmg}  HP ${u.hp}`;
      info.append(nm, st);
      if (u.special) {
        const sp = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px',
          color: team.color, marginTop:'2px' });
        sp.textContent = specialLabel(u.special);
        info.appendChild(sp);
      }

      const costEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'14px',
        color:'#d4b820', flexShrink:'0' });
      costEl.textContent = u.cost+'pts.';

      const addBtn = txBtn('+', () => addUnit(uid));
      addBtn.style.cssText += ';padding:4px 10px;font-size:16px;flex-shrink:0;';
      if (u.cost > rem) addBtn.disabled = true;

      card.append(iconBox, info, costEl, addBtn);
      return card;
    }

    function buildPUCard(pu, rem, curCount) {
      const card = el('div'); card.className='squad-card';

      // Power-up icon box uses team color border
      const iconBox = hexIconEl(42, team.color);
      const icanvas = iconBox.querySelector('canvas');
      const ic = icanvas.getContext('2d');
      ic.font='16px sans-serif'; ic.textAlign='center'; ic.textBaseline='middle';
      ic.fillStyle=team.color;
      ic.fillText(puIconChar(pu.id), 21, 21);

      const info = el('div', { flex:'1' });
      const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'13px',
        color:'#ffffff', letterSpacing:'1px' });
      nm.textContent = pu.name;
      const desc = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px',
        color:'#ffffff', marginTop:'2px' });
      desc.textContent = pu.desc;
      info.append(nm, desc);

      const costEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'14px',
        color:'#d4b820', flexShrink:'0' });
      costEl.textContent = pu.cost+'pts.';

      const addBtn = txBtn('+', () => addPU(pu.id));
      addBtn.style.cssText += ';padding:4px 10px;font-size:16px;flex-shrink:0;';
      if (pu.cost>rem || curCount>=Data.POWERUP_CAP) addBtn.disabled=true;

      card.append(iconBox, info, costEl, addBtn);
      return card;
    }

    function rosterRow(name, cost, color, onRemove) {
      const row = el('div'); row.className='roster-row';
      const rm = txBtn('−', onRemove); rm.style.cssText+=';padding:2px 8px;font-size:15px;';
      const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'12px',
        color, flex:'1', letterSpacing:'1px' });
      nm.textContent = name;
      const cs = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#d4b820' });
      cs.textContent = cost+'pts.';
      row.append(rm, nm, cs);
      return row;
    }

    function enter()   { rebuildUI(); }
    function update()  {}
    function render()  {}
    function destroy() {}

    return { enter, update, render, destroy };
  }

  // ──────────────────────────────────────────────────────────
  // BATTLE SCREEN
  // ──────────────────────────────────────────────────────────
  function Battle(mode, teamId, roster, powerups) {
    let tooltipData = null;
    let tooltipPos  = { x:0, y:0 };
    let menuOpen    = false;
    let menuTab     = 'roster';
    let gameOver    = false;

    function cm(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      return { mx:(e.clientX-rect.left)*(1280/rect.width), my:(e.clientY-rect.top)*(720/rect.height) };
    }

    function handleClick(e) {
      if (menuOpen || gameOver) return;
      const state = Game.getState(); if (!state) return;
      const ph = state.phase;
      if (ph===Game.PHASE.ENEMY || ph===Game.PHASE.OVER) return;
      const {mx,my} = cm(e);
      const tile = Board.tileAtPoint(mx, my); if (!tile) return;
      const {col,row} = tile;

      if (state.puState !== Game.PUSTATE.NONE) {
        if (Game.handlePowerupClick(col,row)) rebuildUI();
        return;
      }

      const tileIdx = Board.idx(col,row);
      const hl      = state.highlights[tileIdx];

      if (ph===Game.PHASE.MOVE) {
        if (hl==='move' && state.selectedUnit) {
          Game.moveUnit(state.selectedUnit, col, row, () => rebuildUI());
        } else {
          const u = Game.unitAt(col,row);
          if (u && u.side==='player') Game.selectUnit(u);
          else Game.clearSelection();
        }
      } else if (ph===Game.PHASE.ATTACK) {
        if (hl==='attack' && state.selectedUnit) {
          Game.attackTarget(state.selectedUnit, col, row); rebuildUI();
        } else {
          const u = Game.unitAt(col,row);
          if (u && u.side==='player' && !u.attackedThisTurn && !u.stunned) Game.selectUnit(u);
          else Game.clearSelection();
        }
      }
    }

    function handleMove(e) {
      if (menuOpen) { tooltipData=null; return; }
      const {mx,my} = cm(e);
      tooltipPos={x:mx,y:my};
      const tile = Board.tileAtPoint(mx,my);
      tooltipData = tile ? Game.getTooltipFor(tile.col,tile.row) : null;
    }

    function enter() {
      Game.start({ mode, playerTeam:teamId, playerRoster:roster, playerPowerups:powerups });
      const state = Game.getState();
      state.onPhaseChange = () => rebuildUI();
      state.onGameOver = (winner,reason) => {
        gameOver=true;
        setTimeout(()=>showEndOverlay(winner,reason), 900);
      };
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      rebuildUI();
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }
    function update(dt) { Game.update(dt); }
    function render(ctx) {
      // Same bg as team select
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.36);
      Game.render(ctx);
      if (tooltipData && !menuOpen) drawTooltip(ctx, tooltipPos.x, tooltipPos.y, tooltipData);
    }

    function rebuildUI() {
      if (gameOver) return;
      const ui = E.getUI(); ui.innerHTML='';
      const state = Game.getState(); if (!state) return;
      const ph         = state.phase;
      const playerTurn = ph===Game.PHASE.MOVE || ph===Game.PHASE.ATTACK;
      const aiTurn     = ph===Game.PHASE.ENEMY;

      // ── Top bar ─────────────────────────────────────────
      const top = el('div', {
        position:'absolute', top:'0', left:'0', right:'0', height:'48px',
        background:'rgba(2,7,14,.94)', borderBottom:'1px solid #0e1c28',
        display:'flex', alignItems:'center', padding:'0 14px', gap:'8px', zIndex:'10'
      });

      const modeEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'14px',
        letterSpacing:'3px', color:'#6a8898', marginRight:'10px' });
      modeEl.textContent = mode==='ctf' ? 'CAPTURE THE FLAG' : 'MELEE';
      top.appendChild(modeEl);

      const mv = phaseBtn('MOVE',     'move',    ph===Game.PHASE.MOVE,   !playerTurn);
      const at = phaseBtn('ATTACK',   'attack',  ph===Game.PHASE.ATTACK, !playerTurn);
      const et = phaseBtn('END TURN', 'endturn', false,                  !playerTurn);
      mv.addEventListener('click', ()=>{ if(ph!==Game.PHASE.MOVE){Game.cancelPowerup();Game.setPhase(Game.PHASE.MOVE);} });
      at.addEventListener('click', ()=>{ if(ph!==Game.PHASE.ATTACK){Game.cancelPowerup();Game.setPhase(Game.PHASE.ATTACK);} });
      et.addEventListener('click', ()=>{ Game.clearSelection();Game.cancelPowerup();Game.endPlayerTurn(); });
      top.append(mv,at,et);

      if (playerTurn) {
        const mp = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px',
          color:'#2e4858', borderLeft:'1px solid #0e1c28', paddingLeft:'10px', marginLeft:'4px' });
        mp.textContent = `MOVES: ${state.movePool}`;
        top.appendChild(mp);
      }
      if (aiTurn) {
        const al = el('div', { fontFamily:'Iceberg,monospace', fontSize:'12px', color:'#c83030', marginLeft:'8px' });
        al.textContent = 'ENEMY TURN...';
        top.appendChild(al);
      }
      top.appendChild(el('div',{flex:'1'}));
      const turnEl = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#2a3a48' });
      turnEl.textContent='TURN '+state.turn;
      top.appendChild(turnEl);
      const backBtn2 = txBtn('BACK', ()=>E.setScreen(TeamSelect(mode)));
      backBtn2.style.fontSize='11px';
      const menuBtn2 = txBtn('MENU', ()=>{ menuOpen=true; rebuildUI(); });
      menuBtn2.style.fontSize='11px';
      top.append(backBtn2, menuBtn2);
      ui.appendChild(top);

      // ── Bottom power-up bar ──────────────────────────────
      const bot = el('div', {
        position:'absolute', bottom:'0', left:'0', right:'0', height:'52px',
        background:'rgba(2,7,14,.92)', borderTop:'1px solid #0e1c28',
        display:'flex', alignItems:'center', padding:'0 18px', gap:'14px', zIndex:'10'
      });
      const puLbl = el('div',{fontFamily:'Iceberg,monospace',fontSize:'10px',letterSpacing:'2px',color:'#2a3e50'});
      puLbl.textContent='POWER UPS'; bot.appendChild(puLbl);

      state.playerPowerups.forEach(pid=>{
        const ico=el('div'); ico.className='pu-icon';
        ico.textContent=puIconChar(pid); ico.title=Data.POWERUPS[pid].name;
        const isActive = state.puData&&state.puData.puId===pid&&state.puState!==Game.PUSTATE.NONE;
        if(isActive) ico.classList.add('active');
        if(playerTurn) {
          ico.addEventListener('click',()=>{ isActive?Game.cancelPowerup():Game.activatePowerup(pid); rebuildUI(); });
        } else { ico.style.opacity='0.28'; ico.style.pointerEvents='none'; }
        bot.appendChild(ico);
      });
      if(!state.playerPowerups.length){const n=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'10px',color:'#182030'});n.textContent='none';bot.appendChild(n);}

      bot.appendChild(el('div',{flex:'1'}));
      const eLbl=el('div',{fontFamily:'Iceberg,monospace',fontSize:'10px',letterSpacing:'2px',color:'#2a3e50'});
      eLbl.textContent='ENEMY POWER UPS'; bot.appendChild(eLbl);
      state.aiPowerups.forEach(pid=>{
        const ico=el('div'); ico.className='pu-icon enemy';
        ico.textContent=puIconChar(pid); ico.title=Data.POWERUPS[pid].name;
        bot.appendChild(ico);
      });
      if(!state.aiPowerups.length){const n=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'10px',color:'#182030'});n.textContent='none';bot.appendChild(n);}
      ui.appendChild(bot);

      if(menuOpen) buildMenuOverlay(ui, state);
    }

    function buildMenuOverlay(ui, state) {
      const overlay=el('div'); overlay.className='tx-overlay';
      overlay.addEventListener('click',e=>{ if(e.target===overlay){menuOpen=false;rebuildUI();} });

      const panel=el('div'); panel.className='tx-panel';
      Object.assign(panel.style,{width:'560px',minHeight:'380px',display:'flex',flexDirection:'column'});

      const tabBar=el('div',{display:'flex',borderBottom:'1px solid #0c1c2c'});
      ['ROSTER','SETTINGS','RULES'].forEach(tab=>{
        const t=document.createElement('button'); t.className='menu-tab';
        if(menuTab===tab.toLowerCase()) t.classList.add('active');
        t.textContent=tab;
        t.addEventListener('click',()=>{menuTab=tab.toLowerCase();rebuildUI();});
        tabBar.appendChild(t);
      });
      const closeBtn=txBtn('✕',()=>{menuOpen=false;rebuildUI();});
      closeBtn.style.cssText+=';margin-left:auto;border:none;padding:10px 14px;';
      tabBar.appendChild(closeBtn);

      const content=el('div',{padding:'16px 18px',flex:'1',overflowY:'auto'});
      if(menuTab==='roster'){
        ['player','ai'].forEach(side=>{
          const h=el('div',{fontFamily:'Iceberg,monospace',fontSize:'11px',letterSpacing:'2px',
            color:side==='player'?'#2e6888':'#882e2e',marginBottom:'8px',marginTop:side==='ai'?'14px':'0'});
          h.textContent=side==='player'?'YOUR UNITS':'ENEMY UNITS'; content.appendChild(h);
          Game.liveUnits(side).forEach(u=>{
            const row=el('div',{display:'flex',gap:'10px',alignItems:'center',padding:'4px 0',borderBottom:'1px solid #0a1820'});
            const nm=el('div',{fontFamily:'Iceberg,monospace',fontSize:'12px',color:side==='player'?(u.team.color||'#b0c8d4'):'#b04040',flex:'1'});
            nm.textContent=u.name;
            const hp=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'10px',color:u.hp>u.maxHp*.5?'#3ac858':'#c83030'});
            hp.textContent=`${u.hp}/${u.maxHp} HP`;
            const conds=[]; if(u.stunned)conds.push('STUNNED'); if(u.poisoned)conds.push('POISONED'); if(u.onFire)conds.push('ON FIRE');
            const cd=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'9px',color:'#b07828'});
            cd.textContent=conds.join(' ');
            row.append(nm,hp,cd); content.appendChild(row);
          });
        });
      } else if(menuTab==='settings'){
        const p=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'11px',color:'#3a5868',lineHeight:'1.8'});
        p.textContent='Volume controls coming in a future update.';
        content.appendChild(p);
        const q=txBtn('QUIT TO TITLE',()=>{E.setScreen(Title());E.playMusic('score');});
        q.style.marginTop='18px'; content.appendChild(q);
      } else {
        const pre=el('pre',{fontFamily:'RobotoMono,monospace',fontSize:'10px',color:'#5a7888',lineHeight:'1.7',whiteSpace:'pre-wrap'});
        pre.textContent=['TURN STRUCTURE','  MOVE phase → ATTACK phase → END TURN','  10 shared movement points per side per turn.','','MOVEMENT','  Select a unit then click a blue-highlighted tile.','','COMBAT','  Select a unit in ATTACK phase, click a red-highlighted enemy.','  Roll d10+ATK vs d10+DEF. Hit only if attack total > defense total.','','POWER-UPS','  Click a power-up icon, then follow the on-board prompts.','','MELEE WIN: Eliminate all enemy units.','CTF WIN: Carry the flag to your own base (top-left).'].join('\n');
        content.appendChild(pre);
      }
      const inner=el('div',{display:'flex',flex:'1'}); inner.append(tabBar,content);
      panel.appendChild(inner);
      overlay.appendChild(panel); ui.appendChild(overlay);
    }

    function showEndOverlay(winner, reason) {
      const ui=E.getUI();
      const overlay=el('div'); overlay.className='tx-overlay';
      const panel=el('div'); panel.className='tx-panel';
      Object.assign(panel.style,{textAlign:'center',padding:'50px 44px',minWidth:'400px'});
      const isWin=winner==='player', isDraw=winner==='draw';
      const col=isWin?'#2ad860':isDraw?'#c8c050':'#d82828';
      const resultEl=el('div',{fontFamily:'Iceberg,monospace',fontSize:'44px',letterSpacing:'7px',
        color:col,textShadow:`0 0 30px ${col}`,marginBottom:'14px'});
      resultEl.textContent=isWin?'VICTORY':isDraw?'DRAW':'DEFEAT';
      const rEl=el('div',{fontFamily:'RobotoMono,monospace',fontSize:'12px',color:'#4a6878',marginBottom:'36px'});
      rEl.textContent=reason;
      if(isWin) E.playMusic('win'); else if(!isDraw) E.playMusic('loss');
      const again=txBtn('PLAY AGAIN',()=>E.setScreen(Battle(mode,teamId,roster,powerups)));
      again.classList.add('primary');
      const home=txBtn('MAIN MENU',()=>{E.setScreen(Title());E.playMusic('score');});
      const br=el('div',{display:'flex',justifyContent:'center',gap:'12px'});
      br.append(again,home);
      panel.append(resultEl,rEl,br); overlay.appendChild(panel); ui.appendChild(overlay);
    }

    function drawTooltip(ctx, mx, my, data) {
      const W=192,H=126; let tx=mx+15,ty=my-H/2;
      if(tx+W>1272) tx=mx-W-15; if(ty<6) ty=6; if(ty+H>714) ty=714-H;
      ctx.save();
      ctx.fillStyle='rgba(2,10,18,.96)'; ctx.strokeStyle=data.color||'#1e3848'; ctx.lineWidth=1.5;
      ctx.fillRect(tx,ty,W,H); ctx.strokeRect(tx,ty,W,H);
      const px=tx+10;
      ctx.font='bold 12px Iceberg'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle=data.color||'#c0d4e0'; ctx.fillText(data.name,px,ty+15);
      const d=(t,c,y)=>{ctx.font='10px RobotoMono';ctx.fillStyle=c;ctx.fillText(t,px,y);};
      d(`HP ${data.hp}`,'#3ac858',ty+32);
      d(`SPD ${data.spd}   RNG ${data.rng}`,'#7aaab8',ty+47);
      d(`ATK ${data.atk}   DEF ${data.def}   DMG ${data.dmg}`,'#7aaab8',ty+62);
      const conds=[]; if(data.stunned)conds.push('STUNNED'); if(data.poisoned)conds.push('POISONED'); if(data.onFire)conds.push('ON FIRE');
      if(conds.length) d(conds.join(' · '),'#c07828',ty+77);
      d(data.side==='player'?'◀ FRIENDLY':'▶ ENEMY',data.side==='player'?'#2e7afa':'#fa2e2e',ty+94);
      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // Shared utilities
  // ──────────────────────────────────────────────────────────
  function txBtn(label, onClick) {
    const b=document.createElement('button'); b.className='tx-btn';
    b.textContent=label; b.addEventListener('click',onClick); return b;
  }
  function phaseBtn(label,cls,isActive,isDimmed) {
    const b=document.createElement('button'); b.className=`phase-btn ${cls}`;
    if(isActive) b.classList.add('active'); if(isDimmed) b.classList.add('dimmed');
    b.textContent=label; return b;
  }
  function sectionHeader(parent, text, extraStyle) {
    const h=el('div',Object.assign({fontFamily:'Iceberg,monospace',fontSize:'11px',
      letterSpacing:'3px',color:'#2e4258',marginBottom:'9px',paddingBottom:'5px',
      borderBottom:'1px solid #0e1c2c'},extraStyle||{}));
    h.textContent=text; parent.appendChild(h);
  }
  function unitIconChar(id) {
    return {infantry:'✦',sniper:'◎',elite:'★',grenadier:'⊕',shock_trooper:'⊞',
            slasher:'⚔',assassin:'◎',acid_thrower:'⊕',grunt:'✦',sharpshooter:'◎',fire_caller:'⊕'}[id]||'●';
  }
  function puIconChar(id) {
    return id==='med_pack'?'✚':id==='mine'?'✦':id==='teleporter'?'⟳':'?';
  }
  function specialLabel(s) {
    return {splash:'SPLASH DAMAGE',stun:'STUN ON HIT',poison:'POISON ON HIT',
            acid_tile:'ACID TILE ON HIT',fire_dot:'FIRE DOT ON HIT',column_fire:'COLUMN FIRE'}[s]||s;
  }

  return { Title, GameSelect, TeamSelect, SquadBuilder, Battle };
})();
