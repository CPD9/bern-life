# Pre-registration

Frozen before any search code merged. A change to anything below gets a dated entry under
"Amendments" with the reason, and the report shows both the original and the amended number.

## Questions
1. Does the Navigator find the expected people and units? (case criterion 1)
2. Do synonym, lay-term and translated queries find the same people as the site's own wording?
   (criterion 2)
3. Is every result traceable to a public page that supports it, with nothing invented? (criterion 3)
4. Does it say "no verifiable source" when none exists, including under a false premise? (ethics)
5. Is exposure fair across units of different size and across the three sources? (ethics)

## Data
`eval/gold.jsonl`, written from public pages before search existed (see `notes` per line).
Variants: site, synonym, lay, translation, invented, control. Languages de/en/fr. Sources unibe,
artorg, dcb.

## Metrics (computed by `eval/src/`, separate code from the search)
- **recall@10** per query: share of expected people and units found in the top 10. A person matches
  when the result's `source_url` or any evidence `page_url` equals the gold `proof_url` (host + path,
  scheme and trailing slash ignored), or the normalised name matches (case, accents, titles such as
  Prof./Dr. removed), so a hit on another page of the same person counts. A unit matches on its unit
  name or proof URL. Queries with `abstain: true` are excluded. Known spelling variants are listed in
  `GOLD-NOTES.md` and accepted.
- **MRR**: reciprocal rank of the first expected hit, 0 if none in the top 10.
- **Variant agreement**: for each base need, recall@10 of each variant, and the Jaccard overlap of
  its top-10 profile ids with the base query's. Reported as spread, not only the best phrasing.
- **Traceability**: share of result claims (name and every field) whose evidence span is found
  verbatim in the stored page text with the same sha256, and whose page URL is in the snapshot.
  Target 100%; any miss is listed by claim.
- **Field completeness** (criterion 4): for each result, the share of the required fields (person,
  role/affiliation, unit, expertise, projects, infrastructure/services, reason, source link) that are
  filled, against the share the source page could fill, judged on a 30-result human-labelled sample.
- **Invented entities**: count of results whose profile is not in the snapshot (must be 0).
- **Abstention accuracy**: on `invented` queries, share that return `abstained: true`; on non-
  abstain queries, share that do not abstain (false abstention rate). Reported separately.
- **Exposure**: share of top-10 slots per unit and per source over all non-abstain queries, next to
  each unit's share of profiles in the snapshot.
- Every metric per source, per language and per variant, plus pooled.

## Text matching
All span and name comparisons normalise Unicode whitespace (non-breaking and narrow spaces become a
plain space, runs collapse to one) and nothing else: case, accents and punctuation must match for
spans. 14 of the 22 proof pages contain non-breaking spaces.

## Statistics
Results are nested in queries, so 95% intervals come from a bootstrap over queries (2,000 draws,
fixed seed 1), clustered by base need (a base and its variants are resampled together). Proportions
over independent items use Wilson intervals. With roughly 13 base needs, differences between
languages smaller than about 25 points cannot be told apart; we say so instead of ranking them.

## Decision rules
- Criterion 1 is met if pooled recall@10 ≥ 0.80 and the interval's lower bound is reported next to it.
- Criterion 3 is met only at 100% traceability and 0 invented entities.
- Abstention is acceptable at ≥ 9 of 10 invented queries with no more than one false abstention on
  site-wording queries.

## What would count against us
A source or language whose recall@10 is far below the pooled number; any untraceable claim; an
invented person answered with results; exposure concentrated in the largest units.

## Amendments

### 2026-10-19: pages named after a listing heading (#162), measured for bundle-3
Not a change to the questions, data, metrics or rules above; `eval/gold.jsonl` is unchanged. It is
recorded because the snapshot gold is scored on changes. The rule was fixed before the runs:
adopt only if, on `eval/dev.jsonl`, recall@10 and MRR are not lower, traceability stays 100%,
invented entities stay 0 and abstention is not lower. Gold is reported as measurement, whatever
the outcome.

