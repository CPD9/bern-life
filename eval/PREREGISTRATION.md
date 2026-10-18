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
