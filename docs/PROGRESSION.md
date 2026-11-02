# Scrap Empire — Progression Design

Approved 2026-11-01. P1 and P2 are built.

**Goal:** a new CrazyGames player is hooked within the first minute and has seen every core system (collect, process, sell, upgrade, automate, manufacture, deliver) within about six minutes. After that, the game keeps a steady drip of new things to want.

## 1. What's clunky today

From the balance bot, which plays perfectly, and from playing:

| Moment | Today | Problem |
|---|---|---|
| First money | ~2:00 (sell 10 iron) | Far too late. The first loop is long, with nothing to celebrate along the way. |
| First upgrade | 0:24 (Carry) | Fine, but then nothing new until 2:18. |
| First employee | 13:23 | Automation is the most exciting part of the genre, and it arrives after most players have left. |
| First buyer truck | 16:28 | Same problem: the bay sits empty and unexplained for 15 minutes. |
| Can line | 22:14 | A 3–4 minute stretch with nothing to buy. |
| Extraction | never | Too expensive for what it gives. |

The problems behind those numbers:

1. **The reward comes too late.** The first loop is collect → walk → shred (2.5 s per scrap) → collect → walk → sort → walk around the bin → stand 2 s → sell. That's 45–60 s of chores before the first coin.
2. **Everything is visible at once.** Nine upgrade pads, an unbuilt factory, empty truck bays, three bins and a hire pad all compete for attention from second one. Nothing feels unlocked because nothing was ever hidden.
3. **The numbers are small.** $2 iron and $25 upgrades don't feel like growing a business.
4. **The best moments come late.** Employees, trucks and the factory all arrive after the 10-minute mark.
5. **No milestones.** Business level is a bar, but reaching a level doesn't do anything you can see.
6. **Too many materials too soon.** The testing switch splits scrap three ways from minute one, which is more to understand on day one.
7. **No reason to come back.** Nothing happens while you're away yet, though capped offline progress is already approved.

## 2. Principles

- **Reward within 20 seconds, and something new every 20–40 seconds** for the first 3 minutes, every 45–90 s up to 10 minutes, then every 2–3 minutes.
- **Show only the next one to three goals.** Everything else is hidden or shown as a locked silhouette. Unlocking is an event.
- **Every unlock is a moment:** the camera pans to it, a fence drops or a building rises, fanfare, a toast, an objective pointing at it.
- **Automation by minute 3.** Watching a hired worker do the chore you just did is the genre's hook.
- **Numbers that grow:** tens of dollars in the first minute, hundreds by minute 5, thousands by minute 15.
- **One new idea at a time.** Each phase adds one system, taught by an objective before the next one appears.

## 3. The first ten minutes, beat by beat

| Time | Beat | What the player sees and does | Reward |
|---|---|---|---|
| 0:00 | Spawn | Standing at the dump-site edge, sparkling scrap all around, an arrow on the nearest piece | — |
| 0:03 | Truck tips scrap | A horn, scrap tumbles across the field: an early spectacle | — |
| 0:05 | First pickup | Pop, the piece flies onto the stack. Objective done | coins fly to the HUD |
| 0:12 | Feed the shredder | It runs fast at first (first 10 scraps at 0.8 s each); iron clanks out | — |
| 0:20 | Sort into the iron bin | — | coins |
| 0:25 | **First sale** at the Scrap Dealer (see 4.2) | A big coin burst; the cash counter rolls up | ~$40 |
| 0:35 | **First upgrade lights up** ("NEW!" sparkle): Carry | Visibly bigger stack | — |
| 1:00 | Magnet | Sweeping the field starts to feel good | — |
| 1:30 | **Business level 2**: "Sorting line unlocked" | The fence by the bins drops: the aluminium bin. The shredder now also gives aluminium (worth more) | level chest |
| 2:00 | Shredder speed, Bin size | Steady upgrades | — |
| 2:40 | **Objective reward: your first employee, free.** "Meet Sam!" | The hut opens and Sam walks out to collect scrap: automation at 3 minutes | a worker |
| 3:30 | **Business level 3**: "Factory unlocked" | The camera pans and the factory rises from its plot (it was a fenced construction site until now). The Press line is cheap | level chest |
| 4:30 | Press makes its first sheets | The **first truck arrives straight away (scripted)** and wants 3 sheets: its bubble and the bay are revealed. Deliver for a big payout | ~$120 |
| 5:30 | Hire a 2nd employee (paid) | Workers now load trucks too | — |
| 6–8 | Supply, Press speed, Yield | — | — |
| 8:00 | **Business level 4**: "Can line and bay 2" | Second line, second bay, copper Extraction appears | level chest |
| 10:00 | Steady state | Several purchases in reach at once; the player chooses | — |

