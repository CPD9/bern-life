# Extraction: profiles with evidence

`python -m bernlife extract` turns `data/bundle/pages.jsonl` into `profiles.jsonl` (contract
`contracts/profile.schema.json`) and `relations.jsonl` (the columns of `entity_relation`). Every
value carries a span that is a verbatim substring of its page's stored text, and code checks that
by string matching. The model proposes; the verifier decides.

## Steps
1. **Selectors** (`extract_selectors.py`) read every page. The page name comes from the title with
   the site suffix removed (`Section: <Name> - <Institute>`, `<Name> – <Site>`) and counts only if
   it is also a whole line of the text. On person pages the line after the name is the role, unless
   it is a contact label; if it starts with Department, Institute and the like, it is a unit
   instead. A `University of Bern, <centre>, <group>` line gives one unit per part. The header line
   that repeats the title's site suffix names the institute.
2. **Model pass** (`extract_prompt.py`, `extract_model.py`) reads person, unit, project,
   infrastructure, listing and other pages by default (`--kinds` changes this). On listing and other
   pages it is asked only for the people the page names. One call per window of
   at most 8,000 characters of whole lines, at most 4 windows per page, role `extract`,
   temperature 0, prompt `extract-v1`, all through the cached router. The page is sent as
   delimited data. The prompt names the kind of page and the fields wanted, never a person. The
   model returns `{value, span}` pairs for the page's own subject and a list of the people the page
   names.
3. **Verifier** (`verify.py`) keeps a proposal only if every check passes. Otherwise it is dropped
   and counted:

   | Reason | Check |
   |---|---|
   | `too_long` | span ≤ 300 and value ≤ 200 characters |
   | `span_not_in_page` | the span occurs in the page text exactly (no space, case or accent tolerance) |
   | `value_not_in_span` | the value is non-empty and occurs in the span, ignoring case |
   | `contact_only` | the span or value is more than an `[email]` / `[phone]` token |
   | `wrong_page` | the page is the subject's own page, or the span names the subject |
   | `not_a_name` | a person's name has 2–6 capitalised words, no digits, no AG/GmbH/Lab/Institute |
   | `bad_json` | the reply parses and each item has the `{value, span}` shape |
   | `no_profile` | both ends of a relation are profiles |

   A stored span is always cut from the page text, never taken from the model, and code may adjust
   it in only two ways (`spans.py`). A span that differs from the page only in case is stored as the
   page's own text, and only when that case-insensitive match is unique on the page. A person's role
   whose span does not name them is kept in only two cases. On a `Project team:` / `Projektteam:`
   line, the role must stand in parentheses after the person's name with no other person's name in
   between; the evidence runs from the start of the name to the closing parenthesis. Otherwise the
   role's line must lie at most two lines after a line naming the person; the evidence runs from the
   start of that name line to the end of the role line. Either span is at most 300 characters and
   still names the person. The report counts these as `case_only`, `role_beside_name` and
   `role_below_name`.

   Model failures are counted by their marker (`model_timeout`, `cache_miss`, ...); the run goes
   on. A `leads` relation needs a leadership word in its span (head, lead, Leiter, director, ...);
   otherwise it is kept as `member_of` or `works_on`.
4. **Merge** (`merge.py`) builds one profile per subject. People merge on their name without
   titles, accents, case or punctuation, within one source ("Prof. Dr. Ada Muster" = "Ada Muster").
   UniBE pages merge on the URL without `_eng` / `_ger` (their names differ by language). Other
   sites' pages merge on host and name, and an institute merges on its host. The name and
   `source_url` come from the subject's own page, English first. Ids are `<kind>-<source>-<slug>`.
5. **Relations** (`relations.py`) are `member_of`, `leads`, `works_on`, `operates` and `part_of`,
   each with its own verified span. An end known only by name (a unit in a staff line) is looked up
   among the profiles' names.

The report counts model proposals by field and verdict (kept or the drop reason), states "model
proposals not found on the page: N, all dropped", and counts the kept spans that the page's own text
replaced.

Before writing, the command checks every stored span against its page again and validates every
profile against the contract. It writes nothing if one fails.

## Opportunities: calls, services, spaces
Six sources describe opportunities rather than people. Each is one file in `sources/` (criterion 6):

| Source | What it gives |
|---|---|
| Bern Economic Development Agency | services |
| Innosuisse | calls and services |
| SNSF | calls |
| Switzerland Innovation Park Biel/Bienne | services and spaces |
| Effinger | coworking space and rooms |
| PROGR | rooms and studios for rent |

Their `page_types` mark `call`, `service` and `space` pages and end in a catch-all `listing`.
Without that catch-all, news pages would fall to the path words and become projects. A source
whose page types name only opportunity kinds and listings is an opportunity source:
- its pages never name an institute, so a funder's or a coworking site's header is not read as a
  research unit;
- the model pass on it runs with `--kinds call,service,space`, and its own instruction asks for
  no people.

- **Fields:** `call` asks for funder, deadline, amount, eligibility and expertise; `service` for
  services, eligibility and expertise; `space` for location, size and services
  (`extract_records.fields_for`).
- **Verbatim values:** dates, amounts and sizes are copied as written, and the verifier checks
  them like any value. A deadline written differently from its span is dropped, never parsed.
  Values made of digits ("31.03.2027", "47m2") count as content; only `[email]` / `[phone]`
  tokens and punctuation are contact-only. Replaying E2's extraction with this rule gave
  byte-identical `profiles.jsonl` and `relations.jsonl`.
- **Names:** these sites title pages with a sentence or a "Room | Rooms | Site" path. When the
  title gives no line, the name is a short line of the page: the one holding the title's first
  segment as a word, else the first opening line that shares a word with the title. This
  applies to opportunity pages only.

## Running it
```bash
BERNLIFE_BACKEND=mock python -m bernlife extract
```
The mock backend runs the selectors only: a mock reply is not evidence. `live` needs the endpoint
in `.env` and refuses unless the served `extract` model id contains `70B`; every call is cached
under `data/llm_cache/`. `replay` answers from the cache alone. `--source ID` replaces that source's
lines and keeps the others. `--limit N` reads only N model pages, chosen in sha256 order so the
sample spreads across hosts.

`python -m bernlife check-places --places web/features/world/places.json` confirms that each map
address span occurs on its page and that the recorded page hash is the stored one. It changes
nothing.

## Limits
- An opportunity's short span can drop its context: the SNSF IICT page's amount "up to CHF 5000"
  is verbatim, but it belongs to a preparatory grant mentioned in the same sentence.
- PROGR's room pages load their text in the browser; the server sends the rental overview for
  each, so only the overview is a space.
- People with the same name in one source become one profile.
- DCB's English and German pages pair only when their names are equal; a translated name gives two
  profiles.
- Pages longer than 32,000 characters are read in part by the model (selectors read all).
- Some team pages are classified as person pages (and some person pages as listings) by E1's URL
  rules; such a page yields no subject of its own, and its people come from the model pass.
