# Dump Site — Plan

Approved and implemented 2026-10-31 (decisions 1–3 all yes). The user's direction: *collecting scrap should be the most fun part. Make the dumping site big, with scrap scattered around for the player to go and pick up.*

This replaces the scrap pile from M1. Everything after the shredder stays the same.

## 1. What it feels like

- **The dump site.** Just inside the gate is a big, open dirt field, about 14 × 14 tiles. It's the largest area in the yard, with tyre tracks, puddles and a few wrecks for character.
- **Deliveries.** The supplier truck backs onto the field and **tips its load**. Pieces of scrap tumble out in arcs and land scattered across the ground. They don't land in one heap.
- **Picking up.** You run around the field collecting pieces. Walking near a piece **pulls it in** (a short magnet) with a pop sound. Quick pickups in a row raise the pitch, so sweeping a cluster feels great. Pieces bounce into the stack on your back.
- **Variety.** Pieces look different (cans, pipes, gears, tyres, car doors, an engine block), so the field always looks like a real dump:

| Size | Examples | Counts as | Takes up |
|---|---|---|---|
| Small | cans, pipes, gears | 1 scrap | 1 slot |
| Big | tyres, car doors, fridges, engine blocks | 3 scrap | 3 slots |

## 2. Rules

- **The field has a cap** of about 150 pieces. When it's full, the truck waits at the gate, as it does now with the pile. That keeps the screen readable and the frame rate high on low-end devices.
- **Putting scrap back (no dead ends).** A drop-off pad at the edge of the field takes carried scrap back; the pieces scatter onto the field again. Per the pad rules, it sits off the walking route and waits for a stand-still.
- **Upgrades.**
  - **New: Magnet,** which widens the pick-up pull.
  - **Changed:** Supply rate brings more pieces per truck.
  - **Unchanged:** Carry still matters, and matters more, because the field is big.
- **Later automation (M3).** Hired workers will roam the field collecting for you. That's the natural next step once picking up by hand is fun but slow.

## 3. Layout

The map grows from 34 × 26 to about 46 × 30 tiles. The dump site takes the gate side of the yard, and the shredder, bins and factory move further along. They get more space between them, which also fixes the crowded labels.

```
GATE ═▶ [   D U M P   S I T E   ] ─▶ shredder ─▶ bins ─▶ factory
        [ scattered scrap, ~14×14 ]   (upgrade pads spread out, all off routes)
```

## 4. Technical notes

- **Pieces are saved data.** Each piece is a position and a kind. 150 pieces add about 5 KB to the save, well inside the 1 MB limit.
- **Deterministic scatter.** Where pieces land comes from a seeded random number stored in the save, so tests can reproduce it.
- **Fast pick-up checks.** Only nearby pieces are checked each tick (spatial lookup), so a full field stays cheap.
- **Save format v8.** The migration turns any scrap left in the old pile into scattered pieces.
- **Tests:** pick-up radius and magnet pull, big pieces filling 3 slots, the field cap, the truck waiting when full, the drop-off pad, deterministic scatter, migration, and the "no dead ends" and "pads off routes" checks.
- **Balance:** rerun the balance runner. The bot walks to the nearest piece.

## 5. Decisions

1. **Big pieces** (worth 3 scrap, take 3 slots)? Recommended: yes, for variety and a reason to choose what to grab.
2. **Magnet** as a new upgrade? Recommended: yes.
3. **Fence:** should the dump site be inside the fenced yard, or a fenced field of its own beside it? Recommended: inside the yard, right past the gate.
