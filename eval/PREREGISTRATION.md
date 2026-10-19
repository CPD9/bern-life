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
### 2026-10-19: exploratory numbers for questions 2, 5 and the labelling of criterion 4 (#227)
Nothing above changes: the questions, data, metrics, decision rules and every number they give stay
as they are, and `eval/gold.jsonl` is unchanged. The three additions below came after the gold
numbers of bundle-2 and bundle-3, and the per-unit exposure counts, were known, so they are
exploratory and never a test of a rule above. Each is its own key in `metrics.json`; the numbers and
how to read them are in `docs/metrics.md`.

- **Consistency across wordings** (question 2): the mean top-10 Jaccard over every pair of wordings
  in `eval/consistency.jsonl`. Reason: variant agreement above compares a rewording only with its
  base question, and the case gives its own example. The glucose set holds four of the case's
  wordings and "Blutzucker messen", which the issue planning the set named and the case does not;
  the case's "metabolic monitoring" and "wearable sensing" were not in that plan and are not added
  after the results. The other two sets pair gold and dev questions whose labels name different
  answers, so their overlap does not measure finding the same experts.
- **Exposure by unit size** (question 5): the top-10 slots of units above the median unit size and
  of the rest, next to their share of profiles. Reason: "exposure concentrated in the largest units"
  needs a grouping, and the per-unit list above has none. The grouping was chosen with the per-unit
  slot counts already in the report. The same groups split by source were added after the first
  numbers were read, because ARTORG and the Diabetes Center Berne are one large unit each and most
  gold questions ask about them.
- **How the 30 results of criterion 4 are labelled**: the 30-result human-labelled sample stands;
  how it is drawn and scored changed before any label exists. Each profile is drawn once, since a
  profile shown for two questions would be judged twice on one page. Two sheets of 19 rows each, 8
  of them shared, replace one sheet where each labeller had 20 rows, 10 of them shared, so each
  takes about 20 minutes. On a shared row a field counts as stated when either labeller says y, so a
  field one of them found is never dropped from what the system should have filled. The sheet no
  longer shows the question, so the page is judged on its own. No label exists under either design,
  so there is no original number to show next to an amended one.
### 2026-10-19: the final gold run of #226 (gold-informed, not held-out)
Nothing above changes: the questions, data, metrics and rules stay as they are, and
`eval/gold.jsonl` is unchanged. This is the gold run the dev2 entry announced: once, at the end, on
the final code, as measurement. As that entry says, it is the third time gold is scored for this
work, so every number here is gold-informed, not held-out.

Code: `226-search-quality` at add81b7 (titles in the premise check, German and French word forms,
the three review fixes, and the passage on the result's own page; the unit cap, `has_part` and
German compounds rejected). Setup: bundle-20261019-3, a fresh database loaded once, predictions in
replay with no model call, and the wording sets of criterion 2 predicted in the same pass.

| Set | Run | recall@10 | MRR | traceable | invented | invented abstained | false abstentions | en / de / fr recall@10 |
|---|---|---|---|---|---|---|---|---|
| gold | bundle-3 (main) | 0.38 [0.22, 0.56] | 0.46 [0.28, 0.63] | 4666/4666 | 0 | 8/10 | 0/38 | 0.55 / 0.18 / 0.12 |
| gold | final #226 | 0.39 [0.24, 0.56] | 0.45 [0.29, 0.60] | 3931/3931 | 0 | 9/10 | 0/38 | 0.55 / 0.20 / 0.12 |

By source, recall@10: UniBE 0.23 → 0.27, ARTORG 0.44 → 0.44, DCB 0.58 → 0.56. By wording: site
0.44 → 0.43, synonyms 0.82 → 0.82, lay terms 0.33 → 0.42, translations 0.24 → 0.27, control 0.33 →
0.33. MRR by source: UniBE 0.31 → 0.38, ARTORG 0.63 → 0.63, DCB 0.53 → 0.43.

Reading:
- The gain on dev and dev2 (pooled recall@10 0.585 → 0.698, MRR 0.456 → 0.529) does not carry to
  gold: recall@10 0.38 → 0.39 and MRR 0.46 → 0.45, both inside the intervals. Criterion 1 stays
  not met.
- Eleven queries move. Found, or found better: q003b (0 → 0.25), q006c (0 → 0.5), q011b (0.33 →
  0.67), q014 (0 → 0.25, first hit at rank 1). Lost: q003c (0.5 → 0), q005 (1.0 → 0.5). First hit
  one rank lower: q001, q001b, q002c, q003.
- q017 (an invented "Dre", asked in French) now abstains, so 9 of 10 invented questions abstain
  with 0 false abstentions on the site's own wording: the abstention rule is met for the first
  time.
- Traceability stays 100% (3,931 cited claims, the passage spans included) and no invented entity
  appears.
