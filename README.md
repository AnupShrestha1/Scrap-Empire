# Scrap Empire

A 2D recycling and manufacturing tycoon for [CrazyGames](https://www.crazygames.com/), built with Phaser 4, TypeScript and Vite.

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
