# Milestone 3 — Employees and Loading Bay: Plan

Approved 2026-10-31 (decisions 1–4 all yes). M3a (loading bay) and M3b (employees) implemented 2026-10-31. The staff hut is below the dump site. From the user's direction:

- **Employees:** hireable for money; they search for whatever task is needed and do it.
- **Products and trucks:** products come out of the build line, and a new section has trucks arriving to pick them up, each showing the item it wants above it.

## 1. Products come out of the line

Products stop selling the instant they're made (this reverses GAME_DESIGN change P):

- **Output spot.** Each factory line puts its products on an **output spot** in front of its window, up to 8 at a time.
- **Back-pressure.** When a line's spot is full, the line pauses, the same as the shredder's tray. That's the reason to get products out to the trucks, or to hire help.
- **Carrying.** Products are carried like everything else, and the Drop button works on them too.

## 2. The loading bay (new section)

- **Location.** A paved area beyond the factory with **2 truck bays**. The map grows to the right to fit it.
- **Arrivals.** A buyer truck pulls into each empty bay. Above it, a bubble shows **what it wants and how many**, for example a sheet icon with "0/6". The bubble fills up as products are loaded.
- **Loading.** You (or employees) load it by standing at the truck's back with matching products.
- **Payment.** When the truck is full it drives off and pays **more than the base price** (e.g. +25%), with a floating "+$".
- **What gets ordered.** Trucks only ask for products your built lines can make. Before any line exists the bay stays empty.
- **Patience.** A truck waits about 90 s; if it isn't filled it leaves (no penalty) and another comes.
- **Selling to anyone.** A gold sell pad at the bay sells products at the base price, off the walking routes. Products are never a dead end.

## 3. Employees

- **Hiring.** Hire them at a new **staff hut** pad (off routes, stand-still to pay). Costs rise per hire, e.g. $150, $250, $400…, up to 6 employees. They're paid once, with no wages.
- **Look.** Same pixel style as you, in green vests so they're easy to tell apart.
- **Behaviour.** They pick the most useful job they can see, in this order:
  1. **Load a waiting truck** with products from a line's output spot.
  2. **Clear the shredder's output tray** into the bins.
  3. **Collect scrap** from the dump site and feed the shredder (only when its hopper has room).
- **Limits.** They never spend money and never sell. You stay in charge of upgrades and buying.
- **No crowding.** Employees claim jobs, so two don't chase the same piece or tray.
- **Walking.** They find routes around fences, machines and bins (grid pathfinding), walk a little slower than you, and carry what you could at the start.

## 4. Technical notes

- **Save data.** Employees (position, stack, current job) and trucks are saved; save format v9.
- **Pathfinding.** A* on the 50 × 30 tile grid, cached per destination, cheap enough for 6 employees on a Chromebook.
- **Tests:**
  - lines pausing when their output spot is full
  - truck orders, loading, payment and patience
  - hiring costs
  - each employee job, and two employees never taking the same job
  - routes avoiding obstacles
  - no dead ends, and pads off routes
  - the migration
- **Balance runner.** Rerun it; the bot also hires employees.

## 5. Decisions

1. **Products from the line** (no instant selling, line pauses when full). OK to reverse change P?
2. **Trucks** pay +25% over base, 2 bays, about 90 s patience, no penalty for letting them go?
3. **Employees** cost $150 rising, up to 6, no wages, never spend or sell?
4. **Order of build:** loading bay first (2a), then employees (2b), so each can be played and reviewed on its own?
