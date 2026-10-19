# Result metrics

Each result shows a few numbers that describe it. They are computed from your question, the
result's verified claims and the stored public pages: never from the AI's opinion of its own
answer, and never from page counts, popularity or the size of a unit. They describe a result and
never change the order of the results.

**A dash (—) means the number could not be computed for this result.** It is not a zero and not a
bad score. When the Navigator answers "no reliable source found", it shows no results and no
numbers.

| Metric | What it tells you | How it is computed |
|---|---|---|
| Relevance | How much of your question this result covers | Topics of your question found, as whole words, in the result's verified claims ÷ all topics. "Covers" and "Not found" list them. |
| Evidence | How directly the public pages tie this person or unit to what you asked | Per covered topic: 100% when the topic and the name are in one passage (within 300 characters), 50% on the same page further apart, 25% only on a page that does not name them. The average over covered topics. |
| Completeness | How much of the profile the public pages fill in | Filled fields out of 5: role, unit, expertise, projects, infrastructure/services. A low value means the pages say little, not that the expert is weak. |
| Novelty | What this result adds to the results above it | "New unit" when it is the first result from its unit; "Adds" lists the topics no higher result covered. The first result is new by definition. |
| Confidence | How often results like this were right on labelled practice questions | Not yet calibrated, so not shown. See below. |

## Topics
Topics are the words of your question that say what you are looking for. Question words such as
"who", "works", "in" or "Bern" are not topics. Query expansion adds other wordings of a topic
(a synonym, a lay term, a translation, an acronym), so "CGM" counts for "glucose sensors"; it never
adds a topic you did not ask about.

## Confidence, once calibrated
People mark the top results of the practice questions (`eval/dev.jsonl`, never the frozen gold set)
right or wrong. Each result's raw score, the mean of relevance and evidence, falls into one of five
bands. Confidence is the lower end of the 95% Wilson interval of the share right in that band, so it
stays cautious while there are few labels. Until the labels exist, the value is empty.

## Fixed choices
The evidence strengths (100%, 50%, 25%) and the 300-character passage are a documented heuristic,
not tuned to any result set. Changing them changes this page and the engine version.

# Evaluation numbers outside the README table

The README's table is written from the evaluator's output on the pinned bundle alone. Three
further numbers need inputs the bundle does not carry, so they are documented here with the
command that computes them. Each is added to `eval/out/metrics.json` next to the others
(`consistency`, `exposure_by_size`, `labelled_completeness`) and changes none of them. These
analyses were added on 19 Oct, after the gold numbers were known; they are not in
`eval/PREREGISTRATION.md`.

## Criterion 2: the same experts for different wording

The table's criterion 2 row compares each gold rewording with its base question. This adds the
case's own example. [`eval/consistency.jsonl`](../eval/consistency.jsonl) holds sets of wordings
of one need, each copied verbatim, never written for this:

- **glucose sensors**: "glucose sensors", "CGM", "biosensing", "Blutzucker messen", "continuous
  glucose monitoring", the case's example of criterion 2.
- **metabolite sensors**: gold q002 (the site's wording), q002b and q002c, and dev q912, which
  asks the same need in lay words.
- **carbs from meal photos**: gold q008 (the site's wording), q008b and q008c, and dev q920, the
  same need in lay German.

`eval/dev.jsonl` holds no two wordings of one need, so the second and third sets pair a dev
question with the gold question it rewords. Each wording goes through the engine's own search
(`python -m bernlife predict`, replay only); the evaluator reads that file and imports nothing
from the engine. Per set: the mean Jaccard overlap of the top-10 profile ids over every pair of
wordings, and for each wording the share of its top 10 that the set's first wording also finds.
A wording with no recorded query expansion is searched plain, and the report lists it.

```
make predict-consistency BERNLIFE_DATA_DIR=<data folder with the bundle> DATABASE_URL=<loaded bundle>
make eval BERNLIFE_DATA_DIR=<the same folder>
```

On `bundle-20261019-3` (engine 0.2.0, replay, no model called):

| Set | Wordings | Mean pairwise Jaccard | Share of each top 10 the first wording also finds |
|---|---|---|---|
| glucose sensors | 5 | 0.10 | 0.29 (CGM 0.40, biosensing 0.17, Blutzucker messen 0.20, continuous glucose monitoring 0.40) |
| metabolite sensors | 4 | 0.18 | 0.37 |
| carbs from meal photos | 4 | 0.10 | 0.07 |

Over all 22 pairs the mean Jaccard is 0.12. Every wording's expansion was recorded in the
bundle's cache (no cache miss); for two, the recorded call gave no terms search could use, so they
were searched plain: dev q912 and gold q008b ("An app that counts the carbs in my meal from a
photo taken with my phone", which shows one result). Different wordings of one need share little
of their top 10: the expected people can still be found (synonym recall@10 is in the README), but
the rest of the list changes with the wording. The bundle does not carry these predictions, so
CI cannot recompute them and the README table leaves them out.

## Fairness: exposure by unit size

The rule, written down before the grouped numbers were computed: the units are the page units of
the three case sources (UniBE's institutes, ARTORG and the Diabetes Center Berne, 22 units). A
unit's size is the number of profiles in the snapshot whose source page belongs to it. A unit with
more profiles than the median unit is large; the median unit and every unit below it are small.
The slots are the top-10 results of the 38 gold questions that should find someone, as for
criterion 5. The per-unit slot counts this sums up were already in the evaluator's report.

On `bundle-20261019-3` (median 125.5 profiles; `make eval` computes it from the bundle's files):

| Group | Units | Profiles | Profile share | Top-10 slots | Slot share | Units never in a top 10 |
|---|---|---|---|---|---|---|
| small (≤ 125.5 profiles) | 11 | 757 | 0.23 | 62 | 0.17 | 4 |
| large (> 125.5 profiles) | 11 | 2,579 | 0.77 | 309 | 0.83 | 0 |

Small units get fewer top-10 slots than their share of profiles, and 4 of the 11 never appear in
a top 10. This is not a clean test of the ranking: the slots follow what the gold questions ask,
and 22 of the 38 ask about ARTORG or the Diabetes Center Berne, each one large unit here. The
ranking has no popularity or size signal and lets at most 4 profiles of one unit into a top 10
([search](search.md)).

## Criterion 4: field completeness, checked by two people

The evaluator writes two blind sheets and a key (to `eval/out/labelling/`, or `--labelling-dir`):
30 shown results drawn round-robin across the three sources (seed 1, each profile once). Rows 1-8
are in both sheets, for agreement; the other 22 alternate, so each labeller has 19 rows. A row
shows the result's kind, name and source link, and asks y or n for each field a page can state
(person, role/affiliation, unit, expertise, projects, infrastructure/services); the instructions
are the sheet's first rows. What the system filled is only in `key.json`. The sheets name people
from public pages, so they are kept outside the repository, and a folder whose sheets hold answers
is never overwritten.

Once both sheets are back, `make eval LABELS=<their folder>` adds per field: how many results'
pages state it, how many of those the system filled (completeness, Wilson interval), and how many
it filled although the page is silent (from another page of the profile). The pooled completeness
over fields has a bootstrap interval over results. On rows 1-8 a field counts as stated when
either labeller says y. Agreement is Cohen's kappa on rows 1-8, per field and over every field
judged by both; a blank answer is left out and counted, and kappa is "—" when both gave one same
answer throughout. Key and sheets must come from the same predictions, or the run is refused.
