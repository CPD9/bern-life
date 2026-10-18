# Engine HTTP API

The engine serves JSON on `127.0.0.1:$ENGINE_PORT` (default 8100). The web app calls it from its
server side only; the browser never talks to the engine directly. Every response body validates
against a schema in this folder. POST is accepted from loopback only.

| Method and path | Body | Response |
|---|---|---|
| `GET /api/health` | — | `health.schema.json` (mode, models per role, snapshot version, counts of pages, profiles, sources) |
| `POST /api/search` | `{ "query": string, "lang"?: "de" \| "en" \| "fr", "sources"?: ["unibe" \| "artorg" \| "dcb"] }` | `result.schema.json` |
| `POST /api/brief` | `{ "text": string }` (plain text; the web app extracts it from an uploaded PDF and does not keep the file) | `result.schema.json` with `brief_terms` |
| `GET /api/profile/{id}` | — | `profile.schema.json` |

Errors: HTTP 4xx/5xx with `{ "error": "<marker>" }`, where the marker is one of `bad_request`,
`not_found`, `engine_error`. No exception text, no provider message.

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
