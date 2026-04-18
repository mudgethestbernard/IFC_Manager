/* ============================================
   IFC MANAGER — RACE ENGINE
   Qualifying sim, race sim with lap ticks,
   commentary generation, strategic interventions.
   ============================================ */

(function() {
  const { TEAMS, RIDERS, TRACKS, POINTS, PRIZE } = window.IFC;
  const G = window.IFCGame;

  // ============================================
  //   QUALIFYING
  // ============================================
  // Single "hot lap" score per rider. Grid set by score.
  function simulateQualifying(state) {
    const track = window.IFC.trackByRound(state.round);
    const entries = [];

    for (const teamId of Object.keys(TEAMS)) {
      const team = teamId === state.teamId
        ? { ...TEAMS[teamId], broom: state.broom }
        : TEAMS[teamId];
      const rider = RIDERS[team.riderId];
      const isPlayer = teamId === state.teamId;

      const playerPhys = isPlayer ? state.rider.physical : rider.physical;
      const playerMen = isPlayer ? state.rider.mental : rider.mental;

      let score = 0;
      score += rider.skill.qualifying * 0.45;
      score += rider.skill.pace * 0.20;
      score += team.broom.speed * 0.15;
      score += team.broom.handling * 0.10;
      score += playerPhys * 0.05;
      score += playerMen * 0.05;

      // track-type adjustments
      if (track.type === 'technical') score += rider.skill.tyreMgmt * 0.05;
      if (track.type === 'high-speed') score += team.broom.speed * 0.03;
      if (track.type === 'over-water') score += rider.skill.consistency * 0.03;

      // simulator bonus (player only)
      if (isPlayer && state.flags.simBonusActive) score += 6;

      // noise
      score += (Math.random() - 0.5) * 8;

      entries.push({ riderId: rider.id, teamId, score, isPlayer });
    }

    entries.sort((a, b) => b.score - a.score);
    return entries.map((e, i) => ({ ...e, grid: i + 1 }));
  }

  // ============================================
  //   RACE SIM
  // ============================================
  // Runs a race as a sequence of "ticks" (laps).
  // Each tick may: shuffle positions, deplete charm gauges,
  // emit commentary, and occasionally spawn an intervention.

  function initRaceState(state, grid) {
    const track = window.IFC.trackByRound(state.round);

    const runners = grid.map(g => {
      const rider = RIDERS[g.riderId];
      const team = g.teamId === state.teamId
        ? { ...TEAMS[g.teamId], broom: state.broom }
        : TEAMS[g.teamId];
      return {
        riderId: g.riderId,
        teamId: g.teamId,
        isPlayer: g.isPlayer,
        grid: g.grid,
        position: g.grid, // live position
        // spell-layer gauges (0-100 each, deplete over laps)
        layers: {
          structural: 100,
          cushioning: 100,
          protection: 100,
          aero: 100,
          braking: 100,
          acceleration: 100,
          stability: 100,
          manoeuvrability: 100,
        },
        pace: rider.skill.pace,
        overtaking: rider.skill.overtaking,
        tyreMgmt: rider.skill.tyreMgmt,
        consistency: rider.skill.consistency,
        physical: g.isPlayer ? state.rider.physical : rider.physical,
        mental: g.isPlayer ? state.rider.mental : rider.mental,
        broomSpeed: team.broom.speed,
        broomHandling: team.broom.handling,
        broomReliability: team.broom.reliability,
        pitsTaken: 0,
        needsPit: false,
        mustPit: false,        // protection charm broken etc.
        dnf: false,
        dnfReason: null,
        timeOffset: 0,         // seconds gained/lost vs baseline
        radioIgnored: false,   // set when Cassian goes off-radio
      };
    });

    return {
      track,
      lap: 0,
      maxLap: track.laps,
      runners,
      commentary: [],
      interventionsScheduled: pickInterventionLaps(track.laps),
      interventionsFired: 0,
      lastCommentator: null,
    };
  }

  function pickInterventionLaps(totalLaps) {
    // three interventions, evenly-ish spaced across the race
    const laps = new Set();
    laps.add(Math.floor(totalLaps * 0.25));
    laps.add(Math.floor(totalLaps * 0.55));
    laps.add(Math.floor(totalLaps * 0.80));
    return laps;
  }

  // ============================================
  //   TICK — one lap advances
  // ============================================
  function tickRace(raceState, playerState) {
    raceState.lap += 1;
    const track = raceState.track;

    // Deplete spell layers for all runners
    for (const r of raceState.runners) {
      if (r.dnf) continue;
      depleteLayers(r, track);
      checkLayerCritical(r, raceState);
      checkMechanical(r, raceState);
    }

    // Recompute positions based on pace + noise
    reorderPositions(raceState);

    // Generate commentary (1-2 lines per lap, variable)
    generateCommentary(raceState, playerState);

    return raceState;
  }

  function depleteLayers(runner, track) {
    // base depletion; accelerated by aggression and track type
    const base = 1.4;
    const agg = 1.0 - (runner.tyreMgmt / 300); // worse management = faster depletion
    const trackMod = track.type === 'high-speed' ? 1.2
                   : track.type === 'technical' ? 1.1
                   : 1.0;

    const d = base * trackMod * (1.4 - agg); // faster drain for low tyreMgmt
    runner.layers.acceleration -= d * 1.2;
    runner.layers.manoeuvrability -= d * 0.9;
    runner.layers.aero -= d * 0.8;
    runner.layers.stability -= d * 0.7;
    runner.layers.braking -= d * 0.6;
    runner.layers.protection -= d * 0.5;
    runner.layers.cushioning -= d * 0.3;
    runner.layers.structural -= d * 0.15;

    // clamp
    for (const k of Object.keys(runner.layers)) {
      runner.layers[k] = Math.max(0, runner.layers[k]);
    }
  }

  function checkLayerCritical(runner, raceState) {
    // Protection charm breaking — the Cassian moment
    if (runner.layers.protection < 15 && !runner.mustPit) {
      runner.mustPit = true;
      runner.pitDeadline = raceState.lap + 5;
    }

    // Acceleration or manoeuvrability critical
    if (runner.layers.acceleration < 20 || runner.layers.manoeuvrability < 20) {
      runner.needsPit = true;
    }
  }

  function checkMechanical(runner, raceState) {
    // Reliability roll — very rare failure
    const failChance = (100 - runner.broomReliability) / 8000;
    if (Math.random() < failChance) {
      runner.dnf = true;
      runner.dnfReason = 'Broom failure';
      emitCommentary(raceState, 'etienne',
        `${RIDERS[runner.riderId].name.split(' ').slice(-1)[0]} is out. Structural integrity lost on the exit.`);
    }

    // Protection charm deadline
    if (runner.mustPit && raceState.lap > runner.pitDeadline && runner.pitsTaken === 0) {
      // Regulation violation or crash
      runner.dnf = true;
      runner.dnfReason = 'Protection charm failure — did not pit in time';
    }
  }

  function reorderPositions(raceState) {
    // compute per-lap pace score with noise
    const scored = raceState.runners.map(r => {
      if (r.dnf) return { r, score: -9999 };
      const accelFactor = r.layers.acceleration / 100;
      const steerFactor = r.layers.manoeuvrability / 100;
      const base = r.pace * 0.4 + r.broomSpeed * 0.25 + r.broomHandling * 0.15;
      const layerHit = (accelFactor + steerFactor) / 2;
      const stamina = (r.physical / 100) * 0.9 + 0.1;
      const noise = (Math.random() - 0.5) * 14;
      const score = base * layerHit * stamina + r.consistency * 0.08 + noise - r.timeOffset * 0.6;
      return { r, score };
    });

    // existing order influences — reduce churn
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => {
      if (!s.r.dnf) s.r.position = i + 1;
    });

    // push DNFs to the end
    raceState.runners.sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      return a.position - b.position;
    });
    raceState.runners.forEach((r, i) => {
      if (!r.dnf) r.position = i + 1;
    });
  }

  // ============================================
  //   COMMENTARY
  // ============================================
  function emitCommentary(raceState, who, text) {
    raceState.commentary.push({
      lap: raceState.lap,
      who,  // 'lee' | 'etienne' | 'radio'
      text,
    });
    raceState.lastCommentator = who;
  }

  function generateCommentary(raceState, playerState) {
    const player = raceState.runners.find(r => r.isPlayer);
    const lap = raceState.lap;
    const total = raceState.maxLap;

    // opening line every few laps
    const atQuarter = lap === Math.floor(total * 0.25);
    const atHalf = lap === Math.floor(total * 0.5);
    const atThreeQ = lap === Math.floor(total * 0.75);
    const atFinal = lap === total;

    if (lap === 1) {
      const leader = raceState.runners.find(r => r.position === 1);
      emitCommentary(raceState, 'lee',
        `"And they're away! ${lastName(leader.riderId)} gets the better start — we've got a race on our hands!"`);
      return;
    }

    if (atQuarter) {
      emitCommentary(raceState, 'etienne',
        `"Quarter distance. ${lastName(leaderOf(raceState).riderId)} leads. The field is settling."`);
      return;
    }

    if (atHalf) {
      emitCommentary(raceState, 'etienne',
        `"Half distance. Spell layers will start to bite from here."`);
      return;
    }

    if (atThreeQ) {
      emitCommentary(raceState, 'lee',
        `"Three-quarter distance! This is where the serious ones make their move!"`);
      return;
    }

    if (atFinal) {
      const leader = leaderOf(raceState);
      emitCommentary(raceState, 'lee',
        `"Final lap! ${lastName(leader.riderId)} leading into the last sector!"`);
      return;
    }

    // Mid-race colour: pick something happening
    const event = pickColourEvent(raceState, player, playerState);
    if (event) emitCommentary(raceState, event.who, event.text);
  }

  function pickColourEvent(raceState, player, playerState) {
    // Things to potentially narrate this lap:
    // - player gained/lost a place (tracked via position delta)
    // - someone's protection charm cracking
    // - player radio-check
    // - a dramatic overtake elsewhere

    const pool = [];

    // Player low on a layer
    if (player && !player.dnf && player.layers.acceleration < 30) {
      pool.push({
        who: 'etienne',
        text: `"${lastName(player.riderId)}'s Acceleration Charm is down to a hair. He cannot keep this pace much longer."`,
      });
    }

    if (player && !player.dnf && player.layers.protection < 25 && player.layers.protection > 15) {
      pool.push({
        who: 'lee',
        text: `"Is that a crack in Bayes's Protection Charm?! Oh, Cassian, not again —"`,
      });
    }

    // Leader-of-the-moment commentary
    const leader = leaderOf(raceState);
    if (leader && Math.random() < 0.2) {
      pool.push({
        who: 'etienne',
        text: `"${lastName(leader.riderId)} through the bottleneck cleanly. Metronomic."`,
      });
    }

    // Player position callouts
    if (player && !player.dnf) {
      if (player.position === 1 && Math.random() < 0.25) {
        pool.push({
          who: 'lee',
          text: `"Bayes leads! — and he's flying like he's barely noticed!"`,
        });
      } else if (player.position <= 3 && Math.random() < 0.2) {
        pool.push({
          who: 'etienne',
          text: `"Bayes is within striking distance. He's in the slipstream."`,
        });
      } else if (player.position >= 5 && Math.random() < 0.2) {
        pool.push({
          who: 'lee',
          text: `"Come on, Cassian — do something ridiculous, would you?"`,
        });
      }
    }

    // Rival drama
    if (Math.random() < 0.1) {
      const rivals = raceState.runners.filter(r => !r.isPlayer && !r.dnf);
      const pick = rivals[Math.floor(Math.random() * rivals.length)];
      if (pick) {
        if (RIDERS[pick.riderId].name.includes('Dubois')) {
          pool.push({ who: 'lee', text: `"Dubois on the radio already — you can hear him from here."` });
        } else if (RIDERS[pick.riderId].name.includes('Flint')) {
          pool.push({ who: 'etienne', text: `"Flint going two-wide through that gap. No margin."` });
        } else if (RIDERS[pick.riderId].name.includes('Steiner')) {
          pool.push({ who: 'etienne', text: `"Steiner's line is identical to last lap. To the centimetre."` });
        } else if (RIDERS[pick.riderId].name.includes('Whitmore')) {
          pool.push({ who: 'lee', text: `"Whitmore's radio just said \\"Plan C.\\" Oh no."` });
        }
      }
    }

    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function leaderOf(raceState) {
    return raceState.runners.find(r => r.position === 1 && !r.dnf);
  }

  function lastName(riderId) {
    const name = RIDERS[riderId].name;
    return name.split(' ').slice(-1)[0];
  }

  // ============================================
  //   INTERVENTIONS
  // ============================================
  // Returns a decision object if this lap triggers one, or null.
  function maybeIntervention(raceState, playerState) {
    if (!raceState.interventionsScheduled.has(raceState.lap)) return null;
    raceState.interventionsFired += 1;

    const player = raceState.runners.find(r => r.isPlayer);
    if (!player || player.dnf) return null;

    const ahead = raceState.runners.find(r => r.position === player.position - 1 && !r.dnf);
    const behind = raceState.runners.find(r => r.position === player.position + 1 && !r.dnf);

    // Scenario selection
    const track = raceState.track;
    const scenarios = [];

    if (ahead) {
      scenarios.push({
        id: 'attack-ahead',
        setup: `Petra, team radio: "Cassian, ${lastName(ahead.riderId)} just ahead. Gap closing."`,
        options: [
          { id: 'attack', label: 'Attack', body: 'Go for the overtake this lap.', effect: 'attack' },
          { id: 'hold', label: 'Hold', body: 'Maintain gap. Try again later.', effect: 'hold' },
          { id: 'pit', label: 'Pit Now', body: 'Undercut. Risky if crew isn\'t sharp.', effect: 'pit' },
        ],
      });
    }

    if (player.layers.protection < 30) {
      scenarios.push({
        id: 'protection-cracking',
        setup: `Petra: "Cassian, your Protection Charm is flickering. It's borderline."`,
        options: [
          { id: 'pit', label: 'Pit Now', body: 'Safe, costs positions.', effect: 'pit' },
          { id: 'continue', label: 'Fly On', body: 'Risk a crack. You know the regulation.', effect: 'continue-dangerous' },
        ],
      });
    }

    if (track.traits.includes('bottleneck') && ahead) {
      scenarios.push({
        id: 'bottleneck',
        setup: `Petra: "Bottleneck up ahead — single file. ${lastName(ahead.riderId)} 1.2 seconds."`,
        options: [
          { id: 'dive', label: 'Dive In', body: 'Force the move before the narrow section.', effect: 'dive' },
          { id: 'wait', label: 'Wait', body: 'Follow through. Try on the exit.', effect: 'hold' },
        ],
      });
    }

    if (scenarios.length === 0) {
      return null;
    }

    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  function applyInterventionEffect(raceState, playerState, effect) {
    const player = raceState.runners.find(r => r.isPlayer);
    if (!player) return { feedback: 'No player runner found.' };

    const aheadPos = player.position - 1;
    const ahead = raceState.runners.find(r => r.position === aheadPos && !r.dnf);

    if (effect === 'attack' || effect === 'dive') {
      // success chance = overtaking skill + mental factor
      const chance = (player.overtaking / 100) * 0.6 + (player.mental / 100) * 0.25 + 0.1;
      const roll = Math.random();
      if (roll < chance) {
        // swap positions
        if (ahead) {
          player.position = aheadPos;
          ahead.position += 1;
        }
        return {
          feedback: `Bayes takes the place!`,
          commentary: { who: 'lee', text: `"HE'S DONE IT! Bayes is through!"` },
        };
      } else if (roll < chance + 0.2) {
        // failed but no damage
        return {
          feedback: 'Attempted. Held.',
          commentary: { who: 'etienne', text: `"Bayes tried the inside. Closed off. Holds position."` },
        };
      } else {
        // failed, lost time / layer damage
        player.timeOffset += 2;
        player.layers.manoeuvrability -= 8;
        return {
          feedback: 'Half-move. He loses time.',
          commentary: { who: 'lee', text: `"Ah — wide, lost the line. Time down."` },
        };
      }
    }

    if (effect === 'hold' || effect === 'wait') {
      // modest conservation
      player.layers.acceleration = Math.min(100, player.layers.acceleration + 2);
      return {
        feedback: 'Holding station.',
        commentary: { who: 'etienne', text: `"Bayes conserves. Sensible."` },
      };
    }

    if (effect === 'pit') {
      // pit stop — cost positions, regen layers
      return pitAction(raceState, playerState, player, false);
    }

    if (effect === 'continue-dangerous') {
      // set flag; Cassian keeps flying with broken protection
      playerState.flags.flewWithBrokenProtection = true;
      return {
        feedback: 'Cassian refuses the radio call.',
        commentary: { who: 'lee', text: `"He's ignored the radio. He's just... flying."` },
      };
    }

    return { feedback: 'Nothing changes.' };
  }

  function pitAction(raceState, playerState, player, forced) {
    // Pit time based on team pit base + mastery
    const pitTime = playerState.pitBase;
    // Each second lost translates roughly to fractional position drop
    // rough: 2 positions lost for 10-12s stop
    const positionsLost = Math.round(pitTime / 5);

    // Move player back by positionsLost
    const oldPos = player.position;
    const newPos = Math.min(7, oldPos + positionsLost);
    // shuffle others up
    raceState.runners.forEach(r => {
      if (r === player) return;
      if (r.dnf) return;
      if (r.position > oldPos && r.position <= newPos) {
        r.position -= 1;
      }
    });
    player.position = newPos;

    // Regen layers
    for (const k of Object.keys(player.layers)) {
      player.layers[k] = Math.min(100, player.layers[k] + 60);
    }
    player.mustPit = false;
    player.needsPit = false;
    player.pitsTaken += 1;
    player.timeOffset += pitTime;

    return {
      feedback: `Pit stop complete. ${pitTime.toFixed(1)}s. Now P${newPos}.`,
      commentary: { who: 'etienne', text: `"Bayes into the pit. ${pitTime.toFixed(1)}-second stop. He rejoins P${newPos}."` },
    };
  }

  // ============================================
  //   FINAL RESOLUTION
  // ============================================
  function finalizeRace(raceState, playerState) {
    // Final positions already set.
    // Apply points + prize + record.
    const P = window.IFC.POINTS;
    const PRIZE_T = window.IFC.PRIZE;

    const finishOrder = [...raceState.runners].sort((a, b) => a.position - b.position);
    const player = finishOrder.find(r => r.isPlayer);
    const playerPos = player.dnf ? 8 : player.position;

    // award points
    finishOrder.forEach(r => {
      if (r.dnf) return;
      const pos = r.position;
      const entry = playerState.standings.find(s => s.riderId === r.riderId);
      if (entry) entry.points += P[pos] || 0;
    });

    // prize money
    if (!player.dnf) {
      playerState.galleons += PRIZE_T[playerPos] || 0;
    }

    // record
    playerState.results.push({
      round: playerState.round,
      position: playerPos,
      points: player.dnf ? 0 : (P[playerPos] || 0),
      dnf: player.dnf,
      dnfReason: player.dnfReason || null,
      notes: '',
    });

    // rider wear
    playerState.rider.physical = Math.max(0, playerState.rider.physical - 8);
    if (player.dnf) playerState.rider.mental = Math.max(0, playerState.rider.mental - 5);
    if (playerPos === 1) playerState.rider.mental = Math.min(100, playerState.rider.mental + 3);

    // check Cassian Rule
    if (playerState.flags.flewWithBrokenProtection && playerPos === 1) {
      playerState.flags.cassianRuleInvoked = true;
    }

    G.clampState(playerState);
    return { playerPos, dnf: player.dnf, dnfReason: player.dnfReason, finishOrder };
  }

  // ============================================
  //   EXPORT
  // ============================================
  window.IFCRace = {
    simulateQualifying,
    initRaceState,
    tickRace,
    maybeIntervention,
    applyInterventionEffect,
    finalizeRace,
    lastName,
  };

})();
