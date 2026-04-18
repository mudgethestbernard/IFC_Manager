/* ============================================
   IFC MANAGER — GAME STATE
   State management, save/load, unlock tracking.
   ============================================ */

const SAVE_KEY_PREFIX = 'ifc-save-';
const UNLOCK_KEY = 'ifc-unlocks';
const LAST_SESSION_KEY = 'ifc-last-session';

// ---------- UNLOCKS ----------
function getUnlocks() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return { nimbus: true };
    const u = JSON.parse(raw);
    u.nimbus = true; // always
    return u;
  } catch (e) {
    return { nimbus: true };
  }
}

function unlockTeam(teamId) {
  const u = getUnlocks();
  u[teamId] = true;
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(u));
  } catch (e) { /* quota issues, nothing we can do */ }
}

function isUnlocked(teamId) {
  return !!getUnlocks()[teamId];
}

// ---------- SAVE / LOAD ----------
function saveKey(teamId) {
  return SAVE_KEY_PREFIX + teamId;
}

function saveGame(state) {
  if (!state || !state.teamId) return false;
  try {
    localStorage.setItem(saveKey(state.teamId), JSON.stringify(state));
    localStorage.setItem(LAST_SESSION_KEY, state.teamId);
    return true;
  } catch (e) {
    console.warn('Save failed:', e);
    return false;
  }
}

function loadGame(teamId) {
  try {
    const raw = localStorage.getItem(saveKey(teamId));
    if (!raw) return null;
    const state = JSON.parse(raw);
    // version check — future-proofing
    if (!state.version || state.version !== 1) return null;
    return state;
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

function deleteSave(teamId) {
  try {
    localStorage.removeItem(saveKey(teamId));
  } catch (e) { /* ignore */ }
}

function hasSave(teamId) {
  try {
    return localStorage.getItem(saveKey(teamId)) !== null;
  } catch (e) {
    return false;
  }
}

function getLastSession() {
  try {
    return localStorage.getItem(LAST_SESSION_KEY);
  } catch (e) {
    return null;
  }
}

function listAllSaves() {
  const saves = [];
  for (const tid of Object.keys(window.IFC.TEAMS)) {
    if (hasSave(tid)) {
      const s = loadGame(tid);
      if (s) saves.push(s);
    }
  }
  return saves;
}

// ---------- STATE HELPERS ----------
function clampState(state) {
  // keep all 0-100 values in range
  state.morale = clamp(state.morale, 0, 100);
  state.reputation = clamp(state.reputation, 0, 100);
  state.spellLayerMastery = clamp(state.spellLayerMastery, 0, 100);
  state.rider.physical = clamp(state.rider.physical, 0, 100);
  state.rider.mental = clamp(state.rider.mental, 0, 100);
  state.broom.speed = clamp(state.broom.speed, 0, 100);
  state.broom.handling = clamp(state.broom.handling, 0, 100);
  state.broom.reliability = clamp(state.broom.reliability, 0, 100);
  if (state.galleons < 0) {
    // austerity — allow negative but flag
    state.flags.austerity = true;
  }
  return state;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- NEW GAME ----------
function newGame(teamId) {
  if (!window.IFC.TEAMS[teamId]) return null;
  const state = window.IFC.getStartingState(teamId);
  saveGame(state);
  return state;
}

// ---------- SESSION STATE ----------
// current game state held in memory
let _current = null;

function setCurrent(state) { _current = state; }
function getCurrent() { return _current; }

// ---------- AUTOSAVE HOOK ----------
function autosave() {
  if (_current) saveGame(_current);
}

// ---------- STANDINGS ----------
function sortedStandings(state) {
  return [...state.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.riderId.localeCompare(b.riderId);
  });
}

function playerStanding(state) {
  const sorted = sortedStandings(state);
  const riderId = window.IFC.TEAMS[state.teamId].riderId;
  const pos = sorted.findIndex(s => s.riderId === riderId) + 1;
  const entry = sorted[pos - 1];
  return { position: pos, points: entry ? entry.points : 0 };
}

// ---------- ENDGAME CHECK ----------
function checkUnlocksAfterSeason(state) {
  const newUnlocks = [];
  for (const [tid, cond] of Object.entries(window.IFC.UNLOCK_CONDITIONS)) {
    if (!isUnlocked(tid) && cond.check(state)) {
      unlockTeam(tid);
      newUnlocks.push(tid);
    }
  }
  return newUnlocks;
}

// ---------- EXPORT ----------
window.IFCGame = {
  // unlocks
  getUnlocks, unlockTeam, isUnlocked,
  // saves
  saveGame, loadGame, deleteSave, hasSave,
  getLastSession, listAllSaves,
  // state
  newGame, setCurrent, getCurrent, autosave,
  clampState, clamp,
  // standings
  sortedStandings, playerStanding,
  // endgame
  checkUnlocksAfterSeason,
};
