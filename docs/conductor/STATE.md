# Conductor state

To continue on another account or machine: open the repo and say "You are the conductor. Read
CLAUDE.md, docs/conductor/STATE.md and .claude/prompts/README.md, then tell me the next step."

Updated: 2026-10-18 14:50 (conductor)

## Deadline
- Planned feature freeze Sun 18 Oct 23:00; Peter builds through the night. Submission and finals
  Mon 19 Oct (Yaseen's plan says finals 17:00; exact submission time to confirm).

## Wave
**W0 done** (5102e7f). Gold set + pre-registration merged (90b9b72, #2): frozen.
**Lanes v2** (#3): the world joins the hackathon. **Round A** starting: E1, W1, W2 (codes after W1
PR 1), I1. Briefs index: `.claude/prompts/README.md`. Peter runs the sessions, max three at once on
the 8 GB laptop.

## Lanes and sessions
| Lane | Brief | Port | Branch / PR | Status |
|---|---|---|---|---|
| engine | E1 crawler + snapshot | 3011 | — | plan reviewed by conductor 14:50 |
| world shell | W1 shell, phone, Ask | 3012 | `4-web-scaffold` (#4) | plan reviewed by conductor 14:35 |
| world 3D | W2 Bern map, places light up | 3014 | — | plan reviewed by conductor 14:35; codes after W1 PR 1 |
| infra | I1 db, compose, CI | 3013 | — | Yaseen (`yaseenmohamd`) |
| conductor | lanes v2 | — | `3-lanes-v2` (#3) | PR to open |

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
- Add the `web` check to the ruleset once W1 PR 1 is on main.

## Findings that change the build
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
