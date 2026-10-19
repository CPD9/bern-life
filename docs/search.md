# Search: load, index, hybrid ranking, abstention

`python -m bernlife serve` answers `POST /api/search` (contract `contracts/result.schema.json`)
from Postgres. With a model connected (live or replay), the question is expanded first; without
one the mode is `mock` and `expanded_terms` is empty. The top 5 results get Apertus' "why it
matches", checked in code. Every other result, and any explanation that fails a check, keeps the
plain reason listing the profile's own claim values. `POST /api/brief` turns a project brief into
needs and searches each one.

## Commands
```bash
python -m bernlife enrich      # retrieval terms for every expertise value into terms.jsonl
python -m bernlife embed       # vectors for every chunk text into data/bundle/vectors.jsonl
python -m bernlife load        # the bundle into Postgres, one transaction per source
python -m bernlife serve       # the API on 127.0.0.1:$ENGINE_PORT
python -m bernlife predict     # gold queries → $BERNLIFE_DATA_DIR/eval/predictions.jsonl
python -m bernlife calibrate   # abstention signals per dev query (eval/dev.jsonl only)
```
`embed` encodes only texts without a stored vector; `load` refuses a chunk with no vector, so a
clean clone never embeds the corpus. The model is `intfloat/multilingual-e5-small` at a pinned
revision (PROVENANCE.md), downloaded once into `$BERNLIFE_DATA_DIR/models/` and checked by the
sha256 of its ONNX file.

## Expansion and enrichment (retrieval only)
Every model call goes through the cached router (`llm.py`); a rerun or `replay` costs nothing.
Terms help search find pages and are never shown as a fact. Code keeps a term only if:
- its kind is synonym, lay, translation or acronym, and its language is de, en, fr or it;
- it is at most 80 characters with no control characters;
- it differs from what it expands;
- it carries no word of a name the question gives after a title.

- **Enrichment** (role `enrich`, prompt `enrich-v1`): the distinct expertise values, sorted, go to
  the model 25 per call, and each gets up to 4 terms. A reply item counts only if it repeats a
  value of its batch exactly. The terms go to `terms.jsonl` and the `term` table. They are
  appended to the profile chunk, so full text and vectors see them. A claim also matches a
  question through its own terms (rule 5), and the claim value is what gets cited.
- **Query expansion** (role `expand`, prompt `expand-v1`): the question, as data, gives up to 12
  terms grouped under topics copied word for word from the question. A topic that is not words
  of the question is dropped with its terms. The grouping is what `metrics.query_topics` reads.
  The same statement then runs twice, on the question and on the question plus its terms, and
  the four rank lists are fused by RRF. A profile's rank per signal is its best of the two.
  Rule 5 matches claims against the question's words and its terms.
- **Abstention reads the plain question only:** the coverage and similarity of the first
  statement, the signals the thresholds were set on. The thresholds did not change.
- A failed call (marker, cache miss, unreadable JSON) means no expansion: search runs plain and
  the mode says `mock`. `versions.prompts` names `expand-v1` when an expansion was used.

## Why it matches (role `explain`, prompt `explain-v2`)
For each of the top 5 results the model sees, as data, only:
- the question;
- the result's name;
- the claims the plain reason cites (pointer, value and verbatim span).

The claims are numbered, and the model returns at most two English sentences and the numbers it
used; code maps the numbers back to JSON pointers. Asked for pointers directly (prompt
`explain-v1`), the model copied whole claim lines into them and only 33% of explanations passed.
Code keeps the text only if:
- every pointer was offered and exists;
- the text is 1 to 400 characters with no control characters;
- the text is not a non-answer: it contains none of the phrases "do not contain", "does not
  contain", "do not mention", "does not mention" (also spelled "don't" and "doesn't", with either
  apostrophe) or "no information" (whole phrases, not single words);
- every capitalised word inside a sentence occurs in the cited claims (value or span) or the name.

