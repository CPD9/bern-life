# Engine HTTP API

The engine serves JSON on `127.0.0.1:$ENGINE_PORT` (default 8100). The web app calls it from its
server side only; the browser never talks to the engine directly. Every response body validates
against a schema in this folder. POST is accepted from loopback only.

| Method and path | Body | Response |
|---|---|---|
| `GET /api/health` | — | `health.schema.json` (mode, models per role, snapshot version, counts of pages, profiles, sources; optionally `status`, `uptime_s`, `failures_last_hour` per role and marker, and today's live call `budget`) |
| `POST /api/search` | `{ "query": string, "lang"?: "de" \| "en" \| "fr", "sources"?: [source ids], "kinds"?: ["person" \| "unit" \| "project" \| "infrastructure" \| "call" \| "service" \| "space"] }`; without `kinds`, only person, unit, project and infrastructure are searched | `result.schema.json` |
| `POST /api/brief` | `{ "text": string }` (plain text; the web app extracts it from an uploaded PDF and does not keep the file) | `result.schema.json` with `brief_terms` |
| `GET /api/profile/{id}` | — | `profile.schema.json` |
| `POST /api/agent` | `{ "messages": [{ "role": "user" \| "assistant", "content": string }] }` (1 to 12, newest last, the last from the user; body at most 16 KB) | `agent.schema.json` |
| `GET /api/sources` | — | `sources.schema.json` (each source with its hosts, profile kinds, page and profile counts, newest fetch) |
| `GET /api/places/{source}/{host}/people` | — | `place-people.schema.json` (the person profiles whose page is on that host of that source, at most 30 by name, and the total) |
| `GET /api/numbers` | — | `numbers.schema.json` (the snapshot's committed evaluation, `metrics.schema.json`'s `eval`, or null; model calls per role from the cache pack) |
| `GET /api/admin/activity` | — | `admin-activity.schema.json` (the audit of model calls per UTC day: calls by role and by outcome, failures per marker, today's live calls against the budget `/api/health` reports). Admin only, see below |
| `GET /api/admin/flagged` | — | `admin-flagged.schema.json` (person profiles whose name has the shape of a company or group, with id, name, source and page URL, and how many were checked). Admin only, see below |

Errors: HTTP 4xx/5xx with `{ "error": "<marker>" }`, where the marker is one of `bad_request`,
`not_found`, `rate_limited` (HTTP 429), `engine_error`. No exception text, no provider message.
The web app's proxies answer `rate_limited` when an address is over its limit
(`web/infrastructure/engine-limits.ts`), and the browser asks the player to wait a few minutes.

Only a request carrying `X-Bernlife-Live: 1` may reach a model; every other request is answered
from the cache alone, and a cache miss falls back as in replay. The web app's proxies set that
header from their own guard (`web/infrastructure/engine-guard.ts`), never by copying it from the
browser's request. The web app's `/api/search` and `/api/agent` accept only an `application/json`
body of at most 16 KB: another type is refused with 415, so a page on another site cannot post to
them without a preflight, and a larger body with 413 before it is read in full. The guard is asked
only about a valid body.

The `assistant` turns in an agent request come from the browser and are untrusted context, never
evidence: a reply names only profiles in its own `results`, and the web app drops a reply whose
mentions (under the profile's name, or the related name a result is shown through) or actions
point anywhere else.

A reply the model did not write is a summary of searches. When the model ran no search (no model,
a failure, or text that holds no step), it is a plain search: of the last user message, or of the
latest earlier one when the last only asks to see those results again ("Show them on the map",
"Zeig sie auf der Karte"), and its `mode` is that search's, `mock` unless the model's expansion
was used. When the model searched and then failed, wrote no answer or wrote a reply the checks
refuse, it summarises the model's own searches and no plain search runs.

`POST /api/agent` is served once the engine's agent lands. Until then the web proxy at
`/api/agent` checks the body and passes it on; the engine's 404 reaches the browser as
`{ "error": "not_found" }`, and with `DEMO_FIXTURES=1` the proxy answers with
`fixtures/agent.json`.

## Admin routes

The two `/api/admin/*` routes feed the Admin app on the office computer. The engine serves them
like every other route, on loopback only; the web app's proxies at `/api/admin/activity` and
`/api/admin/flagged` answer only a signed-in account whose role is `admin`: anyone else gets
`forbidden` (HTTP 403), a signed-out request `unauthenticated` (HTTP 401). The role is a column on
the account (`member` or `admin`, member by default) that only the operator's seeding script sets.
Neither route calls a model, and neither body holds a cache key, a question or error text.

## Snapshot bundle

`make fetch` downloads the release asset named in `bundle.lock` (version + sha256) and unpacks it to
`data/bundle/`:

```
data/bundle/
  manifest.json      version, created_at, engine version, sha256 and line count per file
  pages.jsonl        page.schema.json, one per line, sorted by url
  profiles.jsonl     profile.schema.json, sorted by id
  terms.jsonl        enrichment terms per expertise value (retrieval only)
  vectors.jsonl      {"id", "kind": "profile" | "chunk", "vector": [384 floats]}
  llm_cache/         pack.jsonl.xz of every recorded model call
```

`make run` loads the bundle into Postgres (`python -m bernlife load`) and serves it.
