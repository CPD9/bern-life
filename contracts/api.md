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
| `GET /api/numbers` | — | `numbers.schema.json` (the snapshot's committed evaluation, `metrics.schema.json`'s `eval`, or null; model calls per role from the cache pack) |

Errors: HTTP 4xx/5xx with `{ "error": "<marker>" }`, where the marker is one of `bad_request`,
`not_found`, `engine_error`. No exception text, no provider message.

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

A reply the model did not write (no model, a failure, or text that holds no step) is a summary of
a plain search: of the last user message, or of the latest earlier one when the last has nothing
to search ("Show them on the map", "Zeig sie auf der Karte"). Its `mode` is still the engine's,
`replay` or `live`; only the mock engine answers `mock`.

`POST /api/agent` is served once the engine's agent lands. Until then the web proxy at
`/api/agent` checks the body and passes it on; the engine's 404 reaches the browser as
`{ "error": "not_found" }`, and with `DEMO_FIXTURES=1` the proxy answers with
`fixtures/agent.json`.

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
