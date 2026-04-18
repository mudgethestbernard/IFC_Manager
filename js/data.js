/* ============================================
   IFC MANAGER — DATA LAYER
   Static world data: teams, riders, tracks,
   starting states. No game logic here.
   ============================================ */

// ---------- TEAMS ----------
const TEAMS = {
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus Racing',
    nickname: 'The Clouds',
    country: 'GB',
    motto: 'Innovation Returns',
    colourA: '#4a6fa5',
    colourB: '#c0c8d8',
    riderId: 'cassian',
    // base broom characteristics
    broom: { speed: 82, handling: 78, reliability: 70 },
    spellLayerMastery: 60,
    pitBase: 11.0, // mean pit stop seconds
    topSpeed: 340,
  },
  firebolt: {
    id: 'firebolt',
    name: 'Firebolt Racing',
    nickname: 'The Bolts',
    country: 'IE',
    motto: 'Speed Without Limits',
    colourA: '#d87428',
    colourB: '#1a1a1a',
    riderId: 'aurelien',
    broom: { speed: 90, handling: 82, reliability: 58 },
    spellLayerMastery: 72,
    pitBase: 9.5,
    topSpeed: 360,
  },
  silver: {
    id: 'silver',
    name: 'Silver Arrow',
    nickname: 'The Arrows',
    country: 'AT',
    motto: 'Das Beste oder nichts',
    colourA: '#8a8a9a',
    colourB: '#3a3a4a',
    riderId: 'wolfram',
    broom: { speed: 88, handling: 90, reliability: 92 },
    spellLayerMastery: 95,
    pitBase: 9.5,
    topSpeed: 350,
  },
  thunder: {
    id: 'thunder',
    name: 'Thunderbolt Racing',
    nickname: 'The Thunder',
    country: 'SE',
    motto: 'Hastigast utan gränser',
    colourA: '#d8b820',
    colourB: '#1a3a7a',
    riderId: 'marcus',
    broom: { speed: 95, handling: 75, reliability: 55 },
    spellLayerMastery: 70,
    pitBase: 8.5,
    topSpeed: 370,
  },
  comet: {
    id: 'comet',
    name: 'Comet Trading',
    nickname: 'The Comets',
    country: 'DE',
    motto: 'Zuverlässigkeit und Präzision',
    colourA: '#1a1a1a',
    colourB: '#8b1a1a',
    riderId: 'matthias',
    broom: { speed: 76, handling: 80, reliability: 85 },
    spellLayerMastery: 82,
    pitBase: 11.5,
    topSpeed: 320,
  },
  sweep: {
    id: 'sweep',
    name: 'Cleansweep',
    nickname: 'The Sweeps',
    country: 'GB',
    motto: 'Tradition and Pride',
    colourA: '#2d5a3a',
    colourB: '#c8a832',
    riderId: 'alistair',
    broom: { speed: 72, handling: 74, reliability: 78 },
    spellLayerMastery: 55,
    pitBase: 20.0, // the infamous Cleansweep pit stop
    topSpeed: 310,
  },
  uni: {
    id: 'uni',
    name: 'Universal Brooms',
    nickname: 'The Stars',
    country: 'US',
    motto: 'Innovation Through Disruption',
    colourA: '#b8b8c8',
    colourB: '#1a3a7a',
    riderId: 'ryder',
    broom: { speed: 80, handling: 68, reliability: 60 },
    spellLayerMastery: 50,
    pitBase: 16.5,
    topSpeed: 330,
  },
};

// ---------- RIDERS ----------
const RIDERS = {
  cassian: {
    id: 'cassian',
    name: 'Cassian Bayes',
    age: 25,
    teamId: 'nimbus',
    // skill axes (0-100)
    skill: {
      pace: 94,         // raw speed
      overtaking: 96,   // wet-weather, slipstream, bottlenecks
      qualifying: 62,   // struggles alone; motivation low
      tyreMgmt: 45,     // spell-layer management — terrible
      consistency: 70,
    },
    // starting condition (Round 1)
    physical: 80,
    mental: 55,
  },
  wolfram: {
    id: 'wolfram',
    name: 'Wolfram Steiner',
    age: 30,
    teamId: 'silver',
    skill: { pace: 90, overtaking: 78, qualifying: 95, tyreMgmt: 95, consistency: 94 },
    physical: 88,
    mental: 82,
  },
  aurelien: {
    id: 'aurelien',
    name: 'Aurélien Dubois',
    age: 26,
    teamId: 'firebolt',
    skill: { pace: 92, overtaking: 88, qualifying: 82, tyreMgmt: 60, consistency: 65 },
    physical: 82,
    mental: 70,
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus Flint',
    age: 25,
    teamId: 'thunder',
    skill: { pace: 93, overtaking: 85, qualifying: 75, tyreMgmt: 58, consistency: 62 },
    physical: 86,
    mental: 75,
  },
  matthias: {
    id: 'matthias',
    name: 'Matthias Gerber',
    age: 29,
    teamId: 'comet',
    skill: { pace: 82, overtaking: 75, qualifying: 85, tyreMgmt: 88, consistency: 90 },
    physical: 85,
    mental: 80,
  },
  alistair: {
    id: 'alistair',
    name: 'Alistair Whitmore',
    age: 34,
    teamId: 'sweep',
    skill: { pace: 84, overtaking: 82, qualifying: 80, tyreMgmt: 82, consistency: 85 },
    physical: 78,
    mental: 72,
  },
  ryder: {
    id: 'ryder',
    name: 'Ryder Hale',
    age: 25,
    teamId: 'uni',
    skill: { pace: 78, overtaking: 70, qualifying: 72, tyreMgmt: 60, consistency: 68 },
    physical: 82,
    mental: 85,
  },
};

