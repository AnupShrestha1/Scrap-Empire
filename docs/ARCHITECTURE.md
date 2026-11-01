# Scrap Empire — Architecture and Milestone Plan

v0.2, 2026-10-30. M0 is implemented. Read alongside [GAME_DESIGN.md](GAME_DESIGN.md).

## 1. Stack

| Piece | Choice | Why |
|---|---|---|
| Renderer | **Three.js 0.186** (pinned) | 3D since 2026-11-01 (see [3D_PLAN.md](3D_PLAN.md)). A renderer rather than a framework, so it fits the sim/view split; loads glTF, the format the free model packs ship in. Replaced Phaser 4, which is 2D only. |
| Language | TypeScript, strict mode | Type-checked content IDs and balance data; safer refactors as the game grows |
| Build | Vite | Fast dev server, small production bundles, relative paths (CrazyGames forbids absolute paths) |
| Tests | Vitest | Unit tests for the simulation, economy, saves and offline progress |
| Platform | CrazyGames SDK v3 (`https://sdk.crazygames.com/crazygames-sdk-v3.js`) | Loaded only in CrazyGames builds. The game runs without it. |

There are no other runtime dependencies. We write the joystick, UI and audio ourselves. Models are Kenney's CC0 packs (`public/models/CREDITS.md`), plus objects built in code.

## 2. Key decisions

**D1. The simulation is separate from rendering.** `src/sim` is plain TypeScript with no rendering imports. It runs at a fixed 20 ticks/s, and the view draws the state every frame with interpolation.
- Identical behaviour at 60, 144 and 165 Hz (a CrazyGames requirement).
- The game logic can be unit-tested without a browser.
- Offline progress reuses the same code.
- A save is just the serialised simulation state.

**D2. Content is data.** Items, machines, recipes, upgrades, cost curves, supplier settings, objectives and the yard layout live in `src/data` as typed TypeScript objects. The compiler catches a recipe that names a missing item, and all balance edits happen in one place.

**D3. The fixed layout is data too.** `layout.ts` holds:
- an ASCII tile grid for ground, roads, fences and walls;
- plots: position, allowed machine types, price, unlock requirement;
- worker routes and conveyor routes as waypoint lists;
- expansion zones.

Because every route is fixed, no pathfinding is needed.

**D4. No physics engine.**
- The player collides against the tile grid and static rectangles (simple AABB).
- Each station has interaction zones. Every tick the simulation looks up the player's zone in a coarse spatial grid (4×4-tile cells) and applies the transfer rules from the design doc.
- Workers walk their fixed waypoint routes.

**D5. Items are counters, not objects.** Piles, hoppers, trays, bins, racks and the carried stack are counts per item type. Only belts track individual items: each belt segment is a fixed-size ring buffer of item slots, drawn with pooled sprites. This keeps entity counts low enough for 4 GB Chromebooks.

**D6. UI split.**
- The HUD, panels and toasts are a DOM overlay on top of the canvas, built from small vanilla-TS components and CSS.
- Lamps and progress rings are drawn in 3D; labels and floating text are DOM elements pinned to world points (`view/labels.ts`).

Why: DOM text stays sharp at 800×450 with no high-DPI scaling, where scaled canvas text blurs. CSS handles the responsive layout, and large touch targets come easily. The cost is two layers to keep in step; the UI reads simulation state through the same event queue as the view (D10).

**D7. Rendering and scaling.**
- The canvas fills the iframe; the pixel ratio is capped (2 on desktop, 1.5 on touch devices).
- 3D world: tile (x, y) of the simulation grid is world (x, 0, y), one unit per tile. A perspective camera looks north, 46° down, following the player; its distance shows about 300 tiles of ground whatever the screen shape (`VIEW` in `config.ts`). Because it looks north, stick directions are grid directions.
- The ground is one plane with one baked canvas texture. Trees, fence posts and rails, scrap pieces and stored bars are instanced meshes, so the scene stays around 100–170 draw calls with shadows.
- One sun with a shadow box that follows the camera, plus sky light; light fog at the edges.

**D8. Platform adapter.** One interface (the ad methods are added in M5):

```ts
interface Platform {
  init(): Promise<void>;
  loadingStart(): void; loadingStop(): void;
  gameplayStart(): void; gameplayStop(): void;
  storage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  midgameAd(): Promise<void>;
  rewardedAd(): Promise<boolean>; // false on adError: never grant the reward
  locale(): string;
}
```

- `CrazyGamesPlatform` wraps the SDK. Its storage is the Data module, which uses localStorage for guests and cloud sync for logged-in players.
- `LocalPlatform` uses localStorage and fakes the ads.
- At startup, the CrazyGames version is chosen when `window.CrazyGames?.SDK` exists and its environment isn't `disabled`.
- Nothing outside `src/platform` touches the SDK.

