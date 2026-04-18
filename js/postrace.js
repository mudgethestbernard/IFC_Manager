/* ============================================
   IFC MANAGER — POST-RACE
   Daily Prophet coverage, podium interviews,
   race summary screen.
   ============================================ */

(function() {
  const { TEAMS, RIDERS } = window.IFC;

  // ---------- HEADLINE GENERATION ----------
  function generateHeadline(finishOrder, track, player) {
    const winner = finishOrder.find(r => r.position === 1 && !r.dnf);
    if (!winner) return `CHAOS AT ${track.name.toUpperCase()}`;

    const winnerName = RIDERS[winner.riderId].name;
    const winnerLast = winnerName.split(' ').slice(-1)[0];

    if (winner.isPlayer) {
      if (player && player.pitsTaken === 0) {
        return `BAYES WINS ${track.name.toUpperCase()} — NO PITS, NO MERCY`;
      }
      return `${winnerLast.toUpperCase()} TAKES ${track.nickname.toUpperCase()}`;
    }

    if (winner.riderId === 'wolfram') {
      return `STEINER, AGAIN`;
    }
    if (winner.riderId === 'aurelien') {
      return `DUBOIS SCREAMS HIS WAY TO VICTORY AT ${track.nickname.toUpperCase()}`;
    }
    if (winner.riderId === 'marcus') {
      return `FLINT FASTEST AT ${track.nickname.toUpperCase()} — SAFETY DIVISION UNAMUSED`;
    }
    if (winner.riderId === 'matthias') {
      return `GERBER WINS. QUIETLY.`;
    }
    if (winner.riderId === 'alistair') {
      return `WHITMORE VICTORIOUS — PIT CREW STILL IN THE GARAGE`;
    }
    return `${winnerLast.toUpperCase()} TAKES THE WIN`;
  }

  // ---------- SUBHEAD ----------
  function generateSubhead(finishOrder, track, player) {
    const bits = [];
    const podium = finishOrder.filter(r => !r.dnf).slice(0, 3);
    if (podium.length === 3) {
      bits.push(podium.map(r => RIDERS[r.riderId].name.split(' ').slice(-1)[0]).join(' · '));
    }
    const dnfs = finishOrder.filter(r => r.dnf);
    if (dnfs.length === 1) bits.push(`1 DNF`);
    if (dnfs.length >= 2) bits.push(`${dnfs.length} DNFs`);
    return bits.join(' — ');
  }

  // ---------- BODY COPY ----------
  function generateBodyCopy(finishOrder, track, player, playerState, raceState) {
    const paras = [];
    const winner = finishOrder.find(r => r.position === 1 && !r.dnf);
    const second = finishOrder.find(r => r.position === 2 && !r.dnf);
    const third = finishOrder.find(r => r.position === 3 && !r.dnf);
    const dnfs = finishOrder.filter(r => r.dnf);

    if (winner) {
      const wName = RIDERS[winner.riderId].name;
      let p = `${wName} took the flag at ${track.name}, ahead of ${second ? RIDERS[second.riderId].name : '—'}`;
      if (third) p += ` and ${RIDERS[third.riderId].name}`;
      p += '.';
      paras.push(p);
    }

    // Race-pattern observation
    const playerFin = finishOrder.find(r => r.isPlayer);
    if (playerFin) {
      if (playerFin.dnf) {
        paras.push(`Bayes failed to finish. Reason given: ${playerFin.dnfReason || 'undisclosed'}.`);
      } else if (playerFin.position === 1) {
        paras.push(`Bayes, starting from P${playerFin.grid}, led the field home. He appeared, as ever, unbothered.`);
      } else if (playerFin.position <= 3) {
        paras.push(`Bayes converted P${playerFin.grid} into a P${playerFin.position} finish. A strong result for Nimbus.`);
      } else if (playerFin.position <= playerFin.grid) {
        paras.push(`Bayes ran the race out from P${playerFin.grid} to P${playerFin.position}.`);
      } else {
        paras.push(`Bayes dropped from P${playerFin.grid} at lights-out to P${playerFin.position} at the flag.`);
      }
    }

    // DNF colour
    if (dnfs.length > 0) {
      const namesAndReasons = dnfs.map(r => {
        const n = RIDERS[r.riderId].name.split(' ').slice(-1)[0];
        return `${n} (${r.dnfReason || 'unspecified'})`;
      }).join(', ');
      paras.push(`Retirements: ${namesAndReasons}.`);
    }

    // Track flavour
    if (track.id === 'alpine') {
      paras.push(`The Peak claimed its victims as ever. Medical retirements were processed without fanfare.`);
    } else if (track.id === 'irish') {
      paras.push(`The cliffs were in a mood. Gusts above sixty were reported in the second sector.`);
    } else if (track.id === 'egyptian') {
      paras.push(`A sandstorm broke across the pyramids in the middle stint. Visibility was, briefly, zero.`);
    }

    return paras;
  }

  // ---------- PODIUM INTERVIEWS ----------
  function generateInterview(riderId, position, track, isPlayerPodium) {
    const rider = RIDERS[riderId];
    const lastName = rider.name.split(' ').slice(-1)[0];

    const lines = [];

    if (riderId === 'cassian') {
      if (position === 1) {
        lines.push({ q: 'Cassian, a dominant win — how are you feeling?', a: '"…Fine."' });
        lines.push({ q: 'Fine?', a: '"Yes."' });
        lines.push({ q: 'Was the pass on lap twenty-eight as dangerous as it looked?', a: '"There was space."' });
        lines.push({ q: 'Any word for the team?', a: '"…They did well."' });
      } else if (position === 2) {
        lines.push({ q: 'Second — frustrating?', a: '"It was a podium."' });
        lines.push({ q: 'You were catching the leader on the final lap.', a: '"Ran out of track."' });
      } else if (position === 3) {
        lines.push({ q: 'Third place. What happened?', a: '"…The layers went."' });
        lines.push({ q: 'Any frustration with the pit timing?', a: '"No. It was fine."' });
      }
    }

    else if (riderId === 'wolfram') {
      if (position === 1) {
        lines.push({ q: 'Wolfram, another win.', a: '"As expected."' });
        lines.push({ q: 'Bayes was close at the end.', a: '"He was not close enough."' });
      } else {
        lines.push({ q: 'A rare off-day, Wolfram.', a: '"It was a race. I was on the podium. I do not dwell."' });
      }
    }

    else if (riderId === 'aurelien') {
      if (position === 1) {
        lines.push({ q: 'Aurélien! A victory!', a: '"MON DIEU. YES. YES!"' });
        lines.push({ q: 'Can you describe the final lap?', a: '"I do not remember. I was flying. I WAS FLYING."' });
      } else {
        lines.push({ q: 'Aurélien, P' + position + '.', a: '"The iron arrived late. AGAIN. I am not speaking about this. Next question."' });
      }
    }

    else if (riderId === 'marcus') {
      if (position === 1) {
        lines.push({ q: 'Marcus, first win of the season.', a: '"Bayes wasn\'t trying."' });
        lines.push({ q: 'He finished fifteen seconds behind you.', a: '"Yeah. Wasn\'t trying."' });
      } else {
        lines.push({ q: 'A hard-fought podium, Marcus.', a: '"Flint does not do easy podiums. That\'s Steiner\'s thing."' });
      }
    }

    else if (riderId === 'matthias') {
      lines.push({ q: 'Matthias, a good result.', a: '"Präzision und Disziplin. Thank you."' });
      lines.push({ q: 'And your engineer Laurent?', a: '"He knows."' });
    }

    else if (riderId === 'alistair') {
      if (position === 1) {
        lines.push({ q: 'Alistair! An incredible win!', a: '"I… yes. I did win. Didn\'t I."' });
        lines.push({ q: 'Congratulations.', a: '"Thank you. I must go and check that the pit crew are still here."' });
      } else {
        lines.push({ q: 'A podium, Alistair.', a: '"Yes. A good day. For once."' });
      }
    }

    else if (riderId === 'ryder') {
      lines.push({ q: 'Ryder, on the podium.', a: '"Disruption, baby. This is just the beginning. Next round? Next round we innovate."' });
    }

    return { rider, position, lines };
  }

  // ---------- EXPORT ----------
  window.IFCPostRace = {
    generateHeadline,
    generateSubhead,
    generateBodyCopy,
    generateInterview,
  };

})();
