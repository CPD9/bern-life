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