**D9. Saves.**
- **Format:** one JSON value, `{ v, savedAt, state }`. Compact: counts, levels and unlocks. Belts are saved as counts per segment, not item positions. Budget: under 50 KB (the platform limit is 1 MB).
- **Keys:** `save` holds the current save and `save_backup` the last good one. A save that fails validation falls back to the backup; if both fail, the game starts fresh and keeps the bad data under `save_corrupt` for debugging.
- **Migrations:** an ordered list of pure functions, each moving v→v+1, unit-tested against fixture saves.
- **When it saves:** every 15 s when something changed, on every purchase, and on `visibilitychange` (hidden) and `pagehide`. The Data module can take up to 30 s to sync, so we never depend on a save landing instantly.

**D10. Commands in, events out.** (The queues arrive in M1, with the first commands and events; M0 only has movement input.)
- Input and UI never change state directly. They queue commands (`Move`, `BuyUpgrade`, `SetRecipe`, `ToggleAutoSell`…), applied at the start of a tick.
- The simulation emits typed events (`DeliveryArrived`, `ItemsTransferred`, `MachineStateChanged`, `StorageFull`, `Sale`, `ObjectiveCompleted`…). The view, UI and audio consume them after each tick.
- This keeps the simulation deterministic and testable.

**D11. Time and offline progress.**
- If a frame is late, the simulation catches up by a limited number of ticks.
- A gap longer than 60 s goes through the offline path: elapsed time (clamped to 0–2 h, which also guards against clock changes) is simulated at a coarse 1 s step with the player removed.
- Tests compare offline results against real-time simulation.

