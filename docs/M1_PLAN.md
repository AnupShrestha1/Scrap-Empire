# Milestone 1 — Core Loop: Plan

Approved 2026-10-30. M1a implemented 2026-10-30; M1b next. Builds on [GAME_DESIGN.md](GAME_DESIGN.md) §6 and [ARCHITECTURE.md](ARCHITECTURE.md) §8.

**Goal:** a new player goes truck → pile → shredder → bins → sell → first upgrade in about two minutes, guided only by objectives, on desktop and phone.

To keep reviews small, M1 lands in two parts, each playable and reviewed before the next:

- **M1a — The yard and the chain:** real yard, truck deliveries, pile, carrying, shredder, bins.
- **M1b — Money and guidance:** sell pads, cash, upgrade pads, objectives, HUD, toasts, sound.

## 1. The yard

A 32×24 tile yard inside a fence, with grass, trees and water outside (decoration only; not walkable). The chain reads left to right, top to bottom on screen:

```
 road ══ GATE ══▶ [ Pile 2×2 ] ─▶ [ Shredder 2×2 ] ─▶ [Iron bin][Alu bin]
                                                      (sell pads in front)
        [guard booth]      [upgrade pads: carry · shredder · bins · supply]
```

- **Stations are data.** `layout.ts` gets a station list (id, type, footprint, interaction zones), not just ASCII tiles. Footprints are solid; zones are the tiles where standing does something.
- **Room to grow.** Space is left for the M2 manufacturing row, but no locked or fake plots are shown yet (no placeholders).
- **Decoration:** trees, water edge, lamp posts and a guard booth, as in the reference.

## 2. Rules (starting numbers, all in `src/data/`)

| Thing | Starting value |
|---|---|
| Truck | Every 20 s brings 8 metal scrap. If the pile can't take the whole load, it waits at the gate ("Yard full"). |
| Pile cap | 40 |
| Carry capacity | 5, upgrade +3 per level |
| Transfer speed | 8 items/s while standing in a zone |
| Shredder | Hopper 10, one scrap per 2.5 s, output tray 12 |
| Shredder yield per scrap | 1 iron + 0.3 aluminium (fractions accumulate, so it's exact over time, never random) |
| Bins | Iron 30, Aluminium 30 |
| Prices | Iron $2, Aluminium $5 |
| Starting cash | $0 |

The first upgrades, bought on in-world cash pads:

| Upgrade | First price | Price growth | Effect per level |
|---|---|---|---|
| Carry capacity | $25 | ×1.6 | +3 |
| Shredder speed | $40 | ×1.5 | −15% cycle time |
| Bin size | $30 | ×1.5 | +15 per bin |
| Supply rate | $60 | ×1.7 | Alternates: +2 scrap per load / −2 s between trucks |

These are first guesses. A debug panel (time ×4, add cash, reset save) makes them quick to tune by playing.

## 3. How things behave

- **Carrying.** The worker holds an ordered stack. It can be mixed, and is drawn on their back up to 10 items, then "+N".
- **Pile → worker.** Standing on the pile moves scrap onto the stack until it's full.
- **Worker → shredder.** Standing at the hopper moves scrap off the stack, up to hopper space.
- **Shredder states:**
  - Idle (grey)
  - Processing (green, with a progress ring)
  - Output ready (yellow)
  - Blocked (red, tray full)
  
  The tray and the material counts show in the world.
- **Tray → worker.** Standing at the tray picks up its output.
- **Worker → bins.** Walking past a bin drops only that bin's material. When a bin is full it turns red, a toast says "Iron storage full", and the items stay with the worker. If the bins stay full the tray fills, the shredder blocks, and the problem is visible all the way back up the chain.
- **Sell pads.** Each bin has one; standing on it sells that bin's contents with a floating "+$2".
- **Cash pads.** Standing on one pays in steps and shows a fill ring. Partial payment is kept, the upgrade applies when it's fully paid, and the next price appears. With no cash, the pad shows "Need $X".
- **Objectives 1–8 (the tutorial):** pick up scrap → feed the shredder → collect the output → sort into the bins → sell 10 iron → buy the carry upgrade → process 30 scrap → buy any second upgrade. Each pays a small cash reward. A hint arrow points to the next spot; it can be switched off and never blocks play.

## 4. Code changes

- **Simulation** (`src/sim/systems/`), all pure TypeScript and unit-tested:
  - supplier and truck
  - interaction (zones and transfers)
  - processing
  - storage
  - sales
  - purchases (cash pads)
  - objectives
- **Events.** The simulation emits typed events (`TruckArrived`, `ItemsMoved`, `MachineStateChanged`, `StorageFull`, `Sold`, `Purchased`, `ObjectiveDone`…). The view, toasts and sound react to them. This is architecture decision D10 arriving. A command queue isn't needed yet, since every interaction is proximity-based.
- **Save format v2.** Adds cash, the stack, the pile, the shredder, bins, upgrade levels with partial payments, truck timing, objective progress and lifetime earnings. A migration from v1 keeps current saves working, with a test.
- **View.** New pixel-art sprites: truck (drive-in, unload, leave), pile with 4 sizes, shredder with working frames, bins with fill levels, item icons, sell and cash pads, trees, water, lamp post, booth. Each station gets a small renderer that reads simulation state.
- **UI (DOM, navy style from the reference).**
  - Cash chip, objective banner and sound toggle at the top.
  - Toasts: at most two, with duplicates merged.
  - Checked for legibility at 800×450.
- **Sound.** Tiny sounds generated in code (pickup, drop, shredder hum, truck horn, cash, upgrade, warning), with no audio files.
  - Audio resumes on the first tap (an iOS rule).
  - Everything mutes when CrazyGames' mute setting is on.
- **Collision.** Fences become thin lines, so the worker can walk right up to them (the fix noted after the isometric switch).

## 5. Done when

- [ ] A first-time player reaches the first upgrade in about 2 minutes, using only the objectives.
- [ ] Full bins block the shredder and it recovers when emptied; the truck waits when the pile is full.
- [ ] Every state change can be seen in the world without reading the HUD.
- [ ] Progress (cash, stack, machines, upgrades, objectives) survives a reload; v1 saves migrate.
- [ ] 60 fps at 1080p and in the phone viewport; readable at 800×450.
- [ ] Unit tests cover transfers, processing and yield, back-pressure, purchases, objectives, the truck and migration.
- [ ] You've tried it on a real phone.

## 6. Decisions for you

1. **Starting numbers.** Fine to start with the table above and tune by playing?
2. **Hint arrow.** On by default for new players, switchable off in settings?
3. **Selling.** Selling only from bins' sell pads (not straight from your hands) keeps the bins meaningful. OK?
