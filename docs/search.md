# Search: load, index, hybrid ranking, abstention

`python -m bernlife serve` answers `POST /api/search` (contract `contracts/result.schema.json`)
from Postgres. No model is called yet: the mode is `mock`, `expanded_terms` is empty and the
reason lists the profile's own claim values. E3b adds expansion and explanations on top.

## Commands
```bash
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

## Chunks
- **Profile chunk**, one per profile: the name, then every claim value in contract order.
- **Passages** of every page a profile names as its source or a claim or relation cites: the page
  title plus whole lines, at most 1,000 characters. A passage is verbatim page text, so a claim or
  relation span inside it is found by plain string matching.
- Vectors are stored under the sha256 of the text they were made from (`passage: ` + text), so a
  re-extraction can never reuse a stale vector. `tsv` uses the `simple` configuration: no
  stemming, no language guess.

## Ranking (one SQL statement plus pure code)
1. **Full text:** each query word weighs its BM25 inverse document frequency, so common words in
   any language count little without a stopword list. A chunk scores the weighted `ts_rank` of
   the words it contains.
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
   need three letters, and a short de/en/fr list of function and generic search words ("and",
   "der", "qui", "research", "forscht") never counts. The same test picks the claims the reason
   cites, so every shown result's reason cites a claim that matches. This rule exists because E2's
   final run added 1,241 people who are a bare name from a news or partner page. A passage they
   appear in credits them, and without the rule they would fill the top ten with nothing to show.
   The rule asks whether a result can show its reason, not how prominent it is, so it adds no
   prominence signal.
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
- **Premise check:** a person named after a title (`Prof.`, `Dr.`, `PD`, `Frau`, `Mme` …) must
  be among the candidates' person names. A premise is a hypothesis to check, not a fact.
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
- No stemming: "sensor" does not match "sensors" in full text; the vectors cover some of it.
- Cross-language recall is low (dev translations 0 of 3; gold de 0.16, fr 0.18): e5-small alone
  does not bridge German or French questions to English pages. Query expansion (E3b) targets this.
- An invented name without a title, or an invented project, is caught only by weak support.
- Passages credit profiles only through spans that lie fully inside them, and since rule 5 a
  credited profile still needs a matching claim of its own to be shown.
- Rule 5 matches whole words: "sensors" does not match "biosensors", "psychotropes" does not
  match "psychotroper".
- The API contract has no unit filter, so only `sources` filters. `lang` is accepted and unused.
- Query vectors are computed where the search runs; another CPU can move the last digits.
