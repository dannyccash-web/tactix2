// ============================================================
// screens.js  —  All screens, styled to match the visual guide
// ============================================================

const Screens = (() => {

  const E = TactixEngine;

  // ── DOM helpers ───────────────────────────────────────────
  function el(tag, styles, attrs) {
    const d = document.createElement(tag);
    if (styles) Object.assign(d.style, styles);
    if (attrs)  Object.assign(d, attrs);
    return d;
  }

  // ── Shared CSS ────────────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('tx-styles')) return;
    const s = document.createElement('style');
    s.id = 'tx-styles';
    s.textContent = `
      .tx-btn {
        font-family:'Iceberg',monospace;
        font-size:13px; letter-spacing:2px;
        color:#b0ccd8; background:transparent;
        border:1.5px solid #3a5868;
        padding:7px 20px; cursor:pointer;
        transition:background .12s,border-color .12s,color .12s;
        text-transform:uppercase;
      }
      .tx-btn:hover { background:rgba(58,138,168,0.22); border-color:#6aacca; color:#dff0fa; }
      .tx-btn.primary { border-color:#2a8a50; color:#3ad870; }
      .tx-btn.primary:hover { background:rgba(42,138,80,0.22); border-color:#4aee88; }
      .tx-btn:disabled { opacity:.3; pointer-events:none; }

      .phase-btn {
        font-family:'Iceberg',monospace; font-size:13px; letter-spacing:2px;
        padding:7px 22px; cursor:pointer; border:1.5px solid; background:transparent;
        transition:background .1s, opacity .15s;
      }
      .phase-btn.move   { border-color:#2a8a2a; color:#4ad84a; }
      .phase-btn.attack { border-color:#b8941a; color:#e8c040; }
      .phase-btn.endturn{ border-color:#8a3a3a; color:#d86060; }
      .phase-btn:hover  { background:rgba(255,255,255,.07); }
      .phase-btn.dimmed { opacity:.28; pointer-events:none; }
      .phase-btn.active { background:rgba(255,255,255,.1); }

      .pu-icon {
        width:34px; height:34px; border-radius:50%;
        border:1.5px solid #2e4858;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; font-size:14px; color:#90b8c8;
        background:rgba(8,20,30,.85);
        transition:border-color .12s,background .12s;
        user-select:none;
      }
      .pu-icon:hover  { border-color:#6aaac8; background:rgba(20,55,80,.8); }
      .pu-icon.active { border-color:#f0e040; background:rgba(50,42,0,.8); color:#f0e040; }
      .pu-icon.enemy  { opacity:.6; cursor:default; }

      .tx-overlay {
        position:absolute; inset:0;
        background:rgba(0,0,0,.72);
        display:flex; align-items:center; justify-content:center;
        z-index:50;
      }
      .tx-panel {
        background:rgba(5,14,22,.97);
        border:1px solid #1e3848;
      }
      .menu-tab-btn {
        font-family:'Iceberg',monospace; font-size:14px; letter-spacing:2px;
        padding:14px 24px; background:transparent;
        border:none; border-right:1px solid #162430;
        color:#364e5c; cursor:pointer;
        transition:color .12s;
      }
      .menu-tab-btn:hover { color:#8ab0c0; }
      .menu-tab-btn.active { color:#c8dce8; border-bottom:2px solid #4a90b0; }

      .squad-card {
        display:flex; align-items:center; gap:12px;
        padding:10px 12px; margin-bottom:7px;
        background:rgba(8,20,32,.7);
        border:1px solid #182838;
        transition:background .1s;
      }
      .squad-card:hover { background:rgba(20,50,78,.7); }
      .roster-row {
        display:flex; align-items:center; gap:10px;
        padding:6px 10px; margin-bottom:5px;
        background:rgba(8,20,32,.6);
        border:1px solid #0e1e2c;
      }
    `;
    document.head.appendChild(s);
  })();

  // ──────────────────────────────────────────────────────────
  // TITLE SCREEN
  // ──────────────────────────────────────────────────────────
  function Title() {
    let fade = 0;

    function handleClick() {
      E.unlockAudio();
      E.setScreen(GameSelect());
    }

    function enter() {
      E.playMusic('score');
      E.getCanvas().addEventListener('click', handleClick, { once: true });
    }

    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
    }

    function update(dt) {
      fade = Math.min(1, fade + dt * 1.5);
    }

    function render(ctx) {
      // Full-bleed background
      E.drawBackground(ctx, 'bg1', 1);

      ctx.save();
      ctx.globalAlpha = fade;

      // Logo centered
      const logo = E.getImage('logo');
      if (logo) {
        const lw = 720;
        const lh = logo.height * (lw / logo.width);
        ctx.drawImage(logo, (1280 - lw) / 2, 112, lw, lh);
      }

      // "TURN-BASED COMBAT" subtitle
      ctx.font = '28px Iceberg';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#567286';
      ctx.letterSpacing = '4px';
      ctx.fillText('TURN-BASED COMBAT', 640, 392);

      // START button (styled box like the guide)
      const bw = 220, bh = 56;
      const bx = 640 - bw/2, by = 462;
      ctx.fillStyle = 'rgba(40,60,75,.85)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#5a8898';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.font = '24px Iceberg';
      ctx.fillStyle = '#c8dce8';
      ctx.fillText('START', 640, by + bh/2);

      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // GAME SELECT
  // ──────────────────────────────────────────────────────────
  function GameSelect() {
    let fade = 0;
    let hovered = null;

    const MELEE_CX = 378, CTF_CX = 856, CARD_CY = 430, CARD_R = 140;

    function handleClick(e) {
      const {mx, my} = canvasMouse(e);
      if (Math.hypot(mx - MELEE_CX, my - CARD_CY) < CARD_R) E.setScreen(TeamSelect('melee'));
      else if (Math.hypot(mx - CTF_CX, my - CARD_CY) < CARD_R) E.setScreen(TeamSelect('ctf'));
    }

    function handleMove(e) {
      const {mx, my} = canvasMouse(e);
      if      (Math.hypot(mx-MELEE_CX, my-CARD_CY) < CARD_R) hovered = 'melee';
      else if (Math.hypot(mx-CTF_CX,   my-CARD_CY) < CARD_R) hovered = 'ctf';
      else hovered = null;
    }

    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      buildTopBar('GAME SELECT', () => E.setScreen(Title()));
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }

    function update(dt) { fade = Math.min(1, fade + dt*2); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.52);
      ctx.save(); ctx.globalAlpha = fade;

      ctx.font = '28px Iceberg'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#c8dce8';
      ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=12;
      ctx.fillText('CHOOSE YOUR GAME', 640, 175);
      ctx.shadowBlur=0;

      drawModeHex(ctx, MELEE_CX, CARD_CY, CARD_R, 'melee_icon', 'MELEE', hovered==='melee');
      drawModeHex(ctx, CTF_CX,   CARD_CY, CARD_R, 'capture_the_flag_icon', 'CAPTURE THE FLAG', hovered==='ctf');

      ctx.restore();
    }

    function drawModeHex(ctx, cx, cy, r, iconKey, label, hot) {
      ctx.save();
      hexPath6(ctx, cx, cy, r);
      ctx.fillStyle = hot ? 'rgba(30,65,95,.82)' : 'rgba(12,26,40,.78)';
      ctx.fill();
      if (hot) { ctx.shadowColor='rgba(80,160,210,.6)'; ctx.shadowBlur=22; }
      ctx.strokeStyle = hot ? '#5aaccc' : '#2a4a60';
      ctx.lineWidth = hot ? 2.5 : 1.75;
      ctx.stroke();
      ctx.shadowBlur=0;

      const icon = E.getImage(iconKey);
      if (icon) {
        const iw = 116;
        const ih = 116;
        ctx.save();
        hexPath6(ctx, cx, cy, r - 10);
        ctx.clip();
        ctx.globalAlpha = hot ? 1 : 0.96;
        ctx.drawImage(icon, cx - iw / 2, cy - 88, iw, ih);
        ctx.restore();
      }

      ctx.font='18px Iceberg';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle = hot ? '#fff' : '#b8d4e0';
      ctx.fillText(label, cx, cy + 54);
      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // TEAM SELECT
  // ──────────────────────────────────────────────────────────
  function TeamSelect(mode) {
    let fade = 0;
    let hovered = null;

    // 5 teams in the arrangement shown in the visual guide:
    // Virent(top-left), Magma(top-right), Azure(mid-left), Phlox(center), Vermillion(mid-right)
    const teams = Object.values(Data.TEAMS);
    const positions = [
      { x: 330, y: 310 },   // Virent
      { x: 760, y: 295 },   // Magma  (visually between row1 and row2)
      { x: 182, y: 470 },   // Azure
      { x: 548, y: 450 },   // Phlox
      { x: 950, y: 450 },   // Vermillion
    ];
    const R = 100;

    function handleClick(e) {
      const {mx,my} = canvasMouse(e);
      teams.forEach((team, i) => {
        const p = positions[i];
        if (p && Math.hypot(mx-p.x, my-p.y) < R) {
          E.setScreen(SquadBuilder(mode, team.id));
        }
      });
    }
    function handleMove(e) {
      const {mx,my} = canvasMouse(e);
      hovered = null;
      teams.forEach((team, i) => {
        const p = positions[i];
        if (p && Math.hypot(mx-p.x, my-p.y) < R) hovered = team.id;
      });
    }

    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      buildTopBar('TEAM SELECT', () => E.setScreen(GameSelect(mode)));
    }
    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }

    function update(dt) { fade = Math.min(1, fade + dt*2); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.48);
      ctx.save(); ctx.globalAlpha = fade;

      ctx.font='28px Iceberg'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#c8dce8';
      ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=12;
      ctx.fillText('SELECT YOUR TEAM', 640, 110);
      ctx.shadowBlur=0;

      teams.forEach((team, i) => {
        const p = positions[i]; if (!p) return;
        const hot = hovered === team.id;
        drawTeamHex(ctx, p.x, p.y, R, team, hot);
      });

      ctx.restore();
    }

    function drawTeamHex(ctx, cx, cy, r, team, hot) {
      const portrait = E.getImage(team.portrait);
      ctx.save();

      // Hex background
      hexPath6(ctx, cx, cy, hot ? r+4 : r);
      ctx.fillStyle = `rgba(8,18,28,.75)`;
      ctx.fill();
      if (hot) {
        ctx.shadowColor = team.glowColor || team.color;
        ctx.shadowBlur = 24;
      }
      ctx.strokeStyle = hot ? team.color : '#243444';
      ctx.lineWidth = hot ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Portrait clipped inside hex
      if (portrait) {
        ctx.save();
        hexPath6(ctx, cx, cy, hot ? r+4 : r);
        ctx.clip();
        const sz = (hot ? r+4 : r) * 2.1;
        ctx.drawImage(portrait, cx - sz/2, cy - sz * 0.6, sz, sz);
        ctx.restore();
      }

      // Name label at bottom of hex
      ctx.font = `${hot?15:13}px Iceberg`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = hot ? '#fff' : '#b8d0dc';
      ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 8;
      ctx.fillText(team.name, cx, cy + r * 0.74);
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

    function addUnit(id) {
      if (totalCost() + Data.UNITS[id].cost > Data.SQUAD_BUDGET) return;
      roster.push(id); buildUI();
    }
    function removeUnit(i) { roster.splice(i,1); buildUI(); }
    function addPowerup(id) {
      if (powerups.length >= Data.POWERUP_CAP) return;
      if (totalCost() + Data.POWERUPS[id].cost > Data.SQUAD_BUDGET) return;
      powerups.push(id); buildUI();
    }
    function removePowerup(i) { powerups.splice(i,1); buildUI(); }

    function buildUI() {
      const ui = E.getUI(); ui.innerHTML = '';
      const cost = totalCost();
      const rem  = Data.SQUAD_BUDGET - cost;
      const canReady = roster.length > 0;

      // ── Top nav bar ───────────────────────────────────────
      const nav = el('div', {
        position:'absolute', top:'0', left:'0', right:'0', height:'48px',
        background:'rgba(3,10,18,.95)', borderBottom:'1px solid #162434',
        display:'flex', alignItems:'center', padding:'0 24px', gap:'16px'
      });

      const title = el('div', {
        fontFamily:'Iceberg,monospace', fontSize:'16px', letterSpacing:'4px', color:'#b8ccd8'
      });
      title.textContent = 'BUILD YOUR SQUAD';

      const pts = el('div', {
        fontFamily:'RobotoMono,monospace', fontSize:'12px',
        color: rem >= 0 ? '#f0d34f' : '#c84444', marginLeft:'auto'
      });
      pts.textContent = `${cost} / ${Data.SQUAD_BUDGET} PTS`;

      const backBtn = txBtn('BACK', () => E.setScreen(TeamSelect(mode)));
      const readyBtn = txBtn('READY', () => {
        E.setScreen(Battle(mode, teamId, [...roster], [...powerups]));
      });
      readyBtn.classList.add('primary');
      if (!canReady) readyBtn.disabled = true;

      nav.append(title, pts, backBtn, readyBtn);
      ui.appendChild(nav);

      // ── Two-column layout ─────────────────────────────────
      const body = el('div', {
        position:'absolute', top:'48px', left:'0', right:'0', bottom:'0',
        display:'flex'
      });

      // Left: available pool
      const left = el('div', {
        width:'42%', padding:'18px 20px',
        background:'rgba(4,12,20,.90)',
        borderRight:'1px solid #162434', overflowY:'auto'
      });

      sectionHeader(left, 'SOLDIERS');
      team.units.forEach(uid => left.appendChild(buildUnitCard(uid, rem)));

      sectionHeader(left, 'POWER UPS', {marginTop:'18px'});
      Object.values(Data.POWERUPS).forEach(pu =>
        left.appendChild(buildPUCard(pu, rem, powerups.length))
      );

      // Right: your squad
      const right = el('div', {
        flex:'1', padding:'18px 20px',
        background:'rgba(5,14,24,.88)', overflowY:'auto'
      });

      const squadHdr = el('div', {
        fontFamily:'Iceberg,monospace', fontSize:'16px', letterSpacing:'3px',
        color:'#d6e6ef', marginBottom:'14px', display:'flex', justifyContent:'space-between'
      });
      squadHdr.innerHTML = `<span>YOUR SQUAD</span><span style="color:${rem>=0?'#f0d34f':'#c84444'}">${cost}/${Data.SQUAD_BUDGET} PTS</span>`;
      right.appendChild(squadHdr);

      if (!roster.length && !powerups.length) {
        const hint = el('div', {
          fontFamily:'RobotoMono,monospace', fontSize:'11px', color:'#283848', marginTop:'20px'
        });
        hint.textContent = 'Add soldiers and power-ups from the left panel.';
        right.appendChild(hint);
      }

      roster.forEach((uid, i) => {
        const u = Data.UNITS[uid];
        right.appendChild(rosterRow(u.name, u.cost, team.color, () => removeUnit(i)));
      });

      if (powerups.length) {
        sectionHeader(right, 'POWER UPS', {marginTop:'14px'});
        powerups.forEach((pid, i) => {
          const pu = Data.POWERUPS[pid];
          right.appendChild(rosterRow(pu.name, pu.cost, '#c0a040', () => removePowerup(i)));
        });
      }

      // READY button below squad panel
      const readyRow = el('div', {
        position:'absolute', bottom:'68px', right:'28px'
      });
      const readyBig = txBtn('READY', () => {
        if (!canReady) return;
        E.setScreen(Battle(mode, teamId, [...roster], [...powerups]));
      });
      readyBig.classList.add('primary');
      readyBig.style.cssText += ';font-size:15px;padding:10px 36px;';
      if (!canReady) readyBig.disabled = true;
      readyRow.appendChild(readyBig);
      ui.appendChild(readyRow);

      body.append(left, right);
      ui.appendChild(body);
    }

    function buildUnitCard(uid, rem) {
      const u = Data.UNITS[uid];
      const card = el('div'); card.className = 'squad-card';

      const iconHex = buildHexIcon(unitIconKey(u.id), team.color, false);

      const info = el('div', { flex:'1' });
      const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'15px', color:'#d6e6ef', letterSpacing:'1px' });
      nm.textContent = u.name;
      const st = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px', color:'#7e97a6', marginTop:'2px' });
      st.textContent = `SPEED ${u.speed}  RANGE ${u.range}  ATK +${u.atk}  DEF +${u.def}  DMG ${u.dmg}  HP ${u.hp}`;
      info.append(nm, st);
      if (u.special) {
        const sp = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px', color:team.color, marginTop:'2px' });
        sp.textContent = specialLabel(u.special);
        info.appendChild(sp);
      }

      const costEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'15px', color: u.cost<=rem?'#f0d34f':'#c84444', flexShrink:'0' });
      costEl.textContent = u.cost + 'pts.';

      const addBtn = txBtn('+', () => addUnit(uid));
      addBtn.style.cssText += ';padding:4px 11px;font-size:16px;flex-shrink:0;';
      if (u.cost > rem) addBtn.disabled = true;

      card.append(iconHex, info, costEl, addBtn);
      return card;
    }

    function buildPUCard(pu, rem, curCount) {
      const card = el('div'); card.className = 'squad-card';

      const iconHex = buildHexIcon(powerupIconKey(pu.id), team.color, true);

      const info = el('div', { flex:'1' });
      const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'15px', color:'#ffffff', letterSpacing:'1px' });
      nm.textContent = pu.name;
      const desc = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px', color:'#ffffff', marginTop:'2px' });
      desc.textContent = pu.desc;
      info.append(nm, desc);

      const costEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'15px', color: pu.cost<=rem?'#f0d34f':'#c84444', flexShrink:'0' });
      costEl.textContent = pu.cost + 'pts.';

      const addBtn = txBtn('+', () => addPowerup(pu.id));
      addBtn.style.cssText += ';padding:4px 11px;font-size:16px;flex-shrink:0;';
      if (pu.cost > rem || curCount >= Data.POWERUP_CAP) addBtn.disabled = true;

      card.append(iconHex, info, costEl, addBtn);
      return card;
    }

    function rosterRow(name, cost, color, onRemove) {
      const row = el('div'); row.className = 'roster-row';
      const rm  = txBtn('−', onRemove); rm.style.cssText += ';padding:2px 9px;font-size:15px;';
      const nm  = el('div', { fontFamily:'Iceberg,monospace', fontSize:'12px', color, flex:'1', letterSpacing:'1px' });
      nm.textContent = name;
      const cs  = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#4a6070' });
      cs.textContent = cost + 'pts.';
      row.append(rm, nm, cs);
      return row;
    }

    function enter() { buildUI(); }
    function update() {}
    function render() {}
    function destroy() {}

    return { enter, update, render, destroy };
  }

  // ──────────────────────────────────────────────────────────
  // BATTLE SCREEN
  // ──────────────────────────────────────────────────────────
  function Battle(mode, teamId, roster, powerups) {
    let tooltipData = null;
    let tooltipPos  = { x: 0, y: 0 };
    let menuOpen    = false;
    let menuTab     = 'roster';
    let gameOver    = false;

    // ── Canvas events ─────────────────────────────────────
    function handleClick(e) {
      if (menuOpen || gameOver) return;
      const state = Game.getState();
      if (!state) return;
      const ph = state.phase;
      if (ph === Game.PHASE.ENEMY || ph === Game.PHASE.OVER) return;

      const {mx, my} = canvasMouse(e);
      const tile = Board.tileAtPoint(mx, my);
      if (!tile) return;
      const { col, row } = tile;

      // Powerup flow first
      if (state.puState !== Game.PUSTATE.NONE) {
        const consumed = Game.handlePowerupClick(col, row);
        if (consumed) buildUI();
        return;
      }

      const tileIdx = Board.idx(col, row);
      const hl      = state.highlights[tileIdx];

      if (ph === Game.PHASE.MOVE) {
        if (hl === 'move' && state.selectedUnit) {
          Game.moveUnit(state.selectedUnit, col, row, () => buildUI());
        } else {
          const unit = Game.unitAt(col, row);
          if (unit && unit.side === 'player') Game.selectUnit(unit);
          else Game.clearSelection();
        }
      } else if (ph === Game.PHASE.ATTACK) {
        if (hl === 'attack' && state.selectedUnit) {
          Game.attackTarget(state.selectedUnit, col, row);
          buildUI();
        } else {
          const unit = Game.unitAt(col, row);
          if (unit && unit.side === 'player' && !unit.attackedThisTurn && !unit.stunned)
            Game.selectUnit(unit);
          else Game.clearSelection();
        }
      }
    }

    function handleMove(e) {
      if (menuOpen) { tooltipData = null; return; }
      const {mx, my} = canvasMouse(e);
      tooltipPos = { x: mx, y: my };
      const tile = Board.tileAtPoint(mx, my);
      tooltipData = tile ? Game.getTooltipFor(tile.col, tile.row) : null;
    }

    // ── Screen lifecycle ──────────────────────────────────
    function enter() {
      Game.start({ mode, playerTeam: teamId, playerRoster: roster, playerPowerups: powerups });
      const state = Game.getState();
      state.onPhaseChange = () => buildUI();
      state.onGameOver = (winner, reason) => {
        gameOver = true;
        setTimeout(() => showEndOverlay(winner, reason), 900);
      };
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMove);
      buildUI();
    }

    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMove);
    }

    function update(dt) { Game.update(dt); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.38);
      Game.render(ctx);
      if (tooltipData && !menuOpen) drawTooltip(ctx, tooltipPos.x, tooltipPos.y, tooltipData);
    }

    // ── HUD ───────────────────────────────────────────────
    function buildUI() {
      if (gameOver) return;
      const ui = E.getUI(); ui.innerHTML = '';
      const state = Game.getState(); if (!state) return;

      const ph          = state.phase;
      const playerTurn  = ph === Game.PHASE.MOVE || ph === Game.PHASE.ATTACK;
      const aiTurn      = ph === Game.PHASE.ENEMY;

      // ── Top bar ───────────────────────────────────────
      const topBar = el('div', {
        position:'absolute', top:'0', left:'0', right:'0', height:'48px',
        background:'rgba(3,9,16,.93)', borderBottom:'1px solid #111e2a',
        display:'flex', alignItems:'center', padding:'0 16px', gap:'10px',
        zIndex:'10'
      });

      // Mode label (top-left)
      const modeLabel = el('div', {
        fontFamily:'Iceberg,monospace', fontSize:'15px', letterSpacing:'3px', color:'#7a9aaa',
        marginRight:'12px'
      });
      modeLabel.textContent = mode === 'ctf' ? 'CAPTURE THE FLAG' : 'MELEE';
      topBar.appendChild(modeLabel);

      // Phase buttons (MOVE | ATTACK | END TURN)
      const moveBtn   = phaseBtn('MOVE',     'move',    ph === Game.PHASE.MOVE,   !playerTurn);
      const attackBtn = phaseBtn('ATTACK',   'attack',  ph === Game.PHASE.ATTACK, !playerTurn);
      const endBtn    = phaseBtn('END TURN', 'endturn', false,                    !playerTurn);

      moveBtn.addEventListener('click', () => {
        if (ph !== Game.PHASE.MOVE) { Game.cancelPowerup(); Game.setPhase(Game.PHASE.MOVE); }
      });
      attackBtn.addEventListener('click', () => {
        if (ph !== Game.PHASE.ATTACK) { Game.cancelPowerup(); Game.setPhase(Game.PHASE.ATTACK); }
      });
      endBtn.addEventListener('click', () => {
        Game.clearSelection(); Game.cancelPowerup(); Game.endPlayerTurn();
      });

      topBar.append(moveBtn, attackBtn, endBtn);

      // Move pool indicator
      if (playerTurn) {
        const mp = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#3a6070',
          borderLeft:'1px solid #162430', paddingLeft:'12px', marginLeft:'2px' });
        mp.textContent = `MOVES: ${state.movePool}`;
        topBar.appendChild(mp);
      }

      if (aiTurn) {
        const al = el('div', { fontFamily:'Iceberg,monospace', fontSize:'13px', color:'#d86040',
          marginLeft:'8px' });
        al.textContent = 'ENEMY TURN...';
        topBar.appendChild(al);
      }

      // Spacer
      topBar.appendChild(el('div', { flex:'1' }));

      // Turn counter
      const turnEl = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#364858' });
      turnEl.textContent = `TURN ${state.turn}`;
      topBar.appendChild(turnEl);

      // BACK & MENU buttons (top-right, as in visual guide)
      const backBtn2 = txBtn('BACK', () => E.setScreen(TeamSelect(mode)));
      backBtn2.style.fontSize = '11px';
      const menuBtn2 = txBtn('MENU', () => { menuOpen = true; buildUI(); });
      menuBtn2.style.fontSize = '11px';
      topBar.append(backBtn2, menuBtn2);

      ui.appendChild(topBar);

      // ── Bottom power-up bar ────────────────────────────
      const puBar = el('div', {
        position:'absolute', bottom:'0', left:'0', right:'0', height:'52px',
        background:'rgba(3,9,16,.92)', borderTop:'1px solid #111e2a',
        display:'flex', alignItems:'center', padding:'0 20px', gap:'16px',
        zIndex:'10'
      });

      const puLabel = el('div', { fontFamily:'Iceberg,monospace', fontSize:'10px',
        letterSpacing:'2px', color:'#3a5060' });
      puLabel.textContent = 'POWER UPS';
      puBar.appendChild(puLabel);

      state.playerPowerups.forEach((pid) => {
        const ico = el('div'); ico.className = 'pu-icon';
        const puImg = E.getImage(powerupIconKey(pid));
        if (puImg) {
          const im = el('img', { src: puImg.src, draggable:false });
          im.style.width = '18px';
          im.style.height = '18px';
          im.style.objectFit = 'contain';
          ico.appendChild(im);
        }
        ico.title = Data.POWERUPS[pid].name;
        const active = state.puData && state.puData.puId === pid && state.puState !== Game.PUSTATE.NONE;
        if (active) ico.classList.add('active');
        if (playerTurn) {
          ico.addEventListener('click', () => {
            if (active) { Game.cancelPowerup(); buildUI(); }
            else        { Game.activatePowerup(pid); buildUI(); }
          });
        } else {
          ico.style.opacity = '0.3'; ico.style.pointerEvents = 'none';
        }
        puBar.appendChild(ico);
      });

      if (!state.playerPowerups.length) {
        const none = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#1e2e3c' });
        none.textContent = 'none';
        puBar.appendChild(none);
      }

      puBar.appendChild(el('div', { flex:'1' }));

      const enemyLabel = el('div', { fontFamily:'Iceberg,monospace', fontSize:'10px',
        letterSpacing:'2px', color:'#3a5060' });
      enemyLabel.textContent = 'ENEMY POWER UPS';
      puBar.appendChild(enemyLabel);

      state.aiPowerups.forEach(pid => {
        const ico = el('div'); ico.className = 'pu-icon enemy';
        ico.textContent = puIconChar(pid);
        ico.title = Data.POWERUPS[pid].name;
        puBar.appendChild(ico);
      });

      if (!state.aiPowerups.length) {
        const none = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px', color:'#1e2e3c' });
        none.textContent = 'none';
        puBar.appendChild(none);
      }

      ui.appendChild(puBar);

      // Menu overlay
      if (menuOpen) buildMenuOverlay(ui, state);
    }

    // ── Menu overlay (matches visual guide) ───────────────
    function buildMenuOverlay(ui, state) {
      const overlay = el('div'); overlay.className = 'tx-overlay';
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { menuOpen = false; buildUI(); }
      });

      const panel = el('div'); panel.className = 'tx-panel';
      Object.assign(panel.style, {
        width:'560px', minHeight:'380px', display:'flex', flexDirection:'column'
      });

      // Tab bar (left sidebar style as in guide)
      const tabSidebar = el('div', {
        display:'flex', flexDirection:'column',
        borderRight:'1px solid #0e1e2c', minWidth:'140px'
      });

      ['ROSTER','SETTINGS','RULES'].forEach(tab => {
        const t = el('button'); t.className = 'menu-tab-btn';
        if (menuTab === tab.toLowerCase()) t.classList.add('active');
        t.textContent = tab;
        t.addEventListener('click', () => { menuTab = tab.toLowerCase(); buildUI(); });
        tabSidebar.appendChild(t);
      });

      const closeBtn = txBtn('✕', () => { menuOpen = false; buildUI(); });
      closeBtn.style.cssText += ';margin-top:auto;border:none;padding:10px 14px;font-size:13px;';
      tabSidebar.appendChild(closeBtn);

      // Content area
      const content = el('div', { padding:'18px 20px', flex:'1', overflowY:'auto' });

      if (menuTab === 'roster') {
        ['player','ai'].forEach(side => {
          const hdr = el('div', { fontFamily:'Iceberg,monospace', fontSize:'11px', letterSpacing:'2px',
            color: side==='player' ? '#3a7aa0' : '#a04040', marginBottom:'10px', marginTop: side==='ai'?'16px':'0' });
          hdr.textContent = side==='player' ? 'YOUR UNITS' : 'ENEMY UNITS';
          content.appendChild(hdr);
          Game.liveUnits(side).forEach(u => {
            const row = el('div', { display:'flex', gap:'10px', alignItems:'center',
              padding:'5px 0', borderBottom:'1px solid #0c1c28' });
            const nm = el('div', { fontFamily:'Iceberg,monospace', fontSize:'12px',
              color: side==='player' ? (u.team.color||'#b8ccd8') : '#c07050', flex:'1' });
            nm.textContent = u.name;
            const hp = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'10px',
              color: u.hp > u.maxHp*.5 ? '#4ac870' : '#c84444' });
            hp.textContent = `${u.hp}/${u.maxHp} HP`;
            const conds = [];
            if (u.stunned)  conds.push('STUNNED');
            if (u.poisoned) conds.push('POISONED');
            if (u.onFire)   conds.push('ON FIRE');
            const cd = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'9px', color:'#c08030' });
            cd.textContent = conds.join(' ');
            row.append(nm, hp, cd);
            content.appendChild(row);
          });
        });
      } else if (menuTab === 'settings') {
        const p = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'11px', color:'#4a6878', lineHeight:'1.8' });
        p.textContent = 'Volume controls coming in a future update.\n\nClick outside the panel to close.';
        content.appendChild(p);
        const quitBtn = txBtn('QUIT TO TITLE', () => { E.setScreen(Title()); E.playMusic('score'); });
        quitBtn.style.marginTop = '20px';
        content.appendChild(quitBtn);
      } else {
        const pre = el('pre', { fontFamily:'RobotoMono,monospace', fontSize:'10px',
          color:'#6a8898', lineHeight:'1.7', whiteSpace:'pre-wrap' });
        pre.textContent = [
          'TURN STRUCTURE',
          '  MOVE phase → ATTACK phase → END TURN',
          '  10 shared movement points per side per turn.',
          '',
          'MOVEMENT',
          '  Select a unit then click a blue-highlighted tile.',
          '  Units cannot pass through other units or obstacles.',
          '',
          'COMBAT',
          '  Select a unit in ATTACK phase.',
          '  Click a red-highlighted enemy.',
          '  Roll d10 + ATK vs d10 + DEF. Hit if attack > defense.',
          '',
          'POWER-UPS',
          '  Click a power-up icon, then follow on-board prompts.',
          '  Med Pack: +3 HP.  Mine: place explosive.',
          '  Teleporter: warp a friendly unit anywhere.',
          '',
          'MELEE WIN',
          '  Eliminate all enemy units.',
          '',
          'CTF WIN',
          '  Carry the flag to your own base (top-left corner).',
        ].join('\n');
        content.appendChild(pre);
      }

      const inner = el('div', { display:'flex', flex:'1' });
      inner.append(tabSidebar, content);
      panel.appendChild(inner);
      overlay.appendChild(panel);
      ui.appendChild(overlay);
    }

    // ── End game overlay ──────────────────────────────────
    function showEndOverlay(winner, reason) {
      const ui = E.getUI();
      const overlay = el('div'); overlay.className = 'tx-overlay';

      const panel = el('div'); panel.className = 'tx-panel';
      Object.assign(panel.style, { textAlign:'center', padding:'52px 44px', minWidth:'400px' });

      const isWin = winner==='player', isDraw = winner==='draw';
      const col = isWin ? '#3ad870' : isDraw ? '#c8c060' : '#d83030';

      const resultEl = el('div', { fontFamily:'Iceberg,monospace', fontSize:'44px',
        letterSpacing:'7px', color:col, textShadow:`0 0 32px ${col}`, marginBottom:'14px' });
      resultEl.textContent = isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';

      const reasonEl = el('div', { fontFamily:'RobotoMono,monospace', fontSize:'12px',
        color:'#5a7888', marginBottom:'38px' });
      reasonEl.textContent = reason;

      if (isWin)        E.playMusic('win');
      else if (!isDraw) E.playMusic('loss');

      const again = txBtn('PLAY AGAIN', () => E.setScreen(Battle(mode, teamId, roster, powerups)));
      again.classList.add('primary');
      const home  = txBtn('MAIN MENU',  () => { E.setScreen(Title()); E.playMusic('score'); });

      const btnRow = el('div', { display:'flex', justifyContent:'center', gap:'14px' });
      btnRow.append(again, home);

      panel.append(resultEl, reasonEl, btnRow);
      overlay.appendChild(panel);
      ui.appendChild(overlay);
    }

    // ── Tooltip ───────────────────────────────────────────
    function drawTooltip(ctx, mx, my, data) {
      const W=195, H=128;
      let tx = mx+16, ty = my - H/2;
      if (tx+W > 1272) tx = mx-W-16;
      if (ty < 8)  ty = 8;
      if (ty+H > 712) ty = 712-H;

      ctx.save();
      ctx.fillStyle   = 'rgba(3,11,18,.96)';
      ctx.strokeStyle = data.color || '#2a4858';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(tx, ty, W, H);
      ctx.strokeRect(tx, ty, W, H);

      const px = tx+10;
      const draw = (text, color, y) => {
        ctx.font = '10px RobotoMono'; ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillStyle = color; ctx.fillText(text, px, y);
      };

      ctx.font = 'bold 12px Iceberg'; ctx.fillStyle = data.color||'#c8dce8';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(data.name, px, ty+16);

      draw(`HP ${data.hp}`, '#4ac870', ty+34);
      draw(`SPD ${data.spd}   RNG ${data.rng}`, '#8ab8c8', ty+50);
      draw(`ATK ${data.atk}   DEF ${data.def}   DMG ${data.dmg}`, '#8ab8c8', ty+65);

      const conds = [];
      if (data.stunned)  conds.push('STUNNED');
      if (data.poisoned) conds.push('POISONED');
      if (data.onFire)   conds.push('ON FIRE');
      if (conds.length)  draw(conds.join(' · '), '#d08030', ty+80);

      draw(data.side==='player' ? '◀ FRIENDLY' : '▶ ENEMY',
           data.side==='player' ? '#3a8afa' : '#fa3a3a', ty+96);

      ctx.restore();
    }

    return { enter, destroy, update, render };
  }

  // ──────────────────────────────────────────────────────────
  // Shared utilities
  // ──────────────────────────────────────────────────────────

  function txBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'tx-btn'; b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function phaseBtn(label, cls, isActive, isDimmed) {
    const b = document.createElement('button');
    b.className = `phase-btn ${cls}`;
    if (isActive) b.classList.add('active');
    if (isDimmed) b.classList.add('dimmed');
    b.textContent = label;
    return b;
  }

  function sectionHeader(parent, text, extraStyle) {
    const h = el('div', Object.assign({
      fontFamily:'Iceberg,monospace', fontSize:'14px', letterSpacing:'3px',
      color:'#9fb6c4', marginBottom:'10px', paddingBottom:'6px',
      borderBottom:'1px solid #121e2c'
    }, extraStyle || {}));
    h.textContent = text;
    parent.appendChild(h);
  }

  function buildTopBar(title, onBack) {
    const ui = E.getUI(); ui.innerHTML = '';
    const nav = el('div', {
      position:'absolute', top:'0', left:'0', right:'0', height:'48px',
      display:'flex', alignItems:'center', padding:'0 20px',
      background:'transparent'  // title/select screens show bg, no bar needed
    });
    const backBtn = txBtn('BACK', onBack);
    backBtn.style.cssText += ';position:absolute;top:14px;right:100px;font-size:11px;';
    nav.appendChild(backBtn);
    ui.appendChild(nav);
  }

  // Flat-top hexagon path for UI cards
  function hexPath6(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath();
  }


  function buildHexIcon(iconKey, accentColor, isPowerup) {
    const wrap = el('div', {
      width:'62px', height:'68px', flexShrink:'0', position:'relative',
      clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      background: accentColor,
      boxShadow:`0 0 0 1px ${accentColor}, 0 0 14px ${accentColor}44`
    });
    const inner = el('div', {
      position:'absolute', left:'2px', top:'2px', right:'2px', bottom:'2px',
      clipPath:'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      background:isPowerup ? 'rgba(18,24,34,.95)' : 'rgba(8,18,28,.92)',
      display:'flex', alignItems:'center', justifyContent:'center'
    });
    const icon = E.getImage(iconKey);
    if (icon) {
      const img = el('img', { src: icon.src, draggable:false });
      img.style.width = '34px';
      img.style.height = '34px';
      img.style.objectFit = 'contain';
      img.style.filter = isPowerup ? 'drop-shadow(0 0 8px rgba(255,255,255,.2))' : 'none';
      inner.appendChild(img);
    } else {
      const fallback = el('div', { fontFamily:'Iceberg,monospace', fontSize:'20px', color:'#fff' });
      fallback.textContent = isPowerup ? '+' : '•';
      inner.appendChild(fallback);
    }
    wrap.appendChild(inner);
    return wrap;
  }

  function canvasMouse(e) {
    const rect = E.getCanvas().getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * (1280 / rect.width),
      my: (e.clientY - rect.top)  * (720  / rect.height)
    };
  }

  function unitIconKey(id) {
    const m = {
      infantry:'infantry_icon',
      sniper:'sniper_icon',
      elite:'elite_icon',
      grenadier:'grenadier_icon',
      shock_trooper:'shock_trooper_icon',
      slasher:'slasher_icon',
      assassin:'assassin_icon',
      acid_thrower:'acid_thrower_icon',
      grunt:'infantry_icon',
      sharpshooter:'sniper_icon',
      fire_caller:'fire_caller_icon'
    };
    return m[id] || 'infantry_icon';
  }
  function powerupIconKey(id) {
    const m = { med_pack:'med_pack_icon', mine:'mine_icon', teleporter:'teleporter_icon' };
    return m[id] || 'med_pack_icon';
  }
  function specialLabel(s) {
    const m = {splash:'SPLASH DAMAGE',stun:'STUN ON HIT',poison:'POISON ON HIT',
               acid_tile:'ACID TILE ON HIT',fire_dot:'FIRE DOT ON HIT',column_fire:'COLUMN FIRE'};
    return m[s] || s;
  }

  return { Title, GameSelect, TeamSelect, SquadBuilder, Battle };
})();
