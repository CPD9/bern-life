# Conductor state

To continue on another account or machine: open the repo and say "You are the conductor. Read
CLAUDE.md, docs/conductor/STATE.md and .claude/prompts/README.md, then tell me the next step."

Updated: 2026-10-18 15:10 (conductor)

## Deadline
- Planned feature freeze Sun 18 Oct 23:00; Peter builds through the night. Submission and finals
  Mon 19 Oct (Yaseen's plan says finals 17:00; exact submission time to confirm).

## Wave
**Round A merged:** gold set (#2), lanes v2 (#8), W1 scaffold (#11), I1 schema + compose (#9).
**Open:** I1 bundle fetch + CI database #13 (replaces #12), E1 crawler #14, W2 places PR A (commit
28a7054, push pending). **Round B** briefs: E2, W3; I2 waits for the CSCS URL.

## Lanes and sessions
| Lane | Brief | Port | Branch / PR | Status |
|---|---|---|---|---|
| engine | E1 → E2 | 3011 | #14 | E1 green, reviewed; E2 next |
| world shell | W1 PR 2 Ask, PR 3 phone | 3012 | — | split approved; contracts added in #15 |
| world 3D | W2 PR A → PR B | 3014 | `5-bern-map` | PR A committed, push pending |
| world home | W3 | 3015 | — | waits for a free session |
| infra | I1 PR 2 → I2 | 3013 | #13 | green except GitGuardian (false positive) |
| conductor | round B | — | `15-round-b` (#15) | PR to open |

## E1 crawl (2026-10-18)
3,013 pages, 22 hosts, 18.8 min, none blocked; 22/22 gold proof URLs; 40/40 spans verbatim; 4,033
emails and 2,585 phone numbers redacted; kinds: 795 person, 183 unit, 114 project, 173
infrastructure, 194 listing, 1,554 other; 7 UniBE hosts hit the 150-page cap.

## Decisions (dated; details in docs/decisions.md)
- 2026-10-18 Name Bern Life; repo `CPD9/bern-life`, private.
- 2026-10-18 Models: CSCS API (Swiss) for demo; RunPod vLLM ($22) for smoke tests only.
- 2026-10-18 Brief upload (company project PDF → matched experts) is the demo story on the engine.
- 2026-10-18 Postgres 17 + pgvector, schema owned by Prisma in `db/`; engine uses raw SQL (psycopg).
- 2026-10-18 Embeddings: multilingual-e5-small via fastembed/ONNX on CPU.
- 2026-10-18 Snapshot bundle (pages, LLM cache, vectors) is a SHA-pinned release asset, never in git.
- 2026-10-18 No emails/phones stored; contact is the source link.
- 2026-10-18 Seeds: the 22 hosts from the case inventory (20 UniBE institutes, ARTORG, DCB).
- 2026-10-18 The life-sim world (three.js) is in the hackathon scope; people from public pages are
  never avatars; honest HUD; map without tiles. Adopted parts of Yaseen's plan (see decisions.md).
- 2026-10-18 Platform features (agent, match report, inbox, sources admin, spaces and talent,
  feedback) are built during the hackathon, with conditions (decisions.md). Only Peter merges.
- 2026-10-18 Evidence gains optional `fetched_at` (W1 needs the fetch date per claim).
- 2026-10-18 E1: own RFC 9309 robots matcher (UniBE robots.txt uses wildcards urllib ignores);
  raw HTML kept locally in the data dir for `crawl --offline`, never in the bundle or git; 4 hosts
  at a time (21 of 22 hosts share UniBE's CMS).
- 2026-10-18 Git workflow written down (`docs/git-workflow.md`): trunk-based, worktree per issue,
  squash by Peter, shared `BERNLIFE_DATA_DIR`, release and version rules.

## Done outward steps
- Repo created (private, origin set); labels `lane-1/2/3`, `contract`, `eval`.
- W0 pushed (5102e7f, signature verified).
- Ruleset `main` active (id 25341569): PR + 1 approval, checks contracts/secrets/engine, strict,
  signed, linear, no force-push/deletion, threads resolved; admin may bypass via PR only. Merge with
  `gh pr merge <n> --squash --admin` (squash keeps commits signed and history linear).
- 14:30 ruleset tightened: `update` restricted to the admin via PR, code-owner review after the last
  push. Collaborators `yaseenmohamd`, `nik-milcevs` (write).
- `web` added to the required checks (2026-10-18, after #11).

## E2 full extraction (2026-10-18, apertus-v1-5-70b via Keera/CSCS)
- 1,459 pages, 1,546 live calls (28 gateway 504s refilled); replay rebuilds both files byte for
  byte (`profiles.jsonl` 1560dd40…, `relations.jsonl` ef1b61e2…).
- **648 model proposals were not found on their page (6.4% of ~10,180), all dropped**; 888 more
  dropped because the value was not in its span (rewording).
- 2,005 profiles: 1,556 people (UniBE 1,185, ARTORG 273, DCB 98), 188 units, 103 projects, 158
  infrastructure; 1,897 relations.
- Completeness: people role 71%, unit 45%, expertise 14%; units expertise 71%; projects expertise
  75%; infrastructure expertise 56%.
- Coverage gap: 4 of 29 gold people are named only on pages classed "other", which the model did not
  read. Reading "other" pages is a general coverage step (1,554 pages), decided by Peter.

## Answers to I3 (2026-10-18)
- Predictions come from E3a's `python -m bernlife predict` →
  `$BERNLIFE_DATA_DIR/eval/predictions.jsonl`; the bundle carries a frozen `predictions.jsonl`, so
  `make eval` defaults to `data/bundle/predictions.jsonl` (`PRED=` overrides).
- Field completeness: the evaluator writes a blind 30-result labelling sheet; Peter and Nik label it
  Monday morning with an overlap for agreement. Until then counts and shares only, marked
  "human check pending".
- A person's `unit` field does not count as a unit hit; only `unit` profiles do.
- Package name `evaluator` (in `eval/src/evaluator/`).
- Live model: CSCS via the Keera gateway (`https://gateway.keera.ch/api/v1`, `apertus-v1-5-70b`);
  ask Sabine where Keera runs for the sovereignty section.

## Metrics (adopted 2026-10-18 from Yaseen's proposal)
- Optional `metrics` per result in `result.schema.json`, display only, never reorders; completeness
  out of 5 source-dependent fields; evidence strengths fixed (1.0 / 0.5 / 0.25, 300 characters);
  confidence null until the Monday labels. Brief I5. Nik's match-report design notes in
  `docs/match-report-design.md` (#40).

## World integration (agreed 2026-10-18)
- Lite graphics is `data-graphics="lite"` on `<html>`, written by W1's Settings; the world reads it.
- The world exports a search store (`begin`, `showResults`, `clear`); `app/` wires the Navigator's
  `onShowOnMap` to it (W4). `ResultCard` moves to `web/infrastructure/ui/` in W4 so the place panel
  can reuse it.
- Agent contract `contracts/agent.schema.json`: replies grounded in tool results, on-screen actions
  only.

## Findings that change the build
- 2026-10-18 Stacked PR #12 closed when its base branch was deleted on merge; reopened as #13.
  Rule added to `docs/git-workflow.md`.
- 2026-10-18 E1 found staff emails and phone numbers in page text; redacted at crawl time.
- 2026-10-18 14 of the 22 gold proof pages contain non-breaking spaces. Page text normalises
  Unicode whitespace (now in E1); the pre-registration matches under the same rule.

## Pitch
- BEDA's PowerPoint template: `~/Downloads/powerpoint_template.pptx` (19 sample slides, 15 layouts,
  German placeholders). Brand material for this challenge only: never committed. Brief P1.

## Blockers / open questions
- Does the event require a template repo?
- CSCS base URL and served model ids (needed by I2; key stays in `.env`).
- Exact submission time on Monday.

## Next briefs
See `.claude/prompts/README.md`: round B (E2, I2, W3, W2 walk), round C (E3, I3, W4, X1 agent),
round D (X2 match report, X3 inbox, X4 sources admin, X5 spaces and talent, X6 feedback, I4),
Monday (D1 README, P1 pitch).