The last check is what stops a name or place from the model's memory. It is the only check on the
words themselves: lowercase words and the first word of a sentence are not compared with anything.
The question is not allowed text: a reply that copied "IRM" from the question about a person whose
cited claim is on gene regulation used to pass. Otherwise the plain reason stays. The calls run in
parallel, are cached per question and claims, and replay byte for byte.
Explanations are English only: German capitalises every noun, which the name check cannot tell
from a name.

`mode` is `live` or `replay` when any model text was used (expansion or explanation), and
`versions.prompts` lists the prompt versions used (`expand-v1+explain-v2`).

## Project briefs (`POST /api/brief`, role `brief`, prompt `brief-v1`)
`{"text": "..."}` (1 to 20,000 characters; the web app extracts it from the PDF and keeps no file)
goes to the model as data and gives up to 6 needs, each a short term with a span copied from the
brief. A need is kept only if its span occurs in the brief word for word, whitespace aside. Each
kept need is expanded and searched like a question. A profile found by several needs keeps its
best rank (then the higher fused score, then its id), and the unit cap applies to the merged list.
A result's reason and explanation answer the need that ranked it best. `brief_terms` lists the
kept needs with their spans, and `query` is the need terms joined by "; ". No kept need, or no
need with a result, abstains with `no_verifiable_source`.

## Kinds: people and opportunities
`POST /api/search` takes an optional `kinds` list. Without it, search covers person, unit,
project and infrastructure, exactly as before opportunities existed:
- **Chunk ids carry their group:** a profile chunk starts with its kind, people passages with
  `page`, and passages cited only by opportunities with `opp`.
- **Word statistics:** the full-text half and its counts read only the requested groups, so
  their numbers are unchanged.
- **Vector half for people:** a search that includes people reads the HNSW index unfiltered,
  takes three times the pool, and drops other kinds' chunks afterwards. A filter inside the scan
  makes Postgres trade the index for an exact scan, whose neighbours differ slightly; that alone
  moved gold before the change.
- **Vector half for opportunities alone:** the scan filters inside.

Gold after loading the six opportunity sources (148 profiles, 1,199 new chunks): recall@10 0.36,
MRR 0.43, invented queries abstained 8/10, false abstentions 0/38, 0 invented, in every language
the same as `bundle-20261019-1`. The top 10 differs in one query (q002b, ranks 9 to 11). A profile
the baseline reached with vector rank 106 drops out. Rebuilding the HNSW graph after inserting
the new vectors shifts approximate neighbours that far down. Reloading the same bundle also
reorders a few results below rank 10.

## Chunks
- **Profile chunk**, one per profile: the name, then every claim value in contract order.
- **Passages** of every page a profile names as its source or a claim or relation cites: the page
  title plus whole lines, at most 1,000 characters. A passage is verbatim page text, so a claim or
  relation span inside it is found by plain string matching.
- Vectors are stored under the sha256 of the text they were made from (`passage: ` + text), so a
  re-extraction can never reuse a stale vector. `tsv` uses the `simple` configuration: no
  stemming, no language guess. Word forms are handled at query time (Ranking, rule 1).

## Ranking (one SQL statement plus pure code)
1. **Full text:** each query word weighs its BM25 inverse document frequency, so common words in
   any language count little without a stopword list. A chunk scores the weighted `ts_rank` of
   the words it contains. A query word of letters only also matches the words its light word
   form (`word_forms.py`) maps to the same form, the comparison rule 5 makes: "Kohlenhydrate"
   finds "Kohlenhydraten", "sensor" finds "sensors", and "species" finds "specie" but never
   "special" or "specialist" (no prefix). Coverage still counts only the exact words, as when the
   abstention thresholds were set.
2. **Vectors:** HNSW cosine over the same chunks (`hnsw.iterative_scan = strict_order`,
   `ef_search = 100`). Source filters sit inside both scans. Without a filter Postgres walks the
   HNSW index; with a selective filter it may choose an exact filtered scan, which is cheaper at
   this size. The filter is never applied after the limit.
3. **Credit:** a profile chunk stands for its profile. A passage stands for the page's own subject
   and for every profile whose claim or relation span lies inside it. Each profile keeps its best
   chunk rank per signal, never a sum, so more pages earn nothing.
