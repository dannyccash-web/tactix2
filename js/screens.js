// ============================================================
// screens.js — All game screens: Title, GameSelect, TeamSelect,
//              SquadBuilder, Battle (gameplay), Overlays
// ============================================================

const Screens = (() => {

  // ── Shared helpers ────────────────────────────────────────
  const E = TactixEngine;

  function el(tag, cls, styles = {}) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    Object.assign(d.style, styles);
    return d;
  }

  function btn(label, onClick, styles = {}) {
    const b = el('button', 'tx-btn');
    b.textContent = label;
    b.addEventListener('click', onClick);
    Object.assign(b.style, styles);
    return b;
  }

  // Inject shared CSS once
  (function injectCSS() {
    if (document.getElementById('tx-styles')) return;
    const style = document.createElement('style');
    style.id = 'tx-styles';
    style.textContent = `
      :root {
        --ice: 'Iceberg', monospace;
        --mono: 'RobotoMono', monospace;
      }
      .tx-btn {
        background: transparent;
        border: 1.5px solid #5a8a9f;
        color: #c8dce8;
        font-family: 'Iceberg', monospace;
        font-size: 14px;
        letter-spacing: 2px;
        padding: 8px 22px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        text-transform: uppercase;
      }
      .tx-btn:hover {
        background: rgba(90,138,159,0.25);
        border-color: #8ac8e0;
        color: #e8f4fa;
      }
      .tx-btn.primary {
        border-color: #3aaa60;
        color: #3adf80;
      }
      .tx-btn.primary:hover {
        background: rgba(58,170,96,0.22);
        border-color: #5aef98;
      }
      .tx-btn.danger {
        border-color: #aa3a3a;
        color: #df6060;
      }
      .tx-btn:disabled {
        opacity: 0.35;
        cursor: default;
        pointer-events: none;
      }
      .tx-label {
        font-family: 'Iceberg', monospace;
        color: #8ab0c0;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .tx-overlay {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.72);
        display: flex; align-items: center; justify-content: center;
        z-index: 50;
      }
      .tx-panel {
        background: rgba(8,18,24,0.95);
        border: 1px solid #2a4050;
        padding: 28px 32px;
        min-width: 300px;
      }
      .tx-panel h2 {
        font-family: 'Iceberg', monospace;
        color: #c8dce8;
        font-size: 18px;
        letter-spacing: 4px;
        margin-bottom: 18px;
      }
      .pu-icon {
        width: 32px; height: 32px;
        border: 1.5px solid #3a5060;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 13px;
        color: #a0c0d0;
        background: rgba(10,24,34,0.85);
        transition: border-color 0.15s, background 0.15s;
        user-select: none;
        font-family: 'Iceberg', monospace;
        letter-spacing: 0;
      }
      .pu-icon:hover { border-color: #7ab8d0; background: rgba(30,60,80,0.7); }
      .pu-icon.active { border-color: #f0e040; background: rgba(60,50,0,0.7); }
      .phase-btn {
        padding: 8px 18px;
        font-family: 'Iceberg', monospace;
        font-size: 13px;
        letter-spacing: 2px;
        cursor: pointer;
        border: 1.5px solid;
        background: transparent;
        transition: background 0.12s, opacity 0.12s;
      }
      .phase-btn.move   { border-color: #3a8afa; color: #3a8afa; }
      .phase-btn.attack { border-color: #fa8a3a; color: #fa8a3a; }
      .phase-btn.end    { border-color: #8a8a8a; color: #c0c0c0; }
      .phase-btn:hover  { background: rgba(255,255,255,0.08); }
      .phase-btn.dimmed { opacity: 0.35; pointer-events: none; }
      .phase-btn.active { background: rgba(255,255,255,0.12); }
    `;
    document.head.appendChild(style);
  })();

  // ─────────────────────────────────────────────────────────
  // TITLE SCREEN
  // ─────────────────────────────────────────────────────────
  function Title() {
    let fade = 0;
    let logoScale = 0.85;

    function update(dt) {
      fade = Math.min(1, fade + dt * 1.2);
      logoScale = Math.min(1, logoScale + dt * 0.4);
    }

    function render(ctx) {
      E.drawBackground(ctx, 'bg1', 1);
      E.drawDim(ctx, 0.45);

      ctx.save();
      ctx.globalAlpha = fade;

      // Logo
      const logo = E.getImage('logo');
      if (logo) {
        const lw = 520;
        const lh = logo.height * (lw / logo.width);
        ctx.save();
        ctx.translate(640, 220);
        ctx.scale(logoScale, logoScale);
        ctx.drawImage(logo, -lw/2, -lh/2, lw, lh);
        ctx.restore();
      }

      // Subtitle
      E.drawText(ctx, 'TURN-BASED COMBAT', 640, 340, {
        font: '20px Iceberg',
        color: '#8ab4c8',
        align: 'center',
        shadow: true
      });

      // Start prompt
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 600);
      E.drawText(ctx, 'CLICK TO START', 640, 500, {
        font: '16px Iceberg',
        color: '#c8dce8',
        align: 'center',
        alpha: pulse
      });

      ctx.restore();
    }

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

    return { enter, update, render, destroy };
  }

  // ─────────────────────────────────────────────────────────
  // GAME SELECT SCREEN
  // ─────────────────────────────────────────────────────────
  function GameSelect() {
    let fade = 0;
    let hover = null;

    function update(dt) { fade = Math.min(1, fade + dt * 2); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.55);
      ctx.save();
      ctx.globalAlpha = fade;

      E.drawText(ctx, 'CHOOSE YOUR GAME', 640, 100, {
        font: '32px Iceberg', color: '#c8dce8', align: 'center', shadow: true
      });

      drawModeCard(ctx, 280, 260, 'MELEE', 'Eliminate all enemy units', '✦', hover === 'melee');
      drawModeCard(ctx, 720, 260, 'CAPTURE THE FLAG', 'Carry the flag to your base', '⚑', hover === 'ctf');

      ctx.restore();
    }

    function drawModeCard(ctx, cx, cy, title, sub, icon, hovered) {
      const w = 260, h = 260;
      const x = cx - w / 2, y = cy - h / 2;

      // Hexagonal card outline
      ctx.save();
      drawHexCard(ctx, cx, cy, 130, hovered);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Icon
      ctx.font = '42px sans-serif';
      ctx.fillStyle = hovered ? '#e0f0ff' : '#a0c0d0';
      ctx.fillText(icon, cx, cy - 24);

      // Title
      ctx.font = '18px Iceberg';
      ctx.fillStyle = hovered ? '#ffffff' : '#c8dce8';
      ctx.fillText(title, cx, cy + 28);

      // Subtitle
      ctx.font = '11px RobotoMono';
      ctx.fillStyle = '#6a9ab0';
      ctx.fillText(sub, cx, cy + 52);

      ctx.restore();
    }

    function drawHexCard(ctx, cx, cy, r, hovered) {
      E.hexPath(ctx, cx, cy, r);
      ctx.fillStyle = hovered
        ? 'rgba(40,80,110,0.70)'
        : 'rgba(15,30,45,0.65)';
      ctx.fill();
      ctx.strokeStyle = hovered ? '#7ac8e8' : '#3a5c70';
      ctx.lineWidth = hovered ? 2 : 1.5;
      ctx.stroke();
    }

    function handleClick(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);

      if (Math.hypot(mx - 280, my - 260) < 130) {
        E.setScreen(TeamSelect('melee'));
      } else if (Math.hypot(mx - 720, my - 260) < 130) {
        E.setScreen(TeamSelect('ctf'));
      }
    }

    function handleMouseMove(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);
      const prev = hover;
      if (Math.hypot(mx - 280, my - 260) < 130)       hover = 'melee';
      else if (Math.hypot(mx - 720, my - 260) < 130)   hover = 'ctf';
      else hover = null;
    }

    function buildUI() {
      const ui = E.getUI();
      // Back button
      const backBtn = btn('BACK', () => E.setScreen(Title()), {
        position: 'absolute', top: '20px', right: '100px', fontSize: '12px'
      });
      ui.appendChild(backBtn);
    }

    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMouseMove);
      buildUI();
    }

    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMouseMove);
    }

    return { enter, update, render, destroy };
  }

  // ─────────────────────────────────────────────────────────
  // TEAM SELECT SCREEN
  // ─────────────────────────────────────────────────────────
  function TeamSelect(mode) {
    let fade = 0;
    let hoveredTeam = null;
    const teams = Object.values(Data.TEAMS);

    // Layout: 5 teams in a pattern (2 top, 1 center, 2 bottom)
    const positions = [
      { x: 280, y: 220 },  // virent (top-left)
      { x: 640, y: 180 },  // phlox  (top-center, slightly higher)
      { x: 1000, y: 220 }, // magma  (top-right)
      { x: 380, y: 420 },  // azure  (bottom-left)
      { x: 900, y: 420 },  // vermillion (bottom-right)
    ];

    function update(dt) { fade = Math.min(1, fade + dt * 2); }

    function render(ctx) {
      E.drawBackground(ctx, 'bg2', 1);
      E.drawDim(ctx, 0.50);
      ctx.save();
      ctx.globalAlpha = fade;

      E.drawText(ctx, 'SELECT YOUR TEAM', 640, 70, {
        font: '30px Iceberg', color: '#c8dce8', align: 'center', shadow: true
      });

      teams.forEach((team, i) => {
        const pos = positions[i];
        const hovered = hoveredTeam === team.id;
        drawTeamCard(ctx, pos.x, pos.y, team, hovered);
      });

      ctx.restore();
    }

    function drawTeamCard(ctx, cx, cy, team, hovered) {
      const r = hovered ? 92 : 85;

      // Hex background
      E.hexPath(ctx, cx, cy, r);
      ctx.fillStyle = hovered
        ? `rgba(${hexToRgb(team.color)},0.35)`
        : 'rgba(10,22,34,0.75)';
      ctx.fill();
      ctx.strokeStyle = hovered ? team.color : '#2a4050';
      if (hovered) {
        ctx.shadowColor = team.glowColor || team.color;
        ctx.shadowBlur = 18;
      }
      ctx.lineWidth = hovered ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Portrait
      const portrait = E.getImage(team.portrait);
      if (portrait) {
        ctx.save();
        E.hexPath(ctx, cx, cy, r - 4);
        ctx.clip();
        const sz = r * 1.8;
        ctx.drawImage(portrait, cx - sz/2, cy - sz * 0.65, sz, sz);
        ctx.restore();
      }

      // Name
      ctx.save();
      ctx.font = `bold ${hovered ? 16 : 14}px Iceberg`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hovered ? '#ffffff' : '#c8dce8';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillText(team.name, cx, cy + r * 0.72);
      ctx.restore();
    }

    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return `${r},${g},${b}`;
    }

    function handleClick(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);

      teams.forEach((team, i) => {
        const pos = positions[i];
        if (Math.hypot(mx - pos.x, my - pos.y) < 90) {
          E.setScreen(SquadBuilder(mode, team.id));
        }
      });
    }

    function handleMouseMove(e) {
      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);
      hoveredTeam = null;
      teams.forEach((team, i) => {
        const pos = positions[i];
        if (Math.hypot(mx - pos.x, my - pos.y) < 90) hoveredTeam = team.id;
      });
    }

    function buildUI() {
      const ui = E.getUI();
      const backBtn = btn('BACK', () => E.setScreen(GameSelect()), {
        position: 'absolute', top: '20px', right: '100px', fontSize: '12px'
      });
      ui.appendChild(backBtn);
    }

    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMouseMove);
      buildUI();
    }

    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMouseMove);
    }

    return { enter, update, render, destroy };
  }

  // ─────────────────────────────────────────────────────────
  // SQUAD BUILDER SCREEN
  // ─────────────────────────────────────────────────────────
  function SquadBuilder(mode, teamId) {
    const team = Data.TEAMS[teamId];
    let roster = [];   // array of unit ids
    let powerups = []; // array of powerup ids
    let totalCost = 0;

    function recalcCost() {
      totalCost = roster.reduce((s, id) => s + Data.UNITS[id].cost, 0)
                + powerups.reduce((s, id) => s + Data.POWERUPS[id].cost, 0);
    }

    function addUnit(id) {
      const cost = Data.UNITS[id].cost;
      if (totalCost + cost > Data.SQUAD_BUDGET) return;
      roster.push(id);
      recalcCost();
      buildUI();
    }

    function removeUnit(idx) {
      roster.splice(idx, 1);
      recalcCost();
      buildUI();
    }

    function addPowerup(id) {
      if (powerups.length >= Data.POWERUP_CAP) return;
      const cost = Data.POWERUPS[id].cost;
      if (totalCost + cost > Data.SQUAD_BUDGET) return;
      powerups.push(id);
      recalcCost();
      buildUI();
    }

    function removePowerup(idx) {
      powerups.splice(idx, 1);
      recalcCost();
      buildUI();
    }

    function buildUI() {
      const ui = E.getUI();
      ui.innerHTML = '';
      recalcCost();

      const remaining = Data.SQUAD_BUDGET - totalCost;
      const canReady = roster.length > 0;

      // ── Top bar ──────────────────────────────────────────
      const topBar = el('div', '', {
        position: 'absolute', top: '0', left: '0', right: '0',
        height: '52px',
        background: 'rgba(5,12,20,0.92)',
        borderBottom: '1px solid #1e3040',
        display: 'flex', alignItems: 'center', padding: '0 24px',
        gap: '20px'
      });

      const title = el('div', '', {
        fontFamily: 'Iceberg, monospace', fontSize: '18px',
        color: '#c8dce8', letterSpacing: '4px'
      });
      title.textContent = 'BUILD YOUR SQUAD';

      const budget = el('div', '', {
        fontFamily: 'RobotoMono, monospace', fontSize: '13px',
        color: remaining > 0 ? '#60d080' : '#d06060',
        marginLeft: 'auto'
      });
      budget.textContent = `${totalCost} / ${Data.SQUAD_BUDGET} PTS  (${remaining} REMAINING)`;

      const backBtn = btn('BACK', () => E.setScreen(TeamSelect(mode)));
      const readyBtn = btn('READY', () => {
        E.setScreen(Battle(mode, teamId, [...roster], [...powerups]));
      }, { borderColor: canReady ? '#3aaa60' : '#333', color: canReady ? '#3adf80' : '#555' });
      if (!canReady) readyBtn.disabled = true;

      topBar.append(title, budget, backBtn, readyBtn);
      ui.appendChild(topBar);

      // ── Main layout ──────────────────────────────────────
      const main = el('div', '', {
        position: 'absolute', top: '52px', left: '0', right: '0', bottom: '0',
        display: 'flex', gap: '0'
      });

      // Left panel: available units
      const leftPanel = el('div', '', {
        width: '420px', padding: '20px',
        background: 'rgba(5,14,22,0.88)',
        borderRight: '1px solid #1a2e3e',
        overflowY: 'auto'
      });

      const soldierHeader = el('div', 'tx-label', { marginBottom: '14px' });
      soldierHeader.textContent = 'SOLDIERS';
      leftPanel.appendChild(soldierHeader);

      team.units.forEach(uid => {
        const u = Data.UNITS[uid];
        const card = buildUnitCard(u, () => addUnit(uid), remaining);
        leftPanel.appendChild(card);
      });

      const puHeader = el('div', 'tx-label', { margin: '20px 0 14px' });
      puHeader.textContent = 'POWER UPS';
      leftPanel.appendChild(puHeader);

      Object.values(Data.POWERUPS).forEach(pu => {
        const card = buildPowerupCard(pu, () => addPowerup(pu.id), remaining, powerups.length);
        leftPanel.appendChild(card);
      });

      // Right panel: squad list
      const rightPanel = el('div', '', {
        flex: '1', padding: '20px',
        background: 'rgba(8,18,28,0.88)',
        overflowY: 'auto'
      });

      const squadHeader = el('div', 'tx-label', { marginBottom: '14px' });
      squadHeader.textContent = `YOUR SQUAD   ${totalCost}/${Data.SQUAD_BUDGET} PTS`;
      rightPanel.appendChild(squadHeader);

      if (!roster.length && !powerups.length) {
        const hint = el('div', '', {
          color: '#3a5060', fontSize: '13px', fontFamily: 'RobotoMono',
          marginTop: '30px'
        });
        hint.textContent = 'Add units from the left panel to build your squad.';
        rightPanel.appendChild(hint);
      }

      roster.forEach((uid, i) => {
        const u = Data.UNITS[uid];
        const row = buildRosterRow(u.name, u.cost, () => removeUnit(i), team.color);
        rightPanel.appendChild(row);
      });

      if (powerups.length) {
        const puSep = el('div', 'tx-label', { margin: '14px 0 10px' });
        puSep.textContent = 'POWER UPS';
        rightPanel.appendChild(puSep);
        powerups.forEach((pid, i) => {
          const pu = Data.POWERUPS[pid];
          const row = buildRosterRow(pu.name, pu.cost, () => removePowerup(i), '#d0a040');
          rightPanel.appendChild(row);
        });
      }

      main.append(leftPanel, rightPanel);
      ui.appendChild(main);
    }

    function buildUnitCard(u, onAdd, remaining) {
      const card = el('div', '', {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', marginBottom: '8px',
        background: 'rgba(10,22,35,0.7)',
        border: '1px solid #1e3040',
        cursor: 'pointer', transition: 'background 0.12s'
      });
      card.addEventListener('mouseenter', () => card.style.background = 'rgba(30,55,80,0.7)');
      card.addEventListener('mouseleave', () => card.style.background = 'rgba(10,22,35,0.7)');

      // Icon hex
      const iconBox = el('div', '', {
        width: '36px', height: '36px', flexShrink: '0',
        border: `1.5px solid ${team.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', color: team.color
      });
      iconBox.textContent = unitIcon(u.id);

      const info = el('div', '', { flex: '1' });
      const name = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '14px', color: '#c8dce8', letterSpacing: '1px'
      });
      name.textContent = u.name;
      const stats = el('div', '', {
        fontFamily: 'RobotoMono', fontSize: '10px', color: '#5a8090', marginTop: '2px'
      });
      stats.textContent = `SPD ${u.speed}  RNG ${u.range}  ATK +${u.atk}  DEF +${u.def}  DMG ${u.dmg}  HP ${u.hp}`;
      info.append(name, stats);

      if (u.special) {
        const sp = el('div', '', {
          fontFamily: 'RobotoMono', fontSize: '9px', color: '#c08040', marginTop: '2px'
        });
        sp.textContent = specialLabel(u.special);
        info.appendChild(sp);
      }

      const cost = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '16px',
        color: u.cost <= remaining ? '#60d080' : '#d06060',
        letterSpacing: '1px', flexShrink: '0'
      });
      cost.textContent = u.cost + 'pt';

      const addBtn = btn('+', (ev) => { ev.stopPropagation(); onAdd(); }, {
        padding: '4px 10px', fontSize: '16px', flexShrink: '0'
      });
      if (u.cost > remaining) addBtn.disabled = true;

      card.append(iconBox, info, cost, addBtn);
      return card;
    }

    function buildPowerupCard(pu, onAdd, remaining, currentCount) {
      const card = el('div', '', {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', marginBottom: '8px',
        background: 'rgba(10,22,35,0.7)',
        border: '1px solid #1e3040',
        cursor: 'pointer', transition: 'background 0.12s'
      });
      card.addEventListener('mouseenter', () => card.style.background = 'rgba(30,55,80,0.7)');
      card.addEventListener('mouseleave', () => card.style.background = 'rgba(10,22,35,0.7)');

      const iconBox = el('div', '', {
        width: '36px', height: '36px', flexShrink: '0',
        border: '1.5px solid #8a6020',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px'
      });
      iconBox.textContent = puIcon(pu.id);

      const info = el('div', '', { flex: '1' });
      const name = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '14px', color: '#c8c080', letterSpacing: '1px'
      });
      name.textContent = pu.name;
      const desc = el('div', '', {
        fontFamily: 'RobotoMono', fontSize: '10px', color: '#7a7040', marginTop: '2px'
      });
      desc.textContent = pu.desc;
      info.append(name, desc);

      const cost = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '16px',
        color: pu.cost <= remaining ? '#60d080' : '#d06060',
        letterSpacing: '1px', flexShrink: '0'
      });
      cost.textContent = pu.cost + 'pt';

      const addBtn = btn('+', (ev) => { ev.stopPropagation(); onAdd(); }, {
        padding: '4px 10px', fontSize: '16px', flexShrink: '0'
      });
      if (pu.cost > remaining || currentCount >= Data.POWERUP_CAP) addBtn.disabled = true;

      card.append(iconBox, info, cost, addBtn);
      return card;
    }

    function buildRosterRow(name, cost, onRemove, color = '#c8dce8') {
      const row = el('div', '', {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 10px', marginBottom: '5px',
        background: 'rgba(10,22,35,0.6)',
        border: '1px solid #1a2c3c'
      });
      const nameEl = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '13px', color, flex: '1', letterSpacing: '1px'
      });
      nameEl.textContent = name;
      const costEl = el('div', '', {
        fontFamily: 'RobotoMono', fontSize: '11px', color: '#5a8090'
      });
      costEl.textContent = cost + 'pt';
      const rmBtn = btn('−', onRemove, { padding: '2px 8px', fontSize: '14px' });
      row.append(rmBtn, nameEl, costEl);
      return row;
    }

    function unitIcon(id) {
      const icons = { infantry:'⬡', sniper:'◎', elite:'★', grenadier:'⬡',
                      shock_trooper:'⬡', slasher:'⬡', assassin:'◎',
                      acid_thrower:'⬡', grunt:'⬡', sharpshooter:'◎', fire_caller:'⬡' };
      return icons[id] || '⬡';
    }

    function puIcon(id) {
      return id === 'med_pack' ? '✚' : id === 'mine' ? '✦' : id === 'teleporter' ? '⟳' : '?';
    }

    function specialLabel(s) {
      const labels = {
        splash:'SPLASH DAMAGE', stun:'STUN ON HIT', poison:'POISON ON HIT',
        acid_tile:'ACID TILE ON HIT', fire_dot:'FIRE DOT ON HIT', column_fire:'COLUMN FIRE'
      };
      return labels[s] || s;
    }

    function enter() { buildUI(); }
    function render() {}
    function update() {}
    function destroy() {}

    return { enter, render, update, destroy };
  }

  // ─────────────────────────────────────────────────────────
  // BATTLE SCREEN
  // ─────────────────────────────────────────────────────────
  function Battle(mode, teamId, roster, powerups) {
    let phase = Game.PHASE.MOVE;
    let tooltipData = null;
    let tooltipPos = { x: 0, y: 0 };
    let menuOpen = false;
    let menuTab = 'roster';
    let logVisible = false;

    function enter() {
      Game.start({ mode, playerTeam: teamId, playerRoster: roster, playerPowerups: powerups });
      const state = Game.getState();
      state.onPhaseChange = (p) => {
        phase = p;
        buildUI();
      };
      state.onGameOver = (winner, reason) => {
        setTimeout(() => showEndOverlay(winner, reason), 800);
      };
      buildUI();
    }

    function update(dt) {
      Game.update(dt);
    }

    function render(ctx) {
      E.drawBackground(ctx, 'bg1', 1);
      E.drawDim(ctx, 0.4);
      Game.render(ctx);

      // Tooltip
      if (tooltipData) drawTooltip(ctx, tooltipPos.x, tooltipPos.y, tooltipData);
    }

    function drawTooltip(ctx, mx, my, data) {
      const W = 190, H = 130;
      let tx = mx + 14;
      let ty = my - H / 2;
      if (tx + W > 1270) tx = mx - W - 14;
      if (ty < 10) ty = 10;
      if (ty + H > 710) ty = 710 - H;

      ctx.save();
      ctx.fillStyle = 'rgba(5,14,22,0.95)';
      ctx.strokeStyle = data.color || '#3a6070';
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx, ty, W, H);
      ctx.strokeRect(tx, ty, W, H);

      const lh = 16;
      const px = tx + 10, py = ty + 16;
      const draw = (text, color, y) => {
        ctx.font = '11px RobotoMono';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px, y);
      };

      ctx.font = 'bold 13px Iceberg';
      ctx.fillStyle = data.color || '#c8dce8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.name, px, py);

      draw(`HP  ${data.hp}`, '#60d080', py + lh * 1.1);
      draw(`SPD ${data.spd}   RNG ${data.rng}`, '#a0c0d0', py + lh * 2.1);
      draw(`ATK ${data.atk}   DEF ${data.def}   DMG ${data.dmg}`, '#a0c0d0', py + lh * 3.1);

      const conditions = [];
      if (data.stunned)  conditions.push('STUNNED');
      if (data.poisoned) conditions.push('POISONED');
      if (data.onFire)   conditions.push('ON FIRE');
      if (conditions.length) {
        draw(conditions.join(' • '), '#e09040', py + lh * 4.2);
      }

      const sideLabel = data.side === 'player' ? '◀ FRIENDLY' : '▶ ENEMY';
      draw(sideLabel, data.side === 'player' ? '#3a8afa' : '#fa3a3a', py + lh * 5.3);

      ctx.restore();
    }

    function buildUI() {
      const ui = E.getUI();
      ui.innerHTML = '';
      const state = Game.getState();
      if (!state) return;

      const ph = state.phase;
      const isPlayerTurn = ph === Game.PHASE.MOVE || ph === Game.PHASE.ATTACK;
      const isAITurn = ph === Game.PHASE.ENEMY;

      // ── Top bar ──────────────────────────────────────────
      const topBar = el('div', '', {
        position: 'absolute', top: '0', left: '0', right: '0',
        height: '48px', background: 'rgba(4,10,16,0.92)',
        borderBottom: '1px solid #1a2e3e',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px'
      });

      // Mode label
      const modeLabel = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '16px', letterSpacing: '3px',
        color: '#8ab0c0', marginRight: '10px'
      });
      modeLabel.textContent = mode === 'ctf' ? 'CAPTURE THE FLAG' : 'MELEE';
      topBar.appendChild(modeLabel);

      // Phase buttons
      const moveBtn = el('button', 'phase-btn move');
      moveBtn.textContent = 'MOVE';
      if (ph !== Game.PHASE.MOVE) moveBtn.classList.add('dimmed');
      else moveBtn.classList.add('active');
      if (isAITurn) moveBtn.classList.add('dimmed');

      const attackBtn = el('button', 'phase-btn attack');
      attackBtn.textContent = 'ATTACK';
      if (ph !== Game.PHASE.ATTACK) attackBtn.classList.add('dimmed');
      else attackBtn.classList.add('active');
      if (isAITurn) attackBtn.classList.add('dimmed');

      moveBtn.addEventListener('click', () => {
        if (ph !== Game.PHASE.MOVE) {
          Game.cancelPowerup();
          Game.setPhase(Game.PHASE.MOVE);
        }
      });
      attackBtn.addEventListener('click', () => {
        if (ph !== Game.PHASE.ATTACK) {
          Game.cancelPowerup();
          Game.setPhase(Game.PHASE.ATTACK);
        }
      });

      topBar.append(moveBtn, attackBtn);

      // Move pool display
      if (isPlayerTurn) {
        const mpLabel = el('div', '', {
          fontFamily: 'RobotoMono', fontSize: '11px', color: '#5a8090',
          borderLeft: '1px solid #1e3040', paddingLeft: '12px', marginLeft: '4px'
        });
        mpLabel.textContent = `MOVES: ${state.movePool}`;
        topBar.appendChild(mpLabel);
      }

      if (isAITurn) {
        const aiLabel = el('div', '', {
          fontFamily: 'Iceberg', fontSize: '14px', color: '#fa8060',
          animation: 'blink 0.7s infinite', marginLeft: '8px'
        });
        aiLabel.textContent = 'ENEMY TURN...';
        topBar.appendChild(aiLabel);
      }

      // Spacer
      const spacer = el('div', '', { flex: '1' });
      topBar.appendChild(spacer);

      // Turn label
      const turnLabel = el('div', '', {
        fontFamily: 'RobotoMono', fontSize: '11px', color: '#4a6878'
      });
      turnLabel.textContent = `TURN ${state.turn}`;
      topBar.appendChild(turnLabel);

      // End Turn button
      const endBtn = btn('END TURN', () => {
        Game.clearSelection();
        Game.cancelPowerup();
        Game.endPlayerTurn();
      }, { marginLeft: '10px' });
      if (!isPlayerTurn) endBtn.disabled = true;
      topBar.appendChild(endBtn);

      // Menu button
      const menuBtn = btn('MENU', () => {
        menuOpen = true;
        buildUI();
      }, { marginLeft: '6px', fontSize: '12px' });
      topBar.appendChild(menuBtn);

      ui.appendChild(topBar);

      // ── Power-up bar (bottom) ────────────────────────────
      const puBar = el('div', '', {
        position: 'absolute', bottom: '0', left: '0', right: '0',
        height: '52px', background: 'rgba(4,10,16,0.90)',
        borderTop: '1px solid #1a2e3e',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px'
      });

      const puLabel = el('div', 'tx-label');
      puLabel.textContent = 'POWER UPS';
      puBar.appendChild(puLabel);

      state.playerPowerups.forEach((pid, i) => {
        const pu = Data.POWERUPS[pid];
        const icon = el('div', 'pu-icon');
        icon.title = pu.name;
        icon.textContent = puIconChar(pid);
        if (state.puData?.puId === pid && state.puState !== Game.PUSTATE.NONE) {
          icon.classList.add('active');
        }
        if (isPlayerTurn) {
          icon.addEventListener('click', () => {
            if (state.puState !== Game.PUSTATE.NONE && state.puData?.puId === pid) {
              Game.cancelPowerup();
              buildUI();
            } else {
              Game.activatePowerup(pid);
              buildUI();
            }
          });
        } else {
          icon.style.opacity = '0.4';
          icon.style.cursor = 'default';
        }
        puBar.appendChild(icon);
      });

      if (!state.playerPowerups.length) {
        const nopu = el('div', '', { fontFamily: 'RobotoMono', fontSize: '11px', color: '#2a3c48' });
        nopu.textContent = 'None';
        puBar.appendChild(nopu);
      }

      // Spacer
      const puSpacer = el('div', '', { flex: '1' });
      puBar.appendChild(puSpacer);

      // Enemy powerup display
      const enemyLabel = el('div', 'tx-label');
      enemyLabel.textContent = 'ENEMY POWER UPS';
      puBar.appendChild(enemyLabel);

      state.aiPowerups.forEach(pid => {
        const icon = el('div', 'pu-icon', {
          cursor: 'default', opacity: '0.7'
        });
        icon.textContent = puIconChar(pid);
        icon.title = Data.POWERUPS[pid].name;
        puBar.appendChild(icon);
      });

      if (!state.aiPowerups.length) {
        const nopu = el('div', '', { fontFamily: 'RobotoMono', fontSize: '11px', color: '#2a3c48' });
        nopu.textContent = 'None';
        puBar.appendChild(nopu);
      }

      ui.appendChild(puBar);

      // ── Menu overlay ─────────────────────────────────────
      if (menuOpen) buildMenuOverlay(ui, state);
    }

    function buildMenuOverlay(ui, state) {
      const overlay = el('div', 'tx-overlay');
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { menuOpen = false; buildUI(); }
      });

      const panel = el('div', '', {
        background: 'rgba(5,14,22,0.97)',
        border: '1px solid #2a4050',
        width: '600px', minHeight: '360px',
        display: 'flex', flexDirection: 'column'
      });

      // Tabs
      const tabBar = el('div', '', {
        display: 'flex', borderBottom: '1px solid #1e3040'
      });
      ['ROSTER','SETTINGS','RULES'].forEach(tab => {
        const t = el('button', '', {
          fontFamily: 'Iceberg', fontSize: '14px', letterSpacing: '2px',
          padding: '14px 22px', background: 'transparent',
          borderRight: '1px solid #1e3040',
          color: menuTab === tab.toLowerCase() ? '#c8dce8' : '#3a5060',
          borderBottom: menuTab === tab.toLowerCase() ? '2px solid #5a90b0' : '2px solid transparent',
          cursor: 'pointer'
        });
        t.textContent = tab;
        t.addEventListener('click', () => { menuTab = tab.toLowerCase(); buildMenuOverlay(ui.querySelector('.tx-overlay').parentNode, state); });
        tabBar.appendChild(t);
      });
      const closeBtn = btn('✕ CLOSE', () => { menuOpen = false; buildUI(); }, {
        marginLeft: 'auto', border: 'none', fontSize: '12px', padding: '14px 18px'
      });
      tabBar.appendChild(closeBtn);

      // Content
      const content = el('div', '', { padding: '20px', flex: '1', overflowY: 'auto' });

      if (menuTab === 'roster') {
        content.innerHTML = '';
        ['player','ai'].forEach(side => {
          const units = Game.liveUnits(side);
          const sideLabel = el('div', 'tx-label', { marginBottom: '10px' });
          sideLabel.textContent = side === 'player' ? 'YOUR UNITS' : 'ENEMY UNITS';
          content.appendChild(sideLabel);
          units.forEach(u => {
            const row = el('div', '', {
              display: 'flex', gap: '10px', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid #0e1e2a'
            });
            const n = el('div', '', {
              fontFamily: 'Iceberg', fontSize: '13px',
              color: side === 'player' ? (u.team.color || '#c8dce8') : '#d08060',
              flex: '1'
            });
            n.textContent = u.name;
            const hpEl = el('div', '', {
              fontFamily: 'RobotoMono', fontSize: '11px',
              color: u.hp > u.maxHp * 0.5 ? '#60d080' : '#d06060'
            });
            hpEl.textContent = `HP ${u.hp}/${u.maxHp}`;
            const condEl = el('div', '', {
              fontFamily: 'RobotoMono', fontSize: '10px', color: '#e09040'
            });
            const conds = [];
            if (u.stunned)  conds.push('STUNNED');
            if (u.poisoned) conds.push('POISONED');
            if (u.onFire)   conds.push('ON FIRE');
            condEl.textContent = conds.join(' ');
            row.append(n, hpEl, condEl);
            content.appendChild(row);
          });
          const sep = el('div', '', { height: '16px' });
          content.appendChild(sep);
        });
      } else if (menuTab === 'settings') {
        const info = el('div', '', {
          fontFamily: 'RobotoMono', fontSize: '12px', color: '#5a8090', lineHeight: '1.8'
        });
        info.innerHTML = 'MUSIC &amp; SFX<br><br>Volume controls coming soon.<br>Click outside the panel to close.';
        content.appendChild(info);
        const quitBtn = btn('QUIT TO TITLE', () => { E.setScreen(Title()); E.playMusic('score'); }, {
          marginTop: '20px', display: 'block'
        });
        content.appendChild(quitBtn);
      } else if (menuTab === 'rules') {
        const rules = `
TURN STRUCTURE
  Each turn: MOVE phase → ATTACK phase → END TURN.
  10 shared movement points per side per turn.

MOVEMENT
  Select a unit then click a highlighted tile.
  Units cannot pass through other units or obstacles.

COMBAT
  Select a unit in ATTACK phase, click a red-highlighted enemy.
  Roll d10 + ATK vs d10 + DEF. Hit only if attack total > defense total.
  Hit = full DMG damage.

POWER-UPS
  Click a power-up icon, then follow the prompts on the board.
  Med Pack: heal 3 HP. Mine: place explosive. Teleporter: warp a unit.

MELEE WIN
  Eliminate all enemy units.

CAPTURE THE FLAG
  Carry the flag to your own base (top-left corner).
  Flag carrier moves at speed 2 and cannot attack.
`.trim();
        const pre = el('pre', '', {
          fontFamily: 'RobotoMono', fontSize: '11px', color: '#7a9aaa',
          lineHeight: '1.7', whiteSpace: 'pre-wrap'
        });
        pre.textContent = rules;
        content.appendChild(pre);
      }

      panel.append(tabBar, content);
      overlay.appendChild(panel);
      // Replace existing overlay if any
      const existing = ui.querySelector('.tx-overlay');
      if (existing) existing.remove();
      ui.appendChild(overlay);
    }

    function showEndOverlay(winner, reason) {
      const ui = E.getUI();
      const overlay = el('div', 'tx-overlay');

      const panel = el('div', 'tx-panel', {
        textAlign: 'center', minWidth: '420px', padding: '48px 40px'
      });

      const isWin = winner === 'player';
      const isDraw = winner === 'draw';

      const resultLabel = el('div', '', {
        fontFamily: 'Iceberg', fontSize: '40px',
        letterSpacing: '6px',
        color: isWin ? '#3adf80' : isDraw ? '#c8c080' : '#df3a3a',
        marginBottom: '16px',
        textShadow: `0 0 30px ${isWin ? '#3adf80' : isDraw ? '#c8c080' : '#df3a3a'}`
      });
      resultLabel.textContent = isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';

      const reasonLabel = el('div', '', {
        fontFamily: 'RobotoMono', fontSize: '13px', color: '#6a8a9a',
        marginBottom: '36px'
      });
      reasonLabel.textContent = reason;

      if (isWin) E.playMusic('win');
      else if (!isDraw) E.playMusic('loss');

      const again = btn('PLAY AGAIN', () => {
        E.setScreen(Battle(mode, teamId, roster, powerups));
      }, { marginRight: '14px' });

      const title = btn('MAIN MENU', () => {
        E.setScreen(Title());
        E.playMusic('score');
      });

      const btnRow = el('div', '', { display: 'flex', justifyContent: 'center', gap: '10px' });
      btnRow.append(again, title);

      panel.append(resultLabel, reasonLabel, btnRow);
      overlay.appendChild(panel);
      ui.appendChild(overlay);
    }

    function puIconChar(id) {
      return id === 'med_pack' ? '✚' : id === 'mine' ? '✦' : id === 'teleporter' ? '⟳' : '?';
    }

    function handleClick(e) {
      if (menuOpen) return;
      const state = Game.getState();
      if (!state || state.phase === Game.PHASE.ENEMY || state.phase === Game.PHASE.OVER) return;

      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);

      const tile = Board.tileAtPoint(mx, my);
      if (!tile) return;
      const { col, row } = tile;

      // Powerup flow takes priority
      if (state.puState !== Game.PUSTATE.NONE) {
        const consumed = Game.handlePowerupClick(col, row);
        if (consumed) buildUI();
        return;
      }

      const tileIdx = Board.idx(col, row);
      const hl = state.highlights[tileIdx];

      if (state.phase === Game.PHASE.MOVE) {
        if (hl === 'move') {
          Game.moveUnit(state.selectedUnit, col, row, () => { buildUI(); });
        } else {
          // Select a player unit
          const unit = Game.unitAt(col, row);
          if (unit && unit.side === 'player') {
            Game.selectUnit(unit);
          } else {
            Game.clearSelection();
          }
        }
      } else if (state.phase === Game.PHASE.ATTACK) {
        if (hl === 'attack') {
          Game.attackTarget(state.selectedUnit, col, row);
          buildUI();
        } else {
          // Select player unit for attacking
          const unit = Game.unitAt(col, row);
          if (unit && unit.side === 'player' && !unit.attackedThisTurn && !unit.stunned) {
            Game.selectUnit(unit);
          } else {
            Game.clearSelection();
          }
        }
      }
    }

    function handleMouseMove(e) {
      if (menuOpen) { tooltipData = null; return; }
      const rect = E.getCanvas().getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (1280 / rect.width);
      const my = (e.clientY - rect.top)  * (720  / rect.height);
      tooltipPos = { x: mx, y: my };
      const tile = Board.tileAtPoint(mx, my);
      tooltipData = tile ? Game.getTooltipFor(tile.col, tile.row) : null;
    }

    function enter() {
      E.getCanvas().addEventListener('click', handleClick);
      E.getCanvas().addEventListener('mousemove', handleMouseMove);
    }

    function destroy() {
      E.getCanvas().removeEventListener('click', handleClick);
      E.getCanvas().removeEventListener('mousemove', handleMouseMove);
    }

    return { enter, update, render, destroy };
  }

  // ─────────────────────────────────────────────────────────
  return { Title, GameSelect, TeamSelect, SquadBuilder, Battle };
})();
