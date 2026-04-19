/* ============================================
   IFC MANAGER — ENDINGS
   Branching season-end cutscene text. Style
   guide applies: short, quiet, no crescendos.
   ============================================ */

(function() {
  const { TEAMS, RIDERS } = window.IFC;
  const G = window.IFCGame;

  // Each ending: { id, title, subtitle, paragraphs[] (may embed dynamic bits) }
  //   pickEnding(state) — returns the best-fit ending id given final state.
  //   composeEnding(state, id) — returns the resolved text object.

  function pickEnding(state) {
    const standing = G.playerStanding(state);
    const pos = standing.position;
    const pts = standing.points;

    // Breakdown — Cassian's mental hit zero at any point (we track via results)
    const everBrokeDown = state.flags.breakdownFired === true;
    if (everBrokeDown) return 'breakdown';

    // Censure — reputation too low
    if (state.reputation < 20) return 'censure';

    // Cassian Rule — special win where the regulation gets named
    if (state.flags.cassianRuleInvoked && pos === 1) return 'cassian-rule';

    // Standard positional branches
    if (pos === 1) return 'champion';
    if (pos === 2) return 'runner-up';
    if (pos >= 3 && pos <= 5) return 'midfield';
    return 'collapse';
  }

  function composeEnding(state, id) {
    const standing = G.playerStanding(state);
    const rider = RIDERS[TEAMS[state.teamId].riderId];
    const lastName = rider.name.split(' ').slice(-1)[0];

    const wins = (state.results || []).filter(r => r.position === 1).length;
    const podiums = (state.results || []).filter(r => r.position >= 1 && r.position <= 3 && !r.dnf).length;
    const dnfs = (state.results || []).filter(r => r.dnf).length;

    // ===== Champion =====
    if (id === 'champion') {
      return {
        title: 'CHAMPION',
        subtitle: `${rider.name} · International Flight Championship 2003`,
        paragraphs: [
          `At the Finale, ${lastName} crosses the line first. He looks, as he has always looked, like someone who isn't quite sure what the fuss is about.`,
          `Wolfram Steiner takes off his gloves, walks over, and shakes his hand. He does not speak. It is, for Steiner, an enormous gesture.`,
          `Hartwell cries. He denies it.`,
          `Rowan Blackwood sits on a tyre rack in the paddock with a cup of tea and refuses to look up for twenty minutes. Nobody bothers him.`,
          `${wins} wins. ${podiums} podiums. ${dnfs} retirements. The era ends with someone taking the trophy from Steiner's hands.`,
          `Colin Bayes has written an eleven-page analysis of the final race. Isla has phoned four separate Harpies and one entirely unrelated former Chaser. The Prophet's headline: <b>"BAYES TAKES IT."</b> Nothing else. They didn't need anything else.`,
          `Cassian says: "…Thank you." Then he goes to bed.`,
        ],
      };
    }

    // ===== Runner-up =====
    if (id === 'runner-up') {
      return {
        title: 'RUNNER-UP',
        subtitle: `${rider.name} · P2 · ${standing.points} points`,
        paragraphs: [
          `Steiner retains. The gap is closer than it has been in four years, but the gap is still there.`,
          `${lastName} stands on the second step of the podium and looks at the crowd the way he always does — like he's mildly surprised they're still here.`,
          `Hartwell puts a hand on Rowan's shoulder and says "Next year." Rowan doesn't reply. He's already thinking about Layer 4.`,
          `Lydia gives the press three carefully-worded quotes. Nobody can find Cassian for the evening interviews. He is at the Leaky Cauldron with Marcus Flint.`,
          `${wins} wins. ${podiums} podiums. ${dnfs} retirements. Nimbus closes the season with the closest margin the championship has seen since the war.`,
          `On the wireless, Étienne Delacroix says: "It was the year Nimbus announced itself." Lee Jordan adds: "It was the year they learned how to win." They both mean the same thing.`,
        ],
      };
    }

    // ===== Midfield Rise =====
    if (id === 'midfield') {
      return {
        title: 'NIMBUS RISING',
        subtitle: `${rider.name} · P${standing.position} · ${standing.points} points`,
        paragraphs: [
          `The season closes with Nimbus in P${standing.position}. Not the podium they wanted. Not the collapse they feared.`,
          `${wins ? `${wins} win${wins > 1 ? 's' : ''}.` : 'No wins this year.'} ${podiums} podium${podiums === 1 ? '' : 's'}. ${dnfs} retirement${dnfs === 1 ? '' : 's'}.`,
          `Hartwell walks the garage on the final evening. He stops at each station, nods, and moves on. Nobody speaks. Everybody has already started thinking about the next year.`,
          `${lastName}, asked by the Prophet what he learned this season, considers for a long moment and says: "…That the team is good."`,
          `The Prophet runs it as the headline. Lydia considers that a win.`,
        ],
      };
    }

    // ===== Collapse =====
    if (id === 'collapse') {
      return {
        title: 'A LONG WINTER',
        subtitle: `${rider.name} · P${standing.position} · ${standing.points} points`,
        paragraphs: [
          `The season ends quietly. P${standing.position}. ${standing.points} points. Not a disaster on paper; not a success in any other sense.`,
          `${dnfs} retirements. Too many.`,
          `Hartwell calls a meeting in the briefing room. He does not resign. He does not ask anyone else to. He says: "We are going to think about this. Then we are going to do it differently." Then he leaves.`,
          `Rowan does not look up from his workbench for the rest of the week. Petra quietly begins drafting a new spell-layer sequence. Lydia orders more shortbread.`,
          `${lastName} flies home to Pembrokeshire. Isla makes tea. Colin does not bring up the data.`,
          `It will be a long winter.`,
        ],
      };
    }

    // ===== Breakdown =====
    if (id === 'breakdown') {
      return {
        title: 'SEASON WITHDRAWN',
        subtitle: `${rider.name} · withdrawn after Round ${(state.flags.breakdownRound || state.round)}`,
        paragraphs: [
          `Mid-season, Nora Whitby refuses to certify Cassian as fit to race. Lydia backs her. Hartwell backs Lydia.`,
          `The announcement is short. "${rider.name} will not continue the 2003 season on medical advice." The Prophet prints it, respectfully, on page four.`,
          `The garage is quiet for a long time after. Rowan does not say anything for two full days. When he does speak, it is to ask what tea Cassian prefers.`,
          `Cassian goes home. Colin does not produce an analysis. Isla takes leave from WWN. They sit in the kitchen, the three of them, not talking, for a long time.`,
          `He will race again. The paddock holds a seat for him. But not this year.`,
        ],
      };
    }

    // ===== Censure =====
    if (id === 'censure') {
      return {
        title: 'NIMBUS UNDER REVIEW',
        subtitle: `Ministry censure · Reputation ${state.reputation}`,
        paragraphs: [
          `The Ministry's Department of Magical Games and Sports opens a formal review of Nimbus Racing's conduct across the season.`,
          `The filings cite "pattern of risk tolerance inconsistent with IFC safety regulations," "failures of media cooperation," and, in one footnote, "the so-called 'Bayes precedent.'"`,
          `Hartwell attends every hearing in the same grey coat. Percy Weasley presents his findings. Nothing is disproven. Nothing is decisive.`,
          `The team continues. The scrutiny remains. A new season begins under new eyes.`,
          `Cassian, asked about the review: "…It is what it is."`,
        ],
      };
    }

    // ===== Cassian Rule =====
    if (id === 'cassian-rule') {
      return {
        title: "THE 'CASSIAN RULE'",
        subtitle: `${rider.name} · Champion · Regulation §11.4.4`,
        paragraphs: [
          `At the Irish GP, Cassian's Protection Charm failed at lap forty. He did not pit. He won the race.`,
          `By the end of the season, the IFC Regulations Committee had amended Article Eleven, Section Four, Paragraph Four. The rule, informally named after him, requires a mandatory pit within five laps of a confirmed Protection Charm failure.`,
          `He wins the championship regardless. ${wins} wins, ${podiums} podiums, ${dnfs} retirements.`,
          `On the podium, someone asks him what he thinks of the rule change. He considers it, then says: "…That seems fair."`,
          `The regulation bears his name. He does not think about this. Nobody explains it to him.`,
          `The trophy goes in a cabinet. The rule goes in the handbook. Both are, in their way, the season's legacy.`,
        ],
      };
    }

    // Fallback
    return {
      title: 'SEASON COMPLETE',
      subtitle: `${rider.name} · P${standing.position}`,
      paragraphs: [
        `The season ends.`,
        `${wins} wins. ${podiums} podiums. ${dnfs} retirements. ${standing.points} points.`,
      ],
    };
  }

  window.IFCEndings = {
    pickEnding,
    composeEnding,
  };

})();