Setup: bundle-20261019-2 against the same bundle with #162's extraction replayed from its own
cache (0 misses; 35 profiles and 54 relations removed, no other profile changed), each loaded into
a fresh database, predictions in replay, no model calls.

| Set | Run | recall@10 | MRR | traceable | invented | invented abstained | false abstentions |
|---|---|---|---|---|---|---|---|
| dev | before | 0.86 [0.73, 1.00] | 0.66 [0.49, 0.83] | 2934/2934 | 0 | 5/5 | 1/22 |
| dev | after | 0.86 [0.73, 1.00] | 0.66 [0.49, 0.83] | 2848/2848 | 0 | 5/5 | 1/22 |
| gold | before | 0.36 [0.20, 0.53] | 0.43 [0.26, 0.59] | 4819/4819 | 0 | 8/10 | 0/38 |
| gold | after | 0.38 [0.22, 0.56] | 0.46 [0.28, 0.63] | 4666/4666 | 0 | 8/10 | 0/38 |

Dev is unchanged query by query, so the rule adopts #162. On gold one query moves (q009: recall@10
0 → 0.8, first hit at rank 1): en 0.51 → 0.55, unibe 0.18 → 0.23, site 0.39 → 0.44; de, fr,
artorg and dcb are unchanged. The gain is inside the interval. Two loads of the same bundle reorder
the top 10 of 3 gold queries without changing any metric.

Built as `bundle-20261019-3` (with tonight's recorded demo, agent and brief calls added to the cache
pack, nothing else changed); `make eval` on it reproduces the "after" gold row above to the digit.

### 2026-10-19: titles in the premise check and German and French word forms (#226), decided on dev
Not a change to the questions, data, metrics or rules above; `eval/gold.jsonl` is unchanged. The
rule was written and committed before any code or run: each change is measured on
`eval/dev.jsonl` against a base run in the same setup (bundle-20261019-3, a fresh database per
run, predictions in replay, no model calls) and adopted only if, on dev, recall@10 and MRR are
not lower, traceability stays 100%, invented entities stay 0, invented queries abstained are not
fewer and false abstentions are not more. The changes are decided in order: (a) French and German
titles in the premise check, against the base; (b) German and French word forms in the lexical
match and the claim rule, against the code the decision on (a) leaves. A change the rule rejects
is reverted. Every variant tried on dev is reported. Gold is run once, after the decision, as
measurement, and reported whatever the outcome; nothing changes after it.

Setup: bundle-20261019-3, predictions in replay, no model calls. The rule above says a fresh
database per run. Instead, every run below shares one fresh load, so a reload cannot reorder
results between runs; a base run on a second fresh load gave the same dev metrics. Expansion
came from the cache for every query (dev 27/27, gold 49/49).
Explanations the cache does not hold show the plain reason, which no metric reads: dev 2 of 94
before and 23 of 97 after, gold 17 of 158 before and 40 of 161 after.

| Set | Run | recall@10 | MRR | traceable | invented | invented abstained | false abstentions | en / de / fr recall@10 |
|---|---|---|---|---|---|---|---|---|
| dev | base | 0.86 [0.73, 1.00] | 0.66 [0.49, 0.83] | 2848/2848 | 0 | 5/5 | 1/22 | 1.00 / 0.71 / 0.83 |
| dev | (a) titles | 0.86 [0.73, 1.00] | 0.66 [0.49, 0.83] | 2848/2848 | 0 | 5/5 | 1/22 | 1.00 / 0.71 / 0.83 |
| dev | (a), word forms in the claim rule only | 0.86 [0.73, 1.00] | 0.66 [0.49, 0.83] | 2872/2872 | 0 | 5/5 | 1/22 | 1.00 / 0.71 / 0.83 |
| dev | (a) + (b), claim rule and full text | 0.91 [0.77, 1.00] | 0.66 [0.50, 0.83] | 2971/2971 | 0 | 5/5 | 1/22 | 1.00 / 0.71 / 1.00 |
| gold | base | 0.38 [0.22, 0.56] | 0.46 [0.28, 0.63] | 4666/4666 | 0 | 8/10 | 0/38 | 0.55 / 0.18 / 0.12 |
| gold | (a) + (b) | 0.40 [0.23, 0.57] | 0.44 [0.26, 0.59] | 4533/4533 | 0 | 9/10 | 0/38 | 0.56 / 0.20 / 0.12 |

