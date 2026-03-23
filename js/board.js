// ============================================================
// board.js  —  Flat-top hex grid, shear 30°, scale Y 75%
//              Matches the visual guide exactly.
// ============================================================

const Board = (() => {

  const COLS = Data.BOARD_COLS;   // 20
  const ROWS = Data.BOARD_ROWS;   // 10

  // ── Flat-top hex geometry ─────────────────────────────────
  // A flat-top hex has horizontal tips (left/right) and flat top/bottom edges.
  // R  = circumradius (center to tip)
  // W  = 2*R          (tip to tip width)
  // H  = sqrt(3)*R    (flat-to-flat height)
  // Column x-step     = 1.5*R  (columns overlap by R/2)
  // Row y-step        = sqrt(3)*R
  // Odd columns shift down by sqrt(3)*R/2

  const R        = 30;
  const W        = 2 * R;
  const H        = Math.sqrt(3) * R;        // ≈51.96
  const COL_STEP = 1.5 * R;                 // 45
  const ROW_STEP = H;                       // ≈51.96
  const ODD_OFF  = H / 2;                   // ≈25.98 — odd columns shift down

  // Shear + scale transform (applied to raw grid)
  const SHEAR   = Math.tan(30 * Math.PI / 180);  // tan(30°) ≈ 0.5774
  const SCALE_Y = 0.75;

  // Canvas layout
  const GAME_TOP = 48;   // top bar height
  const GAME_BOT = 52;   // bottom bar height

  // Origin — recomputed in recalcOrigin()
  let OX = 70;
  let OY = 173;

  // ── Tile state ────────────────────────────────────────────
  const TILE = { EMPTY: 0, OBSTACLE: 1, ACID: 2, FIRE: 3 };
  let tiles      = new Array(COLS * ROWS).fill(TILE.EMPTY);
  let tileAngles = tiles.map(() => Math.random() * Math.PI * 2);

  // ── CTF bases (defined before generate so generate can reserve them) ──
  const PLAYER_BASE = [{ col:0,row:0 },{ col:0,row:1 },{ col:1,row:0 }];
  const AI_BASE     = [{ col:COLS-1,row:ROWS-1 },{ col:COLS-1,row:ROWS-2 },{ col:COLS-2,row:ROWS-1 }];

  // ── Board generation ─────────────────────────────────────
  function generate(count) {
    count = count || Data.OBSTACLE_COUNT;
    tiles      = new Array(COLS * ROWS).fill(TILE.EMPTY);
    tileAngles = tiles.map(() => Math.random() * Math.PI * 2);

    const reserved = new Set();
    // Reserve spawn columns
    for (let r = 0; r < ROWS; r++) {
      reserved.add(idx(0, r));
      reserved.add(idx(COLS - 1, r));
    }
    // Reserve bases
    [...PLAYER_BASE, ...AI_BASE].forEach(b => reserved.add(idx(b.col, b.row)));

    let placed = 0, attempts = 0;
    while (placed < Math.floor(count / 2) && attempts < 500) {
      attempts++;
      const col = 2 + Math.floor(Math.random() * (Math.floor(COLS / 2) - 2));
      const row = Math.floor(Math.random() * ROWS);
      const i   = idx(col, row);
      const mc  = COLS - 1 - col;
      const mi  = idx(mc, row);
      if (!reserved.has(i) && !reserved.has(mi) && tiles[i] === TILE.EMPTY) {
        tiles[i] = TILE.OBSTACLE;
        tiles[mi] = TILE.OBSTACLE;
        placed++;
      }
    }
  }

  // ── Index helpers ─────────────────────────────────────────
  function idx(col, row) { return col + row * COLS; }
  function colRow(i)     { return { col: i % COLS, row: Math.floor(i / COLS) }; }

  function getTile(c, r) {
    return (c < 0 || c >= COLS || r < 0 || r >= ROWS) ? TILE.OBSTACLE : tiles[idx(c, r)];
  }
  function setTile(c, r, t) {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tiles[idx(c, r)] = t;
  }
  function isPassable(c, r) {
    const t = getTile(c, r);
    return t === TILE.EMPTY || t === TILE.ACID || t === TILE.FIRE;
  }

  // ── Hex distance (axial coords) ───────────────────────────
  // Flat-top offset-col (odd-col shifted down) → axial
  function toAxial(col, row) {
    const q = col;
    const r = row - Math.floor((col - (col & 1)) / 2);
    return { q, r };
  }
  function axialToOffset(q, r) {
    const col = q;
    const row = r + Math.floor((q - (q & 1)) / 2);
    return { col, row };
  }
  function hexDistance(c1, r1, c2, r2) {
    const a = toAxial(c1, r1), b = toAxial(c2, r2);
    const dq = a.q - b.q, dr = a.r - b.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }

  // Flat-top offset neighbors (odd-col shifted down = "odd-q")
  function neighbors(col, row) {
    const even = [[ 1, 0],[ 1,-1],[ 0,-1],[-1,-1],[-1, 0],[ 0, 1]];
    const odd  = [[ 1, 1],[ 1, 0],[ 0,-1],[-1, 0],[-1, 1],[ 0, 1]];
    return ((col & 1) ? odd : even)
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter(({ col: c, row: r }) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
  }

  // ── Pathfinding ───────────────────────────────────────────
  function findPath(fc, fr, tc, tr, occupiedFn) {
    if (fc === tc && fr === tr) return [];
    if (!isPassable(tc, tr)) return null;
    const start = idx(fc, fr), goal = idx(tc, tr);
    const visited = new Map([[start, null]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      const { col, row } = colRow(cur);
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
    const dist = new Map([[idx(fc, fr), 0]]);
    const queue = [idx(fc, fr)];
    while (queue.length) {
      const cur = queue.shift();
      const d = dist.get(cur);
      if (d >= maxSteps) continue;
      const { col, row } = colRow(cur);
      for (const nb of neighbors(col, row)) {
        const ni = idx(nb.col, nb.row);
        if (dist.has(ni)) continue;
        if (!isPassable(nb.col, nb.row)) continue;
        if (occupiedFn && occupiedFn(nb.col, nb.row)) continue;
        dist.set(ni, d + 1);
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
      const t   = i / dist;
      const off = axialToOffset(
        Math.round(a1.q + (a2.q - a1.q) * t),
        Math.round(a1.r + (a2.r - a1.r) * t)
      );
      if (getTile(off.col, off.row) === TILE.OBSTACLE) return false;
    }
    return true;
  }

  // ── Screen-space transform ────────────────────────────────
  // Raw position of hex center in the un-transformed grid:
  //   x = col * 1.5*R
  //   y = row * sqrt(3)*R  +  (col is odd ? sqrt(3)*R/2 : 0)
  //
  // Then apply:  sx = OX + rx + ry * SHEAR
  //              sy = OY + ry * SCALE_Y

  function hexCenter(col, row) {
    const rx = col * COL_STEP;
    const ry = row * ROW_STEP + (col & 1) * ODD_OFF;
    return {
      x: OX + rx + ry * SHEAR,
      y: OY + ry * SCALE_Y
    };
  }

  // Flat-top hex path: vertices at angles 0°,60°,120°,180°,240°,300°
  function drawHexPath(ctx, cx, cy, r) {
    r = r || R;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;          // 0,60,120,180,240,300°
      const vx = cx + r * Math.cos(a);
      const vy = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  }

  // ── Texture drawing ───────────────────────────────────────
  function drawTextureTile(ctx, cx, cy, r, key, angle, alpha) {
    const img = TactixEngine.getImage(key);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = (alpha === undefined) ? 1 : alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle || 0);
    const sz = r * 2.8;
    ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }

  // ── Full board render ─────────────────────────────────────
  function render(ctx, highlights, mines) {
    highlights = highlights || {};
    mines      = mines      || [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i    = idx(col, row);
        const type = tiles[i];
        const { x, y } = hexCenter(col, row);
        const angle = tileAngles[i];

        // Clipped texture fill
        ctx.save();
        drawHexPath(ctx, x, y, R);
        ctx.clip();

        if      (type === TILE.OBSTACLE) drawTextureTile(ctx, x, y, R, 'rock_texture', angle);
        else if (type === TILE.ACID)     { drawTextureTile(ctx, x, y, R, 'dirt_texture', angle); drawTextureTile(ctx, x, y, R, 'acid_texture', 0, 0.88); }
        else if (type === TILE.FIRE)     { drawTextureTile(ctx, x, y, R, 'dirt_texture', angle); drawTextureTile(ctx, x, y, R, 'fire_texture', 0, 0.88); }
        else                             drawTextureTile(ctx, x, y, R, 'dirt_texture', angle);

        ctx.restore();

        // Hex outline
        drawHexPath(ctx, x, y, R);
        ctx.strokeStyle = type === TILE.OBSTACLE ? '#3d4f58' : '#61767f';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Highlight overlays
        const hl = highlights[i];
        if (hl) {
          const hlMap = {
            move:        { fill: 'rgba(58,138,250,0.32)', stroke: 'rgba(58,138,250,0.88)', lw: 2 },
            attack:      { fill: 'rgba(250,60,60,0.28)',  stroke: 'rgba(250,60,60,0.88)',  lw: 2 },
            selected:    { fill: 'rgba(255,255,80,0.18)', stroke: 'rgba(255,255,80,0.92)', lw: 2.5 },
            base_player: { fill: 'rgba(58,138,250,0.13)', stroke: 'rgba(58,138,250,0.42)', lw: 1.5 },
            base_ai:     { fill: 'rgba(250,80,80,0.13)',  stroke: 'rgba(250,80,80,0.42)',  lw: 1.5 },
            flag:        { fill: 'rgba(255,230,50,0.32)', stroke: 'rgba(255,230,50,0.9)',  lw: 2.5 },
            teleport:    { fill: 'rgba(180,80,255,0.26)', stroke: 'rgba(180,80,255,0.82)', lw: 2 },
            mine_place:  { fill: 'rgba(255,160,30,0.20)', stroke: 'rgba(255,160,30,0.78)', lw: 2 },
          };
          const s = hlMap[hl];
          if (s) {
            drawHexPath(ctx, x, y, R);
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
    ctx.fillStyle   = owner === 'player' ? 'rgba(58,138,250,0.92)' : 'rgba(250,58,58,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3,-3); ctx.lineTo(3,3); ctx.moveTo(3,-3); ctx.lineTo(-3,3); ctx.stroke();
    ctx.restore();
  }

  function drawFlag(ctx, col, row) {
    const { x, y } = hexCenter(col, row);
    ctx.save(); ctx.translate(x, y - 4);
    ctx.strokeStyle = '#e8d050'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -12); ctx.stroke();
    ctx.fillStyle = '#f0e040';
    ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(12,-7); ctx.lineTo(0,-2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── Hit test ──────────────────────────────────────────────
  function tileAtPoint(px, py) {
    let best = null, bestDist = Infinity;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = hexCenter(col, row);
        const d = Math.hypot(px - x, py - y);
        if (d < R * 0.9 && d < bestDist) { bestDist = d; best = { col, row }; }
      }
    }
    return best;
  }

  // ── Bases & spawns ────────────────────────────────────────
  function isPlayerBase(col, row) { return PLAYER_BASE.some(b => b.col === col && b.row === row); }
  function isAIBase(col, row)     { return AI_BASE.some(b => b.col === col && b.row === row); }

  function spawnPositions(side, count) {
    const col = side === 'player' ? 0 : COLS - 1;
    const positions = [];
    const step = Math.max(1, Math.floor(ROWS / count));
    for (let i = 0; i < ROWS && positions.length < count; i += step) {
      if (isPassable(col, i)) positions.push({ col, row: i });
    }
    for (let i = 0; i < ROWS && positions.length < count; i++) {
      if (isPassable(col, i) && !positions.find(p => p.row === i)) positions.push({ col, row: i });
    }
    return positions.slice(0, count);
  }

  // Recalculate origin when canvas dimensions change
  function recalcOrigin(canvasW, canvasH) {
    // Compute board extents at origin (0,0)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const rx = c * COL_STEP;
        const ry = r * ROW_STEP + (c & 1) * ODD_OFF;
        const sx = rx + ry * SHEAR;
        const sy = ry * SCALE_Y;
        minX = Math.min(minX, sx - R); maxX = Math.max(maxX, sx + R);
        minY = Math.min(minY, sy - H * SCALE_Y / 2); maxY = Math.max(maxY, sy + H * SCALE_Y / 2);
      }
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const gameH = canvasH - GAME_TOP - GAME_BOT;
    OX = (canvasW - bw) / 2 - minX;
    OY = GAME_TOP + (gameH - bh) / 2 - minY;
  }

  // Run initial calibration
  recalcOrigin(1280, 720);

  return {
    TILE, COLS, ROWS, R, W, H, COL_STEP, ROW_STEP,
    generate, idx, colRow,
    getTile, setTile, isPassable,
    hexDistance, neighbors, toAxial, axialToOffset,
    findPath, reachable,
    hasLOS,
    hexCenter, drawHexPath,
    render, drawFlag, drawMineToken,
    tileAtPoint,
    PLAYER_BASE, AI_BASE,
    isPlayerBase, isAIBase,
    spawnPositions, recalcOrigin
  };
})();