4. **Fusion:** reciprocal rank fusion, `Σ 1/(60 + rank)`; `score` carries the fused value and
   both ranks.
5. **Can it say why?** A candidate is shown only if at least one cited claim besides its name
   shares a content word with the query, or the query names it (its whole name, or a titled name
   such as "Prof. Muster" that is part of a person's name). Words are folded for case and accents,
   need three letters and are compared by their light word form: an inflection ending (-e, -en,
   -er, -es, -em, -ern, -s, and a plural -s with the ending under it) comes off while four letters
   stay, so "Kohlenhydrate" matches "Kohlenhydraten" and "psychotropes" matches "psychotroper".
   A short de/en/fr list of function and generic search words ("and", "der", "qui", "research",
   "forscht") never counts, in any of their forms. The same test picks the claims the reason
   cites, so every shown result's reason cites a claim that matches. This rule exists because E2's
   final run added 1,241 people who are a bare name from a news or partner page. A passage they
   appear in credits them, and without the rule they would fill the top ten with nothing to show.
   The rule asks whether a result can show its reason, not how prominent it is, so it adds no
   prominence signal.
   **Through a project (`via`):** a candidate with no matching claim of its own is still shown
   when it works on or leads a project (relation `works_on` or `leads`) that has a matching
   claim. The result then carries `via`: the relation with its verbatim span and page, and the
   project's matching claims inline with their evidence. So the card shows both sentences
   ("Project team: …" and the project's topic), and both can be checked. Its `reason` stays the
   plain one from its own claims, and it is not sent to the explainer. Unit membership
   (`member_of`) does not count: on the dev set it added nothing, and a broad unit would vouch
   for everyone in it.
6. **Unit cap:** at most 4 profiles of one unit in the top 10, where a profile's unit is the unit
   of its source page (the evaluator's exposure definition). A capped profile waits until after
   the top ten. The cap relaxes only when no other unit has a candidate left. There is no
   prominence signal: no page count, no links.
7. The top 20 are returned with their verified profiles and the display-only metrics of
   `docs/metrics.md` (added last; they never reorder). The body has no timings, so the same
   query on the same snapshot gives the same bytes.

## Abstention
`abstained: true, abstain_reason: "no_verifiable_source"` when any check fails:
- **Weak support:** no candidate reaches coverage 0.332 (the share of the query's word weight
  one chunk matches; a word absent from the corpus keeps its full weight) **or** cosine
  similarity 0.824.
- **Premise check:** a person named after a title (`Prof.`, `Dr.`, `PD`, `Frau`, `Mme`, and
  since 2026-10-19 `Pr`, `Pre`, `Dre`, `professeure`, `docteure`, `Prof.in`, `Dr.in`, `Dr.med.`
  …) must be among the candidates' person names. `PR` in capitals is not a title. A premise is a hypothesis to check, not a fact.
- **Nothing can say why:** no candidate passes rule 5 above. The first two checks look at every
  candidate, as they did when the thresholds were set; this one comes after them.

### How the thresholds were set
Only on `eval/dev.jsonl`: 12 queries written from pages no gold query uses (none of the gold
people or proof pages), 3 invented titled names on real topics and 2 off-topic queries. `UNIT_CAP`
and k = 60 were fixed before any run. Gold predictions were first run after the thresholds were
committed. `python -m bernlife calibrate` on the bundle `local-8f34ab8c1fba`:

| id | variant | expect abstain | best coverage | best similarity | unmatched name |
|---|---|---|---|---|---|
| q901 | site | no | 0.713 | 0.870 |  |
| q902 | synonym | no | 0.611 | 0.861 |  |
| q903 | lay | no | 0.402 | 0.857 |  |
| q904 | translation | no | 0.324 | 0.827 |  |
| q905 | site | no | 1.000 | 0.857 |  |
| q906 | translation | no | 0.338 | 0.826 |  |
| q907 | synonym | no | 0.592 | 0.857 |  |
| q908 | site | no | 1.000 | 0.870 |  |
| q909 | site | no | 1.000 | 0.901 |  |
| q910 | translation | no | 0.355 | 0.859 |  |
| q911 | synonym | no | 0.700 | 0.870 |  |
| q912 | lay | no | 0.470 | 0.874 |  |
| q913 | invented | yes | 0.364 | 0.838 | yes |
| q914 | invented | yes | 0.379 | 0.831 | yes |
| q915 | invented | yes | 0.382 | 0.817 | yes |
| q916 | invented | yes | 0.294 | 0.822 |  |
| q917 | invented | yes | 0.326 | 0.811 |  |

Similarity 0.824 is the midpoint between the highest off-topic query (0.822) and the lowest
answerable one (0.826). Coverage 0.332 is the midpoint between the highest off-topic coverage
(0.326) and the next answerable coverage above it (0.338). On dev: 5 of 5 abstain, 0 of 12 false
abstentions. The similarity margin is 0.004 wide: e5 similarities crowd together, and two
off-topic queries are thin evidence.

## Plain, enrichment, expansion (bundle with 4,669 terms on 1,352 of 1,362 expertise values)
Thresholds as committed in E3a. Dev first, then gold once. Row (a) on gold is the E3a run below;
with no terms and no model this code reproduced E3a's dev numbers exactly.

| Set | Row | recall@10 | MRR | false abstentions | invented abstained | en / de / fr recall |
|---|---|---|---|---|---|---|
| dev | (a) plain | 0.67 | 0.61 | 1/12 | 5/5 | 0.89 / 0.00 / 0.00 |
| dev | (b) + enrichment | 1.00 | 0.77 | 0/12 | 5/5 | 1.00 / 1.00 / 1.00 |
| dev | (c) + expansion | 1.00 | 0.89 | 0/12 | 5/5 | 1.00 / 1.00 / 1.00 |
| gold | (a) plain | 0.22 [0.10, 0.35] | 0.27 | 4/38 | 8/10 | 0.34 / 0.05 / 0.05 |
| gold | (b) + enrichment | 0.24 [0.12, 0.38] | 0.32 | 1/38 | 8/10 | 0.38 / 0.05 / 0.05 |
| gold | (c) + expansion | 0.27 [0.13, 0.42] | 0.32 | 0/38 | 8/10 | 0.41 / 0.09 / 0.05 |

Traceability stayed 100% and invented entities 0 in every row. The dev language slices are tiny
(2 German and 1 French answerable query), so gold is where German and French are judged, and
there they stay low. Top-10 overlap of translations with their base question rose from 0.09 to
0.36 (Jaccard), so the same people are found more often, but mostly not the expected ones.
Latency with a live expansion call: p50 4.1 s, p95 7.6 s; replayed from the cache it is about
the plain latency, p50 165 ms.

## Reasons through a project (dev extension of 2026-10-18)
`eval/dev.jsonl` gained 10 German and French questions (q918–q927), again from pages and people
no gold query uses:
- six are answered by a person tied to the topic only through a project page or team line;
- four are answered by the person's or unit's own claims.

Thresholds unchanged.

| Set | Row | recall@10 | MRR | false abstentions | invented abstained | en / de / fr recall |
|---|---|---|---|---|---|---|
| dev (27) | (c) expansion | 0.73 | 0.61 | 1/22 | 5/5 | 1.00 / 0.57 / 0.50 |
| dev (27) | + reasons through a project | 0.86 | 0.66 | 1/22 | 5/5 | 1.00 / 0.71 / 0.83 |
| gold | (c) expansion | 0.27 [0.13, 0.42] | 0.32 | 0/38 | 8/10 | 0.41 / 0.09 / 0.05 |
| gold | + reasons through a project | 0.36 [0.20, 0.53] | 0.43 | 0/38 | 8/10 | 0.51 / 0.18 / 0.12 |

On dev, the four questions answered by the person's own claims were found before the change.
None of the six relation-only questions were found before; three are found after. The 12
earlier answerable dev questions keep their ranks. Traceability stayed 100% with 0 invented
entities. All 563 `via` spans and related claims in the dev and gold runs are verbatim on their
stored pages.

Tried on dev and not adopted: abstaining only when both the plain and the expanded signals fall
below the thresholds. It answered q918 (rank 5), but the two off-topic questions stopped
abstaining (3/5 instead of 5/5), so the rule reading the plain signals stays.

## Word forms and French and German titles (dev decision of 2026-10-19)
Decided on `eval/dev.jsonl` under a rule committed before the runs (`eval/PREREGISTRATION.md`,
amendment of 2026-10-19), bundle `bundle-20261019-3`, replay, thresholds unchanged.

| Set | Row | recall@10 | MRR | false abstentions | invented abstained | en / de / fr recall |
|---|---|---|---|---|---|---|
| dev | base | 0.86 [0.73, 1.00] | 0.66 | 1/22 | 5/5 | 1.00 / 0.71 / 0.83 |
| dev | + titles + word forms | 0.91 [0.77, 1.00] | 0.66 | 1/22 | 5/5 | 1.00 / 0.71 / 1.00 |
| gold | base | 0.38 [0.22, 0.56] | 0.46 | 0/38 | 8/10 | 0.55 / 0.18 / 0.12 |
| gold | + titles + word forms | 0.40 [0.23, 0.57] | 0.44 | 0/38 | 9/10 | 0.56 / 0.20 / 0.12 |

Traceability stayed 100% with 0 invented entities. Titles changed no dev byte. On gold they make
the French premise "la Dre …" abstain. Word forms raise dev MRR from 0.655 to 0.661. On gold, MRR
falls from 0.458 to 0.436, inside the interval: three English questions find their first answer
one rank lower.

## Baseline (no model help), bundle `local-8f34ab8c1fba`
`make eval` on the gold predictions, before and after rule 5:

| Run | recall@10 | MRR | traceable | invented | invented abstained | false abstentions | en / de / fr recall |
|---|---|---|---|---|---|---|---|
| without rule 5 | 0.31 [0.18, 0.48] | 0.29 | 1674/1674 | 0 | 8/10 | 0/38 | 0.42 / 0.16 / 0.18 |
| with rule 5 | 0.22 [0.10, 0.35] | 0.27 | 3086/3086 | 0 | 8/10 | 4/38 | 0.34 / 0.05 / 0.05 |

On the dev set the rule raised MRR from 0.50 to 0.61 with recall unchanged at 0.67, and caused one
false abstention: a French question whose answer's claims are German ("Geschichte psychotroper
Substanzen" for "substances psychotropes") shares no word with it. That is the structural cost on
gold too. A result whose only tie to the question is a passage, a relation span or a phrase in
another language is no longer shown. Showing one would mean a reason that cites nothing that
matches. Expansion terms (E3b) give such queries words that can match claims.

Latency per query over the 48 gold queries (Apple M-series CPU, local Postgres): p50 125 ms,
p95 177 ms, max 219 ms with rule 5, which reads every candidate's profile (p50 69 ms before).

## Limits
- Word forms are inflections only: "Genetik" does not match "genetics", and "Schätzung" does not
  match "schätzt". Full text matches whole word forms, as rule 5 does: "sensor" finds "sensors",
  not "biosensors".
- Cross-language recall stays low (gold de 0.20, fr 0.12 with word forms).
- Known misses on dev: a German question below both thresholds on its plain signals abstains
  although expansion finds the answer (q918); a person credited through a project ranked 11
  (q919, rank 6 since word forms); a project whose claims share no word with the question
  cannot vouch: the project behind q920 says "Kohlenhydraten" only in its name, which rule 5
  never reads.
- The evaluator's traceability check reads profile claims, not `via`; the `via` spans are checked
  here instead (563 of 563).
- An invented name without a title, or an invented project, is caught only by weak support.
- Passages credit profiles only through spans that lie fully inside them, and since rule 5 a
  credited profile still needs a matching claim of its own to be shown.
- Rule 5 matches whole word forms: "sensors" does not match "biosensors".
- The API contract has no unit filter, so only `sources` filters. `lang` is accepted and unused.
- 10 expertise values have no enrichment terms (no valid term in the reply).
- Query vectors are computed where the search runs; another CPU can move the last digits.
