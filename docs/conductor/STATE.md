# Conductor state

To continue on another account or machine: open the repo and say "You are the conductor. Read
CLAUDE.md, docs/conductor/STATE.md and .claude/prompts/README.md, then tell me the next step."

Updated: 2026-10-18 14:30 (conductor)

## Deadline
- Feature freeze **Sun 18 Oct 23:00**. Submission **Mon 19 Oct** (time to confirm). Work continues
  after the freeze (world layer).

## Wave
**W0 done** (5102e7f on `main`, CI green). **W1 round 1** running: E1, I1, U1.
Gold set + pre-registration: PR from branch `1-gold-set` (#1), frozen once merged.

## Lanes and sessions (max three at once)
| Lane | Who | Current brief | Branch / PR | Status |
|---|---|---|---|---|
| 1 data / engine | Peter's session | E1 crawler + snapshot | — | ready to start after W0 push |
| 2 world / UX | Nik | U1 search UI on fixtures | — | ready to start after W0 push |
| 3 infra | Yaseen | I1 plumbing, then I2 router | — | ready to start after W0 push |
| conductor | this session | gold set + pre-registration | `1-gold-set` (#1) | PR open |

## Decisions (dated; details in docs/decisions.md)
- 2026-10-18 Name Bern Life; repo `CPD9/bern-life`, private.
- 2026-10-18 Models: CSCS API (Swiss) for demo; RunPod vLLM ($22) for smoke tests only.
- 2026-10-18 Brief upload (company project PDF → matched experts) is the demo story on the W1 engine.
- 2026-10-18 Postgres 17 + pgvector, schema owned by Prisma in `db/`; engine uses raw SQL (psycopg).
- 2026-10-18 Embeddings: multilingual-e5-small via fastembed/ONNX on CPU.
- 2026-10-18 Snapshot bundle (pages, LLM cache, vectors) is a SHA-pinned release asset, never in git.
- 2026-10-18 No emails/phones stored; contact is the source link.
- 2026-10-18 Seeds: the 22 hosts from the case inventory (20 UniBE institutes, ARTORG, DCB).

## Outward steps waiting for Peter
1. ~~Repo created~~ (2026-10-18, https://github.com/CPD9/bern-life, private, origin set).
2. ~~W0 pushed~~ (5102e7f, signature verified).
3. ~~Labels created~~ (`lane-1`, `lane-2`, `lane-3`, `contract`, `eval`; `bug` is a default).
4. ~~Ruleset `main` active~~ (id 25341569): PR + 1 approval, checks contracts/secrets/engine, strict, signed, linear, no force-push/deletion, threads resolved; admin may bypass via PR only (Peter's choice).
5. Collaborators: needs Yaseen's and Nik's GitHub handles.

## Findings that change the build
- 2026-10-18 14 of the 22 gold proof pages contain non-breaking spaces. Page text must normalise
  Unicode whitespace (E1 `html_text.py`), or evidence spans will fail to match. Told lane 1.

## Pending Peter's decision
- Yaseen's plan review (2026-10-18): adopt pitch in BEDA template, his demo storyline, field
  completeness, per-unit caps, aspect matrix, EntityRelation; avatars only after a profile is claimed.

## Blockers / open questions
- Yaseen's and Nik's GitHub handles (collaborators, CODEOWNERS).
- Does the event require a template repo?
- CSCS base URL and served model ids (needed by I2; key stays in `.env`).
- Exact submission time on Monday, and whether the 23:00 freeze is an event rule (Yaseen's plan says finals Mon 17:00).

## Next briefs (written after round 1 starts)
E2 extraction + verifier · E3 enrichment + hybrid search + explain · I3 evaluator · I4 live batch +
bundle release · U2 UI on the real engine · U3 README with animated explainers.
