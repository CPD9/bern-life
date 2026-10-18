# Conductor state

To continue on another account or machine: open the repo and say "You are the conductor. Read
CLAUDE.md, docs/conductor/STATE.md and .claude/prompts/README.md, then tell me the next step."

Updated: 2026-10-18 23:30 (conductor; see HANDOVER.md for the full vision)

## Deadline
- Planned feature freeze Sun 18 Oct 23:00; Peter builds through the night. Submission and finals
  Mon 19 Oct (Yaseen's plan says finals 17:00; exact submission time to confirm).

## Wave
Merged: crawl (#14), extraction (#23, #29, #32, #44), router (#17, #22), evaluator (#33), bundle
tools (#38), metrics (#46), search + API + predict (#58), web shell / Ask / phone (#11, #30, #51),
world city / markers / light-up (#24, #39, #54, #64), accounts (#52, #55), messages backend (#63).
Running: E3b (expansion and enrichment, then explanations and briefs), W4 (world on real data), D1
(README), Yaseen: trigger migration → `make run` → Messages app → S3 Exoscale, Nik: avatar (#62) →
onboarding and home.

## Lanes and sessions
| Lane | Who | Now | Next |
|---|---|---|---|
| engine | Peter's session | E3b PR 1 expansion + enrichment | E3b PR 2 explain + briefs, X1a agent |
| world shell | Peter's session (W1) | D1 README | X1b agent UI |
| world 3D | Peter's session (W2) | W4 world on real data | walk the map |
| backend / infra | Yaseen | span-trigger migration | `make run`, Messages app, S3 Exoscale |
| world home | Nik | avatar #62 | onboarding steps, home room; X2 match report UI |

## Since 19:30
- Merged: expansion + enrichment (#74), explanations + briefs (#91), span-trigger fix (#83), `make run`
  (#88), match report (#79), messages app (#86), documents (#93), onboarding (#90, #81), story
  contract + briefs (#92), `via` contract (#97), explainers (#77).
- Hosted on Exoscale: https://151-145-197-170.sslip.io (invite-only; fixtures until engine + bundle).
- Gold with reasons through projects (`via`, #108): recall@10 0.36, MRR 0.43, 100% traceable.
- Open: #104 opportunity kinds contract, #110 enum migration, #106 labs (S4b), #108 `via` search,
  #105 Nik's bears, #102 Exoscale; STORY (#95) local in W1.

## Search baseline (E3a, bundle `local-8f34ab8c1fba`, no model help)
| Run | recall@10 | MRR | traceable | invented | invented abstained | false abstentions | en / de / fr |
|---|---|---|---|---|---|---|---|
| without the claim rule | 0.31 [0.18, 0.48] | 0.29 | 1674/1674 | 0 | 8/10 | 0/38 | 0.42 / 0.16 / 0.18 |
| with the claim rule (current) | 0.22 [0.10, 0.35] | 0.27 | 3086/3086 | 0 | 8/10 | 4/38 | 0.34 / 0.05 / 0.05 |
Thresholds set on `eval/dev.jsonl` and committed before the gold run (3b8b98e). Latency p50 125 ms.
The claim rule needs a cited non-name claim matching the query; its cross-language cost is what E3b's
expansion targets. Any change to the rule is decided on the dev set only.

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

## E2 extraction, final (2026-10-18, apertus-v1-5-70b via Keera/CSCS)
- 3,234 model calls (all cached), all six page kinds; replay rebuilds `profiles.jsonl` (fe02324a…)
  and `relations.jsonl` (ef1b61e2…) byte for byte.
- **1,151 model proposals were not found on their page (6.9% of ~16,700), all dropped.**
- 3,371 profiles: 2,922 people (UniBE 2,353, ARTORG 369, DCB 200), 188 units, 103 projects, 158
  infrastructure; 1,897 relations. All 29 gold people present (25 before the "other" pages).
- 1,241 people are a bare name from a news or partner page; the search's claim rule keeps them out of
  topical results.

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
- 2026-10-18 Postgres 17.8: `substr()` on compressed long page text fails with an encoding error, so
  the span trigger wrongly refuses 7 claims and 1 relation; fix `"text" || ''` (Yaseen, migration).
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
- Exact submission time on Monday.

## Next briefs
See `.claude/prompts/README.md`: round B (E2, I2, W3, W2 walk), round C (E3, I3, W4, X1 agent),
round D (X2 match report, X3 inbox, X4 sources admin, X5 spaces and talent, X6 feedback, I4),
Monday (D1 README, P1 pitch).
