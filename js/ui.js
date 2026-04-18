/* ============================================
   IFC MANAGER — GAME SHELL UI
   Phase 1: team dashboard, resources, save/load,
   return-to-menu. Race + event logic come later.
   ============================================ */

(function() {
  const { TEAMS, RIDERS, TRACKS } = window.IFC;
  const G = window.IFCGame;

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
      // shouldn't happen if menu did its job; bounce back
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
    const rider = RIDERS[team.riderId];
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

    // --- NEXT RACE CARD ---
    if (track && state.phase !== 'ended') {
      html += renderNextRaceCard(state, track);
    }

    // --- STANDINGS SUMMARY ---
    html += renderStandingsSummary(state, standing);

    // --- RESOURCES ---
    html += renderResources(state, rider);

    // --- BROOM & TEAM ---
    html += renderBroom(state);

    // --- FULL STANDINGS ---
    html += renderFullStandings(state);

    // --- ACTIONS (Phase 1 stub — placeholders) ---
    html += renderActions(state);

    // --- MENU ---
    html += `
      <div class="divider"></div>
      <button class="btn" onclick="UI.goToMenu()">
        <span class="btn-label">Main Menu</span>
        <span class="btn-body">Return to team selection · auto-saved</span>
      </button>
    `;

    html += `<div class="footnote">IFC MANAGER · AUTOSAVE ACTIVE</div>`;
    html += '</main>';

    root.innerHTML = html;
  }

  // ---------- COMPONENTS ----------

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
    `;
  }

  function renderResources(state, rider) {
    return `
      <div class="sh">Resources</div>
      <div class="card">
        <div class="res-row">
          <div class="res-label">Galleons</div>
          <div class="res-val text-gold">${state.galleons.toLocaleString()}</div>
        </div>
        <div class="res-row">
          <div class="res-label">Action Points</div>
          <div class="res-val">${state.ap} / ${window.IFC.AP_PER_WEEK}</div>
        </div>
        ${resourceBar('Team Morale', state.morale)}
        ${resourceBar('Reputation', state.reputation)}
      </div>

      <div class="sh">Rider · ${rider.name}</div>
      <div class="card">
        ${resourceBar('Physical', state.rider.physical)}
        ${resourceBar('Mental', state.rider.mental, state.rider.mental < 35 ? 'crimson' : null)}
      </div>
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
          <div class="bar"><div class="${barClass}" style="width:${value}%;"></div></div>
        </div>
        <div class="res-val">${Math.round(value)}</div>
      </div>
    `;
  }

  function renderBroom(state) {
    return `
      <div class="sh">Broom · Spell Architecture</div>
      <div class="card">
        ${resourceBar('Speed', state.broom.speed)}
        ${resourceBar('Handling', state.broom.handling)}
        ${resourceBar('Reliability', state.broom.reliability)}
        ${resourceBar('Layer Mastery', state.spellLayerMastery)}
        <div class="text-tiny mt-12">
          Mean pit stop: ${state.pitBase.toFixed(1)} sec
        </div>
      </div>
    `;
  }

  function renderFullStandings(state) {
    const sorted = G.sortedStandings(state);
    let rows = '';
    sorted.forEach((s, i) => {
      const rider = RIDERS[s.riderId];
      const team = TEAMS[rider.teamId];
      const isPlayer = rider.teamId === state.teamId;
      rows += `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; ${i < sorted.length - 1 ? 'border-bottom:1px dashed var(--pd);' : ''} ${isPlayer ? 'font-weight:bold;' : ''}">
          <div style="width:20px; text-align:right; font-family:'Segoe UI',sans-serif; font-size:12px; color:var(--im);">
            ${i + 1}
          </div>
          <div style="width:4px; height:24px; background: ${team.colourA}; border-radius:2px;"></div>
          <div style="flex:1; font-size:14px;">
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
      <div class="sh">Championship Standings</div>
      <div class="card">
        ${rows}
      </div>
    `;
  }

  function renderActions(state) {
    // Phase 1 stub — actions not wired yet
    return `
      <div class="sh sh-crimson">Pre-Race Week</div>
      <div class="card">
        <div class="text-small" style="color: var(--id);">
          <i>The race week system is under construction.
          In the full game, this is where you would spend your three Action Points
          on broom development, crew training, Cassian's welfare, media management,
          and responding to events.</i>
        </div>
        <div class="divider"></div>
        <div class="btn-row">
          <button class="btn btn-inline" disabled>R&D</button>
          <button class="btn btn-inline" disabled>Training</button>
          <button class="btn btn-inline" disabled>Rider</button>
          <button class="btn btn-inline" disabled>Scout</button>
        </div>
      </div>
    `;
  }

  // ---------- ACTIONS ----------

  function goToMenu() {
    G.autosave();
    window.location.href = 'index.html';
  }

  // ---------- EXPORT ----------
  window.UI = {
    render, goToMenu,
  };

  // init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
