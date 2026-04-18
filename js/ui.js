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
    if (state.phase === 'pre-race') {
      html += renderPreRace(state, track, standing);
    } else if (state.phase === 'qualifying') {
      html += renderQualifyingStub(state, track);
    } else if (state.phase === 'race') {
      html += renderRaceStub(state, track);
    } else if (state.phase === 'ended') {
      html += renderEndedStub(state);
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
  // STUBS (filled in later phases)
  // ==========================================
  function renderQualifyingStub(state, track) {
    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Qualifying</div>
      <div class="card">
        <div class="text-tiny text-gold">${track.name}</div>
        <p class="text-small mt-12" style="color:var(--id);">
          <i>The Qualifying system is under construction.
          In the full game, this runs a single-lap time simulation that sets
          the grid for Sunday's race.</i>
        </p>
        <div class="divider"></div>
        <button class="btn btn-primary" onclick="UI.skipQualifying()">
          <span class="btn-label">Provisional</span>
          <span class="btn-body">Simulate placeholder grid · continue to Race Day</span>
        </button>
      </div>
    `;
  }

  function renderRaceStub(state, track) {
    return `
      <div class="sh sh-crimson"><span class="dot-live"></span>Race Day</div>
      <div class="card">
        <div class="text-tiny text-gold">${track.name}</div>
        <p class="text-small mt-12" style="color:var(--id);">
          <i>The Race Day engine is under construction.
          The full system runs a lap-by-lap broadcast with commentary from
          Lee Jordan and Étienne Delacroix, plus mid-race strategic
          interventions over the team radio.</i>
        </p>
        <div class="divider"></div>
        <button class="btn btn-primary" onclick="UI.skipRace()">
          <span class="btn-label">Provisional</span>
          <span class="btn-body">Resolve race with placeholder result</span>
        </button>
      </div>
    `;
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
    const playerRiderId = TEAMS[state.teamId].riderId;
    const otherIds = state.standings
      .map(s => s.riderId)
      .filter(id => id !== playerRiderId);

    // shuffle others
    for (let i = otherIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherIds[i], otherIds[j]] = [otherIds[j], otherIds[i]];
    }

    // build race result array
    const positions = new Array(7);
    positions[playerPos - 1] = playerRiderId;
    let ptr = 0;
    for (let i = 0; i < 7; i++) {
      if (!positions[i]) positions[i] = otherIds[ptr++];
    }

    // award points
    const P = window.IFC.POINTS;
    const PRIZE = window.IFC.PRIZE;
    positions.forEach((riderId, idx) => {
      const pos = idx + 1;
      const entry = state.standings.find(s => s.riderId === riderId);
      if (entry) entry.points += P[pos] || 0;
    });

    // prize money for player
    state.galleons += PRIZE[playerPos] || 0;

    // record result
    state.results.push({
      round: state.round,
      position: playerPos,
      points: P[playerPos] || 0,
      notes: 'Placeholder result',
    });
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
    skipQualifying, skipRace,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
