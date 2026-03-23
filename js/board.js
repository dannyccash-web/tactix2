// ============================================================
// board.js — Hex grid geometry, tile rendering, pathfinding, LOS
// ============================================================

const Board = (() => {

  // ── Hex grid config ──────────────────────────────────────
  // Pointy-top hexes rendered onto a sheared, vertically-compressed canvas.
  // Internal grid: even-q offset (col, row).
  // Render: shear 30° then scale Y to 75%.

  const COLS = Data.BOARD_COLS;   // 20
  const ROWS = Data.BOARD_ROWS;   // 10

  // Base hex size before transform
  const HEX_R = 30;  // circumradius (center to vertex)
  const HEX_W = Math.sqrt(3) * HEX_R;  // flat-top hex width
  const HEX_H = 2 * HEX_R;             // flat-top hex height

  // Board placement offset on canvas
  const ORIGIN_X = 80;
  const ORIGIN_Y = 60;

  // Shear + scale transform applied at draw time
  const SHEAR = Math.tan((30 * Math.PI) / 180);  // tan(30°)
  const SCALE_Y = 0.75;

  // Tile type enum
  const TILE = { EMPTY: 0, OBSTACLE: 1, ACID: 2, FIRE: 3 };

  // ── State ────────────────────────────────────────────────
  let tiles = [];       // flat array [col + row*COLS], values from TILE
  let tileAngles = [];  // random rotation angle per tile for texture variety
  let patternCache = {};

  // ── Init / generation ────────────────────────────────────
  function generate(obstacleCount = Data.OBSTACLE_COUNT) {
    tiles = new Array(COLS * ROWS).fill(TILE.EMPTY);
    tileAngles = tiles.map(() => Math.random() * Math.PI * 2);

    // Reserve player spawn (col 0) and AI spawn (col 19)
    const reserved = new Set();
    for (let r = 0; r < ROWS; r++) {
      reserved.add(idx(0, r));
      reserved.add(idx(COLS - 1, r));
    }

    // Generate mirrored obstacles
    const placed = [];
    let attempts = 0;
    while (placed.length < obstacleCount / 2 && attempts < 500) {
      attempts++;
      const col = 1 + Math.floor(Math.random() * (COLS / 2 - 1));
      const row = Math.floor(Math.random() * ROWS);
      const i = idx(col, row);
      const mirrorCol = COLS - 1 - col;
      const mi = idx(mirrorCol, row);
      if (!reserved.has(i) && !reserved.has(mi) && tiles[i] === TILE.EMPTY) {
        tiles[i] = TILE.OBSTACLE;
        tiles[mi] = TILE.OBSTACLE;
        placed.push(i, mi);
      }
    }

    patternCache = {};
  }

  function idx(col, row) { return col + row * COLS; }
  function colRow(i) { return { col: i % COLS, row: Math.floor(i / COLS) }; }

  function getTile(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return TILE.OBSTACLE;
    return tiles[idx(col, row)];
  }

  function setTile(col, row, type) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    tiles[idx(col, row)] = type;
  }

  function isPassable(col, row) {
    return getTile(col, row) === TILE.EMPTY ||
           getTile(col, row) === TILE.ACID  ||
           getTile(col, row) === TILE.FIRE;
  }

  // ── Hex coordinate math ───────────────────────────────────
  // Convert offset (col, row) → axial (q, r) for distance calc
  function toAxial(col, row) {
    const q = col;
    const r = row - (col - (col & 1)) / 2;
    return { q, r };
  }

  function hexDistance(c1, r1, c2, r2) {
    const a1 = toAxial(c1, r1);
    const a2 = toAxial(c2, r2);
    return Math.max(
      Math.abs(a1.q - a2.q),
      Math.abs(a1.r - a2.r),
      Math.abs((a1.q + a1.r) - (a2.q + a2.r))
    );
  }

  // Neighbors in offset grid (even-q)
  function neighbors(col, row) {
    const parity = col & 1;
    const dirs = parity === 0
      ? [[-1,-1],[ 0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
      : [[-1, 0],[ 0,-1],[1, 0],[-1,1],[1,1],[-1,0],[0,1],[1,0]];

    // Actually use the standard even-q neighbor offsets:
    const evenQ = [
      [ 1, 0], [ 1,-1], [ 0,-1],
      [-1,-1], [-1, 0], [ 0, 1]
    ];
    const oddQ = [
      [ 1, 1], [ 1, 0], [ 0,-1],
      [-1, 0], [-1, 1], [ 0, 1]
    ];
    const offsets = (col % 2 === 0) ? evenQ : oddQ;
    return offsets
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter(({ col: c, row: r }) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
  }

  // ── Pathfinding (BFS — passable tiles only) ──────────────
  function findPath(fromCol, fromRow, toCol, toRow, occupiedFn) {
    if (fromCol === toCol && fromRow === toRow) return [];
    if (!isPassable(toCol, toRow)) return null;

    const start = idx(fromCol, fromRow);
    const goal  = idx(toCol, toRow);
    const visited = new Map();
    visited.set(start, null);
    const queue = [start];

    while (queue.length) {
      const cur = queue.shift();
      if (cur === goal) break;
      const { col, row } = colRow(cur);
      for (const nb of neighbors(col, row)) {
        const ni = idx(nb.col, nb.row);
        if (visited.has(ni)) continue;
        if (!isPassable(nb.col, nb.row)) continue;
        // Occupied check — destination is ok, intermediate is not
        if (occupiedFn && occupiedFn(nb.col, nb.row) && ni !== goal) continue;
        visited.set(ni, cur);
        queue.push(ni);
      }
    }

    if (!visited.has(goal)) return null;

    // Reconstruct path
    const path = [];
    let cur = goal;
    while (cur !== start) {
      path.unshift(colRow(cur));
      cur = visited.get(cur);
    }
    return path;
  }

  // Reachable tiles within N steps (BFS with step limit)
  function reachable(fromCol, fromRow, maxSteps, occupiedFn) {
    const result = new Set();
    const dist = new Map();
    const start = idx(fromCol, fromRow);
    dist.set(start, 0);
    const queue = [start];

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
    return result; // set of tile indices
  }

  // ── Line of sight ────────────────────────────────────────
  // Lerp through the hex line and check for obstacles
  function hasLOS(c1, r1, c2, r2) {
    const dist = hexDistance(c1, r1, c2, r2);
    if (dist === 0) return true;
    const a1 = toAxial(c1, r1);
    const a2 = toAxial(c2, r2);

    for (let i = 1; i < dist; i++) {
      const t = i / dist;
      const q = lerp(a1.q, a2.q, t);
      const r = lerp(a1.r, a2.r, t);
      const { col, row } = axialToOffset(Math.round(q), Math.round(r));
      if (getTile(col, row) === TILE.OBSTACLE) return false;
    }
    return true;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function axialToOffset(q, r) {
    const col = q;
    const row = r + (q - (q & 1)) / 2;
    return { col, row };
  }

  // ── Screen-space rendering transform ────────────────────
  // Raw hex center (before shear)
  function rawCenter(col, row) {
    const x = ORIGIN_X + col * HEX_W + (row % 2 === 0 ? 0 : HEX_W / 2);
    const y = ORIGIN_Y + row * HEX_R * 1.5;
    return { x, y };
  }

  // Apply shear + vertical scale
  function hexCenter(col, row) {
    const raw = rawCenter(col, row);
    return {
      x: raw.x + raw.y * SHEAR,
      y: raw.y * SCALE_Y
    };
  }

  // Pointy-top hex path at given center
  function hexPoints(cx, cy, r = HEX_R) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      });
    }
    return pts;
  }

  function drawHexPath(ctx, cx, cy, r = HEX_R) {
    const pts = hexPoints(cx, cy, r);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
  }

  // ── Texture pattern cache ────────────────────────────────
  function getPattern(ctx, imageKey, angle) {
    const cacheKey = `${imageKey}_${angle.toFixed(2)}`;
    if (patternCache[cacheKey]) return patternCache[cacheKey];
    const img = TactixEngine.getImage(imageKey);
    if (!img) return null;
    const pat = ctx.createPattern(img, 'repeat');
    patternCache[cacheKey] = pat;
    return pat;
  }

  // ── Render ───────────────────────────────────────────────
  function render(ctx, highlights = {}, mines = []) {
    // highlights: { tileIndex: 'move'|'attack'|'selected'|'base_player'|'base_ai'|'flag' }
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = idx(col, row);
        const type = tiles[i];
        const { x, y } = hexCenter(col, row);
        const angle = tileAngles[i];

        ctx.save();
        drawHexPath(ctx, x, y);
        ctx.clip();

        if (type === TILE.OBSTACLE) {
          drawTextureTile(ctx, x, y, 'rock_texture', angle);
        } else if (type === TILE.ACID) {
          drawTextureTile(ctx, x, y, 'dirt_texture', angle);
          drawTextureTile(ctx, x, y, 'acid_texture', 0, 0.85);
        } else if (type === TILE.FIRE) {
          drawTextureTile(ctx, x, y, 'dirt_texture', angle);
          drawTextureTile(ctx, x, y, 'fire_texture', 0, 0.85);
        } else {
          drawTextureTile(ctx, x, y, 'dirt_texture', angle);
        }

        ctx.restore();

        // Outline
        drawHexPath(ctx, x, y);
        if (type === TILE.OBSTACLE) {
          ctx.strokeStyle = '#3a4a52';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = '#61767f';
          ctx.lineWidth = 1;
        }
        ctx.stroke();

        // Highlights
        const hl = highlights[i];
        if (hl) {
          drawHexPath(ctx, x, y);
          if (hl === 'move') {
            ctx.fillStyle = 'rgba(60,160,255,0.30)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(60,160,255,0.80)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hl === 'attack') {
            ctx.fillStyle = 'rgba(255,60,60,0.28)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,60,60,0.85)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hl === 'selected') {
            ctx.fillStyle = 'rgba(255,255,80,0.20)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,80,0.90)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          } else if (hl === 'base_player') {
            ctx.fillStyle = 'rgba(60,150,255,0.18)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(60,150,255,0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hl === 'base_ai') {
            ctx.fillStyle = 'rgba(255,80,80,0.18)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,80,80,0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hl === 'flag') {
            ctx.fillStyle = 'rgba(255,230,50,0.35)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,230,50,0.9)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          } else if (hl === 'teleport') {
            ctx.fillStyle = 'rgba(180,80,255,0.28)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(180,80,255,0.85)';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hl === 'mine_place') {
            ctx.fillStyle = 'rgba(255,160,30,0.22)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,160,30,0.80)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // Mine tokens
        const mine = mines.find(m => m.col === col && m.row === row);
        if (mine) drawMineToken(ctx, x, y, mine.owner);
      }
    }
  }

  function drawTextureTile(ctx, cx, cy, imageKey, angle, alpha = 1) {
    const img = TactixEngine.getImage(imageKey);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(img, -HEX_R * 1.2, -HEX_R * 1.2, HEX_R * 2.4, HEX_R * 2.4);
    ctx.restore();
  }

  function drawMineToken(ctx, cx, cy, owner) {
    ctx.save();
    ctx.translate(cx, cy);
    // Small diamond shape
    const s = 8;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fillStyle = owner === 'player' ? 'rgba(60,160,255,0.9)' : 'rgba(255,60,60,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    // X mark
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -3); ctx.lineTo(3, 3);
    ctx.moveTo(3, -3);  ctx.lineTo(-3, 3);
    ctx.stroke();
    ctx.restore();
  }

  // Draw flag on a tile
  function drawFlag(ctx, col, row) {
    const { x, y } = hexCenter(col, row);
    ctx.save();
    ctx.translate(x, y - 6);
    // Pole
    ctx.strokeStyle = '#e0d060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -10);
    ctx.stroke();
    // Flag
    ctx.fillStyle = '#f0e040';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(10, -6);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Hit test ─────────────────────────────────────────────
  // Return {col, row} for a canvas-space click point, or null
  function tileAtPoint(px, py) {
    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x, y } = hexCenter(col, row);
        const d = Math.hypot(px - x, py - y);
        if (d < HEX_R * 0.95 && d < bestDist) {
          bestDist = d;
          best = { col, row };
        }
      }
    }
    return best;
  }

  // ── CTF base tiles ────────────────────────────────────────
  // Player base: top-left 3 tiles. AI base: bottom-right 3 tiles.
  const PLAYER_BASE = [ {col:0,row:0}, {col:0,row:1}, {col:1,row:0} ];
  const AI_BASE     = [ {col:COLS-1,row:ROWS-1}, {col:COLS-1,row:ROWS-2}, {col:COLS-2,row:ROWS-1} ];

  function isPlayerBase(col, row) {
    return PLAYER_BASE.some(b => b.col === col && b.row === row);
  }
  function isAIBase(col, row) {
    return AI_BASE.some(b => b.col === col && b.row === row);
  }

  // Return spawn positions for a side
  function spawnPositions(side, count) {
    const col = side === 'player' ? 0 : COLS - 1;
    const positions = [];
    const step = Math.max(1, Math.floor(ROWS / count));
    for (let i = 0; i < ROWS && positions.length < count; i += step) {
      if (isPassable(col, i)) {
        positions.push({ col, row: i });
      }
    }
    // Fill remaining if evenly spaced didn't give enough
    for (let i = 0; i < ROWS && positions.length < count; i++) {
      if (isPassable(col, i) && !positions.find(p => p.row === i)) {
        positions.push({ col, row: i });
      }
    }
    return positions.slice(0, count);
  }

  return {
    TILE, COLS, ROWS, HEX_R, HEX_W, HEX_H,
    generate,
    idx, colRow,
    getTile, setTile, isPassable,
    hexDistance, neighbors,
    findPath, reachable,
    hasLOS,
    hexCenter,
    drawHexPath,
    render,
    drawFlag,
    drawMineToken,
    tileAtPoint,
    PLAYER_BASE, AI_BASE,
    isPlayerBase, isAIBase,
    spawnPositions
  };
})();