Targets for the balance runner to check:

| Measure | Target |
|---|---|
| First coins | ≤ 0:10 (objective reward) |
| First sale | ≤ 0:30 |
| First upgrade | ≤ 0:45 |
| Purchases in the first 5 minutes | ≥ 8 |
| First employee | ≤ 3:00 |
| First factory line | ≤ 4:30 |
| First order filled | ≤ 6:00 |
| Longest wait for a purchase or unlock, first 10 minutes | ≤ 90 s |

## 4. Systems that make it work

### 4.1 Progressive reveal

Every station, pad and area is in one of three states:

| State | Looks like | When |
|---|---|---|
| **Hidden** | Not there (empty dirt) | More than one level away |
| **Teased** | A dark silhouette or fenced construction site with a sign: "Factory · Business Lv 3" | The next level's unlocks |
| **Active** | Normal | Unlocked |

- Upgrade pads appear one or two at a time as they become useful. A "NEW!" sparkle stays until the first visit.
- At most three teased things at once, so the yard always shows what's next without clutter.
- Areas (sorting, factory, bay, later expansions) unlock with a short camera pan and a fence-drop or build animation.

### 4.2 The Scrap Dealer

A small, friendly buyer's counter (a booth with an awning) beside the bins, replacing the hidden sell pads behind each bin.

- It buys all raw metal you carry: walk up, stand 2 s (the ring fills), and everything sells with one big coin burst.
- The 2-second rule and the off-route rule stay.
- One obvious place to get paid makes the first reward easy to find and satisfying.
- The bins' own sell pads go. Bins become storage for the factory, and the dealer is where raw metal turns into money.

### 4.3 Business levels as milestones

Each level is an event:
- Fanfare, a full-screen banner ("Level 3: Factory unlocked!"), and a **level chest**: a cash bonus plus sometimes a free upgrade level.
- The HUD shows the next level's unlock: "Next: Factory · 62%". The long-term goal is always visible.

| Level | Unlocks |
|---|---|
| 1 | Dump site, shredder (iron only), iron bin, Scrap Dealer, Carry, Magnet |
| 2 | Sorting: aluminium output and bin, staff hut (first employee comes from an objective), Shredder speed, Bin size |
| 3 | Factory + Press line, paid hiring, Supply |
| 4 | Loading bay 2, Can line, Extraction (copper) + copper bin, Press speed |
| 5 | Yield, Can line speed, more employee slots |
| 6+ | Expansions (M4): second dump area, second shredder, new lines |

### 4.4 Materials arrive one at a time

Superseded in detail by section 7 (six metals, Extraction levels, products).

- Iron only at the start.
- Aluminium arrives at level 2, as the first thing that unlocks.
- Copper arrives at level 4, via Extraction.
- This replaces the equal-outputs testing switch, which would be turned off.

### 4.5 A quick start

- **Shredder:** the first 10 scraps process at 0.8 s each, then normal speed (the "warm machine" trick), so the first output appears almost at once.
- **Starting money:** $0 plus a +$10 objective reward on the first pickup, so the first purchase feels within reach.

### 4.6 Bigger numbers

Scale everything about ×4 (prices, costs, rewards) so totals climb into the thousands within ~15 minutes. Same ratios, better feel.

| | Today | Proposed |
|---|---|---|
| Iron / aluminium / copper | $2 / $5 / $8 | $8 / $20 / $32 |
| Sheet / can | $9 / $15 | $40 / $65 |
| Carry Lv 1 | $25 | $50 (first sale ~$40 + $10 reward, so ~0:35) |
| Press line | $120 | $300 at level 3 |
| First employee | $150 | free (objective), then $500 rising |

### 4.7 Juice for the reward moments

- Coins fly from where they're earned to the cash counter, which rolls up.
- Upgrades give a small puff and the stat change floats up ("Carry 5 → 8").
- A filled truck honks and leaves with a confetti burst.
- The first employee's arrival shows a name tag ("Sam") for a few seconds, so workers feel like characters.

### 4.8 Objectives as the spine

The objective chain is rewritten around the beats in section 3. Each objective points at the newest unlock, pays more (scaled ×4), and some pay special rewards (the free employee, a free Magnet level). After the first ten minutes they become **goals**: rotating tasks such as "Fill 3 truck orders", "Shred 200 scrap" or "Hire 3 employees", each with a chest.

### 4.9 Return hooks (later)

