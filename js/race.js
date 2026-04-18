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
    if (!track) {
      console.error('No track for round', state.round);
      return [];
    }
    const entries = [];

    for (const teamId of Object.keys(TEAMS)) {
      const baseTeam = TEAMS[teamId];
      const isPlayer = (teamId === state.teamId);

      // Use player's current broom state, otherwise the team's canonical broom.
      const broom = isPlayer
        ? (state.broom || baseTeam.broom)
        : baseTeam.broom;

      const rider = RIDERS[baseTeam.riderId];
      if (!rider) {
        console.warn('Missing rider for team', teamId);
        continue;
      }

      const playerPhys = isPlayer ? state.rider.physical : rider.physical;
      const playerMen = isPlayer ? state.rider.mental : rider.mental;

      let score = 0;
      score += rider.skill.qualifying * 0.45;
      score += rider.skill.pace * 0.20;
      score += broom.speed * 0.15;
      score += broom.handling * 0.10;
      score += playerPhys * 0.05;
      score += playerMen * 0.05;

      // track-type adjustments
      if (track.type === 'technical') score += rider.skill.tyreMgmt * 0.05;
      if (track.type === 'high-speed') score += broom.speed * 0.03;
      if (track.type === 'over-water') score += rider.skill.consistency * 0.03;

      // simulator bonus (player only)
      if (isPlayer && state.flags && state.flags.simBonusActive) score += 6;

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
      const baseTeam = TEAMS[g.teamId];
      const broom = g.isPlayer ? (state.broom || baseTeam.broom) : baseTeam.broom;
      // Each rider's "race pace" — a roughly stable underlying speed,
      // perturbed each lap by layer state, stamina, and small noise.
      const pacePts = (
        rider.skill.pace * 0.45 +
        rider.skill.consistency * 0.15 +
        broom.speed * 0.20 +
        broom.handling * 0.20
      );
      return {
        riderId: g.riderId,
        teamId: g.teamId,
        isPlayer: g.isPlayer,
        grid: g.grid,
        position: g.grid,
        pacePts,
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
        broomSpeed: broom.speed,
        broomHandling: broom.handling,
        broomReliability: broom.reliability,
        pitsTaken: 0,
        pitPlanned: pickPitLap(track.laps), // NPCs: plan a pit lap
        needsPit: false,
        mustPit: false,
        dnf: false,
        dnfReason: null,
        timeOffset: 0,
        radioIgnored: false,
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
      prevPositions: {}, // track lap-to-lap swaps for commentary
    };
  }

  function pickPitLap(totalLaps) {
    // NPCs pit roughly mid-race, with variance
    const mid = Math.floor(totalLaps * 0.55);
    const variance = Math.floor(totalLaps * 0.15);
    return mid + Math.floor((Math.random() - 0.5) * 2 * variance);
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

    // snapshot previous positions
    const prev = {};
    raceState.runners.forEach(r => { prev[r.riderId] = r.position; });

    // Deplete spell layers for all runners
    for (const r of raceState.runners) {
      if (r.dnf) continue;
      depleteLayers(r, track);
      checkLayerCritical(r, raceState);
    }

    // NPC auto-pit behaviour
    for (const r of raceState.runners) {
      if (r.dnf || r.isPlayer) continue;
      maybeNPCPit(r, raceState);
    }

    // Mechanical failures (track-sensitive)
    for (const r of raceState.runners) {
      if (r.dnf) continue;
      checkMechanical(r, raceState);
    }

    // Adjust positions — swap-based, realistic (1-2 changes per lap)
    adjustPositions(raceState, prev);

    // Generate commentary (reacts to actual changes)
    generateCommentary(raceState, playerState, prev);

    return raceState;
  }

  function depleteLayers(runner, track) {
    // Base depletion is faster now — pit stop is mandatory roughly once per race
    const base = 3.2;
    const mgmtFactor = 1.5 - (runner.tyreMgmt / 150); // low tyreMgmt → faster drain
    const trackMod = track.type === 'high-speed' ? 1.25
                   : track.type === 'technical' ? 1.10
                   : track.type === 'special' ? 1.15
                   : 1.0;

    const d = base * trackMod * mgmtFactor;

    runner.layers.acceleration -= d * 1.25;
    runner.layers.manoeuvrability -= d * 1.00;
    runner.layers.aero -= d * 0.85;
    runner.layers.stability -= d * 0.75;
    runner.layers.braking -= d * 0.65;
    runner.layers.protection -= d * 0.55;
    runner.layers.cushioning -= d * 0.35;
    runner.layers.structural -= d * 0.15;

    for (const k of Object.keys(runner.layers)) {
      runner.layers[k] = Math.max(0, runner.layers[k]);
    }
  }

  function checkLayerCritical(runner, raceState) {
    if (runner.layers.protection < 15 && !runner.mustPit) {
      runner.mustPit = true;
      runner.pitDeadline = raceState.lap + 5;
    }
    if (runner.layers.acceleration < 20 || runner.layers.manoeuvrability < 20) {
      runner.needsPit = true;
    }
  }

  function maybeNPCPit(r, raceState) {
    // NPCs must pit at least once. Forced pit if they've gone too long.
    const lap = raceState.lap;
    const maxLap = raceState.maxLap;

    const shouldPit =
      (r.pitsTaken === 0 && lap >= r.pitPlanned) ||
      (r.mustPit && r.pitsTaken === 0) ||
      (r.needsPit && r.pitsTaken === 0 && Math.random() < 0.4) ||
      // last-chance safety net — NPC must pit before the last 6 laps
      (r.pitsTaken === 0 && lap >= maxLap - 6);

    if (!shouldPit) return;

    // Execute NPC pit
    const team = TEAMS[r.teamId];
    const baseTime = team.pitBase;
    const positionsLost = Math.max(1, Math.min(3, Math.round(baseTime / 5)));

    r.position = Math.min(7, r.position + positionsLost);
    r.pitsTaken += 1;
    r.timeOffset += baseTime;
    for (const k of Object.keys(r.layers)) r.layers[k] = Math.min(100, r.layers[k] + 70);
    r.mustPit = false;
    r.needsPit = false;

    emitCommentary(raceState, 'etienne',
      `"${lastName(r.riderId)} into the pits — ${baseTime.toFixed(1)} seconds."`);
  }

  function checkMechanical(runner, raceState) {
    const track = raceState.track;

    // Base failure chance, scaled by broom reliability and track hostility
    const relFactor = (100 - runner.broomReliability) / 9000;

    // Track hostility multiplier
    let trackMult = 1.0;
    if (track.id === 'alpine') trackMult = 2.8;        // extreme strain
    else if (track.id === 'romanian') trackMult = 1.8; // mountain, dragon risk
    else if (track.id === 'irish') trackMult = 1.7;    // cliff winds
    else if (track.id === 'northsea') trackMult = 1.6; // storms
    else if (track.type === 'over-water') trackMult = 1.3;
    else if (track.type === 'technical') trackMult = 1.2;

    // Failure chance also rises if runner never pitted late in race
    if (runner.pitsTaken === 0 && raceState.lap > raceState.maxLap * 0.7) {
      trackMult *= 2.0;
    }

    const failChance = relFactor * trackMult;

    if (Math.random() < failChance) {
      runner.dnf = true;
      runner.dnfReason = pickDnfReason(track);
      emitCommentary(raceState, 'etienne',
        `"${lastName(runner.riderId)} is out. ${runner.dnfReason}."`);
      return;
    }

    // Protection-charm deadline breach
    if (runner.mustPit && raceState.lap > runner.pitDeadline && runner.pitsTaken === 0) {
      runner.dnf = true;
      runner.dnfReason = 'Protection Charm failure — pit deadline missed';
      emitCommentary(raceState, 'lee',
        `"${lastName(runner.riderId)} has lost the Protection Charm entirely! He's out!"`);
    }
  }

  function pickDnfReason(track) {
    if (track.id === 'alpine') {
      return randChoice(['Strain-induced blackout', 'Iced bristles', 'Ice-wall contact']);
    }
    if (track.id === 'romanian') {
      return randChoice(['Impact with rock face', 'Handle stress fracture']);
    }
    if (track.id === 'irish') {
      return randChoice(['Swept wide by a gust', 'Cliff contact']);
    }
    if (track.id === 'northsea' || track.type === 'over-water') {
      return randChoice(['Wave contact', 'Weatherproofing failure']);
    }
    if (track.id === 'egyptian') {
      return randChoice(['Sandstorm damage', 'Ancient-magic interference']);
    }
    if (track.type === 'technical') {
      return randChoice(['Manoeuvrability Charm collapse', 'Broom contact']);
    }
    return randChoice(['Acceleration Charm failure', 'Structural failure', 'Bristle shedding']);
  }

  function randChoice(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ============================================
  //   POSITION ADJUSTMENT — swap-based, realistic
  // ============================================
  function adjustPositions(raceState, prev) {
    const lap = raceState.lap;
    const total = raceState.maxLap;

    // Compute each runner's effective lap pace right now
    const paceMap = {};
    for (const r of raceState.runners) {
      if (r.dnf) { paceMap[r.riderId] = -9999; continue; }
      const layerHit = (r.layers.acceleration + r.layers.manoeuvrability + r.layers.aero) / 300;
      const stamina = 0.6 + (r.physical / 100) * 0.4;
      const mental = 0.85 + (r.mental / 100) * 0.15;
      const noise = (Math.random() - 0.5) * 4;
      const timeCost = r.timeOffset * 0.5; // pit cost decays over laps
      r.timeOffset = Math.max(0, r.timeOffset - 0.5);
      const pace = r.pacePts * layerHit * stamina * mental + noise - timeCost;
      paceMap[r.riderId] = pace;
    }

    // In the first lap or two, more chaos — bigger shuffles
    // After that, swap-based: only rarely do adjacent runners swap
    const openingLaps = lap <= 2;
    const churnChance = openingLaps ? 0.55 : 0.20;

    // Get runners currently running (not DNF), sorted by current position
    const running = raceState.runners.filter(r => !r.dnf).sort((a, b) => a.position - b.position);

    // For each adjacent pair, consider a swap based on pace difference
    for (let i = 0; i < running.length - 1; i++) {
      const front = running[i];
      const back = running[i + 1];
      const frontPace = paceMap[front.riderId];
      const backPace = paceMap[back.riderId];

      // Positive diff = back runner is faster
      const diff = backPace - frontPace;

      if (diff <= 0) continue;

      // Probability of swap scales with pace gap and overtaking skill
      let pSwap = churnChance * (diff / 20) * (0.7 + back.overtaking / 300);
      // Harder to overtake at bottlenecks / technical tracks
      const track = raceState.track;
      if (track.traits && track.traits.includes('bottleneck')) pSwap *= 0.75;
      if (track.type === 'technical') pSwap *= 0.85;
      pSwap = Math.min(pSwap, 0.55);

      if (Math.random() < pSwap) {
        // swap
        [front.position, back.position] = [back.position, front.position];
      }
    }

    // Ensure DNFs are at the end
    const dnfs = raceState.runners.filter(r => r.dnf);
    const active = raceState.runners.filter(r => !r.dnf).sort((a, b) => a.position - b.position);
    active.forEach((r, i) => { r.position = i + 1; });
    dnfs.forEach((r, i) => { r.position = active.length + i + 1; });
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

  function generateCommentary(raceState, playerState, prevPositions) {
    const player = raceState.runners.find(r => r.isPlayer);
    const lap = raceState.lap;
    const total = raceState.maxLap;

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

    // --- Reactive commentary on position changes ---
    // Find all runners whose position changed this lap
    const swaps = [];
    raceState.runners.forEach(r => {
      if (r.dnf) return;
      const before = prevPositions[r.riderId];
      if (before && before !== r.position) {
        swaps.push({ r, from: before, to: r.position });
      }
    });

    // Prioritise swaps involving the player, the lead, or the podium
    swaps.sort((a, b) => {
      const aScore = (a.r.isPlayer ? 100 : 0) + (a.to <= 3 ? 50 - a.to : 0);
      const bScore = (b.r.isPlayer ? 100 : 0) + (b.to <= 3 ? 50 - b.to : 0);
      return bScore - aScore;
    });

    // Emit at most ONE swap-based line per lap
    if (swaps.length > 0) {
      const topSwap = swaps[0];
      const r = topSwap.r;
      const gained = topSwap.from > topSwap.to;
      if (r.isPlayer) {
        if (gained) {
          emitCommentary(raceState, 'lee',
            `"Bayes is through! Up to P${r.position} — did you see that line?"`);
        } else {
          emitCommentary(raceState, 'etienne',
            `"Bayes loses a place. Down to P${r.position}."`);
        }
      } else {
        // non-player swap — only narrate if it's at the sharp end
        if (r.position === 1 && gained) {
          emitCommentary(raceState, 'lee',
            `"And we have a NEW LEADER! ${lastName(r.riderId)} takes it!"`);
        } else if (r.position <= 3 && gained) {
          emitCommentary(raceState, 'etienne',
            `"${lastName(r.riderId)} into P${r.position}."`);
        } else if (r.position === 1 && !gained) {
          // leader got overtaken — handled above via the gainer
        }
      }
    } else {
      // No swaps — narrate checkpoints or colour
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
        if (leader) emitCommentary(raceState, 'lee',
          `"Final lap! ${lastName(leader.riderId)} leading into the last sector!"`);
        return;
      }

      // Mid-race colour — only emit ~40% of the time
      if (Math.random() < 0.4) {
        const event = pickColourEvent(raceState, player, playerState);
        if (event) emitCommentary(raceState, event.who, event.text);
      }
    }
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
