/* ============================================
   IFC MANAGER — EVENT CARDS
   Scripted canon moments (fixed rounds) and a
   random pool. Events trigger at the start of
   a Pre-Race Week and block action on the hub
   until resolved.
   ============================================ */

(function() {
  const G = window.IFCGame;

  // Each event:
  //   id: unique
  //   title: headline shown in the modal
  //   body: paragraph(s) of narrative
  //   when: optional predicate (state) => bool
  //   options: [{ label, body, apply: (state) => feedback }]
  //   scripted: optional { round: N } fires on that exact round if condition met
  //   weight: for random pool (default 1)

  const EVENTS = {

    // =============== SCRIPTED =============== //

    'colin-first-letter': {
      scripted: { round: 2 },
      title: "A Letter from Colin Bayes",
      body: `A heavy envelope arrives at the Nimbus garage. Inside: ten pages of pencil-drawn diagrams, annotated spreadsheets, and a note in your father's hand. <i>"Dear Cassian — I have been reviewing footage from the British GP. Please see pages 1–8 (turn analysis) and pages 9–10 (slipstream timing). Your mother sends her love. I love you. Dad."</i>`,
      options: [
        {
          label: 'Read it all, carefully',
          body: '1 AP. Handling +3.',
          apply: (s) => {
            if (s.ap < 1) return { feedback: "No AP left this week.", refund: true };
            s.ap -= 1;
            s.broom.handling += 3;
            return { feedback: 'Cassian sits in the briefing room and reads every page. He underlines four lines. Rowan, watching from the doorway, says nothing.' };
          },
        },
        {
          label: 'Skim the highlights',
          body: 'Handling +1.',
          apply: (s) => {
            s.broom.handling += 1;
            return { feedback: 'Cassian flips to the summary. "…Helpful." He means it. Colin will never know.' };
          },
        },
        {
          label: 'Leave it on the bench',
          body: 'Morale −3.',
          apply: (s) => {
            s.morale -= 3;
            return { feedback: 'The notes sit unopened. Somebody tells Lydia. Lydia tells Colin. Colin says he understands. Nobody believes him.' };
          },
        },
      ],
    },

    'wood-tries-again': {
      scripted: { round: 3 },
      title: "Oliver Wood, Again",
      body: `Oliver Wood turns up at training unannounced. "Cassian. Puddlemere. Off-season friendly. You'd only need to Seek. Come on."`,
      options: [
        {
          label: 'Firm no',
          body: 'Morale +2. Wood will sulk for a week.',
          apply: (s) => {
            s.morale += 2;
            return { feedback: 'Cassian: "I like racing." Wood: "You\'re wasting your talent." Cassian: "…I know." Wood sighs. He actually doesn\'t.' };
          },
        },
        {
          label: 'Say you\'ll think about it',
          body: 'Morale −2. Reputation +2.',
          apply: (s) => {
            s.morale -= 2; s.reputation += 2;
            return { feedback: 'Lydia hears the phrase "think about it" from across the room. Her eye twitches. The Prophet will spin it as a Quidditch flirtation.' };
          },
        },
      ],
    },

    'www-test-subject': {
      scripted: { round: 6 },
      title: "Weasleys' Wizard Wheezes Proposal",
      body: `Fred and George arrive with a box of prototypes. "We'd like Cassian to test our new line of Racing Novelties. Think of the publicity!" Lydia has already gone pale.`,
      options: [
        {
          label: 'Yes',
          body: 'Morale +5, Reputation +3, but Reliability −5 for 2 rounds (broom may turn pink).',
          apply: (s) => {
            s.morale += 5;
            s.reputation += 3;
            s.broom.reliability -= 5;
            s.flags.wwwDealAccepted = true;
            return { feedback: 'The broom turns briefly pink during testing. George apologises. Fred does not. Cassian says: "…Aesthetically, no." Lydia leaves the room.' };
          },
        },
        {
          label: 'No',
          body: 'Reputation −2. Fred and George will mention this on air.',
          apply: (s) => {
            s.reputation -= 2;
            s.flags.wwwDealAccepted = false;
            return { feedback: 'The twins leave, affronted. Lee Jordan brings it up on commentary three races in a row.' };
          },
        },
      ],
    },

    'skeeter-ptsd-scoop': {
      scripted: { round: 5 },
      when: (s) => s.rider.mental < 70,
      title: "Skeeter Has a Lead",
      body: `A Ministry contact warns Lydia: Rita Skeeter is writing a piece on Cassian's "wartime demons" and "instability in the cockpit." It will run the morning of the next race.`,
      options: [
        {
          label: 'Legal counsel',
          body: '1,500 G. Reputation preserved.',
          apply: (s) => {
            if (s.galleons < 1500) return { feedback: "Not enough galleons.", refund: true };
            s.galleons -= 1500;
            s.flags.skeeterHandled = 'paid';
            return { feedback: 'A solicitor at Smethwick & Rowle drafts a preemptive rebuttal. The Prophet pulls the piece, replaces it with a feature on broom varnish.' };
          },
        },
        {
          label: 'Preempt with Lydia',
          body: '1 AP. Reputation −5 but controlled, Mental −3.',
          apply: (s) => {
            if (s.ap < 1) return { feedback: "No AP left this week.", refund: true };
            s.ap -= 1;
            s.reputation -= 5;
            s.rider.mental -= 3;
            s.flags.skeeterHandled = 'preempt';
            return { feedback: 'Lydia gives an interview ahead of Skeeter. She controls the framing: "He fought in the war. He\'s here. He\'s racing. Next question." The piece still stings.' };
          },
        },
        {
          label: 'Ignore it',
          body: 'Reputation −15 when it drops, Mental −8.',
          apply: (s) => {
            s.reputation -= 15;
            s.rider.mental -= 8;
            s.flags.skeeterHandled = 'ignored';
            return { feedback: 'It drops on Saturday morning. "UNSTABLE IN THE COCKPIT" above the fold. Cassian does not read it. Everyone else does.' };
          },
        },
      ],
    },

    'etienne-letter': {
      scripted: { round: 7 },
      title: "A Letter from Étienne Delacroix",
      body: `A short note in neat handwriting. <i>"Mon ami — I have been watching your line through Turn 7 at Romania. You are braking too early by perhaps half a metre. Correct it. You will thank me. — É."</i>`,
      options: [
        {
          label: 'Apply the note',
          body: 'Handling +2, Mental +4.',
          apply: (s) => {
            s.broom.handling += 2;
            s.rider.mental += 4;
            return { feedback: 'Cassian reads it once, folds it, puts it in his jacket. Petra notices. Petra says nothing.' };
          },
        },
        {
          label: 'File it away',
          body: 'Mental +2.',
          apply: (s) => {
            s.rider.mental += 2;
            return { feedback: 'Cassian reads it twice. The advice goes unused. The note goes in a drawer. Both remain.' };
          },
        },
      ],
    },

    'goblin-strike': {
      scripted: { round: 4 },
      title: "Goblin Strike at Gringotts",
      body: `The goblin metalworkers' guild has called a strike over Firebolt metalwork fees. Firebolt's iron parts are late. Aurélien is pacing the paddock and cursing in three languages.`,
      options: [
        {
          label: 'Take note and move on',
          body: 'Firebolt weakened next race — minor advantage.',
          apply: (s) => {
            s.flags.firebolt_weakened_next = true;
            return { feedback: 'Petra files the intel. Felix updates the model. Cassian, who had not noticed, is told the news and says "…Huh."' };
          },
        },
      ],
    },

    'summer-break': {
      scripted: { round: 8 },
      title: "Summer Break",
      body: `The paddock empties. August. The Bayes family has a cottage in Pembrokeshire; Cassian disappears for three weeks. The team catches up on sleep.`,
      options: [
        {
          label: 'Let him rest',
          body: 'Physical +25, Mental +15.',
          apply: (s) => {
            s.rider.physical += 25;
            s.rider.mental += 15;
            return { feedback: 'He returns tanned. Lydia doesn\'t ask about the scars. Nobody does. Isla has been telling the whole Pembrokeshire village about the British GP.' };
          },
        },
        {
          label: 'Training camp instead',
          body: 'Physical +10, Mental +5, Handling +3.',
          apply: (s) => {
            s.rider.physical += 10;
            s.rider.mental += 5;
            s.broom.handling += 3;
            return { feedback: 'Felix brings the projected track model. Rowan brings three brooms. Lydia brings aggressive snacks. Cassian flies for five days straight and goes home for the last week.' };
          },
        },
      ],
    },

    // =============== RANDOM POOL =============== //

    'marcus-drinks': {
      weight: 2,
      when: (s) => s.rider.mental < 85,
      title: "Marcus Flint, In Town",
      body: `Marcus Flint is in London for the week and suggests a pub. Nora says no. Lydia says no. Cassian's already got his coat on.`,
      options: [
        {
          label: 'Let him go',
          body: 'Physical −5, Mental +10.',
          apply: (s) => {
            s.rider.physical -= 5;
            s.rider.mental += 10;
            return { feedback: 'They end up at the Leaky Cauldron, then somewhere worse. Cassian gets home at four. He is, on balance, happier.' };
          },
        },
        {
          label: 'Send Lydia to intercept',
          body: 'Mental +2, Morale +3.',
          apply: (s) => {
            s.rider.mental += 2;
            s.morale += 3;
            return { feedback: 'Lydia arrives at the Leaky Cauldron and physically extracts him. Marcus salutes her with a glass. "Next time." Cassian goes to bed at a reasonable hour. For once.' };
          },
        },
      ],
    },

    'hooch-visit': {
      weight: 1,
      title: "Madam Hooch Drops By",
      body: `Madam Hooch visits the garage unannounced. She watches Cassian run through a simulator session, nods once, and then asks after Alistair Whitmore. ("Poor lamb.")`,
      options: [
        {
          label: 'Be polite',
          body: 'Morale +4.',
          apply: (s) => {
            s.morale += 4;
            return { feedback: 'She leaves a tin of biscuits. The Gryffindor veterans on the crew compete viciously to claim them.' };
          },
        },
      ],
    },

    'ministry-audit': {
      weight: 2,
      title: "Ministry Inspection",
      body: `Percy Weasley arrives with a clipboard. "Routine compliance audit. I'll need to see the broom's spell-layer certification from the off-season tests."`,
      options: [
        {
          label: 'Cooperate fully',
          body: 'Reputation +3.',
          apply: (s) => {
            s.reputation += 3;
            if (s.broom.reliability < 60) {
              s.galleons -= 800;
              s.broom.reliability += 5;
              return { feedback: 'Percy files three minor noncompliances. An 800 G fine. Rowan grumbles but fixes them on the spot. The broom is, technically, better for it.' };
            }
            return { feedback: 'Percy finds nothing. He is visibly disappointed. He leaves carrying three forms in triplicate.' };
          },
        },
        {
          label: 'Delay him',
          body: 'Reputation −5.',
          apply: (s) => {
            s.reputation -= 5;
            return { feedback: 'Lydia keeps Percy in the foyer with tea for two hours. He writes a strongly-worded memo. The Prophet picks it up.' };
          },
        },
      ],
    },

    'isla-bragging': {
      weight: 1,
      title: "Your Mother on the Wireless",
      body: `Isla Bayes, guest-commentating for WWN on a Harpies match, spends an entire pre-match segment comparing Gwenog Jones's positioning to "something my son Cassian does, you know the one, the Nimbus boy." The clip is replayed eight times in a day.`,
      options: [
        {
          label: 'Enjoy it',
          body: 'Reputation +4, Morale +2.',
          apply: (s) => {
            s.reputation += 4;
            s.morale += 2;
            return { feedback: 'The team plays the clip on loop. Cassian: "She\'s doing it again." Lydia: "Yes." Cassian: "Why." Lydia: "Because she\'s your mother. Let her."' };
          },
        },
      ],
    },

    'small-press-disaster': {
      weight: 2,
      when: (s) => (s.flags.mediaBuffer || 0) === 0 && (s.flags.pressBuffer || 0) === 0,
      title: "Interview Gone Wrong",
      body: `A Prophet stringer ambushes Cassian at the airport. "Mister Bayes, how do you respond to claims that racing has become less about skill and more about dangerous brinkmanship?" Cassian, jet-lagged: "…Was there a question there?"`,
      options: [
        {
          label: 'Let Lydia handle the aftermath',
          body: 'Reputation −4.',
          apply: (s) => {
            s.reputation -= 4;
            return { feedback: 'Lydia calls the Prophet. Lydia calls the Prophet\'s editor. Lydia calls the Prophet\'s editor\'s editor. The headline still runs: "BAYES DISMISSES SAFETY CONCERNS."' };
          },
        },
        {
          label: 'Issue a formal statement',
          body: '300 G. Reputation −1.',
          apply: (s) => {
            if (s.galleons < 300) return { feedback: "Not enough galleons.", refund: true };
            s.galleons -= 300;
            s.reputation -= 1;
            return { feedback: 'A carefully-worded press release. Lydia writes it; Cassian signs it without reading. The damage is minimised.' };
          },
        },
      ],
    },

    'www-prank-delivery': {
      weight: 1,
      when: (s) => s.flags.wwwDealAccepted === true,
      title: "Fred & George Send More Product",
      body: `A crate arrives, unmarked, in the middle of the night. Inside: "Phase Two" — self-colour-changing bristles, a Quick-Quacks Charm for wand technicians, and a product labelled only "DO NOT OPEN INDOORS."`,
      options: [
        {
          label: 'Test everything',
          body: 'Reputation +3, Morale +3, Reliability −3.',
          apply: (s) => {
            s.reputation += 3;
            s.morale += 3;
            s.broom.reliability -= 3;
            return { feedback: 'The bristles cycle through six colours during a practice run. The wand technicians quack. Rowan locks "DO NOT OPEN INDOORS" in the safe. The crowd loves it.' };
          },
        },
        {
          label: 'Return to sender',
          body: 'Morale −3.',
          apply: (s) => {
            s.morale -= 3;
            return { feedback: 'George accepts the return philosophically. Fred opens "DO NOT OPEN INDOORS" for them, indoors. The shop is closed for three days.' };
          },
        },
      ],
    },

    'felix-graph': {
      weight: 2,
      title: "Felix Has Made a Graph",
      body: `Felix Crane corners you in the briefing room with a three-metre-wide scroll covered in vector fields and time stamps. "Turn seven. If Cassian brakes a fifth of a second later, we gain point-three per lap. I can show you the maths."`,
      options: [
        {
          label: 'Let him explain',
          body: '1 AP. Handling +2.',
          apply: (s) => {
            if (s.ap < 1) return { feedback: "No AP left this week.", refund: true };
            s.ap -= 1;
            s.broom.handling += 2;
            return { feedback: 'Two hours of Felix. Cassian understands perhaps fifteen percent. His next practice lap is, inexplicably, three tenths faster through turn seven.' };
          },
        },
        {
          label: 'Nod politely',
          body: 'No effect.',
          apply: (s) => {
            return { feedback: 'Felix recognises the nod. He goes back to his office. The scroll remains. It will be relevant next week.' };
          },
        },
      ],
    },

    'rita-podium-piece': {
      weight: 1,
      when: (s) => s.reputation >= 60,
      title: "Rita Skeeter Requests an Interview",
      body: `"Cassian Bayes, the Silent Comeback: A Quill-Exclusive with the Boy Who Won't Smile." She's pitching a cover piece. Rumour says she'll be there whether or not you agree.`,
      options: [
        {
          label: 'Decline',
          body: 'Reputation −3.',
          apply: (s) => {
            s.reputation -= 3;
            return { feedback: 'She runs the piece anyway. The quotes are plausible. None are his.' };
          },
        },
        {
          label: 'Agree, supervised',
          body: '1 AP. Reputation +5.',
          apply: (s) => {
            if (s.ap < 1) return { feedback: "No AP left this week.", refund: true };
            s.ap -= 1;
            s.reputation += 5;
            return { feedback: 'Lydia sits in. Cassian answers every question in under five words. The piece is flat, respectful, and profitable. Lydia counts it as a win.' };
          },
        },
      ],
    },

    'charlie-dragon-advice': {
      weight: 1,
      when: (s) => s.round === 7 || s.round === 6,
      title: "A Note from Charlie Weasley",
      body: `"The Horntail's been restless. If your man hears roaring on the east stretch, tell him to climb — the breath goes horizontal. Love to Fred and George. — C.W."`,
      options: [
        {
          label: 'Pass it on',
          body: 'Safety +. (Small DNF-chance reduction at Romanian GP.)',
          apply: (s) => {
            s.flags.dragonAdvice = true;
            return { feedback: 'Petra logs it. Cassian: "…Climb. Got it." He remembers to. Probably.' };
          },
        },
      ],
    },

    'lydia-biscuits': {
      weight: 1,
      title: "Lydia Brings Biscuits",
      body: `Lydia Ashford has decided the team is underfed and turns up at practice with three tins of homemade shortbread. Graham's crew declare it the finest pit incentive on record.`,
      options: [
        {
          label: 'Accept gratefully',
          body: 'Morale +5.',
          apply: (s) => {
            s.morale += 5;
            return { feedback: 'Rowan eats four. Felix takes one and scientifically analyses it. Graham takes the rest. Lydia refuses to disclose the recipe.' };
          },
        },
      ],
    },

  };

  // ------------- TRIGGERING -------------

  function rollEvent(state) {
    // No events in the opening round — let the player breathe.
    if (state.round === 1) return null;

    // First: scripted event for this round?
    for (const [id, ev] of Object.entries(EVENTS)) {
      if (!ev.scripted) continue;
      if (ev.scripted.round !== state.round) continue;
      if (state.flags['event_' + id + '_fired']) continue;
      if (ev.when && !ev.when(state)) continue;
      return { id, event: ev };
    }

    // Otherwise: 55% chance of a random event
    if (Math.random() > 0.55) return null;

    const candidates = [];
    for (const [id, ev] of Object.entries(EVENTS)) {
      if (ev.scripted) continue;
      if (ev.when && !ev.when(state)) continue;
      if (state.flags['event_' + id + '_fired_round_' + state.round]) continue;
      const w = ev.weight || 1;
      for (let i = 0; i < w; i++) candidates.push({ id, event: ev });
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function markFired(state, id, scripted) {
    if (scripted) {
      state.flags['event_' + id + '_fired'] = true;
    } else {
      state.flags['event_' + id + '_fired_round_' + state.round] = true;
    }
  }

  function applyOption(state, event, optionIndex) {
    const opt = event.options[optionIndex];
    if (!opt) return { feedback: 'No such option.' };
    const result = opt.apply(state) || {};
    if (!result.refund) {
      G.clampState(state);
      G.saveGame(state);
    }
    return result;
  }

  // ------------- EXPORT -------------
  window.IFCEvents = {
    EVENTS,
    rollEvent,
    markFired,
    applyOption,
  };

})();