**D12. Input.**
- Keyboard keys are read by `KeyboardEvent.code`. Arrow keys and Space call `preventDefault` so the CrazyGames page doesn't scroll.
- Touch mode switches on at the first touch event (not by guessing from the browser's user agent) and shows the floating joystick.

**D13. Text.** Every UI string lives in `src/i18n/en.ts` and is used through `t('storage.full', { item })`. v1 ships English only; the locale comes from the SDK later.

## 3. How the systems connect

```
Keyboard / joystick ─┐
UI panels ───────────┼─▶ command queue ─▶ SIM TICK (20/s) ─▶ event queue ─▶ 3D view · DOM UI · audio
                     │                         │
                     │                    GameState (plain data)
                     │                         │
                     └──────── SaveManager ◀───┘ ──▶ Platform.storage (CrazyGames Data module / localStorage)
```

Systems run in this order each tick:

1. player
2. interaction
3. supplier
4. processing
5. storage
6. manufacturing
7. workers
8. conveyors
9. sales
10. orders
11. objectives

## 4. Folder structure

```
index.html
vite.config.ts
src/
  main.ts                platform init → load save → load models → start the 3D world
  sim/                   pure game logic, no rendering
    state.ts             GameState types, createNewGame()
    simulation.ts        fixed step, command queue, event queue
    economy.ts           cost curves, prices
    systems/             player, interaction, supplier, processing, storage,
                         manufacturing, sales, workers, conveyors, orders,
                         objectives, offline
  data/                  items, machines, recipes, upgrades, supplier,
                         objectives, layout
  view/                  Three.js view
    world.ts             renderer, camera, lights, frame loop, event feedback
    stations.ts          one view per station, trucks, staff, hint arrow
    field.ts             instanced scrap on the dump site
    character.ts         animated player and employees with their stacks
    props.ts, ground.ts  objects built in code; the yard floor and scenery
    assets.ts            model loading, fitting and baking for instancing
    labels.ts            DOM labels pinned to world points
public/models/           Kenney CC0 models (GLB) and their palette textures
  ui/                    hud, panels, toasts, styles.css
  input/                 keyboard, joystick
  platform/              Platform interface, crazygames, local
  save/                  saveManager, migrations
  audio/                 generated sound effects
  i18n/                  en.ts
tests/                   Vitest specs, fixture saves
docs/
```

## 5. Minimum assets for Milestone 1

Everything is drawn in code, styled after the user's reference images.

- **Ground:** dirt/concrete tiles, road, fence, gate.
- **Player:** idle and walk in four directions (2–4 frames), plus the carried-stack overlay.
- **Supplier truck:** driving and unloading.
- **Metal scrap pile:** four fill stages.
- **Item icons:** metal scrap, iron, aluminium.
- **Shredder:** body with 2–3 working frames, hopper, output tray, status lamp, progress ring.
- **Two bins:** body, fill gauge, material icon, full state.
- **Pads and terminal:** sell pad, cash pad (price label and payment progress), terminal.
- **Touch:** joystick base and knob.
- **UI (DOM):** HUD, toasts, floating "+$" text, using the system font stack (no web font in M1).
- **Sound:** pickup, drop, shredder loop, truck, cash, purchase, warning.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Joystick plus proximity feels bad on phones | Core fun | Prototype in M1 at 800×450; tune zone sizes and transfer speed; you test on a real phone |
| Text unreadable at 800×450 | Rejection | DOM UI, minimum font sizes, icons over text, checked at 800×450 from M1 onwards |
| Too many belt items for 4 GB Chromebooks | Disabled on ChromeOS | Slot buffers, pooled sprites, off-screen culling, items capped per segment, debug overlay with budgets |
| Background tabs throttle timers | Bugs | Fixed-step simulation with capped catch-up; offline path for long gaps |
| Offline exploits (changing the clock) or drift | Broken economy | Clamp elapsed time; same rules at a coarse step; tests against real time |
| Corrupt saves or slow cloud sync | Lost progress | Backup slot, validation, save on `pagehide`, small saves |
| 3D is heavier on low-end devices | Disabled on ChromeOS, poor phone play | Instancing, capped pixel ratio, smaller shadow maps on phones, debug overlay with draw calls |
| iOS Safari: audio unlock, lost WebGL contexts, memory | Game disabled on Safari | Resume audio on a tap, handle context restore, small textures |
| Code-drawn art falls short | Low click-through, weaker reviews | Get references early, dedicated art pass, careful cover art (CrazyGames thumbnails matter) |
| Scope creep | Delays | v1 content cap and out-of-scope list in the design doc |
| Balance | Players leave | Numbers only in config, a debug time-scale, a simulation-only balance runner from M2 |

## 7. Performance budgets

| Measure | Budget |
|---|---|
| Initial download | Under 8 MB; currently 3.0 MB (platform limit for the mobile homepage: 20 MB) |
| Simulation tick | Under 2 ms on a mid-range laptop |
| Draw calls | Under 150 typical, with shadows |
| Models | Kenney GLBs sharing palette textures, about 1.5 MB |
| Tab memory | Under 200 MB |

## 8. Milestones

Each milestone ends with its exit criteria checked and your review before the next one starts. Mobile controls, responsive layout, the platform adapter and versioned saves start in M0 rather than at the end.

### M0 — Project setup (small) — done 2026-10-30

- git repository, Vite + TypeScript + Phaser 4.2.1, Vitest.
- Folder structure, platform adapter (local version plus a CrazyGames stub), save manager with format v1, i18n table.
- Keyboard and joystick input, responsive scaling, debug overlay (FPS, tick time, entity count).

**Done when:**
- a placeholder player walks around a test yard with the keyboard and the joystick, at 800×450 and at 1920×1080;
- the state survives a reload;
- tests run.

### M1 — Core loop

- Yard layout v1 with collisions, gate, and truck deliveries onto a capped pile.
- Shredder (metal scrap → iron + aluminium) with all machine states.
- Two bins with capacity, gauges and full warnings; sell pads; cash.
- 3–4 upgrades through cash pads and the shredder terminal: carry capacity, shredder speed, bin capacity, supply rate.
- Proximity transfers, toasts, objectives 1–8 (the tutorial), basic sounds, autosave.

**Done when:**
- a new player goes from scrap to first sale in about 60 s, guided only by the objectives;
- the shredder blocks when the bins are full and recovers;
- progress survives a reload;
- it runs smoothly at 1080p and in the mobile viewport;
- unit tests cover processing, storage back-pressure and saves.

### M2 — Manufacturing and economy (see M2_PLAN.md; reshaped into one factory with lines during M2a)

- Feed chutes from the storage row.
- Press (metal sheets) and can line (aluminium cans), with recipe selection.
- Product racks with sell pads; buyer truck with auto-sell toggles and reserves.
- All three processor upgrade tracks (extraction unlocks copper), plus manufacturing upgrades.
- Business level.
- A simulation-only balance runner that plays the economy with a scripted strategy and reports when each unlock happens.

**Done when:**
- manufacturing clearly beats selling raw;
- the first 20 minutes give an upgrade every 1–3 minutes, measured with the balance runner and by playing.

### M3 — Automation

- Handcart and large cart.
- Staff hut and workers on fixed routes.
- Conveyors on fixed routes, and the sorter.
- Offline progress with the 2-hour cap and the return summary.

**Done when:**
- a fully automated metal chain runs without the player;
- 300 items on belts keep a stable frame rate with the CPU throttled 4× in browser dev tools;
- offline results land within ~10% of real-time simulation in tests.

### M4a — Content and tiers

- Granulator with plastic.
- Dismantler with e-waste: copper, components, gold.
- Supplier contracts.
- Molder, wire drawer, assembler (motor, circuit board).
- Mk2 machines.
- Expansion zones 1–2.

### M4b — Orders and late game

- Order board.
- Expansion zone 3.
- Manufacturer priority mode.
- Rare salvage crates.
- A balance pass across 2–3 hours of play.

### M5 — Polish and release

- **Art:** a pass against the references, animation polish, cover art.
- **Audio:** a sound pass, plus music if wanted.
- **CrazyGames SDK in full:** gameplay and loading events, Data module saves, ads as planned in the design doc.
- **Hardening:** locale plumbing, performance pass on a throttled low-end profile, Safari/iOS fixes, save-migration tests.
- **Release:** testing in the CrazyGames Preview tool, submission (title, description, cover images), Basic Launch.

## 9. Testing

| Kind | What | Who |
|---|---|---|
| Unit (Vitest) | Simulation systems, economy curves, save migrations, offline progress | Claude |
| Balance runner | Time to each unlock with a scripted strategy | Claude (from M2) |
| Browser | 800×450, 1280×720, 1920×1080 and a phone viewport, run in the in-app browser | Claude |
| Real devices | Phone Safari and Chrome; a Chromebook or a throttled laptop | You |
| Platform | CrazyGames Preview tool before submission | Both |