- **Offline earnings**, already approved: employees keep working, capped at 2 hours. Shown on return as "While you were away: +$1,240".
- An optional rewarded ad to double offline earnings (M5).

## 5. How to build it

Small enough to take in two steps, each checked with the balance runner against the targets in section 3:

- **P1 — Hook and economy (built 2026-11-01):** Scrap Dealer, the six metals and Extraction (section 7), line slots with recipe pads and the twelve products, six bins, business levels 1–8, warm shredder, bigger numbers, rewritten early objectives, free first employee, scripted first truck.
- **P2 — Reveal and milestones (built 2026-11-01):** hidden, teased and active states, unlock moments (camera pan, fence drop), level chests and banners, "Next unlock" HUD, rotating goals. (Coin juice is already in from R2.)

Offline earnings come after, as already planned.

## 6. Decisions for you

1. **Progressive reveal:** hide or tease most of the yard at the start, instead of showing everything?
2. **Scrap Dealer:** one counter that buys all raw metal, replacing the sell pads behind the bins?
3. **Free first employee** from an objective at about 2:40, with paid hires after?
4. **Iron first:** aluminium at level 2, copper at level 4, turning off the equal-outputs testing switch?
5. **Bigger numbers:** scale prices and costs about ×4?
6. **Scripted first truck** the moment the Press makes its first sheets?

## 7. Metals and recipes (user direction, 2026-11-01)

Six metals, each rarer and more valuable than the last, and products made from any mix of them. Prices are on the ×4 scale of 4.6. All numbers are first drafts for the balance bot to tune.

### 7.1 Metals

Every scrap gives **1 iron**. On top of that, each unlocked metal has a chance of turning up in the same scrap, rolled separately. Iron is the bread and butter; the rare finds are the excitement.

| Metal | Sells for | Unlocks | Chance per scrap when unlocked | Each later Extraction level |
|---|---|---|---|---|
| Iron | $8 | Start | always (1 per scrap) | — |
| Aluminium | $20 | Business Lv 2 | 30% | +4% |
| Copper | $36 | Extraction Lv 1 (needs business Lv 3) | 15% | +2.5% |
| Titanium | $70 | Extraction Lv 3 (needs Lv 5) | 6% | +1.2% |
| Gold | $140 | Extraction Lv 5 (needs Lv 6) | 2.5% | +0.6% |
| Platinum | $300 | Extraction Lv 7 (needs Lv 7) | 1% | +0.25% |

- **Extraction** goes to level 8. Levels 1, 3, 5 and 7 each unlock the next metal; *every* level also raises the chance of all the rare metals already unlocked. That's the "upgrade Extraction to find more valuable metal" loop.
- **What a scrap is worth** (selling raw): $8 with iron only, about $14 once aluminium is in, about $30 with everything unlocked at base chances. Each new metal adds a similar slice, so every unlock feels like a raise.
- A rare find shows off: the bar pops out of the shredder with a sparkle and a "Gold!" toast the first few times.
- Shredder Yield stays as it is: +10% of everything per level.

### 7.2 Products

Each product is a recipe of 2–4 metals. Products sell for about 1.6× what their metals would sell for raw, so manufacturing always beats selling raw. A product becomes available once all its metals are unlocked.

| Tier | Product | Recipe | Metals worth | Sells for | Batch |
|---|---|---|---|---|---|
| I | Metal sheet | 3 iron | $24 | $40 | 4 s |
| I | Can | 2 aluminium | $40 | $65 | 3 s |
| I | Toolbox | 2 iron + 1 aluminium | $36 | $60 | 4 s |
| II | Copper wire | 2 copper | $72 | $115 | 4 s |
| II | Motor | 2 iron + 1 copper | $52 | $90 | 5 s |
| II | Radiator | 2 aluminium + 1 copper | $76 | $125 | 5 s |
| III | Drill bit | 2 iron + 1 titanium | $86 | $140 | 6 s |
| III | Bike frame | 2 aluminium + 1 titanium | $110 | $180 | 6 s |
| IV | Circuit board | 2 copper + 1 gold | $212 | $340 | 7 s |
| IV | Watch | 1 titanium + 1 gold | $210 | $350 | 7 s |
| V | Catalytic converter | 2 iron + 1 copper + 1 platinum | $352 | $560 | 8 s |
| V | Jet engine | 2 titanium + 1 copper + 1 platinum | $476 | $780 | 9 s |

More recipes are just data, so the list can grow later.