- Exploratory (#227): consistency across wordings, mean pairwise Jaccard 0.17 (glucose 0.11,
  metabolites 0.23, carbohydrates 0.20), 2 of 13 wordings searched plain; variant agreement lay
  0.17 → 0.24, synonym 0.38 → 0.31, translation 0.28 → 0.24; mean share of the 8 fields filled
  0.61 → 0.58; top-10 slots UniBE / ARTORG / DCB 0.58 / 0.24 / 0.18 against profile shares
  0.76 / 0.13 / 0.07.

The code is adopted as the dev and dev2 rule decided, and nothing was changed after this run. The
predictions of this run are bundle-20261019-4's `predictions.jsonl`; `make eval` on that bundle
reproduces this row.

### 2026-10-19: two extraction fixes toward criterion 1, dev3, and the fourth gold run (#283), before any run
Nothing above changes: the questions, data, metrics and decision rules stay as they are, and
`eval/gold.jsonl` is unchanged. Written and committed with `eval/dev3.jsonl` before any extraction
call, enrichment call or search run of this work.

Why. On bundle-20261019-4 recall@10 is 0.39 against the case's 0.80. The stage-level table of gold
misses that the dev2 entry describes was read again, entity by entity, to choose what to fix: of the
100 expected gold entities, 62 are missing from the top 10. 21 are units with no profile, because
their proof pages are classed `other` (UniBE `/forschung/<name>/` pages, the ARTORG research
index, the IFIK lab page; six of them carry a short-named profile with no claims). 18 are people
whose profile holds only a role or a unit, so the claim rule (`docs/search.md`, rule 5) never shows
them; 92% of person profiles carry no topical claim. 9 fall to the unit cap or to passage results,
11 rank between 11 and 20, and 3 are not in the candidate pool. Had every existing profile been
ranked perfectly, recall@10 would be 0.75: that is the ceiling of any search lever, and the reason
the next two changes are to the data, not to the search. Live expansion changes nothing: all 63 gold
expansions are cache hits. The table was read from gold, so **both fixes are gold-informed**, and
every gold number from the run at the end of this entry is labelled "gold-informed, not held-out"
wherever it appears (this file, README block, `docs/metrics.md`, the report).

Fix 3, unit pages by URL (`sources/*.json` `page_types`, `classify.py`). Only the URL decides a
page's kind, so a kind can be predicted and corrected without reading the page, and the same source
file gives the same kinds on every machine. The change:
- UniBE institute hosts: a page one level under `/forschung/` or `/research/`, with or without
  `index_(eng|ger|fre).html`, is a `unit` page (today `other`). The person, project and listing
  patterns stay in front of it and keep their pages. Pages whose last path word names a list or an
  event rather than a group keep their kind: publications, seminars, funding, awards, prizes,
  conferences, networks, news, archives, dissertations, emeriti, former or adjunct members,
  internal pages, and index pages of research groups, programs, fields or clusters. The
  exclusions are written as URL patterns in the source file.
- The same for the two deeper shapes the stored pages show: the lab pages of the neuroscience
  host, `/research/research_groups/<lab>/` (stored once with and once without the trailing slash;
  the same text gives the same cache key, so one call), and the IAP sub-group pages
  `/research/<group>/<subgroup>/`.
