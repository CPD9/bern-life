# db

The one database schema for every lane: Postgres 17 + pgvector, owned by Prisma. The engine reads
and writes these tables with plain SQL (psycopg); the web app will use the generated client.
Table and column names are snake_case in the database.

Needs Docker, [bun](https://bun.sh) and, for `make test`, Python 3.12.

## Run it

```bash
make db-up        # Postgres + pgvector on 127.0.0.1:5433, healthy before it returns
make db-migrate   # prisma migrate deploy against DATABASE_URL
```

`DATABASE_URL` defaults to `postgresql://bernlife:bernlife@127.0.0.1:5433/bernlife`, the same value
as `.env.example`. Set it in your shell to point somewhere else. Running `db-migrate` again prints
`No pending migrations to apply.`

## A throwaway database for your lane

Every worktree shares one compose project (`name: bernlife`), so all lanes use the same container
and keep their work apart in their own database. `NAME` must be `l1`, `l2` or `l3`; anything else
is refused.

```bash
make db-reset-throwaway NAME=l3   # drop and create bernlife_l3
DATABASE_URL=postgresql://bernlife:bernlife@127.0.0.1:5433/bernlife_l3 make db-migrate
make db-drop-throwaway NAME=l3    # after your PR merges
```

## Tables

| Table | What it holds |
|---|---|
| `source`, `site` | one row per `sources/*.json` and per host; a host is one unit |
| `page` | one stored page per URL: text exactly as extraction saw it, its sha256, fetch date |
| `profile` | a person, unit, project or infrastructure |
| `claim` | one value of a profile field (`name`, `role`, `unit`, `expertise`, `projects`, `infrastructure`, `services`) with its evidence span |
| `entity_relation` | person → group → institute, project and infrastructure links, each with an evidence span |
| `place` | a unit as a place on the stylised map (`x`, `z`), positioned by its address (with the span) or by district |
| `term` | enrichment terms for an expertise value; retrieval only, never shown as a fact |
| `chunk` | searchable text with a 384-dimension embedding and a `tsvector` the engine fills |
| `bundle_load` | which snapshot bundle was loaded, when, with row counts |
| `document` | an uploaded PDF: owner, name, sha256, size, pages, visibility. The file itself sits at `$BERNLIFE_DATA_DIR/uploads/<sha256>`, never in the database, git or the bundle |

## Guards in the database

The engine's verifier checks every span. The database checks again, so bad evidence cannot be
stored by any writer:

- `claim` and `entity_relation` reference the page by `(page_url, page_sha256)`. A claim always
  points at the version of the page it was checked against. That page cannot be updated while
  claims cite it (`ON UPDATE RESTRICT`); delete the claims first, or delete the page and they go
  with it.
- `page_sha256_matches_text` requires `sha256` to be the sha256 of `text` as UTF-8.
- `place_address_has_evidence` requires the address, its page URL, span and page sha256 when
  `position_method` is `address`.
- The `verify_evidence_span` trigger rejects a claim or relation whose `span` is not in the page
  text (at `start` when given; offsets count characters, as Python does) with
  `ERROR: evidence span not found in page` (SQLSTATE `23514`). It reads the whole page text,
  because a slice of a compressed long page can cut a UTF-8 character in half.
- `document` accepts only `application/pdf`, a lowercase hex sha256, 1 byte to 10 MB, at least one
  page and a name of 1–255 characters, whatever the web app sends.

Postgres puts the failing row into the error detail of the sha256 check. Log it on the server;
never show it to a user.

## Changing the schema

Migrations are serialised: one open migration PR at a time. Migrate your throwaway database to the
current migrations, edit `prisma/schema.prisma`, then write the next migration from the
difference between that database and the edited schema:

```bash
cd db
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Prisma has no HNSW index type, so it does not know about `chunk_embedding_hnsw_idx` (raw SQL at the
end of the first migration) and every diff proposes `DROP INDEX "chunk_embedding_hnsw_idx"`. Delete
that line from any migration you write. Prisma also does not model the extension, the two checks
or the trigger. It leaves them alone and does not report them.

The same command, run without schema edits, is the drift check: on a migrated database its only
output is that `DROP INDEX` line.
