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
bun run contract:validators   # and the validators
```

Each lane runs the dev server on its own port (`CONTRIBUTING.md`). The server binds to 127.0.0.1.

## Environment

Read only in `infrastructure/env.ts`.

| Variable        | Meaning                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENGINE_URL`    | Engine base URL, e.g. `http://127.0.0.1:8100`. Required unless `DEMO_FIXTURES=1`.                                                                                                                                                                                     |
| `DEMO_FIXTURES` | `1` renders the invented fixtures from `contracts/fixtures/` instead of calling the engine.                                                                                                                                                                           |
| `DATABASE_URL`  | Postgres for accounts, messages, connections and notifications; without it nobody can sign in, and under `DEMO_FIXTURES` Connections lists the DEMO members alone. Tests run against it only when it names a throwaway database (`bernlife_l1`..`l3`, `bernlife_ci`). |
| `APP_ORIGIN`    | The app's own origin for the CSRF origin check, default `http://127.0.0.1:3000`.                                                                                                                                                                                      |

Accounts are invite-only: `bun run invite:create --count 3` prints codes once and stores only their hashes.

## Contract

Engine responses are checked against `contracts/*.schema.json`; a body that does not match is shown
as an error, never half rendered. Ajv compiles the validators ahead of time into
`infrastructure/contract-validators.generated.js`, so no schema is compiled at run time and the
Content-Security-Policy needs no `'unsafe-eval'` (only `next dev` allows it, for React's error
stacks). TypeScript types are generated from the same schemas into
`infrastructure/contract-types.generated.ts`; a test fails when either is out of date.

The browser talks only to this app's routes: `POST /api/search` (JSON), `POST /api/brief` (form
data with `text` or a PDF `file`, at most 5 MB and 20 pages, read in memory and not kept; a larger
declared Content-Length is refused with 413 before the body is read) and `GET /api/health` (the
HUD's counts; a count the engine does not report is not shown).

In fixture mode a question that shares a word with the fixture query or its expanded terms
("glucose", "CGM") returns `result.json`; any other question returns the abstained fixture; every
brief returns `result-brief.json`.

## Connections and notifications

Members find each other in Connections. The directory (`GET /api/people`) lists members whose
profile visibility lets you see them, never you; a visit (`GET /api/people/<handle>/office`) follows
the owner's visit visibility and is read-only. `POST /api/connections` asks a member by handle with
a note of up to 280 characters; `POST /api/connections/<id>` accepts, declines or withdraws. A
message or a request leaves an in-app notification (`GET /api/notifications`,
`POST /api/notifications/read`, `PUT /api/notifications/preferences`) that holds a kind and an id,
never text; nothing is sent outside the app. Every change checks the origin, the session and a
per-member limit. Under `DEMO_FIXTURES` three invented members, labelled DEMO, can be visited but
not messaged or asked; their handles (`demo-lena`) hold a hyphen, which sign-up refuses.

## Settings

The phone's Settings app stores night mode and lite graphics in `localStorage` (key
`bernlife.settings`) and mirrors them on `<html>`, where anything can read them:
`data-theme="day" | "night"` (absent: follow the device) and `data-graphics="lite"` (absent when
off). An inline script applies them before the first paint.

## Layout

- `app/` routes and the global design tokens (`globals.css`, day and night).
- `app/navigator/` the Navigator on its own page, for the jury.
- `features/shell/` HUD, tab bar and the full-screen frame (lane 2a).
- `features/phone/` the phone overlay: status bar, home screen and dock, notification centre,
  Settings. `app/phone-apps.tsx` mounts the apps; each is real, none is a placeholder.
- `features/desktop/` the office computer; `app/office-apps.tsx` mounts its apps.
- `features/navigator/` Ask: question and project brief, result cards with evidence, aspect matrix.
- `features/lumi/` the chat with Bärli, your agent; `features/floatie/` Bärli floating beside you.
- `features/connections/` members, requests and office visits; `features/notifications/` the bell,
  toasts and the server's notifications.
- `features/opportunities/`, `features/library/`, `features/garage/`, `features/sources/` the apps
  of the same names. `features/settle/` choosing where your office stands.
- `features/world/` the 3D scene that fills the frame (lane 2b).
- `infrastructure/` code shared between features; the only place that reads `process.env`.

A feature never imports another feature; `app/` composes them.
