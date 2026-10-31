# Milestone 2 — Manufacturing and Economy: Plan

Approved 2026-10-30. M2a implemented 2026-10-30; M2b next. Builds on [GAME_DESIGN.md](GAME_DESIGN.md) §7.2–7.5 and §7.7, and [ARCHITECTURE.md](ARCHITECTURE.md) §8.

> **Changed during M2a at the user's direction** (GAME_DESIGN changes O, P, Q): the separate machines and
> product racks below were replaced by **one factory building with production lines**, products **sell the
> moment they are made**, and sell pads moved off the walking routes. Sections 1–3 describe what was built;
> section 3's buyer truck no longer has a job and is proposed for removal (see section 7).

**Goal:** turning metal into products is clearly worth more than selling it raw. The first 20 minutes give a new purchase every 1–3 minutes, and the yard visibly grows from one machine into a small factory.

Like M1, it lands in two reviewable parts:

- **M2a — Factory:** machine plots, the Press and the Can line fed from the bins by chutes, product racks, product selling.
- **M2b — Economy:** business level, the buyer truck with auto-selling, shredder Yield and Extraction (copper), machine upgrades, objectives 9–14, the balance runner.

## 1. Layout (as built)

- **The factory** is a 4×6 brick building with a red roof beyond the bins. Each production line has a window
  with a lamp and a progress ring; "Needs Iron" shows when a line's bin runs short.
- **Lines** are bought in order on the one build pad in front of the factory: line 1 is the Press ($120),
  line 2 the Can line ($300). More lines join in M4.
- **Chutes** run from each bin into the factory wall, appearing when their line is built.
- **Selling raw metal** happens behind the iron bin and in front of the aluminium bin, off every route, after
  a short stand-still. A test checks that no sell pad sits on the routes.

The original plan, kept for reference:



The manufacturing row sits beyond the bins (further along +x), then dispatch at the far end. The chain keeps reading in one direction:

```
pile → shredder → [Iron bin]  ═chute═▶ [Press]    → [Sheet rack]  ┐
                  [Alu bin]   ═chute═▶ [Can line] → [Can rack]    ├→ dispatch bay (buyer truck)
                  [Copper bin] (M2b, sold raw for now)            ┘
```

- **Plots.** Each machine has a fixed plot. Until it's bought, the plot shows as a dashed outline with a cash pad and its price (or "Business level 2" if it's still locked). When paid, the machine appears.
- **Chutes.** Short visible conveyors from a bin to its machine. They're part of the layout and come with the machine.
- **Room for later.** Space stays free for M3 conveyors and M4 machines.

## 2. Manufacturing

- **Machines pull their inputs from the bin through the chute.** That's GAME_DESIGN change F: storage is the hub, so you never carry iron to the press.
- **Batches.** A batch runs when the bin has enough input, takes time, and drops products on the machine's output tray. You carry products to the racks, the same way you carry metal now.
- **States.** Same lamps as the shredder, plus "Missing: Iron" when the bin is short.
- **No recipe picker yet.** Each M2 machine makes one product, so there's nothing to choose. A recipe terminal arrives in M4, when a machine first gets a second recipe.

| Product | Machine | Input | Time | Sells for | Same input sold raw |
|---|---|---|---|---|---|
| Metal sheet | Press | 3 Iron | 4 s | $9 | $6 |
| Aluminium can | Can line | 2 Aluminium | 3 s | $15 | $10 |

Machines cost $120 (Press) and $300 (Can line). The numbers live in config and get tuned by the balance runner.

## 3. Racks and selling

- **Racks.** Product racks work exactly like bins: one per product, with a capacity, drop-off all around, and a gold Sell pad. The same "no dead ends" rule applies, enforced by the same tests.
- **Buyer truck (M2b).** Buy the **Buyer contract** ($200, one-time) and a white box truck arrives at the dispatch bay every 30 s. It buys from every rack and from any bin whose **auto-sell switch** is on, then drives off with cash floating up.
  - **Auto-sell switches.** Each bin and rack gets a small switch pad you step on to flip it. Racks default to on; raw bins default to off, so the buyer doesn't take the iron your press needs.
  - **Holding stock back.** In M2 a switch is only on or off. Keeping some stock back in each container ("reserves") waits for customer orders in M4, which are what make holding stock worthwhile.

## 4. Upgrades and progression (M2b)

- **Business level.** Rises with lifetime earnings at thresholds such as $150, $500, $1,500 and $4,000. Shown as a bar under the cash chip. It unlocks the Can line plot, the Buyer contract and Extraction, so new options arrive at a steady pace and not all at once.
- **Shredder tracks.** The two missing ones from GAME_DESIGN §7.2:
  - **Yield:** +10% output per level. Fractions accumulate, so it's exact.
  - **Extraction:** level 1 adds copper (0.15 per scrap, more per level) and unlocks a copper bin. Copper sells raw at $8 until the wire drawer arrives in M4.
- **Machine upgrades.** A speed pad per machine, and a batch-size pad (+1 product per batch every few levels).
- **Objectives 9–14:** build the Press, make 5 sheets, stock the sheet rack, sell 10 products, buy the Buyer contract, reach business level 3.
- **Save format v5,** with a migration.

## 5. Balance runner (dev tool)

A script that plays the game without graphics. A simple bot repeats the best action it can see: carry scrap, sort, sell, buy the cheapest useful upgrade. Walking takes time based on distance and walking speed. It prints when each purchase and level happens over 30 simulated minutes, so tuning becomes "change a number, rerun, read the timeline" instead of replaying by hand.

## 6. Done when

- [ ] A sheet or can is worth more than its raw inputs, and the balance runner shows players switching to manufacturing by about 6–8 minutes.
- [ ] A purchase every 1–3 minutes for the first 20 minutes (balance runner timeline, then confirmed by playing).
- [ ] With every machine and the buyer running, the player is free to manage instead of carrying everything, but no worse off for helping.
- [ ] No dead ends: tests cover every new container and machine.
- [ ] Saves migrate; 60 fps with the full M2 yard; readable at 800×450.
- [ ] Tried on a real phone (still outstanding from M1).

## 7. Decisions for you

**Open after the factory change:** products now sell instantly, so the buyer truck (section 3) would only
auto-sell raw metal. Proposal: drop the buyer truck from M2b and keep business level, copper, line upgrades,
objectives 9–14 and the balance runner.

Original decisions (approved):

1. **Buying machines on plots.** Machines appear when you pay on their plot. Fine?
2. **Buyer truck.** It buys from racks automatically, and from raw bins only when you switch them on. Fine?
3. **Business level gates.** Some purchases unlock at a business level instead of being available from the start. Fine?
4. **Copper.** In M2 copper is sold raw only, until the wire drawer arrives in M4. Fine?
