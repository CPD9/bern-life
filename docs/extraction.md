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
   infrastructure and listing pages by default (`--kinds` changes this). One call per window of
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

Before writing, the command checks every stored span against its page again and validates every
profile against the contract. It writes nothing if one fails.

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
- People with the same name in one source become one profile.
- DCB's English and German pages pair only when their names are equal; a translated name gives two
  profiles.
- Pages longer than 32,000 characters are read in part by the model (selectors read all).
- Some team pages are classified as person pages (and some person pages as listings) by E1's URL
  rules; such a page yields no subject of its own, and its people come from the model pass.
