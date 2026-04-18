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

      const broom = isPlayer
        ? (state.broom || baseTeam.broom)
        : baseTeam.broom;

      const rider = RIDERS[baseTeam.riderId];
      if (!rider) continue;

      const playerPhys = isPlayer ? state.rider.physical : rider.physical;
      const playerMen = isPlayer ? state.rider.mental : rider.mental;

      let score = 0;
      score += rider.skill.qualifying * 0.45;
      score += rider.skill.pace * 0.20;
      score += broom.speed * 0.15;
      score += broom.handling * 0.10;
      score += playerPhys * 0.05;
      score += playerMen * 0.05;

      if (track.type === 'technical') score += rider.skill.tyreMgmt * 0.05;
      if (track.type === 'high-speed') score += broom.speed * 0.03;
      if (track.type === 'over-water') score += rider.skill.consistency * 0.03;

      if (isPlayer && state.flags && state.flags.simBonusActive) score += 6;

      // Firebolt weakened this round (from goblin strike event)
      if (teamId === 'firebolt' && state.flags && state.flags.firebolt_weakened_next) {
        score -= 8;
      }

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
    raceState.thisLapEmitCount = 0;
    raceState.playerStateRef = playerState; // for track-flag lookups
    const track = raceState.track;

    const prev = {};
    raceState.runners.forEach(r => { prev[r.riderId] = r.position; });

    for (const r of raceState.runners) {
      if (r.dnf) continue;
      depleteLayers(r, track);
      checkLayerCritical(r, raceState);
    }

    for (const r of raceState.runners) {
      if (r.dnf || r.isPlayer) continue;
      maybeNPCPit(r, raceState);
    }

    for (const r of raceState.runners) {
      if (r.dnf) continue;
      checkMechanical(r, raceState);
    }

    adjustPositions(raceState, prev);
    generateCommentary(raceState, playerState, prev);

    return raceState;
  }

  function depleteLayers(runner, track) {
    // Moderate depletion — players usually pit 1-2 times in a race
    const base = 2.2;
    const mgmtFactor = 1.5 - (runner.tyreMgmt / 150);
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

    // ALL core layers depleted → DNF
    if (
      runner.layers.acceleration === 0 &&
      runner.layers.manoeuvrability === 0 &&
      runner.layers.protection === 0
    ) {
      runner.dnf = true;
      runner.dnfReason = 'Complete spell collapse';
      emitCommentary(raceState, 'lee',
        `"${lastName(runner.riderId)} — his charms are GONE. That broom is a plank of wood!"`);
    }
  }

  function maybeNPCPit(r, raceState) {
    const lap = raceState.lap;
    const maxLap = raceState.maxLap;

    // Average of the three core layers — NPCs react to their own state
    const coreAvg = (r.layers.acceleration + r.layers.manoeuvrability + r.layers.protection) / 3;

    const shouldPit =
      (r.pitsTaken === 0 && coreAvg < 25) ||       // layer-based trigger
      (r.mustPit && r.pitsTaken === 0) ||          // protection charm deadline
      (r.pitsTaken === 0 && lap >= maxLap - 5) ||  // safety net
      (r.needsPit && r.pitsTaken === 0 && coreAvg < 35 && Math.random() < 0.5);

    if (!shouldPit) return;

    const team = TEAMS[r.teamId];
    const baseTime = team.pitBase;
    const positionsLost = Math.max(1, Math.min(3, Math.round(baseTime / 5)));

    r.position = Math.min(7, r.position + positionsLost);
    r.pitsTaken += 1;
    r.timeOffset += baseTime;
    for (const k of Object.keys(r.layers)) r.layers[k] = Math.min(100, r.layers[k] + 75);
    r.mustPit = false;
    r.needsPit = false;

    emitCommentary(raceState, 'etienne',
      `"${lastName(r.riderId)} into the pits — ${baseTime.toFixed(1)} seconds."`);
  }

  function checkMechanical(runner, raceState) {
    const track = raceState.track;
    const relFactor = (100 - runner.broomReliability) / 9000;

    let trackMult = 1.0;
    if (track.id === 'alpine') trackMult = 2.8;
    else if (track.id === 'romanian') trackMult = 1.8;
    else if (track.id === 'irish') trackMult = 1.7;
    else if (track.id === 'northsea') trackMult = 1.6;
    else if (track.type === 'over-water') trackMult = 1.3;
    else if (track.type === 'technical') trackMult = 1.2;

    // Charlie Weasley's dragon advice helps at Romanian
    if (track.id === 'romanian' && raceState.playerStateRef && raceState.playerStateRef.flags && raceState.playerStateRef.flags.dragonAdvice && runner.isPlayer) {
      trackMult *= 0.5;
    }

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

    // Compute each runner's effective lap pace
    const paceMap = {};
    for (const r of raceState.runners) {
      if (r.dnf) { paceMap[r.riderId] = -9999; continue; }
      // Layer hit — if accel or maneuvre drops below 30, it degrades sharply
      const accelFactor = r.layers.acceleration < 30
        ? Math.pow(r.layers.acceleration / 30, 2) * 0.9 + 0.1
        : r.layers.acceleration / 100;
      const steerFactor = r.layers.manoeuvrability < 30
        ? Math.pow(r.layers.manoeuvrability / 30, 2) * 0.9 + 0.1
        : r.layers.manoeuvrability / 100;
      const aeroFactor = r.layers.aero / 100;
      const layerHit = (accelFactor * 0.45 + steerFactor * 0.35 + aeroFactor * 0.20);
      const stamina = 0.6 + (r.physical / 100) * 0.4;
      const mental = 0.85 + (r.mental / 100) * 0.15;
      const noise = (Math.random() - 0.5) * 6;
      const timeCost = r.timeOffset * 0.5;
      r.timeOffset = Math.max(0, r.timeOffset - 0.5);
      const pace = r.pacePts * layerHit * stamina * mental + noise - timeCost;
      paceMap[r.riderId] = pace;
    }

    // Churn — openings are chaos, settled field sees fewer swaps
    const openingLaps = lap <= 2;
    const churnChance = openingLaps ? 0.65 : 0.38;

    const running = raceState.runners.filter(r => !r.dnf).sort((a, b) => a.position - b.position);

    // Consider adjacent pairs for swaps
    for (let i = 0; i < running.length - 1; i++) {
      const front = running[i];
      const back = running[i + 1];
      const frontPace = paceMap[front.riderId];
      const backPace = paceMap[back.riderId];

      const diff = backPace - frontPace;
      if (diff <= 0) continue;

      let pSwap = churnChance * (diff / 18) * (0.7 + back.overtaking / 300);
      const track = raceState.track;
      if (track.traits && track.traits.includes('bottleneck')) pSwap *= 0.75;
      if (track.type === 'technical') pSwap *= 0.85;
      pSwap = Math.min(pSwap, 0.7);

      if (Math.random() < pSwap) {
        [front.position, back.position] = [back.position, front.position];
      }
    }

    // DNFs to end
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
      who,
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

      // Mid-race colour — emit ~50% of the time
      if (Math.random() < 0.5) {
        const event = pickColourEvent(raceState, player, playerState);
        if (event) emitCommentary(raceState, event.who, event.text);
      }
    }
  }

  function pickColourEvent(raceState, player, playerState) {
    const pool = [];

    // Player layer states
    if (player && !player.dnf) {
      if (player.layers.acceleration < 25) {
        pool.push({ who: 'etienne', text: `"${lastName(player.riderId)}'s Acceleration Charm is on its last breath. He cannot hold this pace much longer."` });
      }
      if (player.layers.protection < 25 && player.layers.protection > 15) {
        pool.push({ who: 'lee', text: `"Is that a crack in Bayes's Protection Charm?! Oh, Cassian, not again—"` });
      }
      if (player.layers.manoeuvrability < 30) {
        pool.push({ who: 'etienne', text: `"Bayes's manoeuvrability is degrading. Watch for the broom stepping out on him."` });
      }
      if (player.layers.stability < 30) {
        pool.push({ who: 'lee', text: `"Bayes is wobbling through that section — his Stability Charm is complaining."` });
      }
    }

    // Rival layer narration (picked NPC with visible wear)
    const distressedNPC = raceState.runners
      .filter(r => !r.isPlayer && !r.dnf && r.pitsTaken === 0)
      .find(r => r.layers.acceleration < 30 || r.layers.protection < 25);
    if (distressedNPC && Math.random() < 0.5) {
      const rider = RIDERS[distressedNPC.riderId];
      pool.push({ who: 'etienne', text: `"${lastName(distressedNPC.riderId)} is showing layer fatigue. A pit window must open soon."` });
    }

    // Leader commentary
    const leader = leaderOf(raceState);
    if (leader) {
      pool.push({ who: 'etienne', text: `"${lastName(leader.riderId)} through the sector cleanly. Metronomic."` });
      if (leader.isPlayer && Math.random() < 0.4) {
        pool.push({ who: 'lee', text: `"Bayes leads — he's flying like he's barely noticed!"` });
      }
    }

    // Player position-specific colour
    if (player && !player.dnf) {
      if (player.position === 1) {
        pool.push({ who: 'etienne', text: `"Bayes extends the lead."` });
        pool.push({ who: 'lee', text: `"The man is asleep at the stick and still winning!"` });
      } else if (player.position === 2) {
        pool.push({ who: 'etienne', text: `"Bayes is sitting in the slipstream. Waiting."` });
      } else if (player.position === 3) {
        pool.push({ who: 'lee', text: `"Bayes on the bubble for the podium — come on, Cass!"` });
      } else if (player.position >= 5) {
        pool.push({ who: 'lee', text: `"Come on, Cassian — do something ridiculous, would you?"` });
        pool.push({ who: 'etienne', text: `"Bayes sits mid-pack. Not his natural habitat."` });
      }
    }

    // Rival beats — character-specific
    const rivals = raceState.runners.filter(r => !r.isPlayer && !r.dnf);
    const rivalPick = rivals[Math.floor(Math.random() * rivals.length)];
    if (rivalPick && Math.random() < 0.6) {
      const rid = rivalPick.riderId;
      if (rid === 'aurelien') {
        pool.push({ who: 'lee', text: `"Dubois on the radio again — you can hear him from the commentary box."` });
        pool.push({ who: 'etienne', text: `"Dubois dramatic as always. Effective, mind."` });
      } else if (rid === 'marcus') {
        pool.push({ who: 'etienne', text: `"Flint going two-wide through that gap. No margin."` });
        pool.push({ who: 'lee', text: `"Flint flying like he's auditioning for a Quidditch foul reel!"` });
      } else if (rid === 'wolfram') {
        pool.push({ who: 'etienne', text: `"Steiner's line is identical to last lap. To the centimetre."` });
        pool.push({ who: 'lee', text: `"You could set a clock by Steiner. Boring, isn't it?"` });
      } else if (rid === 'alistair') {
        pool.push({ who: 'lee', text: `"Whitmore's radio just said 'Plan C.' Oh no."` });
        pool.push({ who: 'etienne', text: `"Whitmore is driving beautifully. His team is letting him down."` });
      } else if (rid === 'matthias') {
        pool.push({ who: 'etienne', text: `"Gerber quietly moves up. You almost didn't notice."` });
      } else if (rid === 'ryder') {
        pool.push({ who: 'lee', text: `"Hale is pointing at something. We have no idea what."` });
      }
    }

    // Track-specific colour
    const track = raceState.track;
    if (Math.random() < 0.15) {
      if (track.id === 'british') {
        pool.push({ who: 'etienne', text: `"The Stonehenge pass approaches. Single file from here."` });
      } else if (track.id === 'german') {
        pool.push({ who: 'lee', text: `"Through the trees — you can barely see the brooms!"` });
      } else if (track.id === 'alpine') {
        pool.push({ who: 'etienne', text: `"The climb ahead. Expect strain readings to spike."` });
      } else if (track.id === 'irish') {
        pool.push({ who: 'lee', text: `"Another gust at the cliff — they're all being shoved sideways!"` });
      } else if (track.id === 'egyptian') {
        pool.push({ who: 'etienne', text: `"Between the pyramids. Ancient magic thickens the air here."` });
      } else if (track.id === 'romanian') {
        pool.push({ who: 'lee', text: `"And somewhere down there, Charlie Weasley is cursing quietly at a dragon."` });
      } else if (track.id === 'scottish') {
        pool.push({ who: 'etienne', text: `"The valley stretch. The Hogwarts contingent will be roaring."` });
      } else if (track.id === 'swedish') {
        pool.push({ who: 'lee', text: `"And under the aurora — I'm sorry, I'll never get over how beautiful this is."` });
      } else if (track.id === 'channel') {
        pool.push({ who: 'etienne', text: `"Low over the Channel. They're metres above the waves."` });
      }
    }

    // Cassian-specific colour (Lee's signature style)
    if (player && !player.dnf && Math.random() < 0.15) {
      pool.push({ who: 'lee', text: `"Bayes has the face he gets when he's thinking. Or sleeping. Hard to tell."` });
      pool.push({ who: 'lee', text: `"Somewhere in the stands, Colin Bayes is having a small nervous breakdown."` });
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
    const P = window.IFC.POINTS;
    const PRIZE_T = window.IFC.PRIZE;

    const finishOrder = [...raceState.runners].sort((a, b) => a.position - b.position);
    const player = finishOrder.find(r => r.isPlayer);
    const playerPos = player.dnf ? 8 : player.position;

    finishOrder.forEach(r => {
      if (r.dnf) return;
      const pos = r.position;
      const entry = playerState.standings.find(s => s.riderId === r.riderId);
      if (entry) entry.points += P[pos] || 0;
    });

    if (!player.dnf) {
      playerState.galleons += PRIZE_T[playerPos] || 0;
    }

    playerState.results.push({
      round: playerState.round,
      position: playerPos,
      points: player.dnf ? 0 : (P[playerPos] || 0),
      dnf: player.dnf,
      dnfReason: player.dnfReason || null,
      notes: '',
    });

    playerState.rider.physical = Math.max(0, playerState.rider.physical - 8);
    if (player.dnf) playerState.rider.mental = Math.max(0, playerState.rider.mental - 5);
    if (playerPos === 1) playerState.rider.mental = Math.min(100, playerState.rider.mental + 3);

    if (playerState.flags.flewWithBrokenProtection && playerPos === 1) {
      playerState.flags.cassianRuleInvoked = true;
    }

    // Consume one-shot event flags
    delete playerState.flags.firebolt_weakened_next;
    delete playerState.flags.dragonAdvice;

    G.clampState(playerState);
    return { playerPos, dnf: player.dnf, dnfReason: player.dnfReason, finishOrder };
  }

  // ============================================
  //   PLAYER PIT — callable from the UI at any lap
  // ============================================
  function playerPit(raceState, playerState) {
    const player = raceState.runners.find(r => r.isPlayer);
    if (!player || player.dnf) return { ok: false, feedback: 'No active player runner.' };
    if (player.justPittedLap === raceState.lap) {
      return { ok: false, feedback: 'Already pitted this lap.' };
    }

    const pitTime = playerState.pitBase;
    const positionsLost = Math.max(1, Math.min(3, Math.round(pitTime / 5)));

    const oldPos = player.position;
    const newPos = Math.min(7, oldPos + positionsLost);

    raceState.runners.forEach(r => {
      if (r === player) return;
      if (r.dnf) return;
      if (r.position > oldPos && r.position <= newPos) r.position -= 1;
    });
    player.position = newPos;

    for (const k of Object.keys(player.layers)) {
      player.layers[k] = Math.min(100, player.layers[k] + 75);
    }
    player.mustPit = false;
    player.needsPit = false;
    player.pitsTaken += 1;
    player.timeOffset += pitTime;
    player.justPittedLap = raceState.lap;

    emitCommentary(raceState, 'etienne',
      `"Bayes into the pit — ${pitTime.toFixed(1)}-second stop. Rejoins P${newPos}."`);

    return { ok: true, feedback: `Pit stop: ${pitTime.toFixed(1)}s. Now P${newPos}.` };
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
    playerPit,
    lastName,
  };

})();
