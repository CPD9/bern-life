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
None yet.

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