**Where products sell.** The prices above are what the **stall** (the outlet) pays, any time, one at a time. A **buyer truck** pays **×1.25** for the products it ordered, so filling orders is the better deal and the stall is the fallback for spare stock. (The ×1.25 truck bonus already exists in the game today; it stays.)

### 7.3 Lines and recipes

Twelve products don't fit one line each, so the factory gets **line slots** and each line makes whatever you choose:

- The factory starts with 1 line (bought at business Lv 3, as in the beat plan) and grows to **4 lines** (bought on the build pad, at Lv 3, 4, 5 and 6).
- One **recipe pad** behind the factory (off every walking route, 2 s stand-still like every pad) opens a recipe card: each line with the unlocked products, their recipes and prices; tap one and that line switches over. A batch in progress is cancelled and its metals go back to the bins; products of the old recipe on the line's spot must be collected first.
- A line pulls its recipe's metals straight from the bins, as today. If a metal is missing it shows "Needs Copper".
- Buyer trucks order products that one of your lines is currently set to make, so orders always make sense.
- One Line speed upgrade speeds every line (one pad instead of four, behind the factory with the recipe pad).

### 7.4 Yard changes this needs

- **Six bins**, one per metal, in a 2 × 3 block between the shredder and the factory. Each appears (from a teased silhouette) when its metal unlocks. With the Scrap Dealer buying raw metal (4.2), bins no longer need sell pads, so they pack tighter.
- **Business levels 1–8** instead of 1–6. Thresholds after the first balance runs: $0, $300, $800, $3,000, $10,000, $25,000, $70,000, $180,000.

### 7.5 Decisions for you

1. **Line slots with a recipe pad** (any line makes any unlocked product), instead of one dedicated line per product?
2. **Random finds** (each scrap rolls for rare metals, with a sparkle on a find) instead of smooth fractional amounts?
3. **The metal and product numbers** above as the starting point for balancing?
4. **Six bins in a block** between the shredder and the factory, appearing as metals unlock?

### 7.6 First balance run (P1 as built)

From `npm run balance` (a bot that plays well but not perfectly):

| Moment | Target | Bot |
|---|---|---|
| First sale | ≤ 0:30 | 0:18 |
| First upgrade | ≤ 0:45 | 0:26 |
| Business level 2 (aluminium, staff hut) | ~1:30 | 2:06 |
| First employee (free) | ≤ 3:00 | 2:15 |
| First factory line | ≤ 4:30 | 3:42 |
| First truck order filled | ≤ 6:00 | 7:14 |
| Copper (Extraction 1) | ~8:00 | 16:28 |

Changes made while tuning: business level thresholds lowered (see 7.4), supply 10 scrap every 16 s, the staff hut opens at business level 2, and "store metal" moved after the first line (bins have no use before it). The bot spends on cheap upgrades before Extraction and line 2, so those come later than a player chasing objectives would get them; worth checking by playing.

### 7.7 P2 as built

- Reveal levels per station are in `src/data/unlocks.ts`; the simulation gates the same things (Shredder speed and Bin size at level 2, Supply at 3, the second loading bay at 4). Solid stations (factory, bins, hut) are never fully hidden: before their level they stand as dark silhouettes with a level sign.
- Level chests: $100, $250, $600, $1,500, $4,000, $10,000, $25,000 for levels 2–8, paid as cash but not counted as earnings.
- Each level-up shows a banner with what it opened and the chest, the camera swings to the biggest thing unlocked for about 2 s, and it pops in with a puff.
- The HUD's level chip says what the next level opens.
- After the objective chain, goals rotate (truck orders, shredding, products, rare finds), each round bigger and better paid.
- A "Sell storage" pad beside the Scrap Dealer opens a card listing each unlocked metal in storage, with "Sell 10" and "Sell all" (user requests).
- Six buyer truck lanes (user request), one opening per business level from 3 to 8; the east gate road is widened to reach them all and the stall moved south of the lanes.

### 7.8 Playtest fixes (2026-11-01)

