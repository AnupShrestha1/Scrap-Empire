# Scrap Empire — Game Design

v0.2, 2026-10-30. All changes in §3 are approved. This is the source of truth for gameplay. Numbers here are illustrative starting points; the real values live in balance config (`src/data/`), never in code.

## 1. Pitch

A 2D recycling tycoon for CrazyGames, seen in an isometric (diamond-grid) view. You start with a tiny scrapyard and do everything by hand: grab scrap from the delivery pile, feed the shredder, sort what comes out into bins, turn materials into products and sell them. Profits buy workers, conveyors and bigger machines until the yard runs itself, and your job becomes growing and tuning it.

Genre: "idle arcade" tycoon, built for active play. Progress needs the player present and making decisions. Automation keeps the yard running while you play, plus a capped offline trickle.

## 2. Pillars

1. **Physical.** Every movement of goods is visible: piles, the stack on your back, items on belts. Purchases happen in the world, on cash pads or at machine terminals.
2. **Readable.** From across the yard you can tell what every machine is doing and what is blocking it.
3. **Earned automation.** Each automation step replaces a chore the player has already done by hand many times.
4. **Short sessions.** A satisfying loop in the first minute, a meaningful upgrade every few minutes.

## 3. Changes from the original brief

| # | Change | Status |
|---|---|---|
| A | Proximity auto-transfer instead of an interact button | Approved |
| B | Hired workers added as the first automation step, before conveyors | Approved |
| C | Fixed layout: machine plots and belt routes are predefined and bought | Approved |
| D | Offline progress capped at ~2 h, automated chains only | Approved |
| E | Art drawn in code, matched to reference images supplied by the user | Approved |
| F | Storage is the hub: manufacturers, sales and orders all draw from storage | Approved |
| G | Raw materials can be sold from Milestone 1, so the first loop pays out | Approved |
| H | A chain of objectives doubles as the tutorial and as pacing | Approved |
| I | Supplier tracks become *Supply rate* (size and frequency merged) and *Contracts* (scrap types and mix) | Approved |
| J | Processor "efficiency" is a yield multiplier; no waste entity in v1 | Approved |
| K | v1 content cap: 3 scrap types, 6 materials, 6 products, 2 machine tiers. Glass and vehicle scrap move to post-launch updates | Approved |
| L | Buying happens on in-world cash pads (build/unlock) and machine terminals (upgrades) | Approved |
| M | Rare salvage crates that only the player can carry, giving the character a late-game job | Approved |
| N | Isometric view (2:1 diamond grid, as in the art reference) instead of true top-down. The simulation stays on a square grid; only the view projects it | Approved |
| O | One factory building with production lines bought one at a time, instead of separate machines on plots | Approved (user's direction, M2a) |
| P | Products sell the moment they are made: no product racks and no carrying products | Approved (user's direction, M2a) |
| Q | Pads that sell, spend or give items back never sit on walking routes, and wait for the player to stand still | Approved (user's direction, M2a) |
| R | No conveyor belts or chutes: factory lines draw straight from the bins | Approved (user's direction, M2b) |
| S | A big dump site with scattered scrap pieces (small = 1, big = 3) and a magnet pick-up replaces the scrap pile; see DUMP_SITE_PLAN.md | Approved (user's direction, M2b) |

## 4. The yard

The layout is fixed and flows left to right, so the production chain reads like a sentence:

```
GATE ═▶ PILE ─▶ PROCESSORS ─▶ STORAGE ROW ─▶ MANUFACTURERS ─▶ DISPATCH
                                                              (racks, order board, buyer bay)
[staff hut]   [tool shed]   [supplier office]       [expansion zones behind fences]
```

- The starting area is a small fenced yard: gate, pile, one shredder, two bins, sell pads.
- Locked plots appear as dashed outlines with a price pad, so the player can always see what comes next.
- Expansion zones sit behind fences that come down when bought.

## 5. Controls and interaction

**Desktop.** WASD or arrow keys, read by physical key position so ZQSD works on AZERTY keyboards. Mouse for panels. The game never binds Escape or Ctrl+W.

**Mobile.** A floating joystick: touch anywhere in the left part of the screen and it appears under your thumb. Panels use large tap targets.

**Proximity rules.** Nothing needs a button press:

| Where you stand | What happens |
|---|---|
| On a scrap pile | Scrap moves onto your stack, about 8 items/s, until you're full |
| At a machine's input hopper | Matching items move from your stack into the hopper |
| At a machine's output tray | Output moves onto your stack |
| Beside a bin | Only that bin's material leaves your stack |
| On a sell pad | That bin's or rack's contents sell |
| On a cash pad | Cash drains into the pad. The purchase completes when fully paid; partial payment is kept |
| At a terminal | That machine's upgrade panel opens, and closes when you walk away |

The player can carry a mixed stack. The stack is drawn on the character's back up to a visual limit, with a "+N" label beyond it.

## 6. Core loop (Milestone 1)

1. The supplier truck arrives on a timer and dumps metal scrap onto the pile. The pile has a cap: when it's full, the truck waits at the gate with a "Yard full" bubble.
2. The player picks up scrap (starting carry capacity: 5).
3. They drop it into the shredder hopper.
4. The shredder processes one scrap per cycle (around 3 s) and drops iron and some aluminium onto its output tray.
5. When the tray is full, the shredder stops: red lamp, "Output full".
6. The player collects the mixed output and walks past the bins. Each bin takes only its own material.
7. When a bin is full it turns red and shows "Iron storage full", and the items stay on the player's stack.
8. Standing on a bin's sell pad sells its contents at the raw price.
9. Cash goes to the first upgrade pad, such as carry capacity or shredder speed.

Targets: first sale within ~45 s, first upgrade within ~2 min.

## 7. Systems

### 7.1 Supplier

- **Delivery.** The truck drives in, unloads per its contract, and leaves.
- **Pile cap.** Can be upgraded.
- **Track 1: Supply rate.** Levels alternate between a bigger truck (new sprite) and a shorter interval.
- **Track 2: Contracts.** Unlock plastic scrap and e-waste, and choose the mix at the supplier office (presets such as *Mostly metal*, *Balanced*, *Mostly e-waste*). The mix is a strategic choice matched to your processors.

### 7.2 Processors

| Processor | Input | Base outputs | Extraction tech adds |
|---|---|---|---|
| Shredder | Metal scrap | Iron, Aluminium | Copper |
| Granulator | Plastic scrap | Plastic pellets | — (speed and yield only) |
| Dismantler | E-waste | Copper, Components | Gold |

Each processor has three upgrade tracks:

- **Speed.** Shorter cycle time. The motor visibly spins faster.
- **Yield.** More output per input. Fractional output accumulates, so +10% really means +10%.
- **Extraction.** Unlocks secondary outputs and raises their share. A new output chute appears.

**Mk2 machines** replace Mk1 on the same plot: bigger hopper, faster base speed, new look.

**States.** Each machine shows one at all times, with a lamp and an icon:

| State | Lamp | Meaning |
|---|---|---|
| Idle | Grey | Awaiting input |
| Processing | Green | Working; a progress ring shows the cycle |
| Output ready | Yellow | Items waiting on the tray |
| Blocked | Red | Tray full or storage downstream full |
| Paused | Blue | Switched off at its terminal |

### 7.3 Storage

- One bin per material. Starting capacity is around 50, and upgrades make the bin visibly taller.
- Each bin shows a fill gauge and its material's icon.
- **When a bin is full**, nothing can be deposited into it, so the upstream tray fills and the processor blocks. This back-pressure is intentional and always visible.
- Each bin has a sell pad for raw sales.
- **Auto-sell.** A per-material toggle with a "keep N in reserve" setting, available after the buyer contract (M2).

### 7.4 Manufacturing

- Manufacturers sit on plots next to the storage row and pull inputs from bins through feed chutes. The chutes are visible and part of the layout, and nobody hauls inputs.
- Each manufacturer has a recipe list. You choose one active recipe at its terminal.
- Each batch takes time. Output drops onto the tray, and the player (later a worker or conveyor) carries products to the dispatch racks.
- States are the same as processors, plus "Missing: iron", which names the short input.
- **Upgrades:** speed, batch size, and recipe unlocks (gated by business level).
- v1 recipes use raw materials only. Using products as inputs is a post-v1 option.

| Product | Machine | Inputs | Tier |
|---|---|---|---|
| Metal sheet | Press | 3 Iron | 1 |
| Aluminium can | Can line | 2 Aluminium | 1 |
| Plastic crate | Molder | 4 Plastic | 1 |
| Copper wire | Wire drawer | 2 Copper | 1 |
| Electric motor | Assembler | 2 Copper, 1 Iron, 1 Component | 2 |
| Circuit board | Assembler | 2 Components, 1 Gold, 1 Plastic | 2 |

### 7.5 Dispatch and selling

- **Product racks.** One shelf per product, with a capacity and a sell pad.
- **Buyer truck (M2).** Once contracted, it arrives on a timer and buys everything flagged for auto-sell, minus the reserves, from bins and racks. You can watch it load.
- **Prices.** A product is always worth more than its inputs sold raw, and the margin grows with tier (for example ×1.5 at tier 1, ×2.2 at tier 2). Set in config.
- **Order board (M4).** Up to three optional orders, such as "40 metal sheets + 10 cans → bonus cash, expires in 10 min". You fulfil one by standing at the board, which draws from the racks. Orders refresh over time, and higher tiers appear as products unlock. Ignoring an order costs nothing but the bonus.

### 7.6 Transport and automation

Each step is bought in this order:

1. **Hand carry.** Capacity 5, with upgrades.
2. **Handcart, then large cart.** Player gear from the tool shed. The cart is drawn behind the player and raises capacity a lot.
3. **Workers.** Hired at the staff hut and given one fixed route each (pile → shredder, shredder → bins, manufacturers → racks). Upgrades raise their capacity and speed. They're paid once when hired; there are no wages in v1.
4. **Conveyors.** Built on predefined routes through cash pads, with the route shown as a ghost outline until bought. They move more than workers, with items visible on the belt. Speed upgrades.
5. **Sorter.** Sits where processors meet the bins and sends mixed output to the right bin.
6. **Buyer contract.** Turns on auto-sell.
7. **Late game.** Mk2 machines, plus a priority mode where a manufacturer switches recipes to keep stock targets.

**What the player does once the yard is automated:** buys and builds at cash pads, picks contracts and recipe priorities, fulfils orders, and carries rare salvage crates. These occasionally arrive in deliveries, only the player can carry them, and opening one at the workbench gives bonus cash or materials.

### 7.7 Progression

- **Objectives.** One is active at a time, shown at the top of the HUD. The first ~10 are the tutorial ("Pick up scrap", "Feed the shredder", "Sort iron and aluminium", "Sell 10 iron", "Buy the carry upgrade"…). Each pays a cash reward. They never block play, and hint arrows can be turned off.
- **Business level.** Rises with lifetime earnings and gates expansion zones, Mk2 machines, contracts and recipes. Shown as a bar in the HUD.
- **Yard expansions.** Three zones in v1: Plastics wing, E-waste wing, Logistics yard.

### 7.8 Offline progress

- On return, after a load or after the tab has been hidden for more than 60 s, only the automated parts run, for up to 2 h: workers, conveyors, auto-selling, and machines that have input. Nothing the player would have done by hand happens.
- A summary shows what happened: "While you were away: +$X, 120 iron…", including the cap.
- There is no offline progress until the first automation is bought, so the early game stays active.

### 7.9 Economy principles

- Every number lives in config.
- Costs grow geometrically (base × growth^level), with growth of roughly 1.15–1.6 per track.
- Target cadence: an upgrade every 1–3 min early, every 3–6 min mid-game.
- Manufacturing beats selling raw at every tier.
- No negative money, no wages and no failure states in v1. Pressure comes from bottlenecks and opportunity cost.

### 7.10 UI and feedback

- **HUD.** Cash, business-level bar, current objective, sound toggle, menu. Nothing else stays on screen.
- **In the world.** Machine lamps and progress rings, tray contents, bin gauges, floating "+$12", and bubbles like the truck's "Yard full".
- **Toasts.** For warnings: at most two at once, with duplicates merged.
- **Panels.** Open at terminals, have large buttons, and close when you walk away.
- **Legibility.** Everything must stay readable at 800×450 with no high-DPI scaling (a CrazyGames requirement).

### 7.11 Audio

- Generated sound effects, a few KB each: pickup, drop, machine loop (one shared loop, louder when near), conveyor hum, truck horn, cash, upgrade, warning.
- Optionally one short music loop, added later.
- Separate toggles for sound effects and music. Everything mutes during ads.

### 7.12 Monetization (built in M5, planned now)

- **Basic Launch:** no ads.
- **Rewarded ads**, never on the gameplay screen, and always with a non-ad alternative:
  - "Rush delivery" at the supplier terminal.
  - "Double prices for 3 min" at the buyer bay.
  - "Double offline earnings" on the return summary.
- **Midgame ads** only at natural breaks: after an order completes or an expansion unlocks. Never in the first ~5 min of play; the SDK enforces its own rate limit.

### 7.13 Art direction

- Isometric view: diamond ground tiles; machines, bins, fences and characters show two side faces and are depth-sorted by how far down the screen they stand, so the worker can walk behind them. See [ART_DIRECTION.md](ART_DIRECTION.md).
- Drawn in code: stylised, clean shapes, bold outlines, a warm industrial palette.
- Each material has its own colour and its own icon shape, so it stays readable for colour-blind players. Proposed colours: iron blue-grey, aluminium silver, copper orange, plastic teal, components green, gold yellow.
- Style details will be matched to the reference images (pending from the user).

### 7.14 Out of scope for v1

Free building placement, glass and vehicle scrap, products as recipe inputs, wages and upkeep, machine breakdowns, multiplayer, leaderboards, in-app purchases.
