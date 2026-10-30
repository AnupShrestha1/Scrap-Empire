# Scrap Empire — Art Direction

v0.1, 2026-10-30. Based on the user's reference, [art/reference-01.webp](art/reference-01.webp). All art is drawn in code (`src/view/art/`) to match it.

## Look

- **Pixel art.** Chunky pixels with a 1-pixel dark outline around characters and props; bright, saturated colours; simple two- or three-tone shading.
- **Camera: isometric,** like the reference's main yard picture. Ground tiles are 2:1 diamonds; upright objects show a lit left face and a shaded right face, and are depth-sorted.
- **Scale.** A tile is a 32×16 art-pixel diamond, shown with each art pixel as 2×2 render pixels (64×32). Characters are 32×40 art pixels. Pixel diamonds step 2 across per 1 down, so edges stay clean.
- **Facing.** Characters have a front pose (facing down-left) and a back pose (facing up-right), mirrored for the other two diagonals.
- **Readability first.** Every material and machine is recognisable by shape *and* colour.

## Palette

| Use | Colours |
|---|---|
| Outline | `#1e1b24` |
| Dirt yard | `#b8855a` base, `#9a6a45` dark, `#cf9e6e` light, grey gravel |
| Asphalt | `#4a4f5c`, lane markings `#e8e2c8` |
| Concrete | `#a4a7a8` with darker slab seams |
| Fence | posts `#3a3f4a`, mesh/rails `#8d96a0` |
| Wood (crates, pallets) | `#c98a4b`, `#9b6233`, `#e2ad6d` |
| Worker | blue cap `#2f6fd1`, red shirt `#d8443a`, jeans `#3a5a9a`, brown boots |
| Machines | steel grey `#7d8794` with safety yellow `#f2c230` and black hazard stripes |
| Trees and grass (outside the fence) | `#3f8a3a`, `#5fae45`, dark `#2a5e2c` |
| Water | `#2f7fc0`, light `#5aa6dd` |

**Materials** (bins, icons and items share these):

| Material | Colour | Shape cue |
|---|---|---|
| Iron | grey-blue `#7f8a99` | bars / ingots |
| Aluminium | light silver `#cfd6dd` | thin sheets |
| Copper | orange `#e07a2e` | ingots, coils |
| Plastic | blue `#2f74d0` | pellets |
| Components | green `#3fae5a` | circuit chips |
| Gold | yellow `#f5c542` | nuggets |

## Objects from the reference

These are the designs to follow as each milestone needs them:

- **Supplier truck:** blue cab, open grey bed piled with scrap (M1).
- **Scrap piles:** mixed dark heap with orange rust, tyres and blue bits; size grows with the count (M1).
- **Processor:** grey machine with yellow panels, hopper on top and an output belt (M1).
- **Material bins:** open containers in material colours, contents visible and rising with fill (M1).
- **Conveyors:** dark grey belt with lighter chevrons showing direction (M3).
- **Manufacturing station:** red roof, brick-and-blue-window factory with a chimney (M2).
- **Product storage:** pallets of coloured crates (M2).
- **Dispatch truck:** white box truck with red cab (M2).
- **Forklift:** yellow, for the late transport upgrade (M3+).
- **Automation unit:** yellow robot arm on a steel base (late game).
- **Yard dressing:** lamp posts, a guard booth at the gate, chain-link fences, trees and water around the edges.

## UI

- Dark navy rounded panels (`#13243a`, border `#2c4766`), light text (`#e8eef6`).
- Top-bar chips with an icon plus a value (cash with a gold coin, etc.).
- Storage list rows: material icon, name, `120/200`; progress bars in green `#5cc84a`.
- Mobile: joystick bottom-left. There is no interact button, because transfers happen by proximity.

## Not taken from the reference

- The "E – Interact" key: interaction is by proximity.
- The day clock and play/fast-forward buttons: they make the game feel idle rather than active.
- Glass and rubber, which are deferred past v1 in the design doc.
