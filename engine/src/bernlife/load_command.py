"""`python -m bernlife load`: the bundle into Postgres, one transaction per source.

Each source's old rows are deleted and its new rows inserted in the same transaction, so a load
is idempotent and a reader never sees half a source. Rows go in one by one: when the database's
own checks (page sha256, verbatim evidence span) refuse a row, the refusal names that row and its
source is rolled back. Refusals print the database's message, never its detail, which can quote
page text.
"""

import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg import sql

from bernlife import config, paths
from bernlife.bundle_files import Bundle, identity, read_bundle, read_vectors
from bernlife.chunks import build_chunks
from bernlife.database import connect
from bernlife.load_rows import chunk_row, claim_rows, page_row, profile_row, relation_row
from bernlife.sources import Source, load_sources
from bernlife.terms import enrichment_by_value

COUNTED_TABLES = ("page", "profile", "claim", "entity_relation", "chunk", "term")
TERM_COLUMNS = ("value", "term", "kind", "lang", "model", "prompt_version")


class LoadRefused(RuntimeError):
    pass


@dataclass(frozen=True)
class Labelled:
    label: str
    table: str
    row: dict[str, object]


def source_rows(
    source_id: str, bundle: Bundle, vectors: Mapping[str, list[float]]
) -> list[Labelled]:
    pages = [page for page in bundle.pages if page["source_id"] == source_id]
    profiles = [profile for profile in bundle.profiles if profile["source_id"] == source_id]
    ids = {profile["id"] for profile in profiles}
    relations = [relation for relation in bundle.relations if relation["from_profile_id"] in ids]
    rows = [Labelled(f"page {page['url']}", "page", page_row(page)) for page in pages]
    rows += [Labelled(f"profile {p['id']}", "profile", profile_row(p)) for p in profiles]
    rows += [
        Labelled(f"claim {label}", "claim", row)
        for profile in profiles
        for label, row in claim_rows(profile)
    ]
    rows += [
        Labelled(f"relation {relation_label(r)}", "entity_relation", relation_row(r))
        for r in relations
    ]
    for chunk in build_chunks(pages, profiles, relations, enrichment_by_value(bundle.terms)):
        try:
            rows.append(Labelled(f"chunk {chunk.id}", "chunk", chunk_row(chunk, vectors)))
        except KeyError:
            raise LoadRefused(f"{source_id}: chunk {chunk.id} has no vector; run embed") from None
    return rows


def relation_label(relation: Mapping[str, object]) -> str:
    return f"{relation['from_profile_id']} {relation['kind']} {relation['to_profile_id']}"


def insert_statement(table: str, row: Mapping[str, object]) -> sql.Composed:
    values = [
        sql.SQL("%s::vector") if column == "embedding" else sql.Placeholder() for column in row
    ]
    columns = [sql.Identifier(column) for column in row]
    if table == "chunk":
        columns.append(sql.Identifier("tsv"))
        values.append(sql.SQL("to_tsvector('simple', %s)"))
    return sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table), sql.SQL(", ").join(columns), sql.SQL(", ").join(values)
    )


def load_source(conn: psycopg.Connection, source: Source, rows: Sequence[Labelled]) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            "INSERT INTO source (id, name) VALUES (%s, %s)"
            " ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
            (source.id, source.name),
        )
        for site in source.sites:
            cur.execute(
                "INSERT INTO site (host, source_id, unit) VALUES (%s, %s, %s) ON CONFLICT (host)"
                " DO UPDATE SET source_id = EXCLUDED.source_id, unit = EXCLUDED.unit",
                (site.host, source.id, site.unit),
            )
        cur.execute("DELETE FROM profile WHERE source_id = %s", (source.id,))
        cur.execute("DELETE FROM page WHERE source_id = %s", (source.id,))
        for item in rows:
            values = list(item.row.values())
            if item.table == "chunk":
                values.append(item.row["text"])
            try:
                cur.execute(insert_statement(item.table, item.row), values)
            except (psycopg.errors.IntegrityError, psycopg.errors.DataError) as error:
                message = error.diag.message_primary or type(error).__name__
                raise LoadRefused(f"{source.id}: {item.label} refused ({message})") from None


def load_terms(conn: psycopg.Connection, terms: Sequence[Mapping[str, object]]) -> None:
    """Enrichment terms belong to no source: replaced as a whole, in one transaction."""
    statement = insert_statement("term", dict.fromkeys(TERM_COLUMNS))
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("DELETE FROM term")
        cur.executemany(statement, [[row.get(c) for c in TERM_COLUMNS] for row in terms])


def table_counts(conn: psycopg.Connection) -> dict[str, int]:
    counts = {}
    for table in COUNTED_TABLES:
        statement = sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
        counts[table] = conn.execute(statement).fetchone()[0]
    return counts


def load(conn: psycopg.Connection, bundle_dir: Path, sources: Sequence[Source]) -> list[str]:
    """Loads every source it can and records the bundle; returns the refusals, if any."""
    bundle = read_bundle(bundle_dir)
    vectors = read_vectors(bundle_dir)
    unknown = sorted({p["source_id"] for p in bundle.pages} - {s.id for s in sources})
    if unknown:
        return [f"bundle has pages of unknown sources: {', '.join(unknown)}"]
    refusals = []
    for source in sources:
        try:
            load_source(conn, source, source_rows(source.id, bundle, vectors))
        except LoadRefused as refusal:
            refusals.append(str(refusal))
    if refusals:
        return refusals
    load_terms(conn, bundle.terms)
    bundle_id = identity(bundle_dir)
    counts = table_counts(conn)
    with conn.transaction():
        conn.execute(
            "INSERT INTO bundle_load (version, sha256, counts) VALUES (%s, %s, %s)",
            (bundle_id.version, bundle_id.sha256, psycopg.types.json.Jsonb(counts)),
        )
    return []


def main(argv: Sequence[str], env: Mapping[str, str] = os.environ) -> int:
    if argv:
        print("usage: python -m bernlife load", file=sys.stderr)
        return 2
    with connect(config.database_url(env)) as conn:
        conn.autocommit = True
        refusals = load(conn, paths.data_dir(env) / "bundle", load_sources())
        if refusals:
            print("\n".join(f"load: {refusal}" for refusal in refusals), file=sys.stderr)
            return 1
        conn.execute("ANALYZE")
        counts = table_counts(conn)
    print("load: " + ", ".join(f"{table} {count}" for table, count in counts.items()))
    return 0
