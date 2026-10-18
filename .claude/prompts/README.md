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
| `I2-router.md` (PR #17; CSCS probe and RunPod scripts as a follow-up) | infra (Yaseen) | 3013 | I1 merged; CSCS base URL for the probe |
| `I3-evaluator.md` | infra (Yaseen) | 3013 | gold set merged; runs on fixtures until E3 |
| W1 PR 2 (Ask) then PR 3 (phone), from `W1-world-shell.md` | world shell | 3012 | PR 1 merged |
| W2 PR B (scene, light-up, panel), from `W2-bern-map.md` | world 3D | 3014 | PR A merged |
| `W3-onboarding-home.md` | world home | 3015 | a free world session (after W1 PR 3 or W2 PR B) |

## Round C (tonight)

| File | Lane | Depends on |
| --- | --- | --- |
| `E3a-search.md` | engine | E2 merged; I1 schema; baseline numbers with I3 |
| `E3b-expand-explain-brief.md` | engine | E3a merged; CSCS key in `.env` |
| `I3-evaluator.md` | infra (Yaseen) | running now |
| `I4-bundle-run.md` | infra (Yaseen) | I3 merged; E3a `predict`; Peter runs `gh release` |
| `I5-metrics.md` | infra (Yaseen) | I4 tools merged; uses E3a's response builder |
| `D1-readme.md` | world shell (W1) | after W1 PR 3 |
| `S-accounts-messages.md` (S1 accounts, S2 messages) | backend (Yaseen) | after I5; one migration PR at a time |
| `X1-agent.md` (X1a engine, X1b web) | engine, then world shell | E3a merged; W1 PR 3 merged |
| `W4-world-live.md` | world | W1 PR 3 and W2 B2 merged; E3a serving |

## Round D (tonight and overnight): the world you live in

| File | Lane | Depends on |
| --- | --- | --- |
| `X2-match-report.md` | world shell (W1) | README merged |
| `W5-walk.md` | world 3D (W2) | W4 merged |
| `W6-office.md` (W6a furniture, W6b documents) | world home (Nik) | W3c merged; W6b needs S4a |
| `W7-lab-people.md` | world shell (W1) | X2 merged; S4b |
| `S4-docs-labs-hosting.md` (S4a, S4b, S3 Exoscale) | backend (Yaseen) | trigger migration, `make run` |

Rule for people: a real person appears as an avatar only after joining and accepting; before that, a
card with public profile and sources. Demo members only in fixture mode, labelled DEMO.

## Story mode wave (from Sun 21:00)

| File | Lane | Depends on |
| --- | --- | --- |
| `W12-real-bern.md` (the map from swisstopo open data) | world 3D (W2) | W4 merged; **first priority** |
| `W13-first-run.md` (map → interact → join → onboarding) | world shell (W1) | STORY merged |
| `STORY-mode.md` (quest engine, panel, events) | world shell (W1) | X2 merged; **top priority** |
| `W11-settle.md` (choose where to settle, sourced facts) | world 3D (W2) | W4 merged |
| `W5-walk.md` (walk Bern, enter places) | world 3D (W2) | W11 |
| `W3-bear-floatie.md` (your bear, the floatie) | world home (Nik) | onboarding #81 |
| `W6-office.md` (furnish the office, documents on the desk) | world home (Nik) | bear; W6b after S4a |
| `W9-library.md` | world home (Nik) | W6a; S4a for documents |
| `W8-office-desktop.md` | world shell (W1) | STORY |
| `W10-market.md` (Buy becomes Market) | world shell (W1) | W8 |
| `W7-lab-people.md` | world shell (W1) | S4b |
| `E4-opportunities.md` (calls, services, spaces as sources) | engine | E3b dev work |
| `S4-docs-labs-hosting.md` | backend (Yaseen) | `make run` |
| `G1-garage.md` (Apertus models, real numbers) | world (stretch) | evaluator rows |

Rules for this wave: real, sourced facts only (no money, no invented prices or counts); Apertus only
in the garage; a real person is an avatar only after joining; quests complete on app events only.

## Monday morning
P1 pitch in BEDA's template (file stays out of git) · final evaluator run · labelling session ·
rehearsal. Anything not merged by 08:00 goes on the roadmap slide.

When a session reports back, paste its plan or PR link into the conductor session.
