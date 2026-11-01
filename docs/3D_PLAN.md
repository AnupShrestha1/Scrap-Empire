# Scrap Empire — Move to 3D

Approved 2026-11-01. R0, R1 and R2 are done.

**Goal:** replace the 2D isometric pixel art with low-poly 3D in the style of today's trending idle-arcade tycoons: chunky flat-coloured models, soft shadows, a camera that follows the player from a high angle, and items stacked visibly on the character's back. Gameplay, layout, saves and the progression plan (docs/PROGRESSION.md) stay as they are.

## 1. What changes and what doesn't

The simulation was kept separate from rendering from day one, so the move only touches the view.

| Part | Files | Change |
|---|---|---|
| Simulation, data, saves, objectives, staff AI | `src/sim`, `src/data`, `src/save` | **None.** The sim's square grid maps straight onto 3D ground: tile (x, y) becomes world (x, 0, y), one unit per tile. |
| UI (HUD, toasts, Drop button, settings) | `src/ui` | None. It's a DOM overlay and sits on a 3D canvas just as well. |
| Joystick, keyboard, audio, platform SDK | `src/input`, `src/audio`, `src/platform` | None, or a small change to how they attach to the canvas. |
| Tests (111) | `tests/` | Keep passing. Only `iso.test.ts` goes, along with the iso projection. |
| **View** | `src/view` (~2,000 lines, all Phaser) | **Rewritten** in Three.js. |
| Pixel-art pipeline | `src/view/art` | Removed. |

## 2. Engine: Three.js

Phaser is 2D only, so it goes. **Three.js 0.186** replaces it:
- It's a renderer, not a framework, so it fits the existing structure: the sim ticks, and the view reads the state and interpolates.
- It's smaller than Phaser (about 170 KB gzipped against about 350 KB).
- It loads glTF, the format every free pack ships in, out of the box.
- It runs on low-end phones and Chromebooks if we keep to the budget in section 6.

The other option is Babylon.js, a heavier all-in-one engine. It offers nothing this game needs that Three.js lacks.

## 3. Look and camera

- **Style:** low-poly, flat colours from one shared palette texture, no realistic materials. One warm sun with soft shadows, plus a sky-tinted fill light. A light fog at the map edges.
- **Camera:** perspective, about 50° down and offset a little to the side, following the player smoothly. This is the genre's standard view. Pinch or scroll gives a small zoom range. The camera pans to unlocks (progression P2).
- **Readability at 800×450:** big chunky shapes, a bold coloured outline or rim on anything you can interact with, and floating DOM labels for prices and truck orders, kept as they are now.
- **The stack:** carried items pile up behind the character's back and sway as they walk. This is the genre's signature.

## 4. Assets

### 4.1 Free packs (all CC0: free for commercial use, no credit required)

Kenney is the main source, because all its packs share one style and one palette, so the game looks like one world. Other packs only fill gaps.

| Pack | Source | What we'd use | Size |
|---|---|---|---|
| **Car Kit** | [kenney.nl](https://kenney.nl/assets/car-kit) | Supplier tipper, buyer box trucks (40+ cars, trucks and vans; glTF) | 3.4 MB zip |
| **Factory Kit** | [kenney.nl](https://www.kenney.nl/assets/factory-kit) | Factory machines and the press and can lines (140 files, animated). **Not the conveyors**, which we agreed to leave out | to check |
| **City Kit (Industrial)** | [kenney.nl](https://kenney.nl/assets/city-kit-industrial) | Factory building, warehouse, loading bay, chimneys, tanks | to check |
| **Mini Characters** | [kenney.nl](https://kenney.nl/assets/mini-characters) | Player and employees (animated) | to check |
| City Builder Bits (fallback) | [KayKit on itch.io](https://kaylousberg.itch.io/city-builder-bits) | Fences, street props, trees if Kenney lacks them | 4.6 MB zip |
| Quaternius packs (fallback) | [quaternius.com](https://quaternius.com/) | Animated characters if Mini Characters' animations fall short | to check |

Each listing says CC0, but I'll check the licence file inside each zip before using it.

### 4.2 Made in code (no good free match)

The game-specific objects get built from Three.js primitives (boxes, cylinders, bevels) in the Kenney palette, so they match the packs:
- **Scrap pieces** (several shapes: bent pipes, tyres, panels, barrels), drawn with GPU instancing so hundreds stay cheap
- **Shredder** with spinning drums and a shake while it works
- **Material bins** with fill levels you can see
- **Cash pads and charge ring**, the new **Scrap Dealer** booth, the hire pad and the staff hut
- **Metal ingots, sheets and cans** for stacks, trays and line outputs

Free scrapyard packs exist (ithappy's *Junkyard*, TurboSquid's *Junk Yard*), but they're paid and in a different style, so I've left them out.

## 5. Building it

| Step | What | Done when |
|---|---|---|
| **R0 — Look test** | Add Three.js. One small scene: ground, the player walking with a stack, a truck, a code-built shredder and scrap. Measure size and frame rate on desktop and phone width | **Done.** Approved after tuning (zoom, run pace, pad timer, solid trucks) |
| **R1 — Full port** | Every station, staff, trucks, the field, pads, labels, hint arrow, camera follow and the debug overlay in 3D. Remove Phaser and the pixel pipeline | **Done.** 3D is the game at `/`; Phaser removed; 3.0 MB build, 60 fps, ~100–170 draw calls |
| **R2 — Feel** | Factory rebuilt from Factory Kit parts, a livelier shredder, dump-site ground, squash on pickups, coin bursts, truck exhaust, yard decoration (containers, tanks) | **Done.** Open factory hall with working machines, shredder cogs, new dump ground, flying items, coin bursts, dust and exhaust, scenery past the map edge |

Then the progression work (P1 hook, P2 reveal) is built on top in 3D, so unlock moments, the Scrap Dealer and juice are only made once.

## 6. Budget (CrazyGames limits)

CrazyGames' [technical requirements](https://docs.crazygames.com/requirements/technical) set these limits:
- an initial download of 50 MB or less, and **20 MB or less to appear on the mobile homepage**
- gameplay within 20 s
- smooth play on a 4 GB Chromebook

Our targets:
- **Initial download ≤ 8 MB.** Only the models we use are shipped, as compressed GLB, with one shared texture.
- **≤ 150 draw calls and ≤ 150k triangles on screen.** Static scenery is merged, and scrap and coins are instanced.
- **60 fps on desktop, ≥ 45 fps on a mid-range phone.** The pixel ratio is capped at 1.5 on mobile, and shadows have a quality setting.

## 7. Decisions for you

1. **Three.js** in place of Phaser?
2. **Assets:** Kenney as the main style, other CC0 packs only for gaps, and game-specific objects built in code?
3. **Camera:** the genre-standard high-angle follow view with a small zoom range?
4. **Order:** R0 look test → R1 port → R2 feel, then progression P1 and P2 on top?
5. **Downloads:** may I download the four Kenney packs (Car Kit, Factory Kit, City Kit Industrial, Mini Characters) from kenney.nl into a new `assets-src/` folder? They're a few MB each, and I'll report exact sizes. KayKit and Quaternius only if needed.
6. **Reference:** is there a 3D tycoon game whose look you'd like to match? A screenshot would help, as reference-01 did for the pixel art.
