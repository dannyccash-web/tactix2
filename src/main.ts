(() => {
  const GAME_W = 1280;
  const GAME_H = 720;
  const BOARD_W = 840;
  const BOARD_H = 620;
  const BOARD_ORIGIN_X = 28;
  const BOARD_ORIGIN_Y = 50;
  const HEX_SIZE = 21;
  const COLS = 20;
  const ROWS = 10;
  const POINT_BUDGET = 15;
  const MOVE_POOL = 10;
  const MAX_POWERUPS = 5;

  const TEAM_DATA = {
    Azure: {
      color: 0x5db8ff,
      uiColor: '#5db8ff',
      sprite: 'sprite_azure',
      portrait: 'soldier_azure',
      tag: 'Speed / precision',
      units: ['Infantry', 'Sniper', 'Elite'],
      powerText: 'Fast, flexible roster with the Elite as a mobile bruiser.'
    },
    Phlox: {
      color: 0xb682ff,
      uiColor: '#b682ff',
      sprite: 'sprite_phlox',
      portrait: 'soldier_phlox',
      tag: 'Control / disruption',
      units: ['Infantry', 'Sniper', 'Shock Trooper'],
      powerText: 'Control space and lock enemies out with stun pressure.'
    },
    Vermillion: {
      color: 0xff7268,
      uiColor: '#ff7268',
      sprite: 'sprite_vermillion',
      portrait: 'soldier_vermillion',
      tag: 'Damage / splash',
      units: ['Infantry', 'Sniper', 'Grenadier'],
      powerText: 'High-impact attacks and splash damage.'
    },
    Virent: {
      color: 0x68e77d,
      uiColor: '#68e77d',
      sprite: 'sprite_virent',
      portrait: 'soldier_virent',
      tag: 'Poison / hazard',
      units: ['Slasher', 'Assassin', 'Acid Thrower'],
      powerText: 'Poison and acid hazards punish positioning.'
    },
    Magma: {
      color: 0xffa153,
      uiColor: '#ffa153',
      sprite: 'sprite_magma',
      portrait: 'soldier_magma',
      tag: 'Fire / area denial',
      units: ['Grunt', 'Sharpshooter', 'Fire Caller'],
      powerText: 'Columns of fire and damage-over-time pressure.'
    }
  };

  const UNIT_DATA = {
    Infantry:       { cost: 2, speed: 5, range: 2, atk: 1, def: 1, dmg: 2, hp: 5, desc: 'Flexible all-rounder.' },
    Sniper:         { cost: 4, speed: 3, range: 5, atk: 3, def: 0, dmg: 3, hp: 4, desc: 'Long-range single-target pressure.' },
    Elite:          { cost: 6, speed: 7, range: 3, atk: 5, def: 2, dmg: 4, hp: 6, desc: 'Fast, heavy frontline unit.' },
    Grenadier:      { cost: 6, speed: 3, range: 4, atk: 2, def: 5, dmg: 5, hp: 6, desc: 'Splashes adjacent targets on hit.' },
    'Shock Trooper':  { cost: 6, speed: 5, range: 1, atk: 4, def: 3, dmg: 4, hp: 6, desc: 'Stuns targets on hit.' },
    Slasher:        { cost: 3, speed: 6, range: 1, atk: 3, def: 1, dmg: 2, hp: 5, desc: 'Poisons targets on hit.' },
    Assassin:       { cost: 5, speed: 3, range: 5, atk: 3, def: 0, dmg: 3, hp: 4, desc: 'Long-range poison specialist.' },
    'Acid Thrower': { cost: 7, speed: 5, range: 3, atk: 4, def: 3, dmg: 4, hp: 6, desc: 'Creates acid hazards.' },
    Grunt:          { cost: 3, speed: 6, range: 2, atk: 1, def: 1, dmg: 2, hp: 5, desc: 'Applies fire on hit.' },
    Sharpshooter:   { cost: 5, speed: 3, range: 5, atk: 3, def: 0, dmg: 3, hp: 4, desc: 'Long-range burn pressure.' },
    'Fire Caller':  { cost: 7, speed: 5, range: 10, atk: 4, def: 3, dmg: 4, hp: 6, desc: 'Ignites a full column.' }
  };

  const POWERUP_DATA = {
    'Med Pack': { cost: 1, desc: 'Heal 3 HP on a friendly unit.' },
    'Mine': { cost: 1, desc: 'Place a mine that explodes on contact.' },
    'Teleporter': { cost: 2, desc: 'Move a friendly unit to any legal empty tile.' }
  };

  const state = {
    mode: 'Melee',
    playerTeam: 'Azure',
    playerRoster: [],
    playerPowerups: [],
    wins: 0,
    losses: 0,
    lastResult: ''
  };

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function offsetToCube(col, row) {
    const x = col;
    const z = row - ((col + (col & 1)) >> 1);
    const y = -x - z;
    return { x, y, z };
  }

  function hexDistance(a, b) {
    const ac = offsetToCube(a.col, a.row);
    const bc = offsetToCube(b.col, b.row);
    return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
  }

  function neighbors(col, row) {
    const even = col % 2 === 0;
    const dirs = even
      ? [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]]
      : [[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]];
    return dirs
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter(h => h.col >= 0 && h.col < COLS && h.row >= 0 && h.row < ROWS);
  }

  function hexToPixel(col, row) {
    const width = Math.sqrt(3) * HEX_SIZE;
    const height = HEX_SIZE * 2;
    const x = BOARD_ORIGIN_X + col * width + (row % 2 ? 0 : 0); // placeholder for readability
    const y = BOARD_ORIGIN_Y + row * (height * 0.75) + (col % 2 ? height * 0.375 : 0);
    return { x, y };
  }

  function hexPolyPoints(size) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.DegToRad(60 * i - 30);
      points.push(new Phaser.Math.Vector2(Math.cos(angle) * size, Math.sin(angle) * size));
    }
    return points;
  }

  function lineOfSightClear(start, end, obstaclesSet) {
    const N = hexDistance(start, end);
    if (N <= 1) return true;
    const a = offsetToCube(start.col, start.row);
    const b = offsetToCube(end.col, end.row);
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const x = Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      const z = Phaser.Math.Linear(a.z, b.z, t);
      const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const xDiff = Math.abs(rx - x), yDiff = Math.abs(ry - y), zDiff = Math.abs(rz - z);
      let qx = rx, qy = ry, qz = rz;
      if (xDiff > yDiff && xDiff > zDiff) qx = -qy - qz;
      else if (yDiff > zDiff) qy = -qx - qz;
      else qz = -qx - qy;
      const col = qx;
      const row = qz + ((qx + (qx & 1)) >> 1);
      if (obstaclesSet.has(`${col},${row}`)) return false;
    }
    return true;
  }

  function buildRandomRoster(team, budget = POINT_BUDGET) {
    const unitOptions = TEAM_DATA[team].units;
    const powerOptions = Object.keys(POWERUP_DATA);
    const roster = [];
    const powerups = [];
    let points = budget;
    let guard = 0;
    while (points > 0 && guard++ < 100) {
      const affordableUnits = unitOptions.filter(name => UNIT_DATA[name].cost <= points);
      if (affordableUnits.length === 0) break;
      const pick = affordableUnits.sort((a, b) => UNIT_DATA[b].cost - UNIT_DATA[a].cost)[Math.floor(Math.random() * Math.min(2, affordableUnits.length))];
      roster.push(pick);
      points -= UNIT_DATA[pick].cost;
      if (roster.length >= 6) break;
    }
    const powerCount = randInt(1, 2);
    for (let i = 0; i < powerCount; i++) {
      const affordable = powerOptions.filter(name => POWERUP_DATA[name].cost <= points);
      if (!affordable.length) break;
      const p = pickRandom(affordable);
      powerups.push(p);
      points -= POWERUP_DATA[p].cost;
    }
    if (roster.length === 0) roster.push(unitOptions[0]);
    return { roster, powerups };
  }

  function createButton(scene, x, y, w, h, label, onClick, opts = {}) {
    const bg = scene.add.rectangle(x, y, w, h, opts.fill || 0x121c2f, opts.alpha ?? 0.92)
      .setStrokeStyle(2, opts.stroke || 0x6aa9ff)
      .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, {
      fontFamily: opts.font || 'Roboto Mono',
      fontSize: opts.size || '22px',
      color: opts.color || '#f6fbff',
      align: 'center',
      wordWrap: { width: w - 20 }
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(opts.hoverFill || 0x1c2a44));
    bg.on('pointerout', () => bg.setFillStyle(opts.fill || 0x121c2f, opts.alpha ?? 0.92));
    bg.on('pointerdown', onClick);
    return { bg, text };
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      this.load.image('bg1', 'assets/Backgrounds/tactix_background.png');
      this.load.image('bg2', 'assets/Backgrounds/tactix_background_2.png');
      this.load.image('logo', 'assets/Logo/tactix_logo.png');
      this.load.image('sprite_azure', 'assets/Sprites/azure_soldier_sprite.png');
      this.load.image('sprite_vermillion', 'assets/Sprites/vermillion_soldier_sprite.png');
      this.load.image('sprite_phlox', 'assets/Sprites/phlox_soldier_sprite.png');
      this.load.image('sprite_virent', 'assets/Sprites/virent_soldier_sprite.png');
      this.load.image('sprite_magma', 'assets/Sprites/magma_soldier_sprite.png');
      this.load.image('soldier_azure', 'assets/Soldiers/azure-soldier.png');
      this.load.image('soldier_vermillion', 'assets/Soldiers/vermillion-soldier.png');
      this.load.image('soldier_phlox', 'assets/Soldiers/phlox-soldier.png');
      this.load.image('soldier_virent', 'assets/Soldiers/virent-soldier.png');
      this.load.image('soldier_magma', 'assets/Soldiers/magma_soldier.png');
      this.load.audio('music_theme', 'assets/Music/tactix_score.mp3');
      this.load.audio('music_win', 'assets/Music/tactix_win.mp3');
      this.load.audio('music_loss', 'assets/Music/tactix_loss.mp3');
      this.load.audio('sfx_shot', 'assets/Sound Effects/Gun_Shot.mp3');
      this.load.audio('sfx_ricochet', 'assets/Sound Effects/Gun_Ricochet.mp3');
    }
    create() {
      this.scene.start('Title');
    }
  }

  class BaseMenuScene extends Phaser.Scene {
    addBackdrop(texture = 'bg1') {
      this.add.image(GAME_W / 2, GAME_H / 2, texture).setDisplaySize(GAME_W, GAME_H);
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x04070d, 0.72);
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W - 30, GAME_H - 30, 0x000000, 0).setStrokeStyle(2, 0x4f88ff, 0.35);
    }
    ensureTheme() {
      if (!window.__tactixTheme || !window.__tactixTheme.isPlaying) {
        if (window.__tactixTheme) window.__tactixTheme.destroy();
        window.__tactixTheme = this.sound.add('music_theme', { loop: true, volume: 0.3 });
        window.__tactixTheme.play();
      }
    }
    stopResultMusic() {
      ['music_win','music_loss'].forEach(k => {
        const s = this.sound.get(k);
        if (s && s.isPlaying) s.stop();
      });
      if (window.__tactixTheme && !window.__tactixTheme.isPlaying) {
        window.__tactixTheme.play();
      }
    }
  }

  class TitleScene extends BaseMenuScene {
    constructor() { super('Title'); }
    create() {
      this.addBackdrop('bg1');
      this.stopResultMusic();
      const logo = this.add.image(GAME_W / 2, 170, 'logo').setScale(0.4);
      this.add.text(GAME_W / 2, 310, 'TACTIX 2', {
        fontFamily: 'Iceberg', fontSize: '72px', color: '#eef6ff', stroke: '#5db8ff', strokeThickness: 2
      }).setOrigin(0.5);
      this.add.text(GAME_W / 2, 370, 'GROUND-UP PHASER PROTOTYPE', {
        fontFamily: 'Roboto Mono', fontSize: '24px', color: '#9ed1ff', letterSpacing: 2
      }).setOrigin(0.5);
      this.add.text(GAME_W / 2, 440, 'Turn-based hex tactics • browser-first • Steam-ready foundation', {
        fontFamily: 'Roboto Mono', fontSize: '20px', color: '#ffffff'
      }).setOrigin(0.5);
      if (state.lastResult) {
        this.add.text(GAME_W / 2, 490, `Last result: ${state.lastResult}   W:${state.wins}  L:${state.losses}`, {
          fontFamily: 'Roboto Mono', fontSize: '18px', color: '#ffd88b'
        }).setOrigin(0.5);
      }
      createButton(this, GAME_W / 2, 585, 260, 68, 'START', () => {
        this.ensureTheme();
        this.scene.start('ModeSelect');
      }, { font: 'Iceberg', size: '36px', fill: 0x0e2340, hoverFill: 0x16345d, stroke: 0x5db8ff });
      this.add.text(GAME_W / 2, 660, 'Best viewed in a local web server. Click units, tiles, and roster items to play.', {
        fontFamily: 'Roboto Mono', fontSize: '14px', color: '#afc7df'
      }).setOrigin(0.5);
    }
  }

  class ModeSelectScene extends BaseMenuScene {
    constructor() { super('ModeSelect'); }
    create() {
      this.addBackdrop('bg2');
      this.add.text(80, 60, 'SELECT GAME MODE', { fontFamily: 'Iceberg', fontSize: '48px', color: '#ffffff' });
      this.add.text(80, 115, 'Both modes use the same squad builder, movement rules, and combat flow.', {
        fontFamily: 'Roboto Mono', fontSize: '18px', color: '#cde2f8'
      });
      this.drawModeCard(360, 'Melee', 'Classic elimination mode. Destroy all enemy units to win.', () => {
        state.mode = 'Melee';
        this.scene.start('TeamSelect');
      });
      this.drawModeCard(760, 'Capture the Flag', 'Seize the neutral flag and carry it into your base, or wipe out the enemy.', () => {
        state.mode = 'Capture the Flag';
        this.scene.start('TeamSelect');
      });
      createButton(this, 120, 665, 160, 46, 'BACK', () => this.scene.start('Title'), { size: '22px' });
    }
    drawModeCard(x, title, desc, onClick) {
      this.add.rectangle(x, 390, 320, 340, 0x0a1222, 0.9).setStrokeStyle(2, 0x6aa9ff, 0.8);
      this.add.text(x, 275, title.toUpperCase(), { fontFamily: 'Iceberg', fontSize: '42px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
      this.add.text(x, 365, desc, {
        fontFamily: 'Roboto Mono', fontSize: '18px', color: '#d8ecff', align: 'center', wordWrap: { width: 250 }
      }).setOrigin(0.5);
      createButton(this, x, 500, 200, 58, 'CHOOSE', onClick, { font: 'Iceberg', size: '28px', fill: 0x173153 });
    }
  }

  class TeamSelectScene extends BaseMenuScene {
    constructor() { super('TeamSelect'); }
    create() {
      this.addBackdrop('bg1');
      this.add.text(70, 50, `SELECT TEAM • ${state.mode.toUpperCase()}`, { fontFamily: 'Iceberg', fontSize: '46px', color: '#ffffff' });
      this.add.text(70, 104, 'Each team uses a distinct special unit and combat identity.', {
        fontFamily: 'Roboto Mono', fontSize: '18px', color: '#cde2f8'
      });
      const teams = Object.keys(TEAM_DATA);
      teams.forEach((team, idx) => this.drawTeamCard(team, 150 + idx * 225, idx));
      createButton(this, 110, 665, 160, 46, 'BACK', () => this.scene.start('ModeSelect'), { size: '22px' });
    }
    drawTeamCard(team, x, idx) {
      const data = TEAM_DATA[team];
      const card = this.add.rectangle(x, 380, 190, 520, 0x0b1220, 0.88).setStrokeStyle(2, data.color, 0.9).setInteractive({ useHandCursor: true });
      this.add.image(x, 220, data.portrait).setScale(0.18);
      this.add.text(x, 425, team.toUpperCase(), { fontFamily: 'Iceberg', fontSize: '30px', color: data.uiColor, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 458, data.tag, { fontFamily: 'Roboto Mono', fontSize: '15px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
      this.add.text(x, 515, `Roster:\n${data.units.join('\n')}`, {
        fontFamily: 'Roboto Mono', fontSize: '16px', color: '#d9ecff', align: 'center'
      }).setOrigin(0.5);
      this.add.text(x, 620, data.powerText, {
        fontFamily: 'Roboto Mono', fontSize: '13px', color: '#aac5df', align: 'center', wordWrap: { width: 155 }
      }).setOrigin(0.5);
      card.on('pointerdown', () => {
        state.playerTeam = team;
        this.scene.start('SquadBuilder');
      });
    }
  }

  class SquadBuilderScene extends BaseMenuScene {
    constructor() { super('SquadBuilder'); }
    create() {
      this.addBackdrop('bg2');
      this.roster = [];
      this.powerups = [];
      this.pointsSpent = 0;
      this.selectedInfo = null;
      this.add.text(60, 38, 'BUILD YOUR SQUAD', { fontFamily: 'Iceberg', fontSize: '50px', color: '#ffffff' });
      this.add.text(60, 90, `${state.playerTeam} • ${state.mode}`, { fontFamily: 'Roboto Mono', fontSize: '20px', color: TEAM_DATA[state.playerTeam].uiColor });
      this.add.rectangle(240, 390, 360, 530, 0x091221, 0.88).setStrokeStyle(2, TEAM_DATA[state.playerTeam].color, 0.8);
      this.add.rectangle(680, 390, 420, 530, 0x091221, 0.88).setStrokeStyle(2, 0x6aa9ff, 0.8);
      this.add.rectangle(1080, 390, 320, 530, 0x091221, 0.88).setStrokeStyle(2, 0xffd07a, 0.8);
      this.add.text(95, 140, 'UNITS', { fontFamily: 'Iceberg', fontSize: '34px', color: '#ffffff' });
      this.add.text(505, 140, 'POWER-UPS', { fontFamily: 'Iceberg', fontSize: '34px', color: '#ffffff' });
      this.add.text(953, 140, 'CURRENT LOADOUT', { fontFamily: 'Iceberg', fontSize: '34px', color: '#ffffff' });
      TEAM_DATA[state.playerTeam].units.forEach((name, idx) => this.drawUnitOption(name, 120, 200 + idx * 155));
      Object.keys(POWERUP_DATA).forEach((name, idx) => this.drawPowerOption(name, 540, 210 + idx * 135));
      this.summaryText = this.add.text(935, 190, '', { fontFamily: 'Roboto Mono', fontSize: '17px', color: '#f4f8ff', wordWrap: { width: 280 } });
      this.infoText = this.add.text(935, 510, '', { fontFamily: 'Roboto Mono', fontSize: '15px', color: '#b7d0ea', wordWrap: { width: 280 } });
      createButton(this, 120, 665, 160, 46, 'BACK', () => this.scene.start('TeamSelect'), { size: '22px' });
      createButton(this, 1120, 665, 220, 54, 'READY', () => this.tryStartBattle(), { font: 'Iceberg', size: '28px', fill: 0x173153 });
      this.refreshSummary();
    }
    drawUnitOption(name, x, y) {
      const data = UNIT_DATA[name];
      const card = this.add.rectangle(x + 100, y + 45, 290, 110, 0x11203a, 0.9).setStrokeStyle(2, TEAM_DATA[state.playerTeam].color, 0.6).setInteractive({ useHandCursor: true });
      this.add.text(x, y, `${name}  (${data.cost})`, { fontFamily: 'Iceberg', fontSize: '28px', color: '#ffffff' });
      this.add.text(x, y + 34, `SPD ${data.speed}  RNG ${data.range}  ATK +${data.atk}  DEF +${data.def}  DMG ${data.dmg}  HP ${data.hp}`, {
        fontFamily: 'Roboto Mono', fontSize: '14px', color: '#d8e9ff'
      });
      this.add.text(x, y + 60, data.desc, { fontFamily: 'Roboto Mono', fontSize: '14px', color: '#aac5df', wordWrap: { width: 260 } });
      card.on('pointerdown', () => this.addUnit(name));
    }
    drawPowerOption(name, x, y) {
      const data = POWERUP_DATA[name];
      const card = this.add.rectangle(x + 100, y + 38, 340, 95, 0x11203a, 0.9).setStrokeStyle(2, 0xffd07a, 0.8).setInteractive({ useHandCursor: true });
      this.add.text(x, y, `${name}  (${data.cost})`, { fontFamily: 'Iceberg', fontSize: '26px', color: '#ffe19f' });
      this.add.text(x, y + 34, data.desc, { fontFamily: 'Roboto Mono', fontSize: '14px', color: '#d8e9ff', wordWrap: { width: 300 } });
      card.on('pointerdown', () => this.addPowerup(name));
    }
    addUnit(name) {
      const cost = UNIT_DATA[name].cost;
      if (this.pointsSpent + cost > POINT_BUDGET) return this.flashInfo('Not enough points for that unit.');
      this.roster.push(name);
      this.pointsSpent += cost;
      this.infoText.setText(`${name} added.`);
      this.refreshSummary();
    }
    addPowerup(name) {
      const cost = POWERUP_DATA[name].cost;
      if (this.powerups.length >= MAX_POWERUPS) return this.flashInfo('Power-up cap reached.');
      if (this.pointsSpent + cost > POINT_BUDGET) return this.flashInfo('Not enough points for that power-up.');
      this.powerups.push(name);
      this.pointsSpent += cost;
      this.infoText.setText(`${name} added.`);
      this.refreshSummary();
    }
    refreshSummary() {
      const unitLines = this.roster.length ? this.roster.map((u, i) => `${i + 1}. ${u}`) : ['No units selected'];
      const powerLines = this.powerups.length ? this.powerups.map((u, i) => `${i + 1}. ${u}`) : ['No power-ups selected'];
      this.summaryText.setText([
        `Points: ${this.pointsSpent}/${POINT_BUDGET}`,
        '',
        'Units:',
        ...unitLines,
        '',
        `Power-ups (${this.powerups.length}/${MAX_POWERUPS}):`,
        ...powerLines,
        '',
        'Click unit or power-up cards to add them.',
        'Press READY when you have at least one unit.'
      ]);
    }
    flashInfo(msg) {
      this.infoText.setText(msg);
      this.tweens.add({ targets: this.infoText, alpha: 0.4, yoyo: true, duration: 120, repeat: 1 });
    }
    tryStartBattle() {
      if (!this.roster.length) return this.flashInfo('Choose at least one unit.');
      state.playerRoster = deepClone(this.roster);
      state.playerPowerups = deepClone(this.powerups);
      this.scene.start('Battle');
    }
  }

  class BattleScene extends Phaser.Scene {
    constructor() { super('Battle'); }
    create() {
      this.add.image(GAME_W / 2, GAME_H / 2, 'bg1').setDisplaySize(GAME_W, GAME_H);
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x041018, 0.78);
      this.board = [];
      this.hexMap = new Map();
      this.units = [];
      this.unitMap = new Map();
      this.mines = new Map();
      this.hazards = new Map();
      this.flag = null;
      this.selectedUnit = null;
      this.hoveredTile = null;
      this.phase = 'move';
      this.turnSide = 'player';
      this.movePool = MOVE_POOL;
      this.pendingAction = null;
      this.logLines = [];
      this.aiTurnRunning = false;
      this.infoBanner = this.add.text(20, 12, '', { fontFamily: 'Roboto Mono', fontSize: '17px', color: '#ffffff' });
      this.logText = this.add.text(870, 390, '', { fontFamily: 'Roboto Mono', fontSize: '14px', color: '#d8e9ff', wordWrap: { width: 390 } });
      this.sideText = this.add.text(870, 20, '', { fontFamily: 'Iceberg', fontSize: '34px', color: '#ffffff' });
      this.modeText = this.add.text(870, 60, '', { fontFamily: 'Roboto Mono', fontSize: '16px', color: '#cde2f8' });
      this.turnText = this.add.text(870, 90, '', { fontFamily: 'Roboto Mono', fontSize: '18px', color: '#ffd07a' });
      this.objectiveText = this.add.text(870, 122, '', { fontFamily: 'Roboto Mono', fontSize: '15px', color: '#b8d6f2', wordWrap: { width: 370 } });
      this.selectedText = this.add.text(870, 165, '', { fontFamily: 'Roboto Mono', fontSize: '15px', color: '#f4f8ff', wordWrap: { width: 370 } });
      this.panelBg = this.add.rectangle(1065, 530, 390, 340, 0x091221, 0.92).setStrokeStyle(2, 0x6aa9ff, 0.7);
      this.rosterPanelTitle = this.add.text(875, 222, 'TACTICAL PANEL', { fontFamily: 'Iceberg', fontSize: '30px', color: '#ffffff' });
      this.powerupTitle = this.add.text(875, 262, 'Power-ups', { fontFamily: 'Roboto Mono', fontSize: '18px', color: '#ffe19f' });
      this.powerupButtons = [];
      this.baseTiles = { player: new Set(['0,0','0,1','1,0']), ai: new Set([`${COLS-1},${ROWS-1}`, `${COLS-1},${ROWS-2}`, `${COLS-2},${ROWS-1}`]) };

      this.drawBoard();
      this.generateObstacles();
      this.spawnTeams();
      if (state.mode === 'Capture the Flag') this.placeFlag();
      this.drawUiButtons();
      this.refreshPowerupButtons();
      this.updateUI();
      this.log(`Battle started. ${state.playerTeam} vs ${this.aiTeam} in ${state.mode}.`);
      this.beginTurn('player');
    }

    drawBoard() {
      const points = hexPolyPoints(HEX_SIZE);
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const { x, y } = hexToPixel(col, row);
          const g = this.add.graphics({ x, y });
          g.fillStyle(0x10253a, 0.92);
          g.lineStyle(2, 0x45729b, 0.48);
          g.beginPath();
          g.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
          g.closePath();
          g.fillPath();
          g.strokePath();
          const hit = new Phaser.Geom.Polygon(points.map(p => ({ x: p.x, y: p.y })));
          const zone = this.add.zone(x, y, HEX_SIZE * 1.9, HEX_SIZE * 1.9).setInteractive(hit, Phaser.Geom.Polygon.Contains);
          const tile = { col, row, x, y, graphics: g, zone, obstacle: false, marker: null };
          zone.on('pointerdown', () => this.onTileClicked(tile));
          zone.on('pointerover', () => this.highlightHover(tile));
          zone.on('pointerout', () => this.clearHover(tile));
          this.board.push(tile);
          this.hexMap.set(`${col},${row}`, tile);
        }
      }
    }

    drawUiButtons() {
      createButton(this, 930, 318, 140, 46, 'ATTACK PHASE', () => {
        if (this.turnSide !== 'player' || this.phase !== 'move') return;
        this.phase = 'attack';
        this.pendingAction = null;
        this.selectedUnit = null;
        this.log('Player ended movement. Attack phase begins.');
        this.updateUI();
      }, { size: '18px', fill: 0x173153 });
      createButton(this, 1095, 318, 120, 46, 'END TURN', () => {
        if (this.turnSide !== 'player' || this.aiTurnRunning) return;
        this.endPlayerTurn();
      }, { size: '18px', fill: 0x173153 });
      createButton(this, 1220, 318, 90, 46, 'QUIT', () => this.scene.start('Title'), { size: '18px', fill: 0x402028, hoverFill: 0x613241, stroke: 0xff8aa3 });
    }

    generateObstacles() {
      const reserved = new Set(['0,0','0,1','1,0', `${COLS-1},${ROWS-1}`, `${COLS-1},${ROWS-2}`, `${COLS-2},${ROWS-1}`]);
      let pairs = 10, guard = 0;
      while (pairs > 0 && guard++ < 500) {
        const c = randInt(2, Math.floor(COLS / 2) - 1);
        const r = randInt(0, ROWS - 1);
        const m1 = `${c},${r}`;
        const c2 = COLS - 1 - c;
        const r2 = ROWS - 1 - r;
        const m2 = `${c2},${r2}`;
        if (reserved.has(m1) || reserved.has(m2)) continue;
        const t1 = this.hexMap.get(m1), t2 = this.hexMap.get(m2);
        if (!t1 || !t2 || t1.obstacle || t2.obstacle) continue;
        t1.obstacle = t2.obstacle = true;
        this.drawObstacle(t1);
        this.drawObstacle(t2);
        pairs--;
      }
    }

    drawObstacle(tile) {
      const rock = this.add.circle(tile.x, tile.y, HEX_SIZE * 0.7, 0x8290a5, 0.95).setStrokeStyle(2, 0x0a1220, 0.9);
      const tag = this.add.text(tile.x, tile.y, 'X', { fontFamily: 'Roboto Mono', fontSize: '18px', color: '#101823' }).setOrigin(0.5);
      tile.marker = this.add.container(0, 0, [rock, tag]);
    }

    spawnTeams() {
      this.aiTeam = pickRandom(Object.keys(TEAM_DATA).filter(t => t !== state.playerTeam));
      const aiLoadout = buildRandomRoster(this.aiTeam);
      const playerRows = this.computeSpawnRows(state.playerRoster.length);
      const aiRows = this.computeSpawnRows(aiLoadout.roster.length);
      state.playerRoster.forEach((unitName, idx) => this.createUnit('player', state.playerTeam, unitName, 0, playerRows[idx]));
      aiLoadout.roster.forEach((unitName, idx) => this.createUnit('ai', this.aiTeam, unitName, COLS - 1, aiRows[idx]));
      this.playerPowerups = deepClone(state.playerPowerups);
      this.aiPowerups = aiLoadout.powerups;
    }

    computeSpawnRows(count) {
      if (count <= 1) return [Math.floor(ROWS / 2)];
      const rows = [];
      for (let i = 0; i < count; i++) rows.push(Math.round(i * (ROWS - 1) / (count - 1)));
      return [...new Set(rows)].map(r => clamp(r, 0, ROWS - 1));
    }

    createUnit(side, team, unitName, col, row) {
      const stats = UNIT_DATA[unitName];
      const key = TEAM_DATA[team].sprite;
      const { x, y } = hexToPixel(col, row);
      const shadow = this.add.ellipse(x, y + 26, 24, 10, 0x000000, 0.35);
      const sprite = this.add.image(x, y + 2, key).setScale(0.08);
      const hpBarBg = this.add.rectangle(x, y - 35, 38, 6, 0x000000, 0.7);
      const hpBar = this.add.rectangle(x - 18, y - 35, 36, 4, side === 'player' ? 0x5df08f : 0xff7a76, 1).setOrigin(0, 0.5);
      const label = this.add.text(x, y + 36, unitName, { fontFamily: 'Roboto Mono', fontSize: '11px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
      const hitArea = this.add.zone(x, y, 44, 70).setInteractive({ useHandCursor: true });
      const unit = {
        id: Phaser.Math.RND.uuid(), side, team, unitName, col, row,
        hp: stats.hp, maxHp: stats.hp, speed: stats.speed, range: stats.range, atk: stats.atk, def: stats.def, dmg: stats.dmg,
        moved: 0, hasAttacked: false, stunned: false, poisoned: false, burning: false, carryingFlag: false, alive: true,
        sprite, label, hpBar, hpBarBg, hitArea, shadow
      };
      hitArea.on('pointerdown', () => this.onUnitClicked(unit));
      this.units.push(unit);
      this.setUnitMap(unit, col, row);
      return unit;
    }

    setUnitMap(unit, col, row) {
      if (unit.mapKey) this.unitMap.delete(unit.mapKey);
      unit.col = col; unit.row = row; unit.mapKey = `${col},${row}`;
      this.unitMap.set(unit.mapKey, unit);
      const { x, y } = hexToPixel(col, row);
      unit.shadow.setPosition(x, y + 26);
      unit.sprite.setPosition(x, y + 2);
      unit.hpBarBg.setPosition(x, y - 35);
      unit.hpBar.setPosition(x - 18, y - 35);
      unit.label.setPosition(x, y + 36);
      unit.hitArea.setPosition(x, y);
      unit.hpBar.width = Math.max(0, (unit.hp / unit.maxHp) * 36);
    }

    placeFlag() {
      const candidates = this.board.filter(tile => !tile.obstacle && !this.baseTiles.player.has(`${tile.col},${tile.row}`) && !this.baseTiles.ai.has(`${tile.col},${tile.row}`));
      candidates.sort((a, b) => hexDistance(a, { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) }) - hexDistance(b, { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) }));
      const tile = candidates[0];
      const gem = this.add.star(tile.x, tile.y, 5, 8, 16, 0xffe27a, 1).setStrokeStyle(2, 0x5d4b14, 0.8);
      this.flag = { col: tile.col, row: tile.row, sprite: gem, carrierId: null };
    }

    beginTurn(side) {
      this.turnSide = side;
      this.phase = 'move';
      this.movePool = MOVE_POOL;
      this.pendingAction = null;
      this.selectedUnit = null;
      this.aiTurnRunning = false;
      this.units.filter(u => u.side === side && u.alive).forEach(u => {
        u.moved = 0;
        u.hasAttacked = false;
      });
      this.applyStartTurnEffects(side);
      this.updateUI();
      if (this.checkEndConditions()) return;
      if (side === 'ai') {
        this.aiTurnRunning = true;
        this.log('AI turn begins.');
        this.time.delayedCall(500, () => this.runAiTurn());
      } else {
        this.log('Player turn begins.');
      }
    }

    applyStartTurnEffects(side) {
      this.units.filter(u => u.side === side && u.alive).forEach(u => {
        if (u.poisoned) {
          this.log(`${u.unitName} suffers 1 poison damage.`);
          this.applyDamage(u, 1, null, 'poison');
        }
        if (!u.alive) return;
        if (u.burning) {
          this.log(`${u.unitName} suffers 2 fire damage.`);
          this.applyDamage(u, 2, null, 'fire');
          u.burning = false;
        }
        const hazard = this.hazards.get(`${u.col},${u.row}`);
        if (hazard) {
          this.log(`${u.unitName} is standing in ${hazard.type}.`);
          this.applyDamage(u, hazard.damage, null, hazard.type);
        }
      });
      this.units.filter(u => u.side === side && u.alive).forEach(u => {
        if (u.stunned) {
          this.log(`${u.unitName} is stunned this turn.`);
          u.hitArea.disableInteractive();
          u.sprite.setAlpha(0.5);
        } else {
          u.sprite.setAlpha(1);
          u.hitArea.setInteractive({ useHandCursor: true });
        }
      });
      this.time.delayedCall(50, () => {
        this.units.filter(u => u.side === side).forEach(u => {
          if (!u.alive) return;
          if (u.stunned) {
            u.stunned = false;
          }
          u.sprite.setAlpha(1);
          u.hitArea.setInteractive({ useHandCursor: true });
        });
      });
    }

    onUnitClicked(unit) {
      if (!unit.alive) return;
      if (this.pendingAction) return this.resolvePendingActionOnUnit(unit);
      if (this.turnSide === 'player') {
        if (unit.side === 'player') {
          if (unit.stunned) { this.log(`${unit.unitName} is stunned and cannot act.`); return; }
          this.selectedUnit = unit;
          this.updateUI();
        } else if (unit.side === 'ai' && this.selectedUnit && this.phase === 'attack') {
          this.tryAttack(this.selectedUnit, unit);
        }
      }
    }

    onTileClicked(tile) {
      if (this.pendingAction) return this.resolvePendingActionOnTile(tile);
      if (this.turnSide !== 'player' || !this.selectedUnit || this.aiTurnRunning) return;
      if (this.phase === 'move') {
        this.tryMoveUnit(this.selectedUnit, tile.col, tile.row);
      }
    }

    resolvePendingActionOnUnit(unit) {
      const action = this.pendingAction;
      if (action.type === 'medpack') {
        if (unit.side !== 'player' || !unit.alive) return this.log('Choose a living friendly unit.');
        if (unit.hp >= unit.maxHp) return this.log('That unit is already at full health.');
        unit.hp = Math.min(unit.maxHp, unit.hp + 3);
        this.updateUnitVisual(unit);
        this.consumePlayerPowerup('Med Pack');
        this.pendingAction = null;
        this.log(`Med Pack restores ${unit.unitName} to ${unit.hp}/${unit.maxHp} HP.`);
      } else if (action.type === 'teleporter-select') {
        if (unit.side !== 'player' || !unit.alive) return this.log('Select a living friendly unit to teleport.');
        this.pendingAction = { type: 'teleporter-destination', unit };
        this.log(`Select an empty destination tile for ${unit.unitName}.`);
      }
      this.updateUI();
    }

    resolvePendingActionOnTile(tile) {
      const key = `${tile.col},${tile.row}`;
      if (tile.obstacle || this.unitMap.has(key)) return this.log('That tile is blocked.');
      if (this.pendingAction.type === 'mine') {
        const mineSprite = this.add.circle(tile.x, tile.y, 8, 0xffcc4d, 1).setStrokeStyle(2, 0x4b3214, 0.9);
        this.mines.set(key, { col: tile.col, row: tile.row, sprite: mineSprite, owner: 'player' });
        this.consumePlayerPowerup('Mine');
        this.pendingAction = null;
        this.log(`Mine placed at ${tile.col},${tile.row}.`);
      } else if (this.pendingAction.type === 'teleporter-destination') {
        const unit = this.pendingAction.unit;
        if (!unit.alive) return;
        this.unitMap.delete(unit.mapKey);
        this.setUnitMap(unit, tile.col, tile.row);
        this.consumePlayerPowerup('Teleporter');
        this.pendingAction = null;
        this.log(`${unit.unitName} teleported.`);
        this.checkFlagPickup(unit);
      }
      this.updateUI();
    }

    consumePlayerPowerup(name) {
      const idx = this.playerPowerups.indexOf(name);
      if (idx >= 0) this.playerPowerups.splice(idx, 1);
      this.refreshPowerupButtons();
    }

    refreshPowerupButtons() {
      this.powerupButtons.forEach(btn => btn.destroy && btn.destroy());
      this.powerupButtons = [];
      const powerups = [...this.playerPowerups];
      const countMap = {};
      powerups.forEach(p => countMap[p] = (countMap[p] || 0) + 1);
      Object.keys(countMap).forEach((name, idx) => {
        const y = 290 + idx * 42;
        const rect = this.add.rectangle(955, y, 150, 32, 0x173153, 0.95).setStrokeStyle(1, 0xffd07a, 0.7).setInteractive({ useHandCursor: true });
        const text = this.add.text(880, y - 11, `${name} x${countMap[name]}`, { fontFamily: 'Roboto Mono', fontSize: '15px', color: '#ffe19f' });
        rect.on('pointerdown', () => this.activatePowerup(name));
        this.powerupButtons.push(rect, text);
      });
    }

    activatePowerup(name) {
      if (this.turnSide !== 'player') return;
      if (name === 'Med Pack') {
        this.pendingAction = { type: 'medpack' };
        this.log('Select a damaged friendly unit to heal.');
      } else if (name === 'Mine') {
        this.pendingAction = { type: 'mine' };
        this.log('Select an empty hex for the mine.');
      } else if (name === 'Teleporter') {
        this.pendingAction = { type: 'teleporter-select' };
        this.log('Select a friendly unit to teleport.');
      }
      this.updateUI();
    }

    tilePassable(col, row, movingUnit = null) {
      const key = `${col},${row}`;
      const tile = this.hexMap.get(key);
      if (!tile || tile.obstacle) return false;
      const occupant = this.unitMap.get(key);
      if (occupant && occupant !== movingUnit && occupant.alive) return false;
      if (state.mode === 'Capture the Flag') {
        if ((this.baseTiles.player.has(key) || this.baseTiles.ai.has(key)) && !(movingUnit && movingUnit.carryingFlag)) return false;
      }
      return true;
    }

    findPath(start, goal, movingUnit = null) {
      const startKey = `${start.col},${start.row}`;
      const goalKey = `${goal.col},${goal.row}`;
      const frontier = [startKey];
      const came = { [startKey]: null };
      while (frontier.length) {
        const current = frontier.shift();
        if (current === goalKey) break;
        const [cc, rr] = current.split(',').map(Number);
        for (const n of neighbors(cc, rr)) {
          const nk = `${n.col},${n.row}`;
          if (came[nk] !== undefined) continue;
          if (!this.tilePassable(n.col, n.row, movingUnit) && nk !== goalKey) continue;
          came[nk] = current;
          frontier.push(nk);
        }
      }
      if (came[goalKey] === undefined) return null;
      const path = [];
      let cur = goalKey;
      while (cur !== startKey) {
        const [c, r] = cur.split(',').map(Number);
        path.unshift({ col: c, row: r });
        cur = came[cur];
      }
      return path;
    }

    tryMoveUnit(unit, col, row) {
      if (!unit || !unit.alive || unit.side !== this.turnSide || unit.stunned) return;
      const path = this.findPath({ col: unit.col, row: unit.row }, { col, row }, unit);
      if (!path || !path.length) return this.log('No path to that tile.');
      const cap = unit.carryingFlag ? 2 : unit.speed;
      const maxMove = Math.min(this.movePool, cap - unit.moved);
      if (path.length > maxMove) return this.log(`Move too long. Max available: ${maxMove}.`);
      this.movePool -= path.length;
      unit.moved += path.length;
      this.animateMove(unit, path, () => {
        this.checkFlagPickup(unit);
        this.updateUI();
        this.checkEndConditions();
      });
    }

    animateMove(unit, path, onDone) {
      if (!path.length) { onDone && onDone(); return; }
      const step = path.shift();
      this.unitMap.delete(unit.mapKey);
      unit.col = step.col;
      unit.row = step.row;
      unit.mapKey = `${step.col},${step.row}`;
      this.unitMap.set(unit.mapKey, unit);
      const { x, y } = hexToPixel(step.col, step.row);
      this.tweens.add({ targets: unit.shadow, x, y: y + 26, duration: 140 });
      this.tweens.add({ targets: unit.sprite, x, y: y + 2, duration: 140 });
      this.tweens.add({ targets: unit.hpBarBg, x, y: y - 35, duration: 140 });
      this.tweens.add({ targets: unit.hpBar, x: x - 18, y: y - 35, duration: 140 });
      this.tweens.add({ targets: unit.label, x, y: y + 36, duration: 140 });
      this.tweens.add({
        targets: unit.hitArea, x, y, duration: 140,
        onComplete: () => {
          const mine = this.mines.get(`${unit.col},${unit.row}`);
          if (mine) {
            this.triggerMine(mine, unit);
            if (!unit.alive) return onDone && onDone();
          }
          this.time.delayedCall(20, () => this.animateMove(unit, path, onDone));
        }
      });
    }

    triggerMine(mine, triggeringUnit) {
      this.mines.delete(`${mine.col},${mine.row}`);
      if (mine.sprite) mine.sprite.destroy();
      this.log(`${triggeringUnit.unitName} triggered a mine!`);
      this.applyDamage(triggeringUnit, 2, null, 'mine');
      neighbors(mine.col, mine.row).forEach(n => {
        const unit = this.unitMap.get(`${n.col},${n.row}`);
        if (unit && unit.alive) this.applyDamage(unit, 1, null, 'mine-splash');
        const chainMine = this.mines.get(`${n.col},${n.row}`);
        if (chainMine) this.triggerMine(chainMine, { unitName: 'A nearby unit', col: chainMine.col, row: chainMine.row, alive: true });
      });
    }

    tryAttack(attacker, defender) {
      if (!attacker || !defender || !attacker.alive || !defender.alive) return;
      if (attacker.side !== this.turnSide) return;
      if (attacker.hasAttacked) return this.log(`${attacker.unitName} already attacked.`);
      if (attacker.carryingFlag) return this.log('Flag carriers cannot attack.');
      if (attacker.stunned) return this.log('That unit is stunned.');
      const dist = hexDistance(attacker, defender);
      if (dist > attacker.range) return this.log('Target out of range.');
      const obstacleSet = new Set(this.board.filter(t => t.obstacle).map(t => `${t.col},${t.row}`));
      if (!lineOfSightClear(attacker, defender, obstacleSet)) return this.log('Line of sight blocked.');
      attacker.hasAttacked = true;
      const atkRoll = randInt(1, 10) + attacker.atk;
      const defRoll = randInt(1, 10) + defender.def;
      const hit = atkRoll > defRoll;
      this.playAttackFx(attacker, defender, hit);
      if (hit) {
        this.log(`${attacker.unitName} hits ${defender.unitName} (${atkRoll} > ${defRoll}) for ${attacker.dmg}.`);
        this.applyDamage(defender, attacker.dmg, attacker, 'attack');
        this.applyUnitSpecial(attacker, defender);
      } else {
        this.log(`${attacker.unitName} misses ${defender.unitName} (${atkRoll} ≤ ${defRoll}).`);
      }
      this.selectedUnit = null;
      this.updateUI();
      this.checkEndConditions();
    }

    playAttackFx(attacker, defender, hit) {
      const snd = this.sound.play(hit ? 'sfx_shot' : 'sfx_ricochet', { volume: 0.25 });
      const beam = this.add.line(0, 0, attacker.sprite.x, attacker.sprite.y, defender.sprite.x, defender.sprite.y, hit ? 0xffd07a : 0xcbd8e6, 0.9).setLineWidth(3, 3);
      this.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() });
    }

    applyUnitSpecial(attacker, defender) {
      switch (attacker.unitName) {
        case 'Grenadier':
          neighbors(defender.col, defender.row).forEach(n => {
            const unit = this.unitMap.get(`${n.col},${n.row}`);
            if (unit && unit.alive) this.applyDamage(unit, 1, attacker, 'splash');
          });
          this.log('Grenadier splash hits adjacent hexes for 1.');
          break;
        case 'Shock Trooper':
          if (defender.alive) defender.stunned = true;
          this.log(`${defender.unitName} is stunned for its next turn.`);
          break;
        case 'Slasher':
        case 'Assassin':
          if (defender.alive) defender.poisoned = true;
          this.log(`${defender.unitName} is poisoned.`);
          break;
        case 'Acid Thrower':
          this.createHazard(defender.col, defender.row, 'acid', 2);
          this.log('Acid spreads across the target tile.');
          break;
        case 'Grunt':
        case 'Sharpshooter':
          if (defender.alive) defender.burning = true;
          this.log(`${defender.unitName} is set on fire.`);
          break;
        case 'Fire Caller':
          for (let r = 0; r < ROWS; r++) {
            this.createHazard(defender.col, r, 'fire', 2);
            const unit = this.unitMap.get(`${defender.col},${r}`);
            if (unit && unit.alive && unit !== defender) this.applyDamage(unit, 4, attacker, 'fire-column');
          }
          this.log('A full column erupts in flame.');
          break;
      }
    }

    createHazard(col, row, type, damage) {
      const key = `${col},${row}`;
      const existing = this.hazards.get(key);
      if (existing) existing.sprite.destroy();
      const tile = this.hexMap.get(key);
      const sprite = this.add.circle(tile.x, tile.y, 10, type === 'acid' ? 0x69ff8c : 0xff8f4b, 0.8);
      sprite.setStrokeStyle(2, 0x0a1220, 0.85);
      this.hazards.set(key, { type, damage, sprite });
    }

    applyDamage(unit, amount, source, tag) {
      if (!unit.alive) return;
      unit.hp -= amount;
      this.updateUnitVisual(unit);
      this.tweens.add({ targets: unit.sprite, alpha: 0.2, yoyo: true, duration: 90, repeat: 1 });
      if (unit.hp <= 0) this.killUnit(unit, source, tag);
    }

    updateUnitVisual(unit) {
      unit.hp = Math.max(0, unit.hp);
      unit.hpBar.width = Math.max(0, (unit.hp / unit.maxHp) * 36);
    }

    killUnit(unit, source, tag) {
      if (!unit.alive) return;
      unit.alive = false;
      this.unitMap.delete(unit.mapKey);
      this.tweens.add({
        targets: [unit.sprite, unit.shadow, unit.hpBar, unit.hpBarBg, unit.label, unit.hitArea],
        alpha: 0, duration: 280,
        onComplete: () => {
          unit.hitArea.disableInteractive();
        }
      });
      this.log(`${unit.unitName} is eliminated.`);
      if (unit.carryingFlag && this.flag) {
        this.flag.carrierId = null;
        this.flag.col = unit.col;
        this.flag.row = unit.row;
        this.flag.sprite.setPosition(unit.sprite.x, unit.sprite.y - 18).setVisible(true);
        unit.carryingFlag = false;
        this.log('The flag drops to the ground.');
      }
    }

    checkFlagPickup(unit) {
      if (state.mode !== 'Capture the Flag' || !this.flag || !unit.alive) return;
      if (!this.flag.carrierId && unit.col === this.flag.col && unit.row === this.flag.row) {
        this.flag.carrierId = unit.id;
        unit.carryingFlag = true;
        this.flag.sprite.setVisible(false);
        this.log(`${unit.unitName} picked up the flag.`);
      }
      this.checkEndConditions();
    }

    highlightHover(tile) {
      if (tile.obstacle) return;
      tile.graphics.clear();
      this.drawTile(tile, 0x21486c, 0x8bc0ff);
    }

    clearHover(tile) {
      this.redrawTile(tile);
    }

    redrawTile(tile) {
      tile.graphics.clear();
      const key = `${tile.col},${tile.row}`;
      let fill = 0x10253a;
      let stroke = 0x45729b;
      if (this.baseTiles.player.has(key)) fill = 0x163a2b;
      if (this.baseTiles.ai.has(key)) fill = 0x432024;
      if (this.selectedUnit && this.selectedUnit.col === tile.col && this.selectedUnit.row === tile.row) fill = 0x2f4d78;
      this.drawTile(tile, fill, stroke);
    }

    drawTile(tile, fill, stroke) {
      const points = hexPolyPoints(HEX_SIZE);
      tile.graphics.fillStyle(fill, 0.92);
      tile.graphics.lineStyle(2, stroke, 0.62);
      tile.graphics.beginPath();
      tile.graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) tile.graphics.lineTo(points[i].x, points[i].y);
      tile.graphics.closePath();
      tile.graphics.fillPath();
      tile.graphics.strokePath();
    }

    endPlayerTurn() {
      if (this.turnSide !== 'player') return;
      this.selectedUnit = null;
      this.pendingAction = null;
      this.beginTurn('ai');
    }

    async runAiTurn() {
      const aiUnits = this.units.filter(u => u.side === 'ai' && u.alive);
      for (const unit of aiUnits) {
        if (this.checkEndConditions()) return;
        if (unit.stunned) continue;
        const moveTarget = this.chooseAiMoveTarget(unit);
        if (moveTarget) {
          const path = this.findPath({ col: unit.col, row: unit.row }, moveTarget, unit);
          if (path && path.length) {
            const cap = unit.carryingFlag ? 2 : unit.speed;
            const budget = Math.min(this.movePool, cap - unit.moved);
            const actual = path.slice(0, budget);
            if (actual.length) {
              this.movePool -= actual.length;
              unit.moved += actual.length;
              await new Promise(resolve => this.animateMove(unit, actual, resolve));
              this.checkFlagPickup(unit);
              if (this.checkEndConditions()) return;
            }
          }
        }
      }
      this.phase = 'attack';
      this.updateUI();
      await this.wait(250);
      for (const unit of this.units.filter(u => u.side === 'ai' && u.alive)) {
        if (unit.hasAttacked || unit.stunned || unit.carryingFlag) continue;
        const target = this.chooseAiAttackTarget(unit);
        if (target) {
          this.tryAttack(unit, target);
          await this.wait(360);
          if (this.checkEndConditions()) return;
        }
      }
      this.beginTurn('player');
    }

    wait(ms) { return new Promise(resolve => this.time.delayedCall(ms, resolve)); }

    chooseAiMoveTarget(unit) {
      if (state.mode === 'Capture the Flag') {
        if (unit.carryingFlag) {
          return this.closestBaseTile('ai', unit);
        }
        if (this.flag && !this.flag.carrierId) {
          return { col: this.flag.col, row: this.flag.row };
        }
        const playerCarrier = this.units.find(u => u.side === 'player' && u.alive && u.carryingFlag);
        if (playerCarrier) return { col: playerCarrier.col, row: playerCarrier.row };
      }
      const targets = this.units.filter(u => u.side === 'player' && u.alive);
      if (!targets.length) return null;
      targets.sort((a, b) => hexDistance(unit, a) - hexDistance(unit, b));
      const near = targets[0];
      let best = { col: unit.col, row: unit.row };
      let bestDist = hexDistance(best, near);
      for (const n of this.board.filter(t => this.tilePassable(t.col, t.row, unit))) {
        const distFromUnit = this.findPath({ col: unit.col, row: unit.row }, { col: n.col, row: n.row }, unit);
        if (!distFromUnit) continue;
        const maxMove = Math.min(this.movePool, (unit.carryingFlag ? 2 : unit.speed) - unit.moved);
        if (distFromUnit.length > maxMove) continue;
        const d = hexDistance(n, near);
        if (d < bestDist) { best = { col: n.col, row: n.row }; bestDist = d; }
      }
      return bestDist < hexDistance(unit, near) ? best : null;
    }

    chooseAiAttackTarget(unit) {
      const enemies = this.units.filter(u => u.side === 'player' && u.alive)
        .filter(e => hexDistance(unit, e) <= unit.range)
        .filter(e => lineOfSightClear(unit, e, new Set(this.board.filter(t => t.obstacle).map(t => `${t.col},${t.row}`))));
      if (!enemies.length) return null;
      enemies.sort((a, b) => {
        const aPriority = (a.carryingFlag ? 100 : 0) + (a.hp <= unit.dmg ? 50 : 0) - a.hp;
        const bPriority = (b.carryingFlag ? 100 : 0) + (b.hp <= unit.dmg ? 50 : 0) - b.hp;
        return bPriority - aPriority;
      });
      return enemies[0];
    }

    closestBaseTile(side, unit) {
      const entries = [...this.baseTiles[side]].map(k => {
        const [col, row] = k.split(',').map(Number);
        return { col, row };
      });
      entries.sort((a, b) => hexDistance(unit, a) - hexDistance(unit, b));
      return entries[0];
    }

    checkEndConditions() {
      const playerAlive = this.units.some(u => u.side === 'player' && u.alive);
      const aiAlive = this.units.some(u => u.side === 'ai' && u.alive);
      if (!playerAlive) { this.finishBattle(false, 'All player units eliminated.'); return true; }
      if (!aiAlive) { this.finishBattle(true, 'All AI units eliminated.'); return true; }
      if (state.mode === 'Capture the Flag') {
        const playerCarrier = this.units.find(u => u.side === 'player' && u.alive && u.carryingFlag);
        const aiCarrier = this.units.find(u => u.side === 'ai' && u.alive && u.carryingFlag);
        if (playerCarrier && this.baseTiles.player.has(`${playerCarrier.col},${playerCarrier.row}`)) {
          this.finishBattle(true, 'Player returned the flag to base.'); return true;
        }
        if (aiCarrier && this.baseTiles.ai.has(`${aiCarrier.col},${aiCarrier.row}`)) {
          this.finishBattle(false, 'AI returned the flag to base.'); return true;
        }
      }
      return false;
    }

    finishBattle(win, reason) {
      if (this.battleEnded) return;
      this.battleEnded = true;
      state.lastResult = `${win ? 'Victory' : 'Defeat'} — ${reason}`;
      if (win) state.wins++; else state.losses++;
      if (window.__tactixTheme && window.__tactixTheme.isPlaying) window.__tactixTheme.stop();
      this.sound.play(win ? 'music_win' : 'music_loss', { volume: 0.35 });
      this.add.rectangle(GAME_W / 2, GAME_H / 2, 560, 220, 0x07111d, 0.96).setStrokeStyle(2, win ? 0x71ff9b : 0xff7d7d, 0.95);
      this.add.text(GAME_W / 2, GAME_H / 2 - 50, win ? 'VICTORY' : 'DEFEAT', {
        fontFamily: 'Iceberg', fontSize: '72px', color: win ? '#9bffbb' : '#ffb1b1'
      }).setOrigin(0.5);
      this.add.text(GAME_W / 2, GAME_H / 2 + 15, reason, {
        fontFamily: 'Roboto Mono', fontSize: '18px', color: '#ffffff', wordWrap: { width: 460 }, align: 'center'
      }).setOrigin(0.5);
      createButton(this, GAME_W / 2, GAME_H / 2 + 78, 220, 52, 'RETURN TO TITLE', () => this.scene.start('Title'), { size: '24px', fill: 0x173153 });
    }

    log(line) {
      this.logLines.unshift(line);
      this.logLines = this.logLines.slice(0, 12);
      this.logText.setText(this.logLines.join('\n'));
    }

    updateUI() {
      this.sideText.setText(`${this.turnSide === 'player' ? 'PLAYER' : 'AI'} TURN`);
      this.modeText.setText(`${state.mode} • ${state.playerTeam} vs ${this.aiTeam}`);
      this.turnText.setText(`Phase: ${this.phase.toUpperCase()}   Move Pool: ${this.movePool}`);
      this.objectiveText.setText(state.mode === 'Melee'
        ? 'Objective: eliminate all enemy units.'
        : 'Objective: grab the neutral flag and return it to your base, or destroy all enemies.');
      if (this.pendingAction) {
        this.selectedText.setText(`Pending action: ${this.pendingAction.type}`);
      } else if (this.selectedUnit) {
        const u = this.selectedUnit;
        this.selectedText.setText([
          `${u.unitName} • ${u.team}`,
          `HP ${u.hp}/${u.maxHp}  SPD ${u.speed}  RNG ${u.range}`,
          `ATK +${u.atk}  DEF +${u.def}  DMG ${u.dmg}`,
          `Moved ${u.moved}/${u.carryingFlag ? 2 : u.speed}  Attacked: ${u.hasAttacked ? 'Yes' : 'No'}`,
          `Status: ${u.poisoned ? 'Poisoned ' : ''}${u.burning ? 'Burning ' : ''}${u.carryingFlag ? 'Flag Carrier' : 'Ready'}`
        ].join('\n'));
      } else {
        this.selectedText.setText('Select a friendly unit, then click a tile to move or an enemy to attack.');
      }
      this.board.forEach(t => this.redrawTile(t));
      if (this.flag && this.flag.carrierId) {
        const carrier = this.units.find(u => u.id === this.flag.carrierId);
        if (carrier && carrier.alive) {
          this.flag.sprite.setPosition(carrier.sprite.x, carrier.sprite.y - 22).setVisible(true);
        }
      }
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#05070d',
    scene: [BootScene, TitleScene, ModeSelectScene, TeamSelectScene, SquadBuilderScene, BattleScene]
  };

  window.addEventListener('load', () => {
    new Phaser.Game(config);
  });
})();
