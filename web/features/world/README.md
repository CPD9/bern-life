# world

The 3D Bern that fills the shell's canvas (lane 2b).

## Places (`places.json`)

One place per unit in `sources/*.json`, sorted by `id`, except the sources `off-map.json` lists with
a reason. `places.ts` and `off-map.ts` parse them at load and fail with a named error on a broken
entry; `places.test.ts` checks both against `sources/`, so a new source without a place fails until
it gets one or an off-map reason.

| Field                                       | Meaning                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `id`, `name`, `source_id`, `host`           | the unit as listed in `sources/`                                                |
| `kind`                                      | `institute`, `platform`, `centre`, `agency` or `space`; picks the map pictogram |
| `address`                                   | written only from `address_span`                                                |
| `address_span`                              | verbatim text from a stored page of the unit's own host                         |
| `address_url`                               | the page the span was read from, on the unit's own host                         |
| `address_fetched_at`, `address_page_sha256` | `fetched_at` and `sha256` of the crawl snapshot's record for that page          |
| `x`, `z`                                    | position in the map frame of `geography.ts` (1 unit ≈ 20 m)                     |
| `position_method`                           | `address`, or `district` when the unit publishes no address of its own          |

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

### Opportunity places

The opportunity sources (funders, agencies, rooms to rent) that are in Bern stand on the map as an
`agency` (flag) or a `space` (open door). Each address is a span of the source's page in the E4
crawl (`pages.jsonl`), checked by `python -m bernlife check-places`:

| Place        | Span                       | Page                                                                      |
| ------------ | -------------------------- | ------------------------------------------------------------------------- |
| `beda`       | `Münsterplatz 3a`          | `www.berninvest.be.ch/en/start/dienstleistungen.html` (Bern office block) |
| `effinger`   | `Effingerstrasse 10, Bern` | `www.effinger.ch/coworking/`                                              |
| `innosuisse` | `Einsteinstrasse 2`        | `www.innosuisse.admin.ch/en/privacy-policy` (postal address)              |
| `progr`      | `Speichergasse 4`          | `www.progr.ch/de/vermietung/`, inside a sentence, not a whole line        |

Positions follow the frame's own definition: the address's coordinates in the federal building
address register (geo.admin.ch, LV95) minus those of the Zytglogge (Bim Zytglogge 1), divided by
20 m, east to `+x`, north to `-z`. Near the centre this agrees with the hand-drawn landmarks to
within about 100 m. Two places are then moved to the drawn map so they stand on the right side of
it: `beda` 2.2 units west, onto Münsterplatz and clear of the drawn Münster's footprint, and
`innosuisse` 9.5 units east, by the gap between the drawn and the real Aare at that latitude, so it
stays on the east bank where its address is (160 m from the river).

`off-map.json` keeps two sources off the map: SIP Biel/Bienne (`outside-bern`) and SNSF
(`no-stored-address`: none of its 94 stored pages carries a street address, and an address is never
typed from memory). Their results still count as "not on the map".

## Scene

`world-canvas.tsx` fills the shell's canvas slot: ground, district plates, roads and the Aare from
`geography.ts`, a seeded city (`city-plan.ts`, the same layout on every load) and one building of
the same size per building in `buildings.ts`, each with a marker of the same size, and Bärnli, the
player's first agent, as their bear in front of the city hall. People from public pages never appear as figures; they are
entries with sources in a place's panel. Primitives only; `public/world/manifest.json` pins any asset file added later
(`assets.test.ts`).

What makes it Bern (`scene/`): the Old Town as east-west rows of sandstone houses under terracotta
gable roofs, laid along the main street from the Bahnhof under the Zytglogge to the Nydegg
(`old-town-plan.ts`, seeded); the Zytglogge, Münster, Bundeshaus, University main building and
Bahnhof from primitives at their points in `LANDMARKS` (`landmark-plan.ts`); five arched bridges
with piers (`bridge-plan.ts`); the Aare as a smooth curve between darker banks; and district names
as page text over the canvas (`map-labels.tsx`). Landmarks and bridges are one merged mesh, the
houses two instanced meshes, and each flat layer one mesh, so the static city costs fewer draw
calls than before it had any of this. Nothing in it moves.

Settings are read from `<html>`, so the world imports no other feature:

| Attribute                                                | Effect                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `data-theme="night"` (or the OS dark scheme when absent) | night palette and light                                                                             |
| `data-graphics="lite"`                                   | no shadows, a third of the trees, pixel ratio 1, fewer sides on domes, spires, arches and the river |

Light follows the hour in Bern (`sky.ts`). The camera stays between a steep and a shallow view,
within the map; arrows or WASD pan, Q and E turn by 45°, + and - zoom, and mouse or touch drag,
turn and pinch within the same limits. Tab reaches each marker; opening a place eases the camera to
it, and Escape closes the panel. Markers and the agent's button are page buttons placed over the canvas
each frame (`markers/anchor-projector.tsx`). `WorldCanvas` takes `agent` (its name, and its bear
from app/ as `figure(lite)`) and `onAgentOpen()` for a tap, Enter or Space on it.

## Search light-up

The app drives `worldSearch` (`world-search.ts`): `begin()` when a query is sent, `showResults()`
with the `SearchResponse`, `clear()` to reset. While a search runs every marker breathes (no motion
under `prefers-reduced-motion`). With results, `light.ts` maps each result to a building by the host
of its `source_url`: lit markers glow by best rank (1 → 1.0, 2 → 0.85, 3 → 0.7, 4 → 0.55, 5 → 0.4,
then 0.3) and carry that rank as a badge, unlit markers drop to 60 %, and the camera frames the lit
places. Results on no mapped host are counted as "not on the map", never dropped. A place's panel
lists its matches (name, role, why it matches, source).

With `DEMO_FIXTURES=1` the map starts lit with `fixtures/search-glucose.json`: invented people on
real hosts at `/fixture/` paths that do not exist, so the UI labels it FIXTURE and shows those
sources as text, not links.