Decision on dev:
- **(a) adopted.** The dev predictions are the same byte for byte; the dev premises use only
  `Prof.` and `Dr.`.
- **(b) adopted.** recall@10 0.864 → 0.909 and MRR 0.655 → 0.661, and nothing else moves.
  - q919 is found (rank 6, through its project), and q921, q922 and q923 rise.
  - q901 (rank 1 → 2), q910 (3 → 5) and q924 (2 → 3) fall, so English MRR goes 0.93 → 0.87
    while German goes 0.48 → 0.50 and French 0.46 → 0.53.
  - The abstention signals (`calibrate`) are the same to three decimals.
- **Variants tried on dev.** A first word form (also -n and -x, two passes) and the final one,
  each in the claim rule alone, changed no dev metric. Before any dev run with full text, the
  database unit test showed the first form cut "glucose" to "gluco", a prefix that reaches
  "GlucoPatch". The endings were narrowed then.

Gold, measured once after the decision:
- recall@10 0.384 → 0.397 and MRR 0.458 → 0.436. Both changes are inside the intervals.
- q003b (0 → 0.25) and q003c (0.5 → 0.75) gain.
- q003 (first hit rank 1 → 2), q005 (1 → 2) and q027 (3 → 4) lose rank.
- q017 ("la Dre Céline Morand-Hächler", invented) now abstains through (a).
- The gold MRR loss is what the dev rule could not see. It is reported here, and nothing was
  changed after the gold run.
- The base run on this database reproduces the bundle-3 gold row. Against the bundle's frozen
  predictions, it reorders q017's top 10 and changes q020's.

### 2026-10-19: dev2, and the rule for search levers toward criterion 1 (#226), before any dev2 run
Not a change to the questions, data, metrics or decision rules above; `eval/gold.jsonl` is
unchanged. Written and committed with `eval/dev2.jsonl`, before any search run on dev2.

Why a second dev set: `eval/dev.jsonl` (27 queries) is saturated. Its recall@10 is 0.86 on the base
above and 0.91 after the two adopted changes, with UniBE and English at 1.00. A rule like "not
lower on dev" accepts almost any change and cannot show what lifts gold. Gold stays a test, not a
tuning set.

The set: `eval/dev2.jsonl`, 38 queries (q930 to q967) in the gold schema, with 33 expected entities
(26 people, 7 units), each with a profile of the same name in bundle-20261019-3.

| Source | de | en | fr | site | synonym | lay | translation | invented | total |
|---|---|---|---|---|---|---|---|---|---|
| UniBE | 3 | 8 | 5 | 3 | 3 | 3 | 5 | 2 | 16 |
| ARTORG | 2 | 5 | 3 | 2 | 2 | 2 | 2 | 2 | 10 |
| DCB | 4 | 5 | 1 | 3 | 2 | 3 | 1 | 1 | 10 |
| off-topic | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 2 |
| all | 10 | 19 | 9 | 8 | 7 | 8 | 8 | 7 | 38 |

The 7 invented queries are 5 invented titled names (German, French and English titles) and 2
off-topic questions.

How it was written:
- One writer per source (UniBE, ARTORG, DCB) and one for invented queries. Each saw the stored
  pages of bundle-20261019-3 and the variant definitions, never gold, search results or the miss
  table below. They wrote 56 candidates.
