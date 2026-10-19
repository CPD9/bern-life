"""Profiles read back from the claim table, in exactly the shape and order of the bundle.

The page's fetch date travels with every claim (the UI shows when its evidence was read), and is
written back in the bundle's format so a loaded profile and its bundle line are the same bytes.
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import psycopg

from bernlife.extract_records import fields_for

STATEMENT = """
SELECT p.id, p.kind::text, p.source_id, p.source_url, c.field::text, c.position, c.value,
       c.method::text, c.page_url, c.page_sha256, c.span, c.start, pg.fetched_at
  FROM profile p
  JOIN claim c ON c.profile_id = p.id
  JOIN page pg ON pg.url = c.page_url AND pg.sha256 = c.page_sha256
 WHERE p.id = ANY(%s)
 ORDER BY p.id, c.field::text, c.position
"""


def timestamp(moment: datetime) -> str:
    utc = moment.astimezone(UTC)
    if utc.microsecond:
        return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"
    return utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def _claim(row: tuple) -> dict[str, object]:
    evidence: dict[str, object] = {"page_url": row[8], "page_sha256": row[9], "span": row[10]}
    if row[11] is not None:
        evidence["start"] = row[11]
    evidence["fetched_at"] = timestamp(row[12])
    return {"value": row[6], "method": row[7], "evidence": evidence}


def read_profiles(conn: psycopg.Connection, ids: Sequence[str]) -> dict[str, dict[str, object]]:
    profiles: dict[str, dict[str, object]] = {}
    fields: dict[str, dict[str, list[dict[str, object]]]] = {}
    for row in conn.execute(STATEMENT, (list(ids),)).fetchall():
        profile_id, kind, source_id, source_url, field = row[:5]
        if profile_id not in profiles:
            fields[profile_id] = {name: [] for name in fields_for(kind)}
            profiles[profile_id] = {"id": profile_id, "kind": kind, "source_id": source_id}
            profiles[profile_id]["source_url"] = source_url
        if field == "name":
            profiles[profile_id]["name"] = _claim(row)
        else:
            fields[profile_id][field].append(_claim(row))
    return {
        profile_id: {
            "id": profile["id"],
            "kind": profile["kind"],
            "source_id": profile["source_id"],
            "name": profile["name"],
            "source_url": profile["source_url"],
            "fields": fields[profile_id],
        }
        for profile_id, profile in profiles.items()
    }


PLACE_PEOPLE_LIMIT = 30
# A place on the map is one site of a source (its host); a person belongs to it when the page the
# profile was extracted from is on that host. Names are compared as stored, so the order is stable.
PLACE_PEOPLE = """
SELECT p.id, count(*) OVER ()
  FROM profile p
 WHERE p.source_id = %s AND p.kind = 'person'
   AND lower(substring(p.source_url from '^https?://([^/:?#]+)')) = lower(%s)
 ORDER BY p.name, p.id
 LIMIT %s
"""


def place_people(
    conn: psycopg.Connection, source_id: str, host: str, limit: int = PLACE_PEOPLE_LIMIT
) -> tuple[list[dict[str, object]], int]:
    """The person profiles of one place, at most `limit`, and how many it holds in all."""
    rows = conn.execute(PLACE_PEOPLE, (source_id, host, limit)).fetchall()
    ids = [row[0] for row in rows]
    profiles = read_profiles(conn, ids)
    total = rows[0][1] if rows else 0
    return [profiles[profile_id] for profile_id in ids if profile_id in profiles], total
