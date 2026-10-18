"""The one statement behind a search: full-text and vector hits, credited to profiles.

Full text uses the `simple` configuration (no stemming, no language guess), weighted per query
word by BM25's inverse document frequency, so common words in any language weigh little without a
stopword list. `coverage` is the share of the query's word weight a chunk matches; a word found
nowhere in the corpus keeps its full weight, so a query about something absent covers little.
The vector half is an HNSW cosine scan. Source and kind filters sit inside both scans, and the
word statistics count only the chunks a search over those kinds may read, so adding
opportunities leaves a people search's numbers as they were.

A profile chunk stands for its profile. A passage stands for the page's own subject and for every
profile whose claim or relation span lies inside it. Each profile keeps its best rank per signal,
never a sum, so having more pages gives no advantage.
"""

from collections.abc import Sequence
from dataclasses import dataclass

import psycopg

from bernlife.chunks import chunk_prefixes
from bernlife.load_rows import vector_literal

POOL = 200

STATEMENT = """
WITH query_terms AS (
    SELECT DISTINCT lexeme
      FROM unnest(tsvector_to_array(to_tsvector('simple', %(query)s))) AS lexeme
),
corpus AS (
    SELECT count(*)::float8 AS n FROM chunk
     WHERE split_part(id, '-', 1) = ANY(%(prefixes)s::text[])
),
weighted AS (
    SELECT t.lexeme, q.tq, ln(1 + (corpus.n - df.n + 0.5) / (df.n + 0.5)) AS idf
      FROM query_terms t
     CROSS JOIN corpus
     CROSS JOIN LATERAL (SELECT to_tsquery('simple', quote_literal(t.lexeme)) AS tq) q
     CROSS JOIN LATERAL (
           SELECT count(*)::float8 AS n FROM chunk
            WHERE tsv @@ q.tq AND split_part(id, '-', 1) = ANY(%(prefixes)s::text[])
     ) df
),
total AS (SELECT sum(idf) AS idf FROM weighted),
lexical AS (
    SELECT c.id, sum(w.idf * ts_rank(c.tsv, w.tq, 1)) AS score, sum(w.idf) AS matched
      FROM chunk c JOIN weighted w ON c.tsv @@ w.tq
     WHERE split_part(c.id, '-', 1) = ANY(%(prefixes)s::text[])
       AND (%(sources)s::text[] IS NULL OR c.page_url = ANY(ARRAY(
           SELECT url FROM page WHERE source_id = ANY(%(sources)s::text[]))))
     GROUP BY c.id
     ORDER BY score DESC, c.id
     LIMIT %(pool)s
),
nearest AS MATERIALIZED (
    SELECT c.id, c.embedding <=> %(vector)s::vector AS distance
      FROM chunk c
     WHERE split_part(c.id, '-', 1) = ANY(%(prefixes)s::text[])
       AND (%(sources)s::text[] IS NULL OR c.page_url = ANY(ARRAY(
           SELECT url FROM page WHERE source_id = ANY(%(sources)s::text[]))))
     ORDER BY c.embedding <=> %(vector)s::vector
     LIMIT %(pool)s
),
hits AS (
    SELECT 'lexical' AS signal, id, row_number() OVER (ORDER BY score DESC, id) AS rank,
           matched / (SELECT idf FROM total) AS strength
      FROM lexical
    UNION ALL
    SELECT 'vector', id, row_number() OVER (ORDER BY distance, id), 1 - distance
      FROM nearest
),
owners AS (
    SELECT h.signal, h.rank, h.strength, c.profile_id
      FROM hits h JOIN chunk c ON c.id = h.id
     WHERE c.profile_id IS NOT NULL
    UNION
    SELECT h.signal, h.rank, h.strength, p.id
      FROM hits h JOIN chunk c ON c.id = h.id JOIN profile p ON p.source_url = c.page_url
     WHERE c.profile_id IS NULL
    UNION
    SELECT h.signal, h.rank, h.strength, cl.profile_id
      FROM hits h JOIN chunk c ON c.id = h.id
      JOIN claim cl ON cl.page_url = c.page_url AND strpos(c.text, cl.span) > 0
     WHERE c.profile_id IS NULL
    UNION
    SELECT h.signal, h.rank, h.strength, ends.profile_id
      FROM hits h JOIN chunk c ON c.id = h.id
      JOIN entity_relation r ON r.page_url = c.page_url AND strpos(c.text, r.span) > 0
     CROSS JOIN LATERAL (VALUES (r.from_profile_id), (r.to_profile_id)) AS ends(profile_id)
     WHERE c.profile_id IS NULL
)
SELECT o.signal, o.profile_id, min(o.rank) AS best_rank, max(o.strength) AS strength,
       p.kind::text, p.name, pg.unit
  FROM owners o
  JOIN profile p ON p.id = o.profile_id AND p.kind::text = ANY(%(kinds)s::text[])
  JOIN page pg ON pg.url = p.source_url
 GROUP BY o.signal, o.profile_id, p.kind, p.name, pg.unit
 ORDER BY o.signal, best_rank, o.profile_id
"""


@dataclass(frozen=True)
class Hit:
    signal: str  # "lexical" or "vector"
    profile_id: str
    chunk_rank: int
    strength: float  # coverage for lexical, cosine similarity for vector
    kind: str
    name: str
    unit: str


def fetch_hits(
    conn: psycopg.Connection,
    query: str,
    vector: list[float],
    sources: list[str] | None,
    kinds: Sequence[str],
) -> list[Hit]:
    params = {
        "query": query,
        "vector": vector_literal(vector),
        "sources": sources,
        "kinds": list(kinds),
        "prefixes": chunk_prefixes(kinds),
        "pool": POOL,
    }
    rows = conn.execute(STATEMENT, params).fetchall()
    return [Hit(row[0], row[1], row[2], float(row[3] or 0.0), *row[4:]) for row in rows]
