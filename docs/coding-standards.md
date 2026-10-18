# Coding standards

Rules a machine enforces, then rules a reviewer enforces. A rule listed as enforced has a config
line behind it once its package lands.

## Everywhere
- Small modules (under ~200 lines) and small functions. Names over comments; comments only say
  **why**. Every non-obvious module opens with a short comment on why it is shaped that way.
- No dead code, no TODO, no placeholders, no speculative options, no emoji.
- Pure functions by default. Network, database and file writes live in clearly named effectful
  functions at the edges.
- Tests inject dependencies (fakes passed in, no module patching), assert exact values, and a new
  test fails on the old code. Fixtures are invented and describe no real person.
- Anything built from a set (crawl order, threads, dict iteration) is sorted by a stable key before
  it is written, so two runs produce the same bytes.
- Configuration is read in one place per package (`engine/src/bernlife/config.py`,
  `web/infrastructure/env.ts`), lazily, and fails fast with a named error when a required value is
  missing.
- Never show a raw exception or provider error to a user, and never store one. Log it server-side;
  store a marker (`"engine_error"`); show a plain sentence and a retry.

## Python (`engine/`, `eval/src/`)
- Python 3.12, standard library first. Third-party packages need the brief or Peter's OK
  (agreed: `psycopg[binary]`, `fastembed`, `jsonschema`).
- `ruff check` and `ruff format --check` clean; tests with `python -m unittest`.
- Type hints on public functions; `dataclass(frozen=True)` for records.
- SQL lives in the module that owns the table access, as plain parameterised strings. The Prisma
  schema in `db/` is the only schema; an integration test checks the engine's queries against a
  migrated throwaway database.

## TypeScript (`web/`, `db/`)
- Strict TypeScript, no `any` (lint error), inline type imports, `const` by default, no parameter
  reassignment.
- Folder by feature (`web/features/search/`). A feature does not import another feature; shared
  code lives in `web/infrastructure/`.
- `process.env` only in `web/infrastructure/env.ts`.
- Prettier owns formatting, ESLint owns correctness, `--max-warnings=0`.
- Responses from the engine are parsed against the contract before rendering; a response that does
  not parse is an error state, not a partial render.

## UI
- Calm and precise: generous whitespace, one accent colour, numbers that explain themselves.
- Check every screen at 1440 and 390 px, light and dark, no horizontal scroll at 390.
- Contrast ≥ 4.5:1, visible focus ring, full keyboard operation, `prefers-reduced-motion` respected.
- Evidence is always one click away: every claim on screen can show its span and source link.
- Screenshots: headless Chrome, demo or fixture data only.
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1440,1000 --virtual-time-budget=8000 --screenshot=out.png URL`