// ---------- TRACKS (12 rounds) ----------
const TRACKS = [
  {
    round: 1, id: 'british', name: 'British GP', nickname: 'The Stones',
    location: 'Stonehenge, Salisbury Plain', type: 'high-speed',
    lapKm: 6, laps: 60, avgSpeed: 260,
    weather: 'rain-frequent',
    traits: ['bottleneck', 'long-straight', 'overtaking-wide'],
    note: 'Season opener. Stonehenge pass is 2.5m wide — single file.',
  },
  {
    round: 2, id: 'channel', name: 'Channel Crossing GP', nickname: 'The Crossing',
    location: 'Dover Strait', type: 'over-water',
    lapKm: 70, laps: 22, avgSpeed: 215,
    weather: 'wind-variable',
    traits: ['low-altitude', 'long-race', 'wave-hazard'],
    note: 'Longest race on the calendar. ~2 hours over open water.',
  },
  {
    round: 3, id: 'german', name: 'German GP', nickname: 'The Black',
    location: 'Schwarzwald', type: 'technical',
    lapKm: 7, laps: 50, avgSpeed: 195,
    weather: 'fog-frequent',
    traits: ['narrow', 'elevation', 'tree-threading'],
    note: 'Technical forest circuit. Track narrows to 3m.',
  },
  {
    round: 4, id: 'egyptian', name: 'Egyptian GP', nickname: 'The Pharaoh',
    location: 'Giza', type: 'special',
    lapKm: 6.5, laps: 55, avgSpeed: 225,
    weather: 'heat-shimmer',
    traits: ['night-race', 'sandstorm-risk', 'ancient-magic'],
    note: 'Raced at night. Sandstorms can close bottlenecks mid-race.',
  },
  {
    round: 5, id: 'irish', name: 'Irish GP', nickname: 'The Edge',
    location: 'Cliffs of Moher', type: 'special',
    lapKm: 5.5, laps: 65, avgSpeed: 205,
    weather: 'wind-defining',
    traits: ['cliff-flight', 'spray-zone', 'gusts'],
    note: 'One of the most dangerous tracks. Wind is the variable.',
  },
  {
    round: 6, id: 'northsea', name: 'North Sea GP', nickname: 'The Storm',
    location: 'Scotland ↔ Norway', type: 'over-water',
    lapKm: 80, laps: 19, avgSpeed: 215,
    weather: 'storm-risk',
    traits: ['low-altitude', 'long-race', 'fog', 'rough-sea'],
    note: 'Thick fog. Rough waves. Near Durmstrang.',
  },
  {
    round: 7, id: 'romanian', name: 'Romanian GP', nickname: "The Dragon's Lair",
    location: 'Transylvania', type: 'technical',
    lapKm: 7.5, laps: 48, avgSpeed: 185,
    weather: 'mountain-clear',
    traits: ['dragon-risk', 'elevation-sharp', 'rugged'],
    note: 'Dragon Sanctuary nearby. Charlie Weasley on safety duty.',
  },
  {
    round: 8, id: 'swedish', name: 'Swedish GP', nickname: 'The Aurora',
    location: 'Lapland', type: 'high-speed',
    lapKm: 8, laps: 45, avgSpeed: 270,
    weather: 'cold-extreme',
    traits: ['night-race', 'ice-risk', 'long-straight'],
    note: 'Fastest average of the season. Raced under the aurora.',
  },
  {
    round: 9, id: 'baltic', name: 'Baltic Circuit', nickname: 'The Baltic',
    location: 'Sweden ↔ Denmark ↔ Germany', type: 'over-water',
    lapKm: 90, laps: 17, avgSpeed: 225,
    weather: 'cold-sea',
    traits: ['long-race', 'multiple-coastlines'],
    note: 'Near Durmstrang. Cold Baltic winds.',
  },
  {
    round: 10, id: 'scottish', name: 'Scottish Highlands GP', nickname: 'The Heritage',
    location: 'Scottish Highlands', type: 'technical',
    lapKm: 7, laps: 52, avgSpeed: 215,
    weather: 'highland-variable',
    traits: ['loch-crossing', 'valley', 'mountain-top'],
    note: 'Inherits the old Highland racing tradition. Hogwarts students attend.',
  },
  {
    round: 11, id: 'alpine', name: 'Alpine GP', nickname: 'The Peak',
    location: 'Swiss/Austrian Alps', type: 'technical',
    lapKm: 6, laps: 58, avgSpeed: 170,
    weather: 'alpine-severe',
    traits: ['high-altitude', 'strain-extreme', 'ice-walls'],
    note: 'The track from hell. 4–6x strain on climbs.',
  },
  {
    round: 12, id: 'finale', name: 'Championship Finale', nickname: 'Finale',
    location: 'TBA (annual bid)', type: 'high-speed',
    lapKm: 9.5, laps: 45, avgSpeed: 255,
    weather: 'season-dependent',
    traits: ['long-straight', 'title-decider'],
    note: 'New track each year. 2km+ straight guaranteed.',
  },
];

