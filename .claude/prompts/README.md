# Bern Life worker briefs

The conductor keeps `docs/conductor/STATE.md` and writes these briefs. Paste
`handoff/00-shared-context.md`, then one brief, into a new Claude Code session opened on
`~/Developer/bern-life`. At most three worker sessions at once, one per lane.

## W1 round 1 (Sun 18 Oct, from ≈14:00)

| Order | File | Lane | Depends on |
| --- | --- | --- | --- |
| 1 | `E1-crawler.md` | 1 data / engine (port 3011) | W0 on `main` |
| 2 | `I1-plumbing.md` (two PRs) | 3 infra, Yaseen (3013) | W0 on `main` |
| 3 | `U1-search-ui.md` | 2 world / UX, Nik (3012) | W0 on `main` |
| 4 | `I2-router.md` | 3 infra, Yaseen | I1 PR 1 merged; CSCS base URL from Peter |

Conductor in parallel: the gold set (`eval/gold.jsonl`) and `eval/PREREGISTRATION.md`, frozen
before any search code merges.

## W1 round 2 (≈18:30–22:30, briefs written once round 1 reports)

E2 extraction + verifier · E3 enrichment + hybrid search + explain · I3 evaluator · I4 live batch
and bundle release · U2 UI on the real engine · U3 README with animated explainers.

When a session reports back, paste its PR link into the conductor session for the reviewer pass.