- `python -m evaluator.dev2_check` (`eval/src/evaluator/dev2_check.py`) checks each line in code:
  - the gold schema;
  - every `proof_span` verbatim in the stored text of its page, after the whitespace
    normalisation of "Text matching" and nothing else;
  - no gold proof page (host and path);
  - no gold expected person or unit by normalised name (case, accents, titles);
  - no invented name, or its surname, in any stored page or profile name;
  - no e-mail address or phone number;
  - no proof page or name already in dev.
- The checker prints counts and failing line ids, never gold wording. 8 of the 56 candidates
  failed a gold check (4 on a gold proof page, 7 on a gold name, some on both) and were dropped.
  Given ids in the gold pattern, none failed another check.
- From the 48 left, 38 were chosen to match the mix above before any run. One candidate was left
  out because its proof page matches 19 profiles, any of which would count as a hit.
- On the final file the checker passes 38 of 38 on every check.
- Gaps: no German query on an English page (dev has six German translation queries), and one
  French DCB query.

A stage-level table of gold misses was read to choose which stages to work on. For every expected
gold entity missing from the top 10, it holds one stage: crawl, extraction, retrieval, the claim
rule, rank 11 to 20, or the unit cap and abstention. It holds counts per stage, split by source,
language and variant, and is kept outside the repository. No query-level fix was made from it, and
no gold wording went into code, terms or dev2.

Rule for each search lever:
- Measured against the run before it in the same setup: bundle-20261019-3, a fresh database per
  run, predictions in replay, no model calls.
- Adopted only if, on dev and dev2 pooled:
  - recall@10 rises and MRR does not fall;
  - traceability stays 100% and invented entities stay 0;
  - invented queries abstained do not drop and false abstentions do not rise.
- A lever the rule rejects is reverted. Every variant tried is reported, adopted or not.
- Not levers: the evaluator and its matching rules, `GOLD-NOTES.md`, `eval/gold.jsonl`. RRF k stays
  60 unless a dated line here changes it before the run that tests it.
- Dev2 queries have no recorded expansion: in replay the expansion misses and the query runs as a
  plain search. Levers are compared in that setup, so a lever that works only through expansion
  cannot show on dev2.

Gold runs once at the end, on the final code, as measurement. The report gives the original
number (bundle-20261019-3: recall@10 0.38 [0.22, 0.56], MRR 0.46) next to the new one, with
intervals and every slice, whatever the outcome. The gold run in the entry above measured those
two changes and is not used to choose levers.

Disclosure: before this entry was written, a diagnosis script also scored gold for a few
counterfactual variants (raising or removing the unit cap, keeping profiles through a matching
passage on their own page). Those scores are kept outside the repository and play no part in the
rule above: each lever is adopted or rejected on dev and dev2 only. The final gold run is therefore
the third time gold is scored for this work, and the report says so.

Results (a fresh database per run, replay; recall@10 / MRR; gold not run):
- Passage on the result's own page (v3 of three, `docs/search.md`): adopted. Against B0: pooled
  0.642 / 0.482 → 0.698 / 0.518, dev 0.909 / 0.661 → 0.909 / 0.638, dev2 0.452 / 0.356 → 0.548 /
  0.433. Merged onto the three fixes below, against them: pooled 0.642 / 0.500 → 0.698 / 0.529,
  dev 0.909 / 0.685 → 0.864 / 0.673 (q923 leaves the top ten: a passage result takes the fourth
  place of its unit), dev2 0.452 / 0.368 → 0.581 / 0.427. Every row: traceable 100%, passage
  spans included; 0 invented; 11/12 invented abstained; 1/53 false abstentions.
- Unit cap counting groups instead of a source's only unit: rejected, recall does not rise. Pooled
  0.642 / 0.482 as B0, dev and dev2 unchanged (repeat 0.642 / 0.485; v2, the site unit only
  exempt, 0.642 / 0.482).
