# Scrap Empire — Progression Design

Draft for review, 2026-11-01. Design only; nothing here is implemented yet.

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

- **P1 — Hook (first 5 minutes):** Scrap Dealer, iron-first materials, warm shredder, bigger numbers, rewritten early objectives, free first employee, scripted first truck, coin juice.
- **P2 — Reveal and milestones:** hidden, teased and active states, unlock moments (camera pan, fence drop), level chests and banners, "Next unlock" HUD, rotating goals.

Offline earnings come after, as already planned.

## 6. Decisions for you

1. **Progressive reveal:** hide or tease most of the yard at the start, instead of showing everything?
2. **Scrap Dealer:** one counter that buys all raw metal, replacing the sell pads behind the bins?
3. **Free first employee** from an objective at about 2:40, with paid hires after?
4. **Iron first:** aluminium at level 2, copper at level 4, turning off the equal-outputs testing switch?
5. **Bigger numbers:** scale prices and costs about ×4?
6. **Scripted first truck** the moment the Press makes its first sheets?

## 7. Materials and recipes (user direction, 2026-11-01; to design in detail before P1)

- **Iron only at first.** The shredder gives only iron until upgrades unlock more metals.
- **Rarer metals are worth more.** Each new metal has a lower chance per scrap but a higher price. Upgrading Extraction raises the chance of the valuable ones.
- **Single-metal lines:** 3 iron → 1 sheet; aluminium → 1 can (amount to set).
- **Mixed recipes:** combining metals makes higher-value products, e.g. 2 iron + 1 aluminium → a product worth more than either. More such combinations follow.
