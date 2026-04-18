/* ============================================
   IFC MANAGER — GAME UI
   Phase 2: Pre-Race Week actions, AP economy,
   week advance, action feedback.
   ============================================ */

(function() {
  const { TEAMS, RIDERS, TRACKS } = window.IFC;
  const G = window.IFCGame;
  const A = window.IFCActions;

  const FLAG = { GB: '🇬🇧', IE: '🇮🇪', AT: '🇦🇹', SE: '🇸🇪', DE: '🇩🇪', US: '🇺🇸', FR: '🇫🇷' };

  const TRACK_TYPE_LABEL = {
    'high-speed': 'High-speed',
    'technical': 'Technical',
    'over-water': 'Over-water',
    'special': 'Special',
  };

  const TRACK_TYPE_COLOUR = {
    'high-speed': 'var(--tc-hs)',
    'technical': 'var(--tc-tc)',
    'over-water': 'var(--tc-ow)',
    'special': 'var(--tc-sp)',
  };

  // feedback queue for action results
  let _openPanel = null; // which action group panel is open

  // ---------- INIT ----------
  function init() {
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get('team') || G.getLastSession();

    if (!teamId || !TEAMS[teamId]) {
      window.location.href = 'index.html';
      return;
    }

    let state = G.loadGame(teamId);
    if (!state) {
      window.location.href = 'index.html';
      return;
    }

    G.setCurrent(state);
    render();
  }

  // ---------- RENDER ----------
  function render() {
    const state = G.getCurrent();
    if (!state) return;

    const team = TEAMS[state.teamId];
    const track = window.IFC.trackByRound(state.round);
    const standing = G.playerStanding(state);

    const root = document.getElementById('app');
    let html = '';

    // --- HEADER ---
    html += `
      <div class="header">
        <div class="header-top">
          <div>
            <div class="title">IFC MANAGER</div>
            <div class="subtitle">${team.name} · ${FLAG[team.country] || ''}</div>
          </div>
          <div class="header-meta">Round ${state.round} / 12</div>
        </div>
      </div>
    `;

    html += '<main class="fade-in">';

    // --- PHASE-DEPENDENT BODY ---
    try {
      if (state.phase === 'pre-race') {
        html += renderPreRace(state, track, standing);
      } else if (state.phase === 'qualifying') {
        html += renderQualifyingScreen(state, track);
      } else if (state.phase === 'race') {
        html += renderRaceScreen(state, track);
      } else if (state.phase === 'ended') {
        html += renderEndedStub(state);
      } else {
        html += `<div class="card"><div class="text-small">Unknown phase: ${state.phase}</div></div>`;
      }
    } catch (err) {
      console.error('Render error:', err);
      html += `
        <div class="card">
          <div class="sh sh-crimson">Error</div>
          <div class="text-small">Something went wrong rendering this phase.</div>
          <pre style="font-size:10px; color:var(--cr); margin-top:8px; white-space:pre-wrap;">${err.message}</pre>
          <button class="btn btn-inline mt-12" onclick="UI.goToMenu()">Back to Menu</button>
        </div>
      `;
    }

    // --- MENU FOOTER ---
    html += `
      <div class="divider"></div>
      <button class="btn" onclick="UI.goToMenu()">
        <span class="btn-label">Main Menu</span>
        <span class="btn-body">Return to team selection · auto-saved</span>
      </button>
      <div class="footnote">IFC MANAGER · AUTOSAVE ACTIVE</div>
    `;

    html += '</main>';

    root.innerHTML = html;
  }

  // ==========================================
  // PRE-RACE WEEK
  // ==========================================
  function renderPreRace(state, track, standing) {
    let html = '';

    // --- NEXT RACE CARD ---
    html += renderNextRaceCard(state, track);

    // --- STANDINGS SUMMARY ---
    html += renderStandingsSummary(state, standing);

    // --- RESOURCES ---
    html += renderResources(state);

    // --- ACTIONS (Pre-Race Week) ---
    html += renderActionHub(state);

    // --- SECONDARY INFO (collapsible) ---
    html += renderSecondaryInfo(state);

    return html;
  }

  function renderActionHub(state) {
    const ap = state.ap;
    const apDots = '●'.repeat(ap) + '○'.repeat(window.IFC.AP_PER_WEEK - ap);

    let html = `
      <div id="action-hub">
      <div class="sh sh-crimson">Pre-Race Week</div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div class="text-tiny">Action Points</div>
          <div style="font-family:'Segoe UI',sans-serif; font-size:16px; color:var(--g); letter-spacing:2px;">${apDots}</div>
        </div>
        <div class="text-small" style="color:var(--id);">
          Three decisions. Choose what Nimbus needs most this week.
        </div>
      </div>
    `;

    // action group tiles
    html += renderActionGroupTile('rd',     'Broom R&D',        'Refine Speed, Handling, or Reliability');
    html += renderActionGroupTile('train',  'Pit Crew',          'Drill the spell-layer sequence');
    html += renderActionGroupTile('rider',  'Rider Management',  'Rest, therapy, simulator, press work');
    html += renderActionGroupTile('media',  'Media',             'Let Lydia handle the press cycle');
    html += renderActionGroupTile('scout',  'Scout Rivals',      'Intelligence on the next circuit');

    // advance button
    const readyLabel = ap === window.IFC.AP_PER_WEEK
      ? 'Skip the week · go to Qualifying'
      : ap > 0
        ? `End the week with ${ap} AP unused`
        : 'Proceed to Qualifying';
    html += `
      <div class="divider"></div>
      <button class="btn btn-primary" onclick="UI.endWeek()">
        <span class="btn-label">Advance</span>
        <span class="btn-body">${readyLabel}</span>
      </button>
      </div>
    `;

    return html;
  }

  function renderActionGroupTile(groupId, label, desc) {
    const state = G.getCurrent();
    const hasOpen = _openPanel === groupId;
    const actions = Object.entries(A.ACTIONS).filter(([, a]) => a.group === groupId);

    let panel = '';
    if (hasOpen) {
      let items = '';
      actions.forEach(([id, act]) => {
        const afford = A.canAfford(state, act);
        const costStr = [];
        if (act.ap > 0) costStr.push(`${act.ap} AP`);
        if (act.cost > 0) costStr.push(`${act.cost.toLocaleString()} G`);
        if (act.cost === 0 && act.ap === 0) costStr.push('Free');

        items += `
          <button class="btn ${afford ? '' : ''}" ${afford ? '' : 'disabled'}
                  onclick="UI.runAction('${id}')">
            <span class="btn-label">${costStr.join(' · ')}</span>
            <div style="font-weight:bold; margin-bottom:2px;">${act.label}</div>
            <div class="text-small">${act.desc}</div>
          </button>
        `;
      });
      panel = `
        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--pd);">
          ${items}
        </div>
      `;
    }

    return `
      <div class="card card-hover" onclick="UI.togglePanel('${groupId}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="flex:1;">
            <div class="text-tiny text-gold">${label}</div>
            <div class="text-small mt-8" style="color:var(--id);">${desc}</div>
          </div>
          <div style="font-family:'Segoe UI',sans-serif; font-size:14px; color:var(--im); margin-left:12px;">
            ${hasOpen ? '▲' : '▼'}
          </div>
        </div>
        ${panel}
      </div>
    `;
  }

  function renderSecondaryInfo(state) {
    // collapsed; user taps to open
    return `
      <div id="secondary-info">
      <div class="sh">Team Details</div>
      <div class="card card-hover" onclick="UI.toggleDetails()">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="text-small" style="color:var(--id);">
            Rider · Broom · Standings
          </div>
          <div style="font-family:'Segoe UI',sans-serif; font-size:14px; color:var(--im);">
            ${_detailsOpen ? '▲' : '▼'}
          </div>
        </div>
        ${_detailsOpen ? `
          <div style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--pd);">
            ${renderRiderBlock(state)}
            <div style="height:8px;"></div>
            ${renderBroomBlock(state)}
            <div style="height:8px;"></div>
            ${renderFullStandingsBlock(state)}
          </div>
        ` : ''}
      </div>
      </div>
    `;
  }

  let _detailsOpen = false;

  // ==========================================
  // COMPONENTS
  // ==========================================

  function renderNextRaceCard(state, track) {
    const typeCol = TRACK_TYPE_COLOUR[track.type];
    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Next Race</div>
      <div class="card">
        <div class="team-bar" style="background: ${typeCol};"></div>
        <div class="text-tiny" style="color: ${typeCol};">
          ${TRACK_TYPE_LABEL[track.type]} · Round ${track.round}
        </div>
        <div style="font-size:18px; font-weight:bold; margin-top:4px;">
          ${track.name}
        </div>
        <div class="text-small mt-8">
          <i>"${track.nickname}"</i> · ${track.location}
        </div>
        <div class="text-small mt-12">
          ${track.laps} laps × ${track.lapKm} km · Avg ${track.avgSpeed} km/h
        </div>
        <div class="text-small mt-8" style="color: var(--id);">
          ${track.note}
        </div>
      </div>
    `;
  }

  function renderStandingsSummary(state, standing) {
    const pct = standing.position <= 3 ? 'badge-gold'
             : standing.position <= 5 ? 'badge-navy'
             : 'badge-crimson';
    return `
      <div id="standings-summary-block">
      <div class="sh">Season Standing</div>
      <div class="card card-tight">
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px;">
          <div>
            <span class="badge ${pct}">P${standing.position}</span>
            <span style="font-size:17px; font-weight:bold; margin-left:8px;">${standing.points} pts</span>
          </div>
          <div class="text-tiny">Round ${state.round} / 12</div>
        </div>
      </div>
      </div>
    `;
  }

  function renderResources(state) {
    const austerityLabel = state.galleons < 0
      ? ' <span class="badge badge-crimson">AUSTERITY</span>'
      : '';
    return `
      <div id="resources-block">
      <div class="sh">Resources</div>
      <div class="card">
        <div class="res-row">
          <div class="res-label">Galleons${austerityLabel}</div>
          <div class="res-val ${state.galleons < 0 ? 'text-crimson' : 'text-gold'}">
            ${state.galleons.toLocaleString()}
          </div>
        </div>
        <div class="res-row">
          <div class="res-label">Action Points</div>
          <div class="res-val">${state.ap} / ${window.IFC.AP_PER_WEEK}</div>
        </div>
        ${resourceBar('Team Morale', state.morale)}
        ${resourceBar('Reputation', state.reputation)}
      </div>
      </div>
    `;
  }

  function renderRiderBlock(state) {
    const rider = RIDERS[TEAMS[state.teamId].riderId];
    return `
      <div class="text-tiny text-gold" style="margin-bottom:8px;">Rider · ${rider.name}</div>
      ${resourceBar('Physical', state.rider.physical)}
      ${resourceBar('Mental', state.rider.mental, state.rider.mental < 35 ? 'crimson' : null)}
    `;
  }

  function renderBroomBlock(state) {
    return `
      <div class="text-tiny text-gold" style="margin-bottom:8px;">Broom · Spell Architecture</div>
      ${resourceBar('Speed', state.broom.speed)}
      ${resourceBar('Handling', state.broom.handling)}
      ${resourceBar('Reliability', state.broom.reliability)}
      ${resourceBar('Layer Mastery', state.spellLayerMastery)}
      <div class="text-tiny mt-12">
        Mean pit stop: ${state.pitBase.toFixed(1)} sec
      </div>
    `;
  }

  function renderFullStandingsBlock(state) {
    const sorted = G.sortedStandings(state);
    let rows = '';
    sorted.forEach((s, i) => {
      const rider = RIDERS[s.riderId];
      const team = TEAMS[rider.teamId];
      const isPlayer = rider.teamId === state.teamId;
      rows += `
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0;
                    ${i < sorted.length - 1 ? 'border-bottom:1px dashed var(--pd);' : ''}
                    ${isPlayer ? 'font-weight:bold;' : ''}">
          <div style="width:20px; text-align:right; font-family:'Segoe UI',sans-serif; font-size:12px; color:var(--im);">
            ${i + 1}
          </div>
          <div style="width:3px; height:22px; background: ${team.colourA}; border-radius:2px;"></div>
          <div style="flex:1; font-size:13px;">
            ${rider.name}
            ${isPlayer ? '<span class="badge badge-gold" style="margin-left:6px;">YOU</span>' : ''}
          </div>
          <div style="font-family:'Segoe UI',sans-serif; font-size:13px; font-weight:600;">
            ${s.points}
          </div>
        </div>
      `;
    });
    return `
      <div class="text-tiny text-gold" style="margin-bottom:8px;">Championship Standings</div>
      ${rows}
    `;
  }

  function resourceBar(label, value, variant) {
    const barClass = variant === 'crimson' ? 'bar-f bar-f-crimson'
                  : variant === 'navy' ? 'bar-f bar-f-navy'
                  : 'bar-f';
    return `
      <div class="res-row">
        <div class="res-label">${label}</div>
        <div class="res-bar">
          <div class="bar"><div class="${barClass}" style="width:${Math.max(0, Math.min(100, value))}%;"></div></div>
        </div>
        <div class="res-val">${Math.round(value)}</div>
      </div>
    `;
  }

  // ==========================================
  // QUALIFYING
  // ==========================================
  let _qualiResult = null;

  function renderQualifyingScreen(state, track) {
    if (!_qualiResult) {
      _qualiResult = window.IFCRace.simulateQualifying(state);
      const playerEntry = _qualiResult.find(e => e.isPlayer);
      state.gridPosition = playerEntry ? playerEntry.grid : 4;
      G.saveGame(state);
    }
    const result = _qualiResult;
    const playerEntry = result.find(e => e.isPlayer);
    if (!playerEntry) {
      return `<div class="card"><div class="text-small">Qualifying failed to resolve.</div></div>`;
    }

    let rows = '';
    result.forEach((e, i) => {
      const rider = RIDERS[e.riderId];
      const team = TEAMS[e.teamId];
      const isPlayer = e.isPlayer;
      rows += `
        <div style="display:flex; align-items:center; gap:10px; padding:7px 0;
                    ${i < result.length - 1 ? 'border-bottom:1px dashed var(--pd);' : ''}
                    ${isPlayer ? 'font-weight:bold;' : ''}">
          <div style="width:22px; text-align:right; font-family:'Segoe UI',sans-serif; font-size:12px; color:var(--im);">
            ${e.grid}
          </div>
          <div style="width:3px; height:22px; background: ${team.colourA}; border-radius:2px;"></div>
          <div style="flex:1; font-size:13px;">
            ${rider.name}
            ${isPlayer ? '<span class="badge badge-gold" style="margin-left:6px;">YOU</span>' : ''}
          </div>
          <div class="text-tiny" style="opacity:0.5;">${team.nickname}</div>
        </div>
      `;
    });

    let commentLine = '';
    if (playerEntry.grid === 1) {
      commentLine = `<i>Jordan: "Pole for Bayes! Has he even woken up?"</i>`;
    } else if (playerEntry.grid <= 3) {
      commentLine = `<i>Delacroix: "Front two rows. That's a race seat."</i>`;
    } else if (playerEntry.grid <= 5) {
      commentLine = `<i>Delacroix: "Midfield. Not ideal. Not catastrophic."</i>`;
    } else {
      commentLine = `<i>Jordan: "Back row. Right, Cassian. Overtakes, please."</i>`;
    }

    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Qualifying Result</div>
      <div class="card">
        <div class="text-tiny text-gold">${track.name} · ${track.nickname}</div>
        <div class="text-small mt-12">${commentLine}</div>
        <div class="divider"></div>
        ${rows}
      </div>

      <div class="divider"></div>
      <button class="btn btn-primary" onclick="UI.startRace()">
        <span class="btn-label">Race Day</span>
        <span class="btn-body">Line up on the grid · P${playerEntry.grid}</span>
      </button>
    `;
  }

  // ==========================================
  // RACE DAY — LIVE
  // ==========================================
  let _raceState = null;
  let _raceTimer = null;
  let _raceMode = 'idle'; // idle | running | paused | intervention | finished
  let _pendingIntervention = null;

  function renderRaceScreen(state, track) {
    if (!_raceState && _raceMode === 'idle') {
      return renderRaceIntro(state, track);
    }
    return renderRaceLive(state, track);
  }

  function renderRaceIntro(state, track) {
    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Race Day</div>
      <div class="card">
        <div class="text-tiny text-gold">${track.name}</div>
        <div style="font-size:17px; font-weight:bold; margin-top:4px;">Starting grid: P${state.gridPosition || 4}</div>
        <div class="text-small mt-12" style="color:var(--id);">
          ${track.laps} laps. Lee Jordan and Étienne Delacroix on commentary.
          Petra will be on the team radio.
        </div>
        <div class="divider"></div>
        <div class="text-small" style="color:var(--id);">
          <i>During the race, you will receive a handful of team-radio calls
          asking for a decision. Respond quickly — the window is brief.</i>
        </div>
      </div>
      <button class="btn btn-primary" onclick="UI.beginRace()">
        <span class="btn-label">Lights Out</span>
        <span class="btn-body">Start the race</span>
      </button>
    `;
  }

  function renderRaceLive(state, track) {
    const rs = _raceState;
    if (!rs) return '';

    return `
      <div id="race-live">
        ${renderRaceHeader(rs)}
        ${renderRaceLayers(rs)}
        <div class="sh">Running Order</div>
        <div class="card card-tight" id="race-order">${renderRunningOrderRows(rs)}</div>
        <div class="sh">Commentary</div>
        <div class="card card-tight" style="max-height:320px; overflow-y:auto;" id="commentary-log">
          ${renderCommentaryRows(rs)}
        </div>
        <div id="race-finish-btn">${renderRaceFinishBtn()}</div>
      </div>
    `;
  }

  function renderRaceHeader(rs) {
    const player = rs.runners.find(r => r.isPlayer);
    const playerPos = player ? (player.dnf ? 'DNF' : `P${player.position}`) : '—';
    const progressPct = (rs.lap / rs.maxLap) * 100;
    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Live · ${rs.track.name}</div>
      <div class="card card-tight" id="race-header">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="text-tiny">Lap</div>
            <div style="font-size:18px; font-weight:bold;" id="race-lap">${rs.lap} / ${rs.maxLap}</div>
          </div>
          <div style="text-align:right;">
            <div class="text-tiny">Bayes</div>
            <div style="font-size:18px; font-weight:bold;" id="race-player-pos">${playerPos}</div>
          </div>
        </div>
        <div class="bar mt-12"><div class="bar-f" id="race-progress" style="width:${progressPct}%;"></div></div>
      </div>
    `;
  }

  function renderRaceLayers(rs) {
    const player = rs.runners.find(r => r.isPlayer);
    if (!player || player.dnf) return '<div id="race-layers"></div>';
    return `
      <div id="race-layers">
        <div class="card card-tight">
          <div class="text-tiny text-gold">Your Broom · Charm Layers</div>
          ${miniBar('Protection', player.layers.protection, player.layers.protection < 20 ? 'crimson' : null)}
          ${miniBar('Acceleration', player.layers.acceleration, player.layers.acceleration < 25 ? 'crimson' : null)}
          ${miniBar('Manoeuvrability', player.layers.manoeuvrability)}
          ${miniBar('Stability', player.layers.stability)}
        </div>
      </div>
    `;
  }

  function renderRunningOrderRows(rs) {
    const ordered = [...rs.runners].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      return a.position - b.position;
    });
    let rows = '';
    ordered.forEach((r, i) => {
      const rider = RIDERS[r.riderId];
      const team = TEAMS[r.teamId];
      const isPlayer = r.isPlayer;
      const gridShift = r.grid - (i + 1);
      const shiftBadge = r.dnf ? '<span class="text-crimson">DNF</span>'
                       : gridShift > 0 ? `<span style="color:#2d7a5f;">▲${gridShift}</span>`
                       : gridShift < 0 ? `<span style="color:var(--cr);">▼${-gridShift}</span>`
                       : `<span style="color:var(--im);">—</span>`;
      rows += `
        <div style="display:flex; align-items:center; gap:8px; padding:5px 0;
                    ${i < ordered.length - 1 ? 'border-bottom:1px dashed var(--pd);' : ''}
                    ${isPlayer ? 'font-weight:bold; background:rgba(200,168,50,0.07);' : ''}
                    ${r.dnf ? 'opacity:0.45;' : ''}">
          <div style="width:20px; text-align:right; font-family:'Segoe UI',sans-serif; font-size:12px; color:var(--im);">
            ${r.dnf ? '—' : r.position}
          </div>
          <div style="width:3px; height:18px; background: ${team.colourA}; border-radius:2px;"></div>
          <div style="flex:1; font-size:12.5px;">
            ${rider.name}
          </div>
          <div style="font-family:'Segoe UI',sans-serif; font-size:11px; width:34px; text-align:right;">
            ${shiftBadge}
          </div>
        </div>
      `;
    });
    return rows;
  }

  function renderCommentaryRows(rs) {
    const log = rs.commentary.slice(-12);
    if (log.length === 0) {
      return `<div class="text-small" style="color:var(--im);"><i>Awaiting lights out...</i></div>`;
    }
    let html = '';
    log.forEach(c => {
      const who = c.who === 'lee' ? 'Jordan'
                : c.who === 'etienne' ? 'Delacroix'
                : c.who === 'radio' ? 'Team Radio'
                : '—';
      const colour = c.who === 'lee' ? 'var(--cr)'
                  : c.who === 'etienne' ? 'var(--nv)'
                  : 'var(--g)';
      html += `
        <div style="padding:8px 0; border-bottom:1px dashed var(--pd);">
          <div class="text-tiny" style="color:${colour};">L${c.lap} · ${who}</div>
          <div class="text-small mt-8">${c.text}</div>
        </div>
      `;
    });
    return html;
  }

  function renderRaceFinishBtn() {
    if (_raceMode !== 'finished') return '';
    return `
      <div class="divider"></div>
      <button class="btn btn-primary" onclick="UI.finishRace()">
        <span class="btn-label">Chequered Flag</span>
        <span class="btn-body">See the race result</span>
      </button>
    `;
  }

  function miniBar(label, value, variant) {
    const barClass = variant === 'crimson' ? 'bar-f bar-f-crimson' : 'bar-f';
    const pct = Math.max(0, Math.min(100, value));
    return `
      <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
        <div class="text-tiny" style="width:110px;">${label}</div>
        <div style="flex:1;">
          <div class="bar"><div class="${barClass}" style="width:${pct}%;"></div></div>
        </div>
        <div style="font-family:'Segoe UI',sans-serif; font-size:11px; width:32px; text-align:right;">${Math.round(pct)}</div>
      </div>
    `;
  }

  // ---------- Race actions ----------

  function startRace() {
    // from qualifying screen → race intro
    const state = G.getCurrent();
    state.phase = 'race';
    _qualiResult = null;
    G.saveGame(state);
    render();
  }

  function beginRace() {
    const state = G.getCurrent();
    // build grid from stored qualifying
    const grid = window.IFCRace.simulateQualifying(state);
    _raceState = window.IFCRace.initRaceState(state, grid);
    _raceMode = 'running';
    scheduleNextTick();
    render();
  }

  function scheduleNextTick() {
    clearTimeout(_raceTimer);
    _raceTimer = setTimeout(() => {
      tick();
    }, 1400);
  }

  function tick() {
    if (_raceMode !== 'running') return;
    const state = G.getCurrent();

    window.IFCRace.tickRace(_raceState, state);

    // check intervention
    const intervention = window.IFCRace.maybeIntervention(_raceState, state);
    if (intervention) {
      _pendingIntervention = intervention;
      _raceMode = 'intervention';
      // partial update + modal — no full repaint
      updateRaceLiveSections();
      showInterventionModal(intervention);
      return;
    }

    // check finish
    if (_raceState.lap >= _raceState.maxLap) {
      _raceMode = 'finished';
      updateRaceLiveSections();
      return;
    }

    // partial update only — no flicker
    updateRaceLiveSections();
    scheduleNextTick();
  }

  // Update only the dynamic sections of the race live view.
  // Avoids tearing down the whole page each lap.
  function updateRaceLiveSections() {
    const rs = _raceState;
    if (!rs) return;

    // header: lap counter + player pos + progress bar
    const player = rs.runners.find(r => r.isPlayer);
    const playerPos = player ? (player.dnf ? 'DNF' : `P${player.position}`) : '—';

    const lapEl = document.getElementById('race-lap');
    if (lapEl) lapEl.textContent = `${rs.lap} / ${rs.maxLap}`;

    const posEl = document.getElementById('race-player-pos');
    if (posEl) posEl.textContent = playerPos;

    const progEl = document.getElementById('race-progress');
    if (progEl) progEl.style.width = `${(rs.lap / rs.maxLap) * 100}%`;

    // layers block (inner HTML only, not the container)
    const layersEl = document.getElementById('race-layers');
    if (layersEl) {
      if (player && !player.dnf) {
        layersEl.innerHTML = `
          <div class="card card-tight">
            <div class="text-tiny text-gold">Your Broom · Charm Layers</div>
            ${miniBar('Protection', player.layers.protection, player.layers.protection < 20 ? 'crimson' : null)}
            ${miniBar('Acceleration', player.layers.acceleration, player.layers.acceleration < 25 ? 'crimson' : null)}
            ${miniBar('Manoeuvrability', player.layers.manoeuvrability)}
            ${miniBar('Stability', player.layers.stability)}
          </div>
        `;
      } else {
        layersEl.innerHTML = '';
      }
    }

    // running order
    const orderEl = document.getElementById('race-order');
    if (orderEl) orderEl.innerHTML = renderRunningOrderRows(rs);

    // commentary (append last line only if it's new, instead of replacing all)
    const logEl = document.getElementById('commentary-log');
    if (logEl) {
      const currentCount = logEl.querySelectorAll('[data-c-idx]').length;
      const total = rs.commentary.length;
      if (total > currentCount) {
        // build and append just the new rows
        for (let i = currentCount; i < total; i++) {
          const c = rs.commentary[i];
          const row = document.createElement('div');
          row.setAttribute('data-c-idx', i);
          row.style.cssText = 'padding:8px 0; border-bottom:1px dashed var(--pd);';
          const who = c.who === 'lee' ? 'Jordan'
                    : c.who === 'etienne' ? 'Delacroix'
                    : c.who === 'radio' ? 'Team Radio'
                    : '—';
          const colour = c.who === 'lee' ? 'var(--cr)'
                      : c.who === 'etienne' ? 'var(--nv)'
                      : 'var(--g)';
          row.innerHTML = `
            <div class="text-tiny" style="color:${colour};">L${c.lap} · ${who}</div>
            <div class="text-small mt-8">${c.text}</div>
          `;
          // remove the "Awaiting lights out..." placeholder on first append
          if (currentCount === 0 && i === 0) {
            logEl.innerHTML = '';
          }
          logEl.appendChild(row);
        }
        // auto-scroll to bottom
        logEl.scrollTop = logEl.scrollHeight;
      }
    }

    // finish button (show when finished)
    const finishEl = document.getElementById('race-finish-btn');
    if (finishEl) finishEl.innerHTML = renderRaceFinishBtn();
  }

  function showInterventionModal(intervention) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'intervention-modal';

    let optBtns = '';
    intervention.options.forEach(opt => {
      optBtns += `
        <button class="btn" onclick="UI.resolveIntervention('${opt.effect}')">
          <span class="btn-label">${opt.label}</span>
          <span class="btn-body">${opt.body}</span>
        </button>
      `;
    });

    modal.innerHTML = `
      <div class="modal">
        <div class="text-tiny" style="color:var(--cr);"><span class="dot-live"></span>Team Radio · Lap ${_raceState.lap}</div>
        <h3 style="margin-top:8px;">Decision</h3>
        <p class="text-small mb-16" style="font-style:italic;">${intervention.setup}</p>
        ${optBtns}
      </div>
    `;
    document.body.appendChild(modal);
  }

  function resolveIntervention(effect) {
    const state = G.getCurrent();
    const modal = document.getElementById('intervention-modal');
    if (modal) modal.remove();

    const result = window.IFCRace.applyInterventionEffect(_raceState, state, effect);
    if (result.commentary) {
      _raceState.commentary.push({
        lap: _raceState.lap,
        who: result.commentary.who,
        text: result.commentary.text,
      });
    }
    if (result.feedback) pushFeedback(result.feedback);

    _pendingIntervention = null;

    // continue race
    if (_raceState.lap >= _raceState.maxLap) {
      _raceMode = 'finished';
      updateRaceLiveSections();
    } else {
      _raceMode = 'running';
      updateRaceLiveSections();
      scheduleNextTick();
    }
  }

  function finishRace() {
    const state = G.getCurrent();
    const resolution = window.IFCRace.finalizeRace(_raceState, state);

    // advance round
    state.round += 1;
    if (state.round > 12) {
      state.phase = 'ended';
    } else {
      state.phase = 'pre-race';
      state.ap = window.IFC.AP_PER_WEEK;
      // per-week flags reset
      state.flags.simBonusActive = false;
      state.flags.scoutActive = false;
      state.flags.mediaBuffer = 0;
      state.flags.pressBuffer = 0;
      state.flags.flewWithBrokenProtection = false;
    }

    G.clampState(state);
    G.saveGame(state);

    _raceState = null;
    _raceMode = 'idle';
    _qualiResult = null;

    const finishLine = resolution.dnf
      ? `DNF — ${resolution.dnfReason}`
      : `Finished P${resolution.playerPos}.`;
    pushFeedback(finishLine);

    render();
  }

  function skipQualifying() {
    // legacy stub button (unused now — but keep the function for safety)
    const state = G.getCurrent();
    state.phase = 'race';
    G.saveGame(state);
    render();
  }

  function skipRace() {
    // legacy stub — no longer reachable
    render();
  }

  function renderEndedStub(state) {
    const standing = G.playerStanding(state);
    return `
      <div class="sh">Season Concluded</div>
      <div class="card">
        <div class="text-tiny text-gold">Final Standing</div>
        <div style="font-size:22px; font-weight:bold; margin-top:6px;">
          P${standing.position} · ${standing.points} pts
        </div>
        <p class="text-small mt-16" style="color:var(--id);">
          <i>Ending sequences arrive in a later phase.</i>
        </p>
      </div>
    `;
  }

  // ==========================================
  // FEEDBACK TOAST
  // ==========================================
  function ensureFeedbackRail() {
    let rail = document.getElementById('feedback-rail');
    if (rail) return rail;
    rail = document.createElement('div');
    rail.id = 'feedback-rail';
    rail.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      max-width: 600px; width: calc(100% - 32px);
      z-index: 80;
      pointer-events: none;
      display: flex; flex-direction: column-reverse; gap: 6px;
    `;
    document.body.appendChild(rail);
    return rail;
  }

  function pushFeedback(text) {
    const rail = ensureFeedbackRail();
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: var(--nv);
      color: var(--pl);
      border-left: 3px solid var(--g);
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.4;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      font-family: Georgia, serif;
    `;
    toast.innerHTML = text;
    rail.appendChild(toast);

    // cap at 3 visible toasts — remove oldest
    while (rail.children.length > 3) {
      rail.removeChild(rail.firstChild);
    }

    // fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // fade out + remove after 5s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-4px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 5000);
  }

  // Legacy no-op (kept so render() can call it safely)
  function renderFeedback() {}

  // ==========================================
  // ACTIONS (bound to buttons)
  // ==========================================

  function togglePanel(groupId) {
    _openPanel = (_openPanel === groupId) ? null : groupId;
    rerenderActionHub();
  }

  function toggleDetails() {
    _detailsOpen = !_detailsOpen;
    rerenderSecondaryInfo();
  }

  // Partial re-render helpers — avoid full-page repaint for simple toggles.
  function rerenderActionHub() {
    const state = G.getCurrent();
    const anchor = document.getElementById('action-hub');
    if (!anchor) { render(); return; }
    anchor.outerHTML = renderActionHub(state);
  }

  function rerenderSecondaryInfo() {
    const state = G.getCurrent();
    const anchor = document.getElementById('secondary-info');
    if (!anchor) { render(); return; }
    anchor.outerHTML = renderSecondaryInfo(state);
  }

  function rerenderResources() {
    const state = G.getCurrent();
    const anchor = document.getElementById('resources-block');
    if (!anchor) return;
    anchor.outerHTML = renderResources(state);
  }

  function rerenderStandingsSummary() {
    const state = G.getCurrent();
    const anchor = document.getElementById('standings-summary-block');
    if (!anchor) return;
    const standing = G.playerStanding(state);
    anchor.outerHTML = renderStandingsSummary(state, standing);
  }

  function runAction(actionId) {
    const state = G.getCurrent();
    const result = A.runAction(state, actionId);
    if (result.ok) {
      pushFeedback(result.feedback);
      // if AP is zero, auto-close panel
      if (state.ap === 0) _openPanel = null;
    } else {
      pushFeedback('<i>' + result.feedback + '</i>');
    }
    // partial re-renders — no full repaint
    rerenderActionHub();
    rerenderResources();
    // if rider/broom/standings panel is open, update it too
    if (_detailsOpen) rerenderSecondaryInfo();
  }

  function endWeek() {
    const state = G.getCurrent();
    A.endWeek(state);
    _openPanel = null;
    // reset any lingering race/quali cache from a prior round
    _qualiResult = null;
    _raceState = null;
    _raceMode = 'idle';
    pushFeedback('The week closes. Operating costs settled. On to Qualifying.');
    render();
  }

  function skipQualifying() {
    // Phase 3 placeholder — pick a realistic placeholder grid position
    const state = G.getCurrent();
    // rough estimate: use rider pace + qualifying skill + broom speed
    const rider = RIDERS[TEAMS[state.teamId].riderId];
    const score = rider.skill.pace * 0.4 + rider.skill.qualifying * 0.3 + state.broom.speed * 0.3;
    // place roughly by score
    state.gridPosition = score > 85 ? 2 : score > 75 ? 3 : score > 65 ? 4 : 5;
    state.phase = 'race';
    G.saveGame(state);
    pushFeedback(`Provisional grid set. You start P${state.gridPosition}.`);
    render();
  }

  function skipRace() {
    // Phase 3 placeholder — resolve race with rough weighted result
    const state = G.getCurrent();
    const rider = RIDERS[TEAMS[state.teamId].riderId];
    const score = rider.skill.pace * 0.35
                + rider.skill.overtaking * 0.2
                + state.broom.speed * 0.2
                + state.broom.handling * 0.15
                + state.rider.physical * 0.05
                + state.rider.mental * 0.05;
    // map to position
    let pos;
    if (score > 88) pos = 1;
    else if (score > 82) pos = 2;
    else if (score > 76) pos = 3;
    else if (score > 70) pos = 4;
    else if (score > 64) pos = 5;
    else if (score > 58) pos = 6;
    else pos = 7;

    // Give other riders random positions for the placeholder standings
    applyPlaceholderRaceResult(state, pos);

    // advance round
    state.round += 1;
    if (state.round > 12) {
      state.phase = 'ended';
    } else {
      state.phase = 'pre-race';
      state.ap = window.IFC.AP_PER_WEEK;
      // reset per-week flags
      state.flags.simBonusActive = false;
      state.flags.scoutActive = false;
    }

    G.clampState(state);
    G.saveGame(state);
    pushFeedback(`Race resolved. Cassian finishes P${pos}.`);
    render();
  }

  function applyPlaceholderRaceResult(state, playerPos) {
    // Legacy helper; no longer used once the race engine is wired up.
    // Kept as a no-op to avoid breaking any latent references.
  }

  function goToMenu() {
    G.autosave();
    window.location.href = 'index.html';
  }

  // ---------- EXPORT ----------
  window.UI = {
    render, goToMenu,
    togglePanel, toggleDetails,
    runAction, endWeek,
    // race flow
    startRace, beginRace, resolveIntervention, finishRace,
    // legacy / unused but kept
    skipQualifying, skipRace,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
