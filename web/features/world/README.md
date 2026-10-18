# world

The 3D Bern that fills the shell's canvas (lane 2b).

## Places (`places.json`)

One place per unit in `sources/*.json`, sorted by `id`. `places.ts` parses it at load and fails with
a named error on a broken entry; `places.test.ts` checks it against `sources/`.

| Field                                       | Meaning                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `id`, `name`, `source_id`, `host`           | the unit as listed in `sources/`                                       |
| `kind`                                      | `institute`, `platform` or `centre`; picks the map pictogram           |
| `address`                                   | written only from `address_span`                                       |
| `address_span`                              | verbatim line from the unit's own contact block                        |
| `address_url`                               | the page the span was read from, on the unit's own host                |
| `address_fetched_at`, `address_page_sha256` | `fetched_at` and `sha256` of the crawl snapshot's record for that page |
| `x`, `z`                                    | position in the map frame of `geography.ts` (1 unit ≈ 20 m)            |
| `position_method`                           | `address`, or `district` when the unit publishes no address of its own |

**Positions are placed by hand from the address and are approximate (street level).** They are not
survey data. A `district` place has no address fields and stands in its district.

How the addresses were read: robots.txt checked, one request at a time with at least 1 s between
requests, at most the home page and one contact page per host. Page text was normalised the way
the crawler stores it (script, style, nav, header and footer dropped, Unicode whitespace collapsed,
block elements on their own lines), and the span is a whole line of that text. The page copies were
not kept. The fetch date and hash come from the crawl snapshot's stored page for the same URL
(`pages.jsonl`), whose text has emails and phone numbers redacted, so the hash identifies the exact
text the span is checked against.

Units at one street address share a building and one marker with a count (`buildings.ts`).
