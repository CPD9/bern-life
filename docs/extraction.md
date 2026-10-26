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
   that repeats the title's site suffix names the institute. A page whose name is exactly a
   listing heading (`listing_names.py`: "Services", "Dienstleistungen", "Thesis Projects", "Core
   Facilities", "Group Leaders", ...) has no subject of its own, like a listing page: the URL
   rules file it as a service or project page, but it lists many. The people it names still come
   from the model pass.
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
sample spreads across hosts. `--list-kinds` prints the pages whose kind the source files would
change now and calls nothing (see "Page kinds by URL").

`python -m bernlife check-places --places web/features/world/places.json` confirms that each map
address span occurs on its page and that the recorded page hash is the stored one. It changes
nothing.

## Listing headings (2026-10-19)
Replaying E2's extraction with the listing headings removed 35 profiles (16 infrastructure, 18
project, 1 unit: 6 "Services", 4 "Dienstleistungen", 5 "Thesis Projects", ...) and 54 relations
(28 `works_on`, 16 `operates`, 9 `member_of`, 1 `part_of`), and changed no other profile. Before,
these profiles took 26 top-10 slots in 20 gold queries. Gold on a fresh database, same bundle
otherwise: recall@10 0.36 → 0.38, MRR 0.43 → 0.46, invented abstained 8/10 and false abstentions
0/38 unchanged, 0 invented. Dev (checked first): recall@10 0.86 and MRR 0.66 unchanged.

## Page kinds by URL (2026-10-19)
Only the URL decides a page's kind: the crawl writes it into `pages.jsonl` from the source file's
`page_types` (`classify.py`), so a kind can be predicted and corrected without reading the page.
`python -m bernlife extract --list-kinds` prints every stored page whose kind the source files
would change now (`url  old -> new`) and the model windows a re-extraction would send for them,
pages with the same text counted once; it calls nothing. `python -m bernlife crawl --offline
--source <id>` applies the change: it rebuilds that source's lines from the kept HTML, and with
unchanged sources it reproduces `pages.jsonl` byte for byte, so only `kind` moves.

