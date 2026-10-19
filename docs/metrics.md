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
further numbers are documented here with the command that computes them. Each is added to
`eval/out/metrics.json` next to the others (`consistency`, `exposure_by_size`,
`labelled_completeness`) and changes none of them. They were added on 19 Oct, after the gold
numbers were known, so they are exploratory, not pre-registered: the amendment of that date in
[`eval/PREREGISTRATION.md`](../eval/PREREGISTRATION.md) gives the reasons.

## Criterion 2: the same experts for different wording

The table's criterion 2 row compares each gold rewording with its base question. This adds a set
built on the case's own example. [`eval/consistency.jsonl`](../eval/consistency.jsonl) holds sets
of wordings of one need, each copied verbatim and none written to fit results:

- **glucose sensors**: "glucose sensors", "CGM", "biosensing" and "continuous glucose
  monitoring" are the case's wordings; "Blutzucker messen" is not in the case, it was named as
  the German lay wording when the set was planned, before any result. The case also lists
  "metabolic monitoring" and "wearable sensing"; they were not in the planned set and are not
  added now that the results are known.
- **metabolite sensors**: gold q002 (the site's wording), q002b and q002c, and dev q912, which
  asks about the same topic in lay words.
- **carbs from meal photos**: gold q008 (the site's wording), q008b and q008c, and dev q920, the
  same topic in lay German.

`eval/dev.jsonl` holds no two wordings of one need, so the second and third sets pair a dev
question with the gold question on the same topic. Each wording goes through the engine's own
search (`python -m bernlife predict`, replay only); the evaluator reads that file and imports
nothing from the engine, and refuses it when it was searched on another bundle than the one
scored. Per set: the mean Jaccard overlap of the top-10 profile ids over every pair of wordings,
and for each wording the share of its top 10 that the set's first wording also finds. A wording
with no recorded query expansion is searched plain, and the report lists it.

```
make predict-consistency BERNLIFE_DATA_DIR=<data folder with the bundle> DATABASE_URL=<loaded bundle>
make eval BERNLIFE_DATA_DIR=<the same folder>
```

On `bundle-20261019-3` (engine 0.2.0, replay, no model called), copied from the evaluator's report:

| Set | Wordings | Mean pairwise Jaccard | Share of each top 10 the first wording also finds |
|---|---|---|---|
| glucose sensors | 5 | 0.10 | 0.29 (CGM 0.40, biosensing 0.17, Blutzucker messen 0.20, continuous glucose monitoring 0.40) |
| metabolite sensors | 4 | 0.18 | 0.37 |
| carbs from meal photos | 4 | 0.10 | 0.07 |

Over all 22 pairs the mean Jaccard is 0.12. Every wording's expansion was recorded in the
bundle's cache (no cache miss); for two, the recorded call gave no terms search could use, so they
were searched plain: dev q912 and gold q008b ("An app that counts the carbs in my meal from a
photo taken with my phone", which shows one result).

Different wordings share little of their top 10. That alone does not say the expected people are
lost, and the second and third sets have two limits:

- **On the carbs set the first wording is the one that misses.** Gold q008, q008b and q008c all
  have recall@10 0. The top 10 of q008 shows neither the Intelligent Nutrition project nor the
  AI in Health and Nutrition (AIHN) unit, while q008b, q008c and dev q920 show the project. The
  set's 0.07 measures the reference wording failing more than the others drifting.
- **The labels of one set do not name the same answers**, so "one need" in these two sets is our
  reading of the questions, not something the gold and dev labels back:

| Question | Expected answer in its label |
|---|---|
| gold q008 | ARTORG's AIHN group and its head |
| dev q920 | the team of the DCB's Qarbs project |
| gold q002 | the team of a DCB project and an affiliated ARTORG group |
| dev q912 | the DCB's Sensing & Smart Monitoring focus area |

The bundle does not carry these predictions (they need the loaded database), so CI cannot
recompute them and the README table leaves them out.

## Fairness: exposure by unit size

The grouping: the units are the page units of the three case sources (UniBE's institutes, ARTORG
and the Diabetes Center Berne). A unit's size is the number of profiles in the snapshot whose
source page belongs to it. A unit with more profiles than the median unit is large; the median
unit and every unit below it are small. The slots are the top-10 results of the gold questions
that should find someone, as for criterion 5. The grouping was chosen when the per-unit slot
counts were already in the evaluator's report. The second table, the same groups split by source,
was added after the first had been read, as a check of what the first one shows.

`make eval` computes both from the bundle's files alone, and `infra/readme_numbers.py` writes them
here:

<!-- exposure:start -->
<!-- Written by infra/readme_numbers.py from eval/out/metrics.json: change the script, not this block. -->

| Group | Units | Profiles | Profile share | Top-10 slots | Slot share | Units never in a top 10 |
|---|---|---|---|---|---|---|
| small (≤ 125.5 profiles) | 11 | 757 | 0.23 | 62 | 0.17 | 4 |
| large (> 125.5 profiles) | 11 | 2,579 | 0.77 | 309 | 0.83 | 0 |

| Source | Group | Units | Profiles | Profile share | Top-10 slots | Slot share | Units never in a top 10 |
|---|---|---|---|---|---|---|---|
| UniBE | small | 11 | 757 | 0.29 | 62 | 0.28 | 4 |
| UniBE | large | 9 | 1,896 | 0.71 | 158 | 0.72 | 0 |
| ARTORG | large | 1 | 443 | 1.00 | 89 | 1.00 | 0 |
| DCB | large | 1 | 240 | 1.00 | 62 | 1.00 | 0 |

Snapshot `bundle-20261019-3`: median unit 125.5 profiles; top-10 slots outside these units 0. To reproduce: `make fetch && make eval && python3 infra/readme_numbers.py`. CI fails when this block differs from the evaluator's output.
<!-- exposure:end -->

On `bundle-20261019-3`, small units get fewer top-10 slots than their share of profiles over the
three sources, and that gap comes from ARTORG and the Diabetes Center Berne: each is one large
unit here, and 22 of the 38 questions ask about one of them. Within UniBE, small units get about
their share of slots (0.28 of slots for 0.29 of profiles), although 4 of the 11 small units never
reach a top 10. So the first table is no evidence that the ranking favours large units: the slots
follow what the gold questions ask. The ranking has no popularity or size signal and lets at most
4 profiles of one unit into a top 10 ([search](search.md)).

## Criterion 4: field completeness, checked by two people

The evaluator writes two blind sheets and a key (to `eval/out/labelling/`, or `--labelling-dir`):
30 shown results drawn round-robin across the three sources (seed 1, each profile once). Rows 1-8
are in both sheets, for agreement; the other 22 alternate, so each labeller has 19 rows. A row
shows the result's kind, name and source link, and asks y or n for each field a page can state
(person, role/affiliation, unit, expertise, projects, infrastructure/services); the instructions
are the sheet's first rows. What the system filled is only in `key.json`. The sheets name people
from public pages, so they are never committed; the default folder is ignored by git. A folder
whose sheets hold answers, or cannot be read, is never overwritten. A sheet saved back by a
spreadsheet reads the same with commas, semicolons or tabs, in UTF-8 or Windows-1252.

Once both sheets are back, `make eval LABELS=<their folder>` adds per field: how many results'
pages state it, how many of those the system filled (completeness, Wilson interval), and how many
it filled although the page is silent (from another page of the profile). The pooled completeness
over fields has a bootstrap interval over results. On rows 1-8 a field counts as stated when
either labeller says y. Agreement is Cohen's kappa on rows 1-8, per field and over every field
judged by both; a blank answer is left out and counted, and kappa is "—" when both gave one same
answer throughout. Key and sheets must come from the same predictions, or the run is refused.
