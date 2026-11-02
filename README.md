# Scrap Empire

A 2D recycling and manufacturing tycoon for [CrazyGames](https://www.crazygames.com/), built in 3D with Three.js, TypeScript and Vite. Models are Kenney's CC0 packs.

- Game design: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Architecture and milestones: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 (local platform, debug overlay on) |
| `npm run dev:cg` | Dev server with the CrazyGames SDK loaded (its `local` mode) |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run build:cg` | Typecheck and build for CrazyGames to `dist-crazygames/` (adds the SDK script) |

Move with WASD or the arrow keys, or press and drag anywhere for the joystick. The <code>`</code> key toggles the debug overlay; add `?debug` to the URL to show it in production builds.

## Testing on a phone

1. Phone and PC on the same Wi-Fi.
2. `npm run dev:phone` (serves on your network on port 5174; Windows may ask to allow Node through the firewall: allow it for private networks).
3. On the phone, open the `Network:` address it prints, e.g. `http://192.168.1.135:5174`.

Code changes reload on the phone too. Saves on the phone are separate from the PC's.

