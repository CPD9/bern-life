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
bun run contract:types   # regenerate types after a change in contracts/
```

Each lane runs the dev server on its own port (`CONTRIBUTING.md`). The server binds to 127.0.0.1.

## Environment

Read only in `infrastructure/env.ts`.

| Variable        | Meaning                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENGINE_URL`    | Engine base URL, e.g. `http://127.0.0.1:8100`. Required unless `DEMO_FIXTURES=1`.                                                                                    |
| `DEMO_FIXTURES` | `1` renders the invented fixtures from `contracts/fixtures/` instead of calling the engine.                                                                          |
| `DATABASE_URL`  | Postgres for accounts and messages. Needed only by `/api/auth/*`; tests run against it only when it names a throwaway database (`bernlife_l1`..`l3`, `bernlife_ci`). |
| `APP_ORIGIN`    | The app's own origin for the CSRF origin check, default `http://127.0.0.1:3000`.                                                                                     |

Accounts are invite-only: `bun run invite:create --count 3` prints codes once and stores only their hashes.

## Contract

Engine responses are checked with Ajv against `contracts/*.schema.json`; a body that does not match
is shown as an error, never half rendered. TypeScript types are generated from the same schemas into
`infrastructure/contract-types.generated.ts`; a test fails when they are out of date.

The browser talks only to this app's routes: `POST /api/search` (JSON), `POST /api/brief` (form
data with `text` or a PDF `file`, at most 5 MB and 20 pages, read in memory and not kept; a larger
declared Content-Length is refused with 413 before the body is read) and `GET /api/health` (the
HUD's counts; a count the engine does not report is not shown).

In fixture mode a question that shares a word with the fixture query or its expanded terms
("glucose", "CGM") returns `result.json`; any other question returns the abstained fixture; every
brief returns `result-brief.json`.

## Settings

The phone's Settings app stores night mode, lite graphics and data saver in `localStorage` (key
`bernlife.settings`) and mirrors them on `<html>`, where anything can read them:
`data-theme="day" | "night"` (absent: follow the device), `data-graphics="lite"` and
`data-saver="on"` (absent when off). An inline script applies them before the first paint.

## Layout

- `app/` routes and the global design tokens (`globals.css`, day and night).
- `app/navigator/` the Navigator on its own page, for the jury.
- `features/shell/` HUD, tab bar and the full-screen frame (lane 2a).
- `features/phone/` the phone overlay, its app grid, Settings and the coming-next sheets.
- `features/navigator/` Ask: question and project brief, result cards with evidence, aspect matrix.
- `features/world/` the 3D scene that fills the frame (lane 2b).
- `infrastructure/` code shared between features; the only place that reads `process.env`.

A feature never imports another feature; `app/` composes them.
