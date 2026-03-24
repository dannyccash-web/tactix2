// ============================================================
// ai.js — AI turn logic for Melee and CTF modes
// ============================================================

const AI = (() => {

  function takeTurn(state, api) {
    const { liveUnits, unitAt, moveUnit, attackTarget,
            removePowerup, applyDamage, triggerMine,
            logMsg, checkWin, endGame } = api;

    const aiUnits   = liveUnits('ai');
    const playerUnits = liveUnits('player');

    if (!aiUnits.length) return;
    let acted = false;

    // ── 1. Use med pack if any AI unit is badly hurt ──────
    const medIdx = state.aiPowerups.indexOf('med_pack');
    if (medIdx !== -1) {
      const hurt = aiUnits.filter(u => u.hp < u.maxHp / 2);
      if (hurt.length) {
        // Heal lowest HP unit
        const target = hurt.reduce((a, b) => a.hp < b.hp ? a : b);
        target.hp = Math.min(target.maxHp, target.hp + 3);
        target.poisoned = false;
        removePowerup('ai', 'med_pack');
        logMsg(`AI used Med Pack on ${target.name}`);
      }
    }

    // ── 2. Move & attack each unit ────────────────────────
    for (const unit of aiUnits) {
      if (unit.hp <= 0 || unit.stunned) continue;

      const before = { col: unit.col, row: unit.row, hp: unit.hp, attacked: unit.attackedThisTurn };
      if (state.mode === 'ctf') {
        doCtfMove(unit, state, api);
      } else {
        doMeleeMove(unit, state, api);
      }
      if (unit.col !== before.col || unit.row !== before.row || unit.hp !== before.hp || unit.attackedThisTurn !== before.attacked) acted = true;

      checkWin();
      if (state.phase === 'over') return;
    }

    // ── 3. Place mines if available ───────────────────────
    const mineIdx = state.aiPowerups.indexOf('mine');
    if (mineIdx !== -1 && playerUnits.length > 0) {
      // Place a mine near the player flag carrier or highest-threat player
      const carrier = state.mode === 'ctf'
        ? playerUnits.find(u => u.hasFlag)
        : null;
      const target = carrier || playerUnits[0];
      const nearTiles = Board.neighbors(target.col, target.row).filter(nb =>
        Board.isPassable(nb.col, nb.row) &&
        !unitAt(nb.col, nb.row) &&
        !state.mines.find(m => m.col === nb.col && m.row === nb.row)
      );
      if (nearTiles.length) {
        const t = nearTiles[Math.floor(Math.random() * nearTiles.length)];
        state.mines.push({ col: t.col, row: t.row, owner: 'ai' });
        removePowerup('ai', 'mine');
        logMsg('AI placed a mine');
        acted = true;
      }
    }

    if (!acted && aiUnits.length && playerUnits.length) {
      const unit = aiUnits[0];
      const target = playerUnits.reduce((best, p) => {
        const d = Board.hexDistance(unit.col, unit.row, p.col, p.row);
        return !best || d < best.d ? { p, d } : best;
      }, null).p;
      const dest = bestApproach(unit, target, Math.min(unit.speed, state.movePool), state, api);
      if (dest) moveUnit(unit, dest.col, dest.row);
    }
  }

  // ── Melee AI ─────────────────────────────────────────────
  function doMeleeMove(unit, state, api) {
    const { liveUnits, unitAt, attackTarget } = api;
    const playerUnits = liveUnits('player');
    if (!playerUnits.length) return;

    // Find best attack target in range first
    const attackable = playerUnits.filter(p => {
      const dist = Board.hexDistance(unit.col, unit.row, p.col, p.row);
      return dist <= unit.range && Board.hasLOS(unit.col, unit.row, p.col, p.row);
    });

    if (!attackable.length) {
      // Move toward highest priority target
      const target = pickMeleeTarget(unit, playerUnits, state);
      if (target) {
        const maxSteps = Math.min(unit.speed, state.movePool);
        const dest = bestApproach(unit, target, maxSteps, state, api);
        if (dest) api.moveUnit(unit, dest.col, dest.row);
      }

      // Re-check attack after move
      const postAttackable = playerUnits.filter(p => {
        const dist = Board.hexDistance(unit.col, unit.row, p.col, p.row);
        return p.hp > 0 && dist <= unit.range && Board.hasLOS(unit.col, unit.row, p.col, p.row);
      });
      if (postAttackable.length) {
        const t = pickBestVictim(unit, postAttackable);
        attackTarget(unit, t.col, t.row);
      }
    } else {
      // Attack immediately
      const t = pickBestVictim(unit, attackable);
      attackTarget(unit, t.col, t.row);
    }
  }

  function pickMeleeTarget(unit, enemies, state) {
    // Prefer kill shots, then lowest HP, then closest
    const withDist = enemies.map(e => ({
      e,
      dist: Board.hexDistance(unit.col, unit.row, e.col, e.row),
      killable: e.hp <= unit.dmg
    }));
    withDist.sort((a, b) => {
      if (a.killable && !b.killable) return -1;
      if (!a.killable && b.killable) return 1;
      if (a.e.hp !== b.e.hp) return a.e.hp - b.e.hp;
      return a.dist - b.dist;
    });
    return withDist[0]?.e || null;
  }

  function pickBestVictim(attacker, enemies) {
    // Priority: kill shots > flag carriers > lowest HP
    const withScore = enemies.map(e => {
      let score = 0;
      if (e.hp <= attacker.dmg) score += 1000;
      if (e.hasFlag) score += 500;
      score -= e.hp;
      return { e, score };
    });
    withScore.sort((a, b) => b.score - a.score);
    return withScore[0].e;
  }

  function bestApproach(unit, target, maxSteps, state, api) {
    const { unitAt } = api;

    // Try to get within attack range of target
    // BFS from unit's position, find tile closest to target within range
    const startIdx = Board.idx(unit.col, unit.row);
    const dist = new Map();
    dist.set(startIdx, 0);
    const queue = [{ col: unit.col, row: unit.row }];
    let best = null;
    let bestScore = Infinity;

    while (queue.length) {
      const cur = queue.shift();
      const curIdx = Board.idx(cur.col, cur.row);
      const d = dist.get(curIdx);
      if (d > maxSteps) continue;

      const distToTarget = Board.hexDistance(cur.col, cur.row, target.col, target.row);
      const score = Math.max(0, distToTarget - unit.range);
      if (score < bestScore && (cur.col !== unit.col || cur.row !== unit.row)) {
        bestScore = score;
        best = cur;
      }
      if (score === 0) break;

      for (const nb of Board.neighbors(cur.col, cur.row)) {
        const ni = Board.idx(nb.col, nb.row);
        if (dist.has(ni)) continue;
        if (!Board.isPassable(nb.col, nb.row)) continue;
        if (unitAt(nb.col, nb.row)) continue;
        dist.set(ni, d + 1);
        queue.push(nb);
      }
    }
    return best;
  }

  // ── CTF AI ───────────────────────────────────────────────
  function doCtfMove(unit, state, api) {
    const { liveUnits, unitAt, attackTarget } = api;
    const playerUnits = liveUnits('player');
    const playerCarrier = playerUnits.find(u => u.hasFlag);
    const myCarrier = liveUnits('ai').find(u => u.hasFlag);

    if (unit.hasFlag) {
      // I have the flag — go to my base
      doCarrierMove(unit, state, api);
    } else if (!state.flag?.carrier && state.flag) {
      // Flag is loose — go grab it if closer than player
      const myDist     = Board.hexDistance(unit.col, unit.row, state.flag.col, state.flag.row);
      const playerDist = playerUnits.length
        ? Math.min(...playerUnits.map(p => Board.hexDistance(p.col, p.row, state.flag.col, state.flag.row)))
        : 999;

      if (myDist <= playerDist + 2) {
        // Move toward flag
        const maxSteps = Math.min(unit.speed, state.movePool);
        const dest = bestApproach(unit, state.flag, maxSteps, state, api);
        if (dest) api.moveUnit(unit, dest.col, dest.row);
      } else {
        // Intercept player carrier or attack
        doMeleeMove(unit, state, api);
      }
    } else if (playerCarrier) {
      // Prioritize stopping the carrier
      const dist = Board.hexDistance(unit.col, unit.row, playerCarrier.col, playerCarrier.row);
      if (dist <= unit.range && Board.hasLOS(unit.col, unit.row, playerCarrier.col, playerCarrier.row)) {
        attackTarget(unit, playerCarrier.col, playerCarrier.row);
      } else {
        const maxSteps = Math.min(unit.speed, state.movePool);
        const dest = bestApproach(unit, playerCarrier, maxSteps, state, api);
        if (dest) api.moveUnit(unit, dest.col, dest.row);
        // Attack after moving
        const postDist = Board.hexDistance(unit.col, unit.row, playerCarrier.col, playerCarrier.row);
        if (playerCarrier.hp > 0 && postDist <= unit.range &&
            Board.hasLOS(unit.col, unit.row, playerCarrier.col, playerCarrier.row)) {
          attackTarget(unit, playerCarrier.col, playerCarrier.row);
        }
      }
    } else {
      doMeleeMove(unit, state, api);
    }
  }

  function doCarrierMove(unit, state, api) {
    const base = Board.AI_BASE;
    // Find closest base tile that's reachable
    const targets = base.filter(b => Board.isPassable(b.col, b.row));
    if (!targets.length) return;

    const maxSteps = Math.min(unit.speed - unit.speedUsedThisTurn, state.movePool);
    let bestDest = null;
    let bestDist = Infinity;

    for (const t of targets) {
      const dist = Board.hexDistance(unit.col, unit.row, t.col, t.row);
      if (dist < bestDist) {
        bestDist = dist;
        bestDest = t;
      }
    }

    if (bestDest) {
      const dest = bestApproach(unit, bestDest, maxSteps, state, api);
      if (dest) api.moveUnit(unit, dest.col, dest.row);
    }
  }

  return { takeTurn };
})();
