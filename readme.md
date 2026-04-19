# IFC Manager

A season-management game set in the International Flight Championship.
The player runs a broom-racing team as its Team Principal across a
twelve-round season, circa 2003.

Built as a static site for GitHub Pages. No server, no build step.
All state lives in `localStorage`.

---

## Running Locally

Just open `index.html` in a browser. That's it.

For GitHub Pages, push to a repo and enable Pages on the `main` branch
(root folder).

---

## File Structure

```
/
├── index.html          Main menu
├── game.html           Game screen
├── css/
│   └── style.css       Design language (inherited from the IFC publication)
├── js/
│   ├── data.js         Teams, riders, tracks, starting state
│   ├── game.js         Save/load, unlocks, state helpers
│   ├── actions.js      Pre-Race Week action definitions
│   ├── events.js       Event cards — scripted + random pool
│   ├── race.js         Qualifying sim, race engine, commentary
│   ├── postrace.js     Daily Prophet coverage, podium interviews
│   ├── endings.js      Season-end branching cutscenes
│   ├── menu.js         Main menu rendering
│   └── ui.js           Game screen rendering
└── README.md
```

---

## Development Phases

- [x] **Phase 1** — Data layer, main menu, game shell, save/load scaffolding
- [x] **Phase 2** — Pre-Race Week: Action Points, broom R&D, rider management, media
- [x] **Phase 3** — Qualifying and Race Day: lap-by-lap commentary, strategic interventions
- [x] **Phase 4** — Event cards: scripted canon moments and random pool
- [x] **Phase 5** — Endings, season summary, new-season flow

The game is content-complete for the Nimbus-only campaign.

---

## Playable Teams

The first playthrough is restricted to **Nimbus Racing** (the Cassian
comeback arc). Others unlock through play:

| Team | Unlock |
|------|--------|
| Nimbus Racing | Always available |
| Thunderbolt | Finish 3rd or better with Nimbus |
| Firebolt | Win the Championship with Nimbus |
| Cleansweep | Achieve 5+ podiums in a Nimbus season |

Silver Arrow, Comet, and Universal are not currently planned as
playable teams — they serve the story better as rivals.

---

## Storage

- Saves: one per team, keyed `ifc-save-<teamId>`
- Unlocks: `ifc-unlocks`
- Last session: `ifc-last-session`

All writes happen through `IFCGame.saveGame()` with `try/catch`
around quota failures. Incognito / private browsing will not
persist between sessions — a notice should be shown when we detect
this (to be added in a later phase).
