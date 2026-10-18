# Bern Life worker briefs

The conductor keeps `docs/conductor/STATE.md` and writes these briefs. Peter runs the sessions.
Open a new Claude Code session on `~/Developer/bern-life` and start it with:

```
/plan @handoff/00-shared-context.md @.claude/prompts/<brief>.md
```

The session plans, Peter pastes the plan to the conductor, and the session implements after
"approved". At most three sessions on Peter's laptop at once (8 GB): one Next dev server and one
Postgres at a time.

## Round A (Sun 18 Oct, now → ≈19:30)

| File | Lane | Port | Depends on |
| --- | --- | --- | --- |
| `E1-crawler.md` | engine | 3011 | — |
| `W1-world-shell.md` (PR 1 scaffold, PR 2 phone + Ask) | world shell | 3012 | — |
| `W2-bern-map.md` | world 3D | 3014 | W1 PR 1 merged before coding |
| `I1-plumbing.md` (two PRs) | infra (Yaseen, or Peter as a 4th session when one ends) | 3013 | — |

## Round B (now → 23:00)

| File | Lane | Port | Depends on |
| --- | --- | --- | --- |
| `E2-extract.md` | engine | 3011 | E1 merged (#14); live model run after I2 and Peter's go-ahead |
| `I2-router.md` | infra (Yaseen) | 3013 | I1 merged; **CSCS base URL from Peter** |
| W1 PR 2 (Ask) then PR 3 (phone), from `W1-world-shell.md` | world shell | 3012 | PR 1 merged |
| W2 PR B (scene, light-up, panel), from `W2-bern-map.md` | world 3D | 3014 | PR A merged |
| `W3-onboarding-home.md` | world home | 3015 | a free world session (after W1 PR 3 or W2 PR B) |

## Round C (23:00 → ≈03:00)
E3 enrichment + hybrid search + explain + brief API · I3 evaluator · W4 the world and phone on the
real engine (map lights up from live search) · X1 the agent: the Navigator character in Ask uses
tools (search, light up and fly to places, open a profile, start a match report); it never sends
anything outside the app without a click.

## Round D (≈03:00 → 08:00)
X2 match report: PDF plus a live link that opens the same lit-up map · X3 inquiry inbox: a web form
and invented inquiries are split into needs, matched, and answered with a cited draft that staff
approve (no real mailbox) · X4 sources admin: add a source by pasting a URL (preview, save), re-crawl
of changed pages, source health · X5 spaces and talent as ordinary sources, every figure sourced and
dated · X6 feedback labels on results, tuned only on a separate dev query set, never the gold set ·
I4 live batch on CSCS and the bundle release.

## Monday morning
D1 README with animated explainers · P1 pitch in BEDA's template (file stays out of git) · final
eval run · rehearsal. Anything not merged by 08:00 goes on the roadmap slide.

When a session reports back, paste its plan or PR link into the conductor session.