- Via `has_part`, a unit shown through a part with a matching claim: rejected, MRR falls. Pooled
  0.642 / 0.482 → 0.642 / 0.476, dev2 MRR 0.356 → 0.345 (v2, adding `operates`, 0.642 / 0.476).
- German compounds split for full text, on the passage merge: rejected, recall does not move (v1);
  v2 was not finished before the search freeze and is not adopted.

### 2026-10-19: three fixes to titles and word forms after review, and gold-informed levers (#226), before the runs
Not a change to the questions, data, metrics or rules above; `eval/gold.jsonl` and
`eval/dev2.jsonl` are unchanged. Written and committed before the runs it describes. A review of
the titles and word forms entry probed the stored data outside every eval set and found three
defects:
- (c) Full text matched a word's light form as a prefix with the word's own weight, so it also
  reached unrelated words: "species" became `speci:*` (13 chunks hold the word, 623 the prefix:
  special, specialist, specific), and "transfer" reached "transformation". Fix: a query word
  matches only the words `word_form` maps to its own form ("species", "specie"; "Kohlenhydrate",
  "Kohlenhydraten"), the comparison the claim rule makes. Coverage still counts exact words only.
- (d) "Pre" and "Pr" opened a name in English Title Case: "Pre Clinical Models of Sepsis"
  abstained. Fix: "Pr", "Pre" and "Dre" open a name only when written with a period or after a
  French article or preposition ("la Pre", "du Pr", "chez la Dre").
- (e) Reasons cite claims that share only a word form, so recorded explanations miss the cache.
  Fix: a reason cites the claims sharing an exact word with the question, and the claims sharing
  only a form when there are none. Which results show, and their order, do not change.

Rule, in the setup of the titles and word forms entry (bundle-20261019-3, its one shared load,
predictions in replay, no model calls):
- (c) is adopted if, on dev, against word forms in the claim rule only (full text on exact words),
  recall@10 and MRR are not lower, traceability stays 100%, invented entities stay 0, invented
  queries abstained are not fewer and false abstentions are not more: the rule (b) passed.
  Otherwise full text goes back to exact words and the claim rule keeps its word forms.
- (d) and (e) are adopted if, on dev, every query keeps the same results in the same order; (e)
  may change only the claims a reason cites.
- Each row is also run on dev2 and reported. Dev2 does not decide these fixes, which repair (b)
  rather than add a lever.
- Gold is not run for these fixes. The gold row "(a) + (b)" above measured the prefix. The final
  gold run of #226 measures the fixed code, and its report says so.

Gold-informed levers. The dev2 entry says a table of gold misses by stage chose the stages to work
on, and that gold was scored for raising or removing the unit cap and for keeping profiles through
a passage before that entry's rule was written. A gold gain from a lever of this round is
therefore not a held-out measurement. Every gold number from the final run of #226, and any gold
number of a lever chosen after the miss table, is labelled "gold-informed, not held-out" wherever
it appears, README included. The unit cap and passage levers are also named as scored on gold
before their rule.

Results (a fresh database per run; (d) and (e) also compared on one shared load):
- (c) adopted. Dev against full text on exact words: recall@10 0.864 → 0.909, MRR 0.655 → 0.685,
  traceable 100%, 0 invented, 5/5 invented abstained, 1/22 false abstentions. Dev2: recall@10
  0.452 → 0.452, MRR 0.374 → 0.368.
- (d) adopted. Dev and dev2 predictions byte-identical to (c) on the shared load. Dev 0.909 /
  0.685, dev2 0.452 / 0.368.
- (e) adopted. Every dev and dev2 query keeps its results and order on the shared load; only
  reasons change (22 of 398 dev results, 41 of 567 dev2). Dev 0.909 / 0.685, dev2 0.452 / 0.368.
