/* ============================================
   IFC MANAGER — MAIN MENU
   Handles index.html rendering and navigation.
   ============================================ */

(function() {
  const { TEAMS, RIDERS, UNLOCK_CONDITIONS } = window.IFC;
  const G = window.IFCGame;

  // country flag emoji
  const FLAG = {
    GB: '🇬🇧', IE: '🇮🇪', AT: '🇦🇹', SE: '🇸🇪',
    DE: '🇩🇪', US: '🇺🇸', FR: '🇫🇷',
  };

  const TEAM_ORDER = ['nimbus', 'thunder', 'firebolt', 'sweep', 'silver', 'comet', 'uni'];

  function render() {
    const root = document.getElementById('app');
    const unlocks = G.getUnlocks();
    const saves = G.listAllSaves();
    const last = G.getLastSession();

    let html = '';

    // --- HERO ---
    html += `
      <div class="hero">
        <div class="hero-title">IFC MANAGER</div>
        <div class="hero-sub">International Flight Championship</div>
        <div class="hero-year">Season 2003 · Team Principal Edition</div>
      </div>
    `;

    html += '<main class="fade-in">';

    // --- CONTINUE (if last session exists) ---
    if (last && G.hasSave(last) && unlocks[last]) {
      const save = G.loadGame(last);
      if (save) {
        const team = TEAMS[save.teamId];
        const standing = G.playerStanding(save);
        const isEnded = save.phase === 'ended';
        const phaseLabel = isEnded
          ? 'Season Complete'
          : `Round ${save.round} · ${save.phase.replace('-', ' ')}`;
        html += `
          <div class="sh sh-crimson"><span class="dot-live"></span>Resume Session</div>
          <div class="card card-hover" onclick="MENU.resume('${save.teamId}')">
            <div class="team-bar" style="background: linear-gradient(90deg, ${team.colourA}, ${team.colourB});"></div>
            <div class="text-tiny text-gold">${team.name} · ${FLAG[team.country] || ''}</div>
            <div style="font-size:17px; font-weight:bold; margin-top:4px;">
              ${phaseLabel}
            </div>
            <div class="text-small mt-8">
              ${standing.position > 0 ? `P${standing.position} · ${standing.points} pts` : 'Season not started'}
              · ${save.galleons.toLocaleString()} G
            </div>
          </div>
          <div class="divider"></div>
        `;
      }
    }

    // --- TEAM SELECT ---
    html += `<div class="sh">Select a Team</div>`;

    for (const tid of TEAM_ORDER) {
      const team = TEAMS[tid];
      const rider = RIDERS[team.riderId];
      const unlocked = !!unlocks[tid];
      const hasSaveFile = G.hasSave(tid);

      if (unlocked) {
        html += `
          <div class="team-tile" onclick="MENU.selectTeam('${tid}')">
            <div class="team-swatch" style="background: linear-gradient(180deg, ${team.colourA}, ${team.colourB});"></div>
            <div class="team-info">
              <div class="team-name">${team.name} ${FLAG[team.country] || ''}</div>
              <div class="team-meta">${rider.name} · ${team.nickname}</div>
              ${hasSaveFile ? `<div class="text-tiny text-gold mt-8">✓ SAVE PRESENT</div>` : ''}
            </div>
          </div>
        `;
      } else {
        const cond = UNLOCK_CONDITIONS[tid];
        html += `
          <div class="team-tile locked">
            <div class="team-swatch" style="background: linear-gradient(180deg, ${team.colourA}, ${team.colourB});"></div>
            <div class="team-info">
              <div class="team-name">${team.name}</div>
              <div class="team-meta">${cond ? cond.description : 'Locked'}</div>
            </div>
          </div>
        `;
      }
    }

    // --- OPTIONS ---
    html += `
      <div class="divider"></div>
      <div class="sh">Options</div>
      <button class="btn btn-danger" onclick="MENU.confirmWipe()">
        <span class="btn-label">Reset</span>
        <span class="btn-body">Wipe all saves and unlocks</span>
      </button>
    `;

    html += `
      <div class="footnote">
        IFC Manager · A Nimbus Racing Production · 2003
      </div>
    `;

    html += '</main>';
    root.innerHTML = html;
  }

  function selectTeam(teamId) {
    const unlocks = G.getUnlocks();
    if (!unlocks[teamId]) return;

    const hasSave = G.hasSave(teamId);
    if (hasSave) {
      showChoiceModal(teamId);
    } else {
      startNewGame(teamId);
    }
  }

  function showChoiceModal(teamId) {
    const team = TEAMS[teamId];
    const save = G.loadGame(teamId);
    const standing = save ? G.playerStanding(save) : null;

    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>${team.name}</h3>
        <p class="text-small mb-16">
          You have an existing save at Round ${save.round}
          ${standing ? `, currently P${standing.position}.` : '.'}
        </p>
        <button class="btn btn-primary" id="mod-continue">
          <span class="btn-label">Continue</span>
          <span class="btn-body">Resume existing season</span>
        </button>
        <button class="btn btn-danger" id="mod-new">
          <span class="btn-label">New Season</span>
          <span class="btn-body">Overwrite the current save</span>
        </button>
        <button class="btn" id="mod-cancel">
          <span class="btn-body">Cancel</span>
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#mod-continue').onclick = () => {
      document.body.removeChild(modal);
      resume(teamId);
    };
    modal.querySelector('#mod-new').onclick = () => {
      document.body.removeChild(modal);
      startNewGame(teamId);
    };
    modal.querySelector('#mod-cancel').onclick = () => {
      document.body.removeChild(modal);
    };
  }

  function startNewGame(teamId) {
    G.newGame(teamId);
    goToGame(teamId);
  }

  function resume(teamId) {
    goToGame(teamId);
  }

  function goToGame(teamId) {
    try {
      localStorage.setItem(LAST_SESSION_KEY_DIRECT, teamId);
    } catch (e) {}
    window.location.href = 'game.html?team=' + encodeURIComponent(teamId);
  }

  // direct key access for header write
  const LAST_SESSION_KEY_DIRECT = 'ifc-last-session';

  function confirmWipe() {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h3>Wipe All Data?</h3>
        <p class="text-small mb-16">
          This erases every save and every unlock. You will start over from Nimbus only.
          This cannot be undone.
        </p>
        <button class="btn btn-danger" id="mod-yes">
          <span class="btn-body">Yes, wipe everything</span>
        </button>
        <button class="btn" id="mod-no">
          <span class="btn-body">Cancel</span>
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#mod-yes').onclick = () => {
      wipeAll();
      document.body.removeChild(modal);
      render();
    };
    modal.querySelector('#mod-no').onclick = () => {
      document.body.removeChild(modal);
    };
  }

  function wipeAll() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ifc-')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }

  // expose
  window.MENU = {
    render, selectTeam, resume, confirmWipe,
  };

  // auto-render on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
