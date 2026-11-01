# Scrap Empire — Art Direction

v0.2, 2026-11-01. The game moved from code-drawn isometric pixel art to low-poly 3D (see [3D_PLAN.md](3D_PLAN.md)). The original pixel-art reference, [art/reference-01.webp](art/reference-01.webp), still guides the layout and colours.

## Look

- **Low-poly 3D, like today's idle-arcade tycoons.** Chunky shapes, flat colours from shared palette textures, soft shadows from one warm sun, light fog at the edges.
- **Camera:** perspective, looking north 46° down, following the player, who sits a little below centre. About 300 tiles of ground show on any screen shape.
- **Characters** are Kenney Mini Characters at 1.7× scale, with idle, walk and sprint animations played near their natural pace (faster looks like vibrating). They turn smoothly to face where they're going.
- **The carried stack** sits on the character's back and leans with acceleration. Collected scrap flies onto it; delivered scrap falls in with a bounce.
- **Readability first.** Every material and machine is recognisable by shape *and* colour. Prices, counts and orders are DOM labels, so they stay sharp at 800×450.

## Models

From Kenney's CC0 packs (`public/models/`, credits in `CREDITS.md`). Full packs live outside git in `assets-src/`.

| Use | Model |
|---|---|
| Player, employees | Mini Characters: character-male-a, character-male-c |
| Supplier truck | Car Kit: garbage-truck |
| Buyer trucks | Car Kit: delivery |
| Scrap pieces | Car Kit debris: tyre, door, plate, axle (pipe), drivetrain (engine), nut (gear) |
| Shredder | Factory Kit: machine-fortified with hopper-high-square on top |
| Factory | City Kit Industrial: building-f stretched to the factory's footprint, chimney-large |
| Staff hut, gate booth | City Kit Industrial: building-k |
| Crates | Factory Kit: box-large, box-small |

**Built in code** (`src/view/props.ts`), in the same flat style: bins with visible stacked bars, pads with painted icons, items (bars, sheets, cans, scrap bales), cans and fridges on the dump site, trees, fences, lamp posts, the outlet booth, status lamps and progress rings.

## Palette

| Use | Colour |
|---|---|
| Grass | `#86c25a` |
| Yard floor (dirt) | `#d2b07a` |
| Dump site | `#a5835a` |
| Concrete | `#c3c7cf` |
| Road | `#5d6170`, white dashes |
| Fence | posts `#6d7392`, rails `#8e94b3` |
| Bins | walls `#5f6589`, rim in the material's colour |
| Upgrade pads | green `#2f8f57`; sell pads gold `#c98a1e`; hire and build blue `#3a7bd5` |
| Status lamps | green working, blue output ready, amber waiting, red stuck |

**Materials** (bins, stacks and piles share these):

| Material | Colour | Shape |
|---|---|---|
| Scrap | `#9c8672` | crushed bale |
| Iron | `#7f8ea3` | bar |
| Aluminium | `#dde4ec` | bar |
| Copper | `#e08a45` | bar |
| Metal sheet | `#9fb3cc` | thin plate |
| Can | `#e2534b` | cylinder |

## UI

- Dark navy rounded panels (`#13243a`, border `#2c4766`), light text (`#e8eef6`).
- Pad labels: a small name over the price in gold; grey when locked.
- Truck orders: a white bubble with the product, loaded/wanted, and a patience bar.
- Mobile: floating joystick anywhere, Drop button mid-low left.