For bundle-5 (#283) `sources/unibe.json` gained three unit patterns and `sources/artorg.json` one:
- A UniBE page one level under `/forschung/` or `/research/`, with or without
  `index_(eng|ger|fre).html`, is a unit page. The person, project and listing patterns stay in
  front of it. A page whose slug holds a word that names a list, an event, a service or an index
  rather than a group keeps its kind; the words stand in the pattern as whole `_`-delimited words
  (de/en/fr): publications, dissertations, seminars, colloquia, meetings, events, conferences,
  workshops, awards, prizes, funding, grants, networks, partners, news, archives, media,
  factsheets, registries, internal, emeriti, former, adjunct, alumni, "the day of", research
  support, and the index pages `research_groups`, `research_programs`, `research_fields`,
  `research_clusters`, `research_group_leaders`, `forschungsgruppen`, `(forschungs)einblicke`.
  The path words of the other kinds (projects, services, facilities, instruments, team,
  members, ...) are in the list too, so a project, infrastructure or listing page keeps the kind
  the path words give it.
- The neuroscience host's lab pages `/research/research_groups/<lab>` and `<lab>/`: 17 labs are
  stored under both URLs with the same text, so the second is a cache hit.
- IAP's sub-group pages `/research/<group>/<subgroup>/index_eng.html`, with the same word list
  (`members` is a listing by the earlier pattern, `research_projects` a project, `publications`
  stays `other`).
- ARTORG's research index `/research/index_eng.html`, the centre's research areas. Its page name
  is "Research": the title gives no other line.

On the bundle-4 pages `--list-kinds` named 144 pages, every one `other -> unit`: 56 one level
under research (IFIK 19, IRM 12, IMG 11, ITP 9, IAP 5), 9 IAP sub-groups, 78 neuroscience lab
URLs (61 labs) and the ARTORG index; 131 model windows over 127 distinct texts. The model pass
sends pages with the same text in a second round (`extract_command.map_twins_last`), after the
first of them has been answered, so a twin URL never costs a second live call.

The live run (`make live ARGS="extract --source unibe --source artorg"`, apertus-v1-5-70b): 2,838
model windows over 2,675 pages, 2,707 answered from the cache, 131 live calls (median 6.8 s, p90
13.6 s), no miss and no failure marker; every call is in `llm_cache/audit.jsonl`. Pages: `other`
1,554 → 1,410, `unit` 183 → 327. Profiles 3,484 → 3,537:
- units 187 → 314. The 127 new units carry 412 expertise, 60 project, 59 infrastructure and 5
  service claims, each a verified span of its page; 119 have at least one claim, 112 an
  expertise claim, 8 none (their pages hold a name and contact lines: the IRM anthropology page
  in English, applied biosafety, the ZEN, the Königsfelden drug trials, non-linear optics,
  predatory bacteria, the neurosurgery research laboratory, stroke).
- people 2,922 → 2,848. The re-read pages were asked for their subject and their people, and the
  reply names fewer people than the `other` prompt did: 98 bare-name profiles from the
  neuroscience and IMG pages are gone (one of them had a claim, a role; none an expertise claim)
  and 24 appear. People with an expertise claim: 222 before and after.
- relations 1,843 → 2,236: `member_of` 1,340 → 1,606 and `part_of` 157 → 284 (each new unit to
  its institute); `leads`, `works_on` and `operates` unchanged.
- The verifier over the whole run, cached replies included: 943 model proposals not found on
  their page, 1,282 values not in their span, 1,123 claims about another page's subject, 280
  names that are not a name, 35 too long, 185 unreadable replies, all dropped.

What happened to the profiles that cited a re-classed page. 240 had one as their own page: 239
people named on a lab or group page (220 without a claim) and the ITP institute profile, whose
name span lies on the TFT page and which stays as it was. The people that the new reply still
names keep their profile and gain a `member_of` relation to the new unit. Profiles that share a
name with a new unit stay beside it, because units merge on their page URL: the IRM divisions
from `/ueber_uns/abteilungen/` (one of them, Anthropologie, without a claim), the IFIK and IRM
service pages under `/dienstleistungen/`, the IFIK `/forschung/` and `/research/` pairs whose
paths differ beyond the language suffix, and ARTORG's AIMI group, which the neuroscience host
lists too. Where two slugs collide the second id in key order ends in `-2`: the `/forschung/`
unit now holds `unit-unibe-anthropologie` and the older one `unit-unibe-anthropologie-2`, while
for traffic sciences the older `/about_us/departments/` unit keeps the bare id. The four IAP
pages `/about_us/people/<group>/` are person pages by URL, so their profiles named after a group
(Biomedical Photonics, Laser Physics, Microwave Physics, Precision Engineering) stay, with the
new units beside them. The four person profiles named like a company (Effra Digital, Kilele
Health, Visage Medical, Biomedical Photonics) stay too: this change reads URLs, not names, the
DCB pages that name the first three are untouched, and the verifier's `not_a_name` check stops
digits and AG, GmbH, Lab or Institute, which these two-word names do not carry.

## Limits
- Navigation pages under /services/ ("FAQ", "Links", "Kontakt", "About us", "Pricing") still
  become infrastructure profiles; only the listing headings in `listing_names.py` are dropped.
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
- IMG's eleven `/forschung/<name>/` pages describe research projects of the institute (the drug
  trials at the PUK Basel, the Lambarene hospital, ...) and are unit pages by the URL rule.
- Index pages stay `other`: ISPM's research groups and themes, the research-groups lists of the
  neuroscience, TKI, PKI and IFIK hosts, and the ITA research index `/forschung/index_ger.html`,
  which is zero levels under. IAP's one three-level page stays `other` too.
