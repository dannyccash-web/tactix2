// ============================================================
// ai.js — AI turn logic for Melee and CTF modes
// ============================================================

const AI = (() => {

  // Called once at start of AI turn to use med pack if needed
  function useMedPack(state, api) {
    const { liveUnits, removePowerup, logMsg } = api;
    const aiUnits = liveUnits('ai');
    const medIdx = state.aiPowerups.indexOf('med_pack');
    if (medIdx !== -1) {
      const hurt = aiUnits.filter(u => u.hp > 0 && u.hp < u.maxHp / 2);
      if (hurt.length) {
        const target = hurt.reduce((a, b) => a.hp < b.hp ? a : b);
        target.hp = Math.min(target.maxHp, target.hp + 3);
        target.poisoned = false;
        removePowerup('ai', 'med_pack');
        logMsg(`AI used Med Pack on ${target.name}`);
      }
    }
  }

  // Called after all units have acted to optionally place a mine
  function placeMine(state, api) {
    const { liveUnits, unitAt, removePowerup, logMsg } = api;
    const mineIdx = state.aiPowerups.indexOf('mine');
    const stillPlayers = liveUnits('player');
    if (mineIdx !== -1 && stillPlayers.length > 0) {
      const target = stillPlayers.find(u => u.hasFlag) || stillPlayers[0];
      const nearTiles = Board.neighbors(target.col, target.row).filter(nb =>
        Board.isPassable(nb.col, nb.row) &&
        !unitAt(nb.col, nb.row) &&
        !state.mines.find(m => m.col === nb.col && m.row === nb.row)
      );
      if (nearTiles.length) {
        const t = nearTiles[0];
        state.mines.push({ col: t.col, row: t.row, owner: 'ai' });
        removePowerup('ai', 'mine');
        logMsg('AI placed a mine');
      }
    }
  }

  // Move phase for a single unit
  function actUnitMove(unit, state, api) {
    const { liveUnits } = api;
    if (!liveUnits('player').length) return;
    if (state.mode === 'ctf') doCtfMoveOnly(unit, state, api);
    else doMeleeMoveOnly(unit, state, api);
  }

  // Attack phase for a single unit (called after movement animation completes)
  function actUnitAttack(unit, state, api) {
    const { liveUnits, attackTarget } = api;
    if (!liveUnits('player').length) return;
    if (unit.attackedThisTurn) return;

    const playerUnits = liveUnits('player');
    const attackable = playerUnits.filter(p =>
      p.hp > 0 &&
      Board.hexDistance(unit.col, unit.row, p.col, p.row) <= unit.range &&
      Board.hasLOS(unit.col, unit.row, p.col, p.row)
    );
    if (!attackable.length) return;

    // In CTF, prioritise the flag carrier
    const carrier = attackable.find(p => p.hasFlag);
    const target = carrier || pickBestVictim(unit, attackable);
    attackTarget(unit, target.col, target.row);
  }

  // Act with a single unit (move + attack together) — kept for compatibility
  function actUnit(unit, state, api) {
    const { liveUnits, checkWin } = api;
    if (!liveUnits('player').length) return;
    if (state.mode === 'ctf') doCtfMove(unit, state, api);
    else doMeleeMove(unit, state, api);
    checkWin();
  }

  // Legacy full-turn (kept for compatibility, not used in sequential mode)
  function takeTurn(state, api) {
    useMedPack(state, api);
    const aiUnits = liveUnits('ai');
    aiUnits.sort((a, b) => nearestEnemyDist(a, api.liveUnits('player')) - nearestEnemyDist(b, api.liveUnits('player')));
    for (const unit of aiUnits) {
      if (unit.hp <= 0 || unit.stunned) continue;
      actUnit(unit, state, api);
      api.checkWin();
      if (state.phase === 'over') return;
    }
    placeMine(state, api);
  }

  // Move only — no attack (attack is triggered separately after animation)
  function doMeleeMoveOnly(unit, state, api) {
    const { liveUnits, moveUnit } = api;
    const playerUnits = liveUnits('player');
    if (!playerUnits.length) return;

    // Check if already in attack range — if so, don't move (save steps)
    const alreadyInRange = playerUnits.some(p =>
      p.hp > 0 &&
      Board.hexDistance(unit.col, unit.row, p.col, p.row) <= unit.range &&
      Board.hasLOS(unit.col, unit.row, p.col, p.row)
    );
    if (alreadyInRange) return;

    const target = pickMeleeTarget(unit, playerUnits);
    const maxSteps = Math.min(unit.speed - unit.speedUsedThisTurn, state.movePool);
    if (target && maxSteps > 0) {
      const dest = bestApproach(unit, target, maxSteps, api);
      if (dest) moveUnit(unit, dest.col, dest.row);
    }
  }

  function doCtfMoveOnly(unit, state, api) {
    const { liveUnits, moveUnit } = api;
    const playerUnits = liveUnits('player');

    if (unit.hasFlag) {
      doCarrierMove(unit, state, api);
      return;
    }

    const playerCarrier = playerUnits.find(u => u.hasFlag);

    // If carrier is already in attack range, don't move — attack will fire separately
    if (playerCarrier) {
      const dist = Board.hexDistance(unit.col, unit.row, playerCarrier.col, playerCarrier.row);
      if (dist <= unit.range && Board.hasLOS(unit.col, unit.row, playerCarrier.col, playerCarrier.row)) return;
    }

    const looseFlag = state.flag && !state.flag.carrier ? state.flag : null;
    const moveTarget = playerCarrier || looseFlag || pickMeleeTarget(unit, playerUnits);
    const maxSteps = Math.min(unit.speed - unit.speedUsedThisTurn, state.movePool);
    if (moveTarget && maxSteps > 0) {
      const dest = bestApproach(unit, moveTarget, maxSteps, api);
      if (dest) moveUnit(unit, dest.col, dest.row);
    }
  }

  function doMeleeMove(unit, state, api) {
    const { liveUnits, attackTarget, moveUnit } = api;
    const playerUnits = liveUnits('player');
    if (!playerUnits.length) return;

    // Try to attack in place first
    const attackable = playerUnits.filter(p =>
      p.hp > 0 &&
      Board.hexDistance(unit.col, unit.row, p.col, p.row) <= unit.range &&
      Board.hasLOS(unit.col, unit.row, p.col, p.row)
    );
    if (attackable.length && !unit.attackedThisTurn) {
      const t = pickBestVictim(unit, attackable);
      attackTarget(unit, t.col, t.row);
      return;
    }

    // Move toward nearest/best target
    const target = pickMeleeTarget(unit, playerUnits);
    const maxSteps = Math.min(unit.speed - unit.speedUsedThisTurn, state.movePool);
    if (target && maxSteps > 0) {
      const dest = bestApproach(unit, target, maxSteps, api);
      if (dest) moveUnit(unit, dest.col, dest.row);
    }

    // Try to attack after moving
    const postAttackable = liveUnits('player').filter(p =>
      p.hp > 0 &&
      Board.hexDistance(unit.col, unit.row, p.col, p.row) <= unit.range &&
      Board.hasLOS(unit.col, unit.row, p.col, p.row)
    );
    if (postAttackable.length && !unit.attackedThisTurn) {
      const t = pickBestVictim(unit, postAttackable);
      attackTarget(unit, t.col, t.row);
    }
  }

  function doCtfMove(unit, state, api) {
    const { liveUnits, attackTarget, moveUnit } = api;
    const playerUnits = liveUnits('player');
    const playerCarrier = playerUnits.find(u => u.hasFlag);

    // If this unit is carrying the flag, head to base
    if (unit.hasFlag) {
      doCarrierMove(unit, state, api);
      return;
    }

    // Prioritize attacking the player's flag carrier if in range
    if (playerCarrier && !unit.attackedThisTurn) {
      const dist = Board.hexDistance(unit.col, unit.row, playerCarrier.col, playerCarrier.row);
      if (dist <= unit.range && Board.hasLOS(unit.col, unit.row, playerCarrier.col, playerCarrier.row)) {
        attackTarget(unit, playerCarrier.col, playerCarrier.row);
        return;
      }
    }

    // Determine movement target:
    // 1. If player has flag → chase carrier
    // 2. If flag is loose → go pick it up
    // 3. Otherwise → attack nearest player
    const looseFlag = state.flag && !state.flag.carrier ? state.flag : null;
    const moveTarget = playerCarrier || looseFlag || pickMeleeTarget(unit, playerUnits);
    const maxSteps = Math.min(unit.speed - unit.speedUsedThisTurn, state.movePool);
    if (moveTarget && maxSteps > 0) {
      const dest = bestApproach(unit, moveTarget, maxSteps, api);
      if (dest) moveUnit(unit, dest.col, dest.row);
    }

    // Try to attack after moving
    const attackable = liveUnits('player').filter(p =>
      p.hp > 0 &&
      Board.hexDistance(unit.col, unit.row, p.col, p.row) <= unit.range &&
      Board.hasLOS(unit.col, unit.row, p.col, p.row)
    );
    if (attackable.length && !unit.attackedThisTurn) {
      // Prioritize the flag carrier
      const carrierNow = attackable.find(p => p.hasFlag);
      const t = carrierNow || pickBestVictim(unit, attackable);
      attackTarget(unit, t.col, t.row);
    }
  }

  function doCarrierMove(unit, state, api) {
    const { moveUnit } = api;
    // Flag bearer can only move 2 spaces
    const maxSteps = Math.min(2, unit.speed - unit.speedUsedThisTurn, state.movePool);
    if (maxSteps <= 0) return;
    let bestBase = null, bestDist = Infinity;
    for (const b of Board.AI_BASE) {
      const d = Board.hexDistance(unit.col, unit.row, b.col, b.row);
      if (d < bestDist) { bestDist = d; bestBase = b; }
    }
    if (!bestBase) return;
    const dest = bestApproach(unit, bestBase, maxSteps, api);
    if (dest) moveUnit(unit, dest.col, dest.row);
  }

  function pickMeleeTarget(unit, enemies) {
    const withDist = enemies.map(e => ({
      e,
      dist: Board.hexDistance(unit.col, unit.row, e.col, e.row),
      killable: e.hp <= unit.dmg
    }));
    withDist.sort((a, b) => {
      if (a.killable && !b.killable) return -1;
      if (!a.killable && b.killable) return 1;
      if (a.e.hasFlag && !b.e.hasFlag) return -1;
      if (!a.e.hasFlag && b.e.hasFlag) return 1;
      if (a.e.hp !== b.e.hp) return a.e.hp - b.e.hp;
      return a.dist - b.dist;
    });
    return withDist[0]?.e || null;
  }

  function pickBestVictim(attacker, enemies) {
    const withScore = enemies.map(e => {
      let score = 0;
      if (e.hp <= attacker.dmg) score += 1000;
      if (e.hasFlag) score += 600;
      score += Math.max(0, 10 - e.hp);
      score -= Board.hexDistance(attacker.col, attacker.row, e.col, e.row);
      return { e, score };
    });
    withScore.sort((a, b) => b.score - a.score);
    return withScore[0].e;
  }

  function nearestEnemyDist(unit, enemies) {
    if (!enemies.length) return 999;
    return Math.min(...enemies.map(e => Board.hexDistance(unit.col, unit.row, e.col, e.row)));
  }

  function bestApproach(unit, target, maxSteps, api) {
    const { unitAt } = api;
    const startIdx = Board.idx(unit.col, unit.row);
    const dist = new Map([[startIdx, 0]]);
    const queue = [{ col: unit.col, row: unit.row }];
    let best = null;
    let bestScore = null;

    while (queue.length) {
      const cur = queue.shift();
      const curIdx = Board.idx(cur.col, cur.row);
      const d = dist.get(curIdx);
      if (d > maxSteps) continue;

      if (cur.col !== unit.col || cur.row !== unit.row) {
        const distToTarget = Board.hexDistance(cur.col, cur.row, target.col, target.row);
        // Primary: minimize steps-outside-range (0 if already in range)
        // Secondary: minimize total distance to target
        // Tertiary: maximize steps taken (get as close as possible)
        const outsideRange = Math.max(0, distToTarget - unit.range);
        const score = [outsideRange, distToTarget, -d];
        if (bestScore === null ||
            score[0] < bestScore[0] ||
            (score[0] === bestScore[0] && score[1] < bestScore[1]) ||
            (score[0] === bestScore[0] && score[1] === bestScore[1] && score[2] < bestScore[2])) {
          bestScore = score;
          best = cur;
        }
      }

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

  return { takeTurn, useMedPack, placeMine, actUnit, actUnitMove, actUnitAttack };
})();