- **Pads:** the shredder's upgrade pads sit 3 tiles apart well north of it, and Line speed and the recipe pad sit in front of the factory, so no machine hides them from the camera. Pads wait **1 s**, counted only while the player stands still.
- **Shredder capacity** upgrade (+5 hopper, +6 tray per level, from level 1), and a **second shredder** bought for $2,500 at business level 4 on a pad beside its plot.
- **Employees** start at 2 tiles/s carrying 2 (Staff speed and Staff carry upgrades raise them to 4.1 and 8). They now sell overflow so nothing stalls: metal goes to the Scrap Dealer when its bin is full and the tray is filling, and products no truck wants go to the stall when a line is stuck.
- **Trucks** order any unlocked product, avoiding duplicates, weighted towards what lines make (×3) or what the bins can cover (×2). Lines have **Auto** (on by default): with employees, an idle line switches to what waiting trucks need. Picking a product by hand turns Auto off.
- **Look:** ingot-shaped metals that shine more the rarer they are, and the scrapyard cartoon UI from the "Scrap Empire cartoon UI" design canvas.
- **Balance:** with weaker employees the first line still comes at about 4 minutes, but business level 5 moves from about 18 to about 26 minutes in the bot run. Worth tuning (cheaper staff upgrades, or a lower level-5 threshold) after playing.
- **No silhouettes** (user, 2026-11-01): anything not unlocked is simply absent: not drawn and not solid (the simulation rebuilds its walkable map as stations open, moving anyone in the way). Bins appear when their metal is unlocked. What's next is shown on the HUD and the level-up banner instead.

## 8. Balance pass (2026-11-02)

### 8.1 How it's measured

`npm run balance` plays 50 simulated minutes twice: an **efficient** player, and a **casual** one who walks 35% slower and pauses about a second before each decision. The bot plays sensibly: it saves for big unlocks (line slots, the second shredder, the Extraction levels that unlock a metal) when they're under ~90 s of income away, keeps small upgrades in step with its business level, stores the metal its lines and the waiting trucks need, and sells the rest. The report prints level times against targets, purchase gaps per phase, income by source (raw metal, stall products, truck orders, employee sales, objectives, chests), throughput (scrap delivered and shredded, products made, orders filled and missed) and spending. `BALANCE_TIMELINE=1` adds every event.

### 8.2 Targets and results

| Business level | Target (min) | Efficient | Casual |
|---|---|---|---|
| 2 | 1.5–2.5 | 1:51 | 2:26 |
| 3 | 3–5 | 3:27 | 3:50 |
| 4 | 7–10 | 9:01 | 8:46 |
| 5 | 12–16 | 14:36 | 18:26 |
| 6 | 18–24 | 21:34 | 26:26 |
| 7 | 26–34 | 30:52 | 37:46 |
| 8 | 36–46 | 40:19 | after 50 |

| Phase | Longest wait between purchases | Target | Purchases |
|---|---|---|---|
| 0–10 min | 79 s | ≤ 90 s | 20 |
| 10–30 min | 136 s | ≤ 150 s | 36 |
| 30–50 min | 161 s | ≤ 240 s | 26 |

Income grows steadily: about $440/min in the first 5 minutes, $1,600 by minute 12, $2,200 by 30, $5,000+ by 40. Truck orders become the main income after about 10 minutes, as intended; raw metal stays a steady side income. Orders expire rarely (0–4 per 5 minutes against up to 40 filled).

### 8.3 What changed

| | Before | Now | Why |
|---|---|---|---|
| Business levels | $300 / 800 / 3,000 / 10,000 / 25,000 / 70,000 / 180,000 | $300 / 800 / **4,000** / 10,000 / **20,000** / **38,000** / **70,000** | Level 4 came at 5:32 (too early), levels 6–8 at 26, 45 and never |
| Scrap per delivery | 10 | **12** | Early income was capped by scrap supply; casual players slogged between levels 3 and 4 |
| Supply upgrade | +2 scrap / −2 s per step, ×1.7 cost | **+3 / −2.5 s, ×1.6** | Scrap supply was the mid-game bottleneck (deliveries grew only 25 → 36/min) |
| Extraction cost growth | ×1.75 | **×1.55** | It took half of all spending; later metals now arrive on time |
| Truck orders | 4–8 items, 90 s patience | **3–6 items, 150 s** | A third to a half of mid-game orders expired with slow early employees |
| Level chests (2–8) | $100 … $25,000 | $100 / 250 / 600 / **1,200 / 2,000 / 3,500 / 6,000** | Late chests were worth many minutes of income in one lump |
| Late objective rewards | $3,000 / 5,000 / 10,000 / 20,000 | **$2,000 / 2,500 / 3,500 / 5,000** | Same: about one to two minutes of income each |
| Rotating goals | $5,000 × 1.5 per round | **$3,000 × 1.4** | In line with late income |

### 8.4 Still to check by playing

- The bot fills truck orders well; real players may miss more of them early, before employees are upgraded.
- The casual curve runs about 25% behind the efficient one, and reaches level 8 just after 50 minutes. That is about right for a game meant to last more than one session, but worth confirming.
- Offline earnings (not built yet) will add to all of this once they're in.

