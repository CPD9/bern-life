# Match Report: Design Implications of the Metrics Spec

Oct 18, 2026 · @nik milcev

The metrics spec changes the Match Report design: the metrics tell the project manager *why* to trust a result, so most of them work better as **words and highlights than as percentages**. They aren't decoration on top of the results.

## What changes in the design

| Metric or element | Design change | Why |
| --- | --- | --- |
| Relevance | Topic chips on each card: filled when found, outlined or struck through when missing. The percentage becomes secondary. | "Covers: glucose sensors, wearables · Not found: children" says more than "67%". The same chips at the top let her scan which result covers which part of her question. |
| Evidence | Each card shows a short excerpt from the source page, topic words highlighted, link beside it. Partly replaces "Why this matches". | "Each expert with the sentence that proves it" is the strongest idea in the spec. A quote from the page can't be hallucinated; an AI-written reason can. |
| Request section | Shows the split into topics with their alternative wordings, e.g. *glucose sensors* (also: CGM, continuous glucose monitoring, Glukosesensor). Alternatives marked "added by the system". | The AI may add wordings but never topics. Showing that builds trust and links to the "PM confirms keywords" step. |
| Novelty | Tags instead of 0 / 50 / 100%: "New unit", "Adds: children", "Same unit as #1". Same-unit results can nest under the first one. | "0%" reads as *bad* although the result is correct, the same problem as "— instead of 0". |
| Completeness | Empty fields shown as "—" in the card, with a small "website lists 6 of 8 fields". | A percentage feels like a quality score. Showing gaps keeps it a fact about the page and protects small labs (fairness rule). |
| "—" value | A consistent empty state for "couldn't be computed", with its hover meaning, clearly different from a low score. | The spec's rule only works if the design makes "—" unmistakable. |

## Two tensions to raise with the team

**Ranking vs. numbers.** In the worked example, rank 2 (Dr. B: 33% / 50%) scores lower than rank 3 (Lab C: 67% / 63%). She will notice and ask why. "Display only, never reorder" is defensible, but the design must explain it.

- Add a line above the list: "Ordered by search match · the numbers describe each result, they don't rank it."
- Or ask the team whether the search ranking can also be explained in one line.

**Hover doesn't exist on paper.** "One-line meaning on hover" works on screen, but she wants a one-pager she can forward or print.

- The PDF version needs a small "How to read this report" legend in the footer.
- That legend is also where the "robust guidelines" fit: the five rules in plain language.

## One gap in the spec

The **Confidence** definition is cut off mid-sentence. "How often results like this are actually right" means measuring against known correct answers, so it needs the synthetic test cases with hand-checked ground truth. Until those exist, Confidence should show "—" everywhere.

- [ ] Ask the teammate for the rest of the Confidence section

## Suggested card hierarchy

Each match card reads top to bottom, most important first:

1. **Name, role, unit** + novelty tag
2. **Topic chips**: relevance, shown visually
3. **Proof sentence** with highlighted topic words + source link: evidence
4. **Small metric row**: Relevance 67% · Evidence 100% · Completeness 75%
5. **Detail fields** (projects, infrastructure), with "—" where empty