// ---------- STANDINGS (entering Round 1 — fresh season) ----------
// Points as of start of 2003 season. Previous champion: Steiner (4x).
const INITIAL_STANDINGS = [
  { riderId: 'wolfram', points: 0 },
  { riderId: 'aurelien', points: 0 },
  { riderId: 'marcus', points: 0 },
  { riderId: 'cassian', points: 0 },
  { riderId: 'matthias', points: 0 },
  { riderId: 'alistair', points: 0 },
  { riderId: 'ryder', points: 0 },
];

// ---------- POINTS TABLE ----------
const POINTS = { 1: 10, 2: 5, 3: 3, 4: 2, 5: 1, 6: 0, 7: 0 };

// ---------- PRIZE MONEY (Galleons) ----------
const PRIZE = { 1: 2500, 2: 1500, 3: 800, 4: 400, 5: 200, 6: 0, 7: 0 };

// ---------- WEEKLY OPERATING COST ----------
const OPERATING_COST = 3000;

// ---------- ACTION POINTS PER WEEK ----------
const AP_PER_WEEK = 3;

// ---------- STARTING STATE (Nimbus, Round 1) ----------
function getStartingState(teamId) {
  const team = TEAMS[teamId];
  const rider = RIDERS[team.riderId];

  return {
    version: 1,
    teamId: teamId,

    // season progress
    round: 1,
    phase: 'pre-race', // pre-race | qualifying | race | post-race | summer-break | ended
    week: 1,

    // resources
    galleons: 15000,
    morale: 65,
    reputation: 70,

    // rider state
    rider: {
      id: rider.id,
      physical: rider.physical,
      mental: rider.mental,
    },

    // broom state (mutable — improves with R&D)
    broom: { ...team.broom },
    spellLayerMastery: team.spellLayerMastery,
    pitBase: team.pitBase,

    // turn-based
    ap: AP_PER_WEEK,

    // qualifying result for current round (set during quali phase)
    gridPosition: null,

    // accumulated stats
    standings: INITIAL_STANDINGS.map(s => ({ ...s })),
    results: [], // [{ round, position, points, notes }]

    // event & narrative flags
    flags: {
      protectionCharmIncidentResolved: false,
      cassianRuleInvoked: false,
      therapyStartedThisSeason: false,
      wwwDealAccepted: null, // null | true | false
      skeeterHandled: null, // null | 'paid' | 'preempt' | 'ignored'
    },

    // log of major events (for ending text)
    seasonLog: [],
  };
}

// ---------- UNLOCK CONDITIONS ----------
const UNLOCK_CONDITIONS = {
  thunder: { description: 'Finish the season 3rd or better with Nimbus', check: (save) => save.teamId === 'nimbus' && getFinalPosition(save) <= 3 },
  firebolt: { description: 'Win the Championship with Nimbus', check: (save) => save.teamId === 'nimbus' && getFinalPosition(save) === 1 },
  sweep:    { description: 'Achieve 5+ podium finishes in a Nimbus season', check: (save) => save.teamId === 'nimbus' && countPodiums(save) >= 5 },
};

function getFinalPosition(save) {
  if (!save.standings) return 99;
  const sorted = [...save.standings].sort((a, b) => b.points - a.points);
  return sorted.findIndex(s => s.riderId === TEAMS[save.teamId].riderId) + 1;
}

function countPodiums(save) {
  if (!save.results) return 0;
  return save.results.filter(r => r.position <= 3).length;
}

// ---------- HELPERS ----------
function teamOf(riderId) { return TEAMS[RIDERS[riderId].teamId]; }
function riderOf(teamId) { return RIDERS[TEAMS[teamId].riderId]; }
function trackByRound(round) { return TRACKS.find(t => t.round === round); }

// Expose globally for non-module usage
window.IFC = {
  TEAMS, RIDERS, TRACKS,
  INITIAL_STANDINGS, POINTS, PRIZE,
  OPERATING_COST, AP_PER_WEEK,
  UNLOCK_CONDITIONS,
  getStartingState, getFinalPosition, countPodiums,
  teamOf, riderOf, trackByRound,
};
