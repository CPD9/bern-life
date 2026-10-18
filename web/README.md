# web

The Bern Life world: a game shell (HUD, tab bar, phone) around a three.js view of Bern. Next 16,
React 19, strict TypeScript, Tailwind v4, React Three Fiber. Bun is the package manager.

```bash
bun install
PORT=3012 DEMO_FIXTURES=1 bun run dev   # http://127.0.0.1:3012
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
```

Each lane runs the dev server on its own port (`CONTRIBUTING.md`). The server binds to 127.0.0.1.

## Environment

Read only in `infrastructure/env.ts`.

| Variable        | Meaning                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `ENGINE_URL`    | Engine base URL, e.g. `http://127.0.0.1:8100`. Required unless `DEMO_FIXTURES=1`.           |
| `DEMO_FIXTURES` | `1` renders the invented fixtures from `contracts/fixtures/` instead of calling the engine. |

## Layout

- `app/` routes and the global design tokens (`globals.css`, day and night).
- `features/shell/` HUD, tab bar and the full-screen frame (lane 2a).
- `features/world/` the 3D scene that fills the frame (lane 2b).
- `infrastructure/` code shared between features; the only place that reads `process.env`.

A feature never imports another feature; `app/` composes them.
