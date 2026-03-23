// ============================================================
// board.js — Hex grid geometry, tile rendering, pathfinding, LOS
// ============================================================

const Board = (() => {

  const COLS = Data.BOARD_COLS;   // 20
  const ROWS = Data.BOARD_ROWS;   // 10

  // Pointy-top hexes with an isometric-style presentation.
  const HEX_R    = 28;
  const HEX_W    = Math.sqrt(3) * HEX_R;
  const HEX_H    = 2 * HEX_R;
  const COL_STEP = HEX_R * 1.5;
  const ROW_STEP = HEX_W;
  const SHEAR    = 0.42;
  const SCALE_Y  = 0.72;

  // Gameplay area: canvas 1280×720, top bar 48px, bottom bar 52px
  // Usable: 1280 × 620 starting at y=48
  // Board is centered within that area.
  // Origin is computed so the board sits centered.
  const GAME_TOP    = 48;
  const GAME_BOTTOM = 52;
  const GAME_H      = 720 - GAME_TOP - GAME_BOTTOM;   // 620

  // After shear+scale, the four corners:
  function _corner(col, row) {
    const rx = col * COL_STEP;
    const ry = row * ROW_STEP + (col % 2 === 0 ? 0 : ROW_STEP / 2);
    return { x: rx + ry * SHEAR, y: ry * SCALE_Y };
  }

  const _corners = [[0,0],[COLS-1,0],[0,ROWS-1],[COLS-1,ROWS-1]].map(([c,r])=>_corner(c,r));
  const _boardMinX = Math.min(..._corners.map(p=>p.x));
  const _boardMaxX = Math.max(..._corners.map(p=>p.x));
  const _boardMinY = Math.min(..._corners.map(p=>p.y));
  const _boardMaxY = Math.max(..._corners.map(p=>p.y));
  const _boardW    = _boardMaxX - _boardMinX + HEX_R * 2;
  const _boardH    = _boardMaxY - _boardMinY + HEX_R * 2;

  // Origin offsets to center board in usable area
  let ORIGIN_X = (1280 - _boardW) / 2 - _boardMinX + HEX_R;
  let ORIGIN_Y = GAME_TOP + (GAME_H - _boardH) / 2 - _boardMinY + HEX_R;

  // Tile type enum
  const TILE = { EMPTY: 0, OBSTACLE: 1, ACID: 2, FIRE: 3 };

  // State
  let tiles      = [];
  let tileAngles = [];

  // ── Generation ────────────────────────────────────────────
  function generate(obstacleCount) {
    obstacleCount = obstacleCount || Data.OBSTACLE_COUNT;
    tiles      = new Array(COLS * ROWS).fill(TILE.EMPTY);
    tileAngles = tiles.map(() => Math.random() * Math.PI * 2);

    const reserved = new Set();
    for (let r = 0; r < ROWS; r++) {
      reserved.add(idx(0, r));
      reserved.add(idx(COLS - 1, r));
    }
    // Also reserve base tiles for CTF
    PLAYER_BASE.forEach(b => reserved.add(idx(b.col, b.row)));
    AI_BASE.forEach(b => reserved.add(idx(b.col, b.row)));

    let attempts = 0, placed = 0;
    while (placed < Math.floor(obstacleCount / 2) && attempts < 500) {
      attempts++;
      const col = 2 + Math.floor(Math.random() * (Math.floor(COLS / 2) - 2));
      const row = Math.floor(Math.random() * ROWS);
      const i   = idx(col, row);
      const mc  = COLS - 1 - col;
      const mi  = idx(mc, row);
      if (!reserved.has(i) && !reserved.has(mi) && tiles[i] === TILE.EMPTY) {
        tiles[i]  = TILE.OBSTACLE;
        tiles[mi] = TILE.OBSTACLE;
        placed++;
      }
    }
  }

  function idx(col, row)  { return col + row * COLS; }
  function colRow(i)       { return { col: i % COLS, row: Math.floor(i / COLS) }; }
  function getTile(c, r)   { return (c<0||c>=COLS||r<0||r>=ROWS) ? TILE.OBSTACLE : tiles[idx(c,r)]; }
  function setTile(c, r, t){ if (c>=0&&c<COLS&&r>=0&&r<ROWS) tiles[idx(c,r)] = t; }
  function isPassable(c,r) { const t=getTile(c,r); return t===TILE.EMPTY||t===TILE.ACID||t===TILE.FIRE; }

  // ── Axial helpers ─────────────────────────────────────────
  function toAxial(col, row) {
    return { q: col, r: row - Math.floor((col + (col & 1)) / 2) };
  }
  function axialToOffset(q, r) {
    return { col: q, row: r + Math.floor((q + (q & 1)) / 2) };
  }
  function hexDistance(c1, r1, c2, r2) {
    const a = toAxial(c1, r1), b = toAxial(c2, r2);
    const dq = a.q - b.q, dr = a.r - b.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }

  // Even-q offset neighbors
  function neighbors(col, row) {
    const even = [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
    const odd  = [[1,1],[1, 0],[0,-1],[-1, 0],[-1,1],[0,1]];
    const offs = (col % 2 === 0) ? even : odd;
    return offs.map(([dc,dr]) => ({ col: col+dc, row: row+dr }))
               .filter(({col:c,row:r}) => c>=0&&c<COLS&&r>=0&&r<ROWS);
  }

  // ── Pathfinding ───────────────────────────────────────────
  function findPath(fc, fr, tc, tr, occupiedFn) {
    if (fc===tc && fr===tr) return [];
    if (!isPassable(tc, tr)) return null;
    const start = idx(fc, fr), goal = idx(tc, tr);
    const visited = new Map([[start, null]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      const {col, row} = colRow(cur);
      for (const nb of neighbors(col, row)) {
        const ni = idx(nb.col, nb.row);
        if (visited.has(ni)) continue;
        if (!isPassable(nb.col, nb.row)) continue;
        if (occupiedFn && occupiedFn(nb.col, nb.row) && ni !== goal) continue;
        visited.set(ni, cur);
        queue.push(ni);
      }
    }
    if (!visited.has(goal)) return null;
    const path = [];
    let cur = goal;
    while (cur !== start) { path.unshift(colRow(cur)); cur = visited.get(cur); }
    return path;
  }

  function reachable(fc, fr, maxSteps, occupiedFn) {
    const result = new Set();
    const dist = new Map([[idx(fc,fr), 0]]);
    const queue = [idx(fc,fr)];
    while (queue.length) {
      const cur = queue.shift();
      const d = dist.get(cur);
      if (d >= maxSteps) continue;
      const {col, row} = colRow(cur);
      for (const nb of neighbors(col, row)) {
        const ni = idx(nb.col, nb.row);
        if (dist.has(ni)) continue;
        if (!isPassable(nb.col, nb.row)) continue;
        if (occupiedFn && occupiedFn(nb.col, nb.row)) continue;
        dist.set(ni, d+1);
        result.add(ni);
        queue.push(ni);
      }
    }
    return result;
  }

  // ── Line of sight ─────────────────────────────────────────
  function hasLOS(c1, r1, c2, r2) {
    const dist = hexDistance(c1, r1, c2, r2);
    if (dist === 0) return true;
    const a1 = toAxial(c1, r1), a2 = toAxial(c2, r2);
    for (let i = 1; i < dist; i++) {
      const t  = i / dist;
      const q  = a1.q + (a2.q - a1.q) * t;
      const r  = a1.r + (a2.r - a1.r) * t;
      const rq = Math.round(q), rr = Math.round(r);
      const off = axialToOffset(rq, rr);
      if (getTile(off.col, off.row) === TILE.OBSTACLE) return false;
    }
    return true;
  }

  // ── Screen-space transform ────────────────────────────────
  function hexCenter(col, row) {
    const rx = col * COL_STEP;
    const ry = row * ROW_STEP + (col % 2 === 0 ? 0 : ROW_STEP / 2);
    return {
      x: ORIGIN_X + rx + ry * SHEAR,
      y: ORIGIN_Y + ry * SCALE_Y
    };
  }

  // Pointy-top hex path
  function drawHexPath(ctx, cx, cy, r) {
    r = r || HEX_R;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ── Texture drawing ───────────────────────────────────────
  function drawTextureTile(ctx, cx, cy, r, imageKey, angle, alpha) {
    alpha = (alpha === undefined) ? 1 : alpha;
    const img = TactixEngine.getImage(imageKey);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const sz = r * 2.6;
    ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
    ctx.restore();
  }

  // ── Render ────────────────────────────────────────────────
  function render(ctx, highlights, mines) {
    highlights = highlights || {};
    mines      = mines      || [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i    = idx(col, row);
        const type = tiles[i];
        const {x, y} = hexCenter(col, row);
        const angle  = tileAngles[i];

        ctx.save();
        drawHexPath(ctx, x, y, HEX_R);
        ctx.clip();

        if (type === TILE.OBSTACLE) {
          drawTextureTile(ctx, x, y, HEX_R, 'rock_texture', angle);
        } else if (type === TILE.ACID) {
          drawTextureTile(ctx, x, y, HEX_R, 'dirt_texture', angle);
          drawTextureTile(ctx, x, y, HEX_R, 'acid_texture', 0, 0.9);
        } else if (type === TILE.FIRE) {
          drawTextureTile(ctx, x, y, HEX_R, 'dirt_texture', angle);
          drawTextureTile(ctx, x, y, HEX_R, 'fire_texture', 0, 0.9);
        } else {
          drawTextureTile(ctx, x, y, HEX_R, 'dirt_texture', angle);
        }

        ctx.restore();

        // Stroke outline
        drawHexPath(ctx, x, y, HEX_R);
        ctx.strokeStyle = type === TILE.OBSTACLE ? '#3d4f58' : '#61767f';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Highlight overlays
        const hl = highlights[i];
        if (hl) {
          drawHexPath(ctx, x, y, HEX_R);
          const hlStyles = {
            move:         { fill:'rgba(58,138,250,0.30)', stroke:'rgba(58,138,250,0.85)', lw:2 },
            attack:       { fill:'rgba(250,60,60,0.28)',  stroke:'rgba(250,60,60,0.88)',  lw:2 },
            selected:     { fill:'rgba(255,255,80,0.18)', stroke:'rgba(255,255,80,0.92)', lw:2.5 },
            base_player:  { fill:'rgba(58,138,250,0.14)', stroke:'rgba(58,138,250,0.45)', lw:1.5 },
            base_ai:      { fill:'rgba(250,80,80,0.14)',  stroke:'rgba(250,80,80,0.45)',  lw:1.5 },
            flag:         { fill:'rgba(255,230,50,0.32)', stroke:'rgba(255,230,50,0.90)', lw:2.5 },
            teleport:     { fill:'rgba(180,80,255,0.26)', stroke:'rgba(180,80,255,0.82)', lw:2 },
            mine_place:   { fill:'rgba(255,160,30,0.20)', stroke:'rgba(255,160,30,0.78)', lw:2 },
          };
          const s = hlStyles[hl];
          if (s) {
            ctx.fillStyle = s.fill; ctx.fill();
            ctx.strokeStyle = s.stroke; ctx.lineWidth = s.lw; ctx.stroke();
          }
        }

        // Mine tokens
        const mine = mines.find(m => m.col === col && m.row === row);
        if (mine) drawMineToken(ctx, x, y, mine.owner);
      }
    }
  }

  function drawMineToken(ctx, cx, cy, owner) {
    ctx.save(); ctx.translate(cx, cy);
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0);
    ctx.closePath();
    ctx.fillStyle = owner==='player' ? 'rgba(58,138,250,0.92)' : 'rgba(250,58,58,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3,-3); ctx.lineTo(3,3); ctx.moveTo(3,-3); ctx.lineTo(-3,3); ctx.stroke();
    ctx.restore();
  }

  function drawFlag(ctx, col, row) {
    const {x, y} = hexCenter(col, row);
    ctx.save(); ctx.translate(x, y - 4);
    ctx.strokeStyle = '#e8d050'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-12); ctx.stroke();
    ctx.fillStyle = '#f0e040';
    ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(12,-7); ctx.lineTo(0,-2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── Hit test ──────────────────────────────────────────────
  function tileAtPoint(px, py) {
    let best = null, bestDist = Infinity;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const {x, y} = hexCenter(col, row);
        const d = Math.hypot(px-x, py-y);
        if (d < HEX_R * 0.9 && d < bestDist) { bestDist = d; best = {col, row}; }
      }
    }
    return best;
  }

  // ── CTF bases & spawns ────────────────────────────────────
  const PLAYER_BASE = [{col:0,row:0},{col:0,row:1},{col:1,row:0}];
  const AI_BASE     = [{col:COLS-1,row:ROWS-1},{col:COLS-1,row:ROWS-2},{col:COLS-2,row:ROWS-1}];

  function isPlayerBase(col, row) { return PLAYER_BASE.some(b=>b.col===col&&b.row===row); }
  function isAIBase(col, row)     { return AI_BASE.some(b=>b.col===col&&b.row===row); }

  function spawnPositions(side, count) {
    const col = side === 'player' ? 0 : COLS - 1;
    const positions = [];
    const step = Math.max(1, Math.floor(ROWS / count));
    for (let i = 0; i < ROWS && positions.length < count; i += step) {
      if (isPassable(col, i)) positions.push({col, row:i});
    }
    for (let i = 0; i < ROWS && positions.length < count; i++) {
      if (isPassable(col, i) && !positions.find(p=>p.row===i)) positions.push({col, row:i});
    }
    return positions.slice(0, count);
  }

  // Recalculate origin when canvas scale changes
  function recalcOrigin(canvasW, canvasH) {
    const gameH = canvasH - GAME_TOP - GAME_BOTTOM;
    ORIGIN_X = (canvasW - _boardW) / 2 - _boardMinX + HEX_R;
    ORIGIN_Y = GAME_TOP + (gameH - _boardH) / 2 - _boardMinY + HEX_R;
  }

  return {
    TILE, COLS, ROWS, HEX_R, HEX_W, HEX_H,
    generate, idx, colRow,
    getTile, setTile, isPassable,
    hexDistance, neighbors,
    findPath, reachable,
    hasLOS, hexCenter,
    drawHexPath, render,
    drawFlag, drawMineToken,
    tileAtPoint,
    PLAYER_BASE, AI_BASE,
    isPlayerBase, isAIBase,
    spawnPositions, recalcOrigin
  };
})();
