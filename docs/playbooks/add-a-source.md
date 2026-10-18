# Add a source

A new institution is one JSON file in `sources/` and one command. No code changes.

## 1. Write the file

`sources/<id>.json`, validated against `contracts/source.schema.json`. The worked example is the
invented fixture `contracts/fixtures/source.json`:

```json
{
  "id": "example",
  "name": "Example Institute (fixture, not a real site)",
  "sites": [
    {
      "host": "www.example-institute.test",
      "unit": "Example Institute for Engineering",
      "seeds": ["https://www.example-institute.test/"],
      "allow_paths": ["/team/", "/research/"],
      "deny_paths": ["/login"]
    }
  ],
  "crawl": { "max_pages_per_site": 50, "delay_s": 1.0, "max_depth": 3 },
  "page_types": [
    { "kind": "person", "url_pattern": "^https://www\\.example-institute\\.test/team/[a-z-]+$" }
  ]
}
```

- **One site per host.** Each host is one unit, so exposure is measured per unit. Seeds must be on
  their site's host.
- **allow_paths / deny_paths** are path prefixes. With `allow_paths` set, only those paths are
  followed; seeds are always fetched, so a `/` seed can lead to `/team/`. `deny_paths` always wins.
- **page_types** are regular expressions on the full URL, tried in order; the first match sets the
  page kind (`person`, `unit`, `project`, `infrastructure`, `listing`). Pages that match none get a
  kind from path words (`project`, `services`, `team`, ...) or `other`.
- `delay_s` is at least 0.5 s. If robots.txt asks for a longer `Crawl-delay`, that is used.

Check it before crawling:

```bash
python contracts/check.py
```

## 2. Crawl it

```bash
python -m bernlife crawl --source example
```

Only that source's lines in `pages.jsonl` and `events.jsonl` are replaced; the other sources stay
as they were. The crawler reads robots.txt first (a disallowed URL is logged and never fetched),
seeds from the sitemap that robots.txt names (or `/sitemap.xml`), and fetches one page at a time
per host. A host that answers 429, or 403 to robots.txt, is stopped and reported, never retried.

Output, under `BERNLIFE_DATA_DIR` (default `<repo>/data`):

| File | Contents | Leaves this machine? |
|---|---|---|
| `bundle/pages.jsonl` | one page per line, sorted by URL (`contracts/page.schema.json`) | yes, in the bundle |
| `crawl/events.jsonl` | every fetch or skip: url, status, `page:<kind>` or the reason | no |
| `crawl/html/<host>.jsonl.gz` | the fetched HTML, for `crawl --offline` | no, never |

A page line for the fixture site would look like `contracts/fixtures/page.json`. Page text has
navigation, header, footer and cookie banners removed, Unicode whitespace normalised, and e-mail
addresses and phone numbers replaced by `[email]` and `[phone]`. `sha256` is the hash of `text`.

The command ends with a summary for the PR, shaped like this (numbers made up):

```
| source | host | pages | robots skips | errors | left at max | stopped |
|---|---|---:|---:|---:|---:|---|
| example | www.example-institute.test | 12 | 0 | 0 | 0 |  |
```

## 3. Change kinds or text rules without crawling again

After editing `page_types` (or the text rules in `engine/src/bernlife/html_text.py`), rebuild the
pages from the HTML kept by the last crawl, without a single request:

```bash
python -m bernlife crawl --offline --source example
```
