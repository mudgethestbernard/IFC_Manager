/* ============================================
   IFC MANAGER — ACTIONS
   Pre-Race Week action definitions and resolution.
   Each action: cost (AP + Galleons), effect on state,
   narrative feedback line.
   ============================================ */

(function() {
  const G = window.IFCGame;

  // ---------- ACTION DEFINITIONS ----------
  // Each action returns { ok: bool, feedback: string } after apply.

  const ACTIONS = {

    // ---- BROOM R&D ----
    'rd-speed-small': {
      group: 'rd',
      label: 'Speed R&D (Modest)',
      desc: 'Refine the Acceleration Charm stack. +3 Speed.',
      ap: 1, cost: 1500,
      canRun: (s) => s.broom.speed < 100,
      apply: (s) => {
        s.broom.speed += 3;
        return { feedback: 'Rowan runs the new Acceleration Charm stack on the bench. "Holds.\u00a0Barely."' };
      },
    },
    'rd-speed-large': {
      group: 'rd',
      label: 'Speed R&D (Major)',
      desc: 'Full rework of the upper charm layers. +5 Speed.',
      ap: 1, cost: 3000,
      canRun: (s) => s.broom.speed < 100,
      apply: (s) => {
        s.broom.speed += 5;
        return { feedback: 'Three nights in the workshop. Rowan emerges with ash in his hair and a grin. "Try not to break this one."' };
      },
    },
    'rd-handling-small': {
      group: 'rd',
      label: 'Handling R&D (Modest)',
      desc: 'Fine-tune the Stability Charm. +3 Handling.',
      ap: 1, cost: 1500,
      canRun: (s) => s.broom.handling < 100,
      apply: (s) => {
        s.broom.handling += 3;
        return { feedback: 'Petra tests the new Stability Charm in the simulator. She does not sigh. This is high praise.' };
      },
    },
    'rd-handling-large': {
      group: 'rd',
      label: 'Handling R&D (Major)',
      desc: 'Rebalance the Manoeuvrability / Stability pairing. +5 Handling.',
      ap: 1, cost: 3000,
      canRun: (s) => s.broom.handling < 100,
      apply: (s) => {
        s.broom.handling += 5;
        return { feedback: 'Rowan and Petra argue for an hour about interference patterns, then agree. The broom turns like a thought.' };
      },
    },
    'rd-reliability-small': {
      group: 'rd',
      label: 'Reliability R&D (Modest)',
      desc: 'Reinforce Structural layer. +3 Reliability.',
      ap: 1, cost: 1500,
      canRun: (s) => s.broom.reliability < 100,
      apply: (s) => {
        s.broom.reliability += 3;
        return { feedback: 'Structural scans look healthier. Rowan stops muttering about the handle stress, at least for now.' };
      },
    },
    'rd-reliability-large': {
      group: 'rd',
      label: 'Reliability R&D (Major)',
      desc: 'Reseat the base layers. +5 Reliability.',
      ap: 1, cost: 3000,
      canRun: (s) => s.broom.reliability < 100,
      apply: (s) => {
        s.broom.reliability += 5;
        return { feedback: 'A full tear-down and re-cast. It takes the crew two days and a significant amount of tea.' };
      },
    },

    // ---- PIT CREW TRAINING ----
    'train-crew': {
      group: 'train',
      label: 'Pit Crew Training',
      desc: 'Drill the spell-layer sequence. Pit stop −0.5s, Mastery +5.',
      ap: 1, cost: 800,
      canRun: (s) => s.pitBase > 6,
      apply: (s) => {
        s.pitBase = Math.max(6, s.pitBase - 0.5);
        s.spellLayerMastery += 5;
        return { feedback: 'Graham runs the crew through the sequence until they stop flinching. "Three, two, one\u2014go." Again. Again.' };
      },
    },

    // ---- RIDER MANAGEMENT ----
    'rider-rest': {
      group: 'rider',
      label: 'Rest',
      desc: 'A quiet week. Physical +15, Mental +5.',
      ap: 1, cost: 0,
      canRun: (s) => s.rider.physical < 100 || s.rider.mental < 100,
      apply: (s) => {
        s.rider.physical += 15;
        s.rider.mental += 5;
        return { feedback: 'Cassian sleeps for eleven hours. Lydia looks mildly emotional when he shows up to breakfast.' };
      },
    },
    'rider-therapy': {
      group: 'rider',
      label: 'Therapy Session',
      desc: 'A professional consults on the war-adjacent symptoms. Mental +20. First session of the season costs Morale −5 (the team is protective).',
      ap: 1, cost: 500,
      canRun: (s) => s.rider.mental < 100,
      apply: (s) => {
        s.rider.mental += 20;
        let feedback;
        if (!s.flags.therapyStartedThisSeason) {
          s.morale -= 5;
          s.flags.therapyStartedThisSeason = true;
          feedback = 'The therapist is discreet, comes highly recommended, and asks Cassian questions he answers flatly. Nora stands guard outside the door. Morale dips slightly. Nobody wants outsiders looking at him.';
        } else {
          feedback = 'Cassian actually lets the therapist finish a sentence this time. Progress.';
        }
        return { feedback };
      },
    },
    'rider-simulator': {
      group: 'rider',
      label: 'Simulator Training',
      desc: 'Hours on the training track. Qualifying bonus next round.',
      ap: 1, cost: 300,
      canRun: (s) => true,
      apply: (s) => {
        s.flags.simBonusActive = true;
        return { feedback: 'Felix runs him through every turn on a projected model of the next circuit. Cassian squints at the maths and somehow improves anyway.' };
      },
    },
    'rider-press': {
      group: 'rider',
      label: 'Press Training with Lydia',
      desc: 'Lydia drills him on safe answers. Buffers the next interview disaster.',
      ap: 1, cost: 200,
      canRun: (s) => true,
      apply: (s) => {
        s.flags.pressBuffer = (s.flags.pressBuffer || 0) + 1;
        return { feedback: '"When they ask if it was dangerous, you say\u2014" "\u2014it was within acceptable parameters." "NO, Cassian, you say \'it\'s part of the job.\'" "\u2026Right."' };
      },
    },

    // ---- MEDIA ----
    'media': {
      group: 'media',
      label: 'Media Management',
      desc: 'Lydia fields the press cycle. Reputation +5. Blocks one interview incident.',
      ap: 1, cost: 0,
      canRun: (s) => true,
      apply: (s) => {
        s.reputation += 5;
        s.flags.mediaBuffer = (s.flags.mediaBuffer || 0) + 1;
        return { feedback: 'Lydia gives three interviews in Cassian\'s stead, charms a junior Skeeter, and sends Cassian home with biscuits.' };
      },
    },

    // ---- SCOUTING ----
    'scout': {
      group: 'scout',
      label: 'Scout Rivals',
      desc: 'Intelligence on the next race. Reveals track conditions and a rival detail.',
      ap: 1, cost: 400,
      canRun: (s) => !s.flags.scoutActive,
      apply: (s) => {
        s.flags.scoutActive = true;
        const track = window.IFC.trackByRound(s.round);
        const whispers = [
          'Laurent passes a note at dinner. Comet is running a lighter handling setup this weekend.',
          'A Beauxbatons alumnus mentions Firebolt\'s iron parts arrived late again. Aur\u00e9lien is already pacing.',
          'Petra confirms the weather: ' + describeWeather(track.weather) + '.',
          'Felix has modelled the bottleneck timing. He produces three graphs and one sentence: "Brake late."',
          'Madam Hooch has been seen at the Cleansweep garage. She looks resigned.',
          '\u00c9tienne sends a letter. Silver Arrow has rebalanced their Layer 7. "Expect precision, not pace."',
        ];
        return { feedback: whispers[Math.floor(Math.random() * whispers.length)] };
      },
    },
  };

  function describeWeather(w) {
    const map = {
      'rain-frequent': 'rain likely on race day',
      'wind-variable': 'wind expected to shift twice in the race',
      'fog-frequent': 'morning fog, probably lingering',
      'heat-shimmer': 'clear desert night, minimal interference',
      'wind-defining': 'gusts up to sixty at the cliffs',
      'storm-risk': 'a proper storm is building off Norway',
      'mountain-clear': 'cold and clear, low visibility at altitude',
      'cold-extreme': 'sub-zero, the aurora will be out',
      'cold-sea': 'a hard north wind across the Baltic',
      'highland-variable': 'Highland weather. Which is to say, all of it',
      'alpine-severe': 'ice walls glinting, storm on the west face',
      'season-dependent': 'whatever the host nation arranges',
    };
    return map[w] || 'weather unclear';
  }

  // ---------- CHECK ----------
  function canAfford(state, action) {
    if (!action) return false;
    if (state.ap < action.ap) return false;
    if (state.galleons < action.cost) return false;
    if (action.canRun && !action.canRun(state)) return false;
    // prevent duplicate in same week where appropriate
    if (action.group === 'scout' && state.flags.scoutActive) return false;
    return true;
  }

  // ---------- RUN ----------
  function runAction(state, actionId) {
    const action = ACTIONS[actionId];
    if (!action) return { ok: false, feedback: 'Unknown action.' };
    if (!canAfford(state, action)) return { ok: false, feedback: 'Cannot afford that.' };

    state.ap -= action.ap;
    state.galleons -= action.cost;

    const result = action.apply(state) || {};
    G.clampState(state);
    G.saveGame(state);

    return { ok: true, feedback: result.feedback || 'Done.' };
  }

  // ---------- END OF WEEK / ADVANCE TO QUALIFYING ----------
  // When the player has used their APs (or chooses to end early),
  // we advance to the Qualifying phase of the current round.
  function endWeek(state) {
    // per-week decay
    state.rider.physical = Math.max(0, state.rider.physical - 3);
    state.rider.mental = Math.max(0, state.rider.mental - 2);
    state.morale = Math.max(0, state.morale - 1);

    // operating cost
    state.galleons -= window.IFC.OPERATING_COST;

    // reset weekly flags that shouldn't persist
    state.flags.scoutActive = false;

    // advance phase
    state.phase = 'qualifying';

    G.clampState(state);
    G.saveGame(state);
    return state;
  }

  // ---------- EXPORT ----------
  window.IFCActions = {
    ACTIONS,
    canAfford,
    runAction,
    endWeek,
  };

})();