- ARTORG: the research index `/research/index_eng.html` (the centre's research areas) becomes a
  unit page. DCB only if a page of the same kind turns up in the list below.
- Before any call, every page whose kind changes is listed (url, old kind, new kind) and counted,
  and the list says what happens to the six short-named profiles with no claims. Cached pages are
  cache hits; only re-classed pages reach the model. Expected: 120 to 190 calls; the stage stops
  and reports before passing 200.

Fix 4, topical claims for people (`extract_prompt.py`, `extract_command.py`). A second prompt
version, `extract-topics-v1`, asks a person page only for expertise, projects and
infrastructure/services values, each with its verbatim span; the page stays data, never
instructions, in the framing and JSON shape the verifier expects, and the version is part of the
cache key. It runs once, on person pages (kind `person`) where no profile the page is the source
of has an expertise claim, and whose text has at least 300 characters. The first condition reads
every profile whose name claim cites the page: ten pages today give both a bare-name profile
without claims and a titled twin ("…, MD") with claims, and such a page is not read again. The
second condition follows from the stored pages: 501 person pages have no expertise claim in any
of their profiles, 372 of them are under 300 characters (a name, a role and contact lines, nothing
to extract), 98 are 300 to 499, 31 are longer, and 7 have a research heading and 500 characters or
more. About 129 pages are read, one call per window of 8,000 characters: about 130 to 260 calls
rather than the 530 first estimated; if the count before the run differs from 129 by more than a
fifth, the stage reports before calling. The verifier (`verify.py`) is unchanged: a value is kept
only if its span is on the page and the value is in the span. Verified claims are merged into the
existing profile (`merge.py`); nothing else about the profile changes. Then enrichment for the
new expertise values only (values that already have terms are skipped; 25 values per call, so
under 40 calls), and embeddings for the new chunk texts, computed locally.

Model calls: every call goes through the cached router (`llm.py`), is counted in
`llm_cache/audit.jsonl`, and the counts of both stages are reported here. Peter approved about 680
calls for this path; the work stops and reports before any step that would take the total past
1,000.

dev3 (`eval/dev3.jsonl`, 20 queries, q970 to q989; dev2 already holds q950 to q967). Why a third
set: dev and dev2 were written before the two fixes and hold few of the pages they change, so
pooled dev and dev2 alone could not show them. How it was written:
- One writer, from the stored pages of bundle-20261019-4 (`pages.jsonl`) and the claim counts of
  its profiles, never from `eval/gold.jsonl`, search results or predictions. The writer had read
  `GOLD-NOTES.md`, which names the gold proof pages and their topics, and avoided those topics and
  the English twins of gold proof pages; the gold queries themselves were not read.
- Candidates were drawn from two lists made in code: (a) pages classed `other` whose URL is one
  level under `/forschung/` or `/research/` (116 pages, 4 of them gold or dev proof pages and
  excluded), and (b) person pages whose profiles hold no expertise claim and whose text states
  what the person works on (30 pages of 500 characters or more).
- Every query has two to four expected entities: 49 in all, 28 units and 21 people. 26 of the 49
  have no profile today (the unit pages classed `other`); 23 have one by name: the 21 people and
  two IRM divisions whose `/ueber_uns/` page already gives a unit of the same name. Of the 21
  people, 14 are named only on their group's page, so after fix 3 they gain a role and a relation
  to the unit, which rule 5 does not read; dev3 measures that limit too. 4 have an own page that
  states their work and no expertise claim in any profile (the fix 4 case), and 3 have claims
  today. Three unit pages are the deeper shapes of fix 3 (two neuroscience lab pages, one IAP
  sub-group page), so the run shows whether those patterns matter.
- Languages en 9, de 6, fr 5; variants `site` 10 and `translation` 10 (a query in another
  language than its proof pages). All queries are UniBE: ARTORG's and DCB's unit pages are units
  already, and their person pages without an expertise claim hold no topical text.
- `python -m evaluator.dev2_check` was extended before the set was written: `--dev` may be given
  more than once, and a new check, `gold_text`, refuses a line whose expected name is written
  anywhere in gold (a query, a note, a name or a span), titles aside. Under the extended checker,
  with dev and dev2 as the earlier sets, on bundle-4's pages and profiles, the committed file gives:
  ```
  dev3.jsonl: 20 lines, 20 pass every check
    schema 20/20  span 20/20  gold_url 20/20  gold_name 20/20  gold_text 20/20  invented 20/20  personal 20/20  dev 20/20
    profile: 49 expected entities, 23 by name, 0 by proof page only, 26 with none; widest proof page matches 2 profiles
  ```
  dev2, checked the same way, fails `gold_text` on 2 of its 38 lines (q945 and q949): their
  expected names are written in a gold note or question without being gold entities, which the
  earlier checks could not see. dev2 is frozen and stays as it is; the two lines are recorded
  here. `contracts/check.py` validates dev3 against the gold schema.
- dev3 queries have no recorded expansion: in replay the expansion misses and the query runs as
  a plain search, as for dev2.

Rule for adopting the data:
- Measured on dev, dev2 and dev3 pooled: the new data (both fixes, then enrichment and
  embeddings) against bundle-20261019-4's data, on the same code (this branch, whose search code
  is unchanged), a fresh database per run, predictions in replay, no model calls.
- Adopted only if recall@10 and MRR are not lower, traceability stays 100%, invented entities
  stay 0, invented queries abstained are not fewer and false abstentions are not more. Each set is
  also reported alone.
- If the pooled rule rejects the pair, fix 3 alone is measured the same way (its extraction
  replays from the cache, 0 calls) and adopted or rejected by the same rule; fix 4 alone is not
  tried. Data the rule rejects is not used; the submission then stays on bundle-20261019-4.
- Not levers: the evaluator and its matching rules, `GOLD-NOTES.md`, `eval/gold.jsonl`,
  `eval/dev.jsonl`, `eval/dev2.jsonl`. RRF k stays 60. The search code is not changed in this
  work.

Gold runs once at the end, on the adopted data, as measurement, in the same setup, and its
predictions become bundle-20261019-5's `predictions.jsonl`. It is the fourth time gold is scored
for this work (the dev2 entry counted three), so every gold number is labelled "gold-informed, not
held-out". The report gives the bundle-4 number (recall@10 0.39 [0.24, 0.56], MRR 0.45) next to the
new one, with intervals and every slice, whatever the outcome; nothing changes after it. The
ceiling named above is 0.75, and the gain will be well below it: no promise beyond the tables.

Results

To be filled after the runs: the tables per set and pooled, the decision, the model-call counts
of both stages, and the gold row, each gold number labelled "gold-informed, not held-out".
