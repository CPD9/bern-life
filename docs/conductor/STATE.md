# Conductor state

To continue on another account or machine: open the repo and say "You are the conductor. Read
CLAUDE.md, docs/conductor/STATE.md and .claude/prompts/README.md, then tell me the next step."

Updated: 2026-10-18 13:45 (conductor)

## Deadline
- Feature freeze **Sun 18 Oct 23:00**. Submission **Mon 19 Oct** (time to confirm). Work continues
  after the freeze (world layer).

## Wave
**W0 base repo**, nearly done locally; waiting on Peter for the outward steps below.
Next: **W1 round 1** (briefs E1, I1, I2, U1), conductor writes the gold set in parallel.

## Lanes and sessions (max three at once)
| Lane | Who | Current brief | Branch / PR | Status |
|---|---|---|---|---|
| 1 data / engine | Peter's session | E1 crawler + snapshot | — | ready to start after W0 push |
| 2 world / UX | Nik | U1 search UI on fixtures | — | ready to start after W0 push |
| 3 infra | Yaseen | I1 plumbing, then I2 router | — | ready to start after W0 push |
| conductor | this session | gold set + pre-registration | — | starts after W0 push |

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
2. Peter commits W0 (`git commit -S -s`) and pushes `main`.
3. ~~Labels created~~ (`lane-1`, `lane-2`, `lane-3`, `contract`, `eval`; `bug` is a default).
4. Branch protection JSON shown, then OK (may 403 on a free private repo; then recorded here).
5. Collaborators: needs Yaseen's and Nik's GitHub handles.

## Blockers / open questions
- Yaseen's and Nik's GitHub handles (collaborators, CODEOWNERS).
- Does the event require a template repo?
- CSCS base URL and served model ids (needed by I2; key stays in `.env`).
- Exact submission time on Monday.

## Next briefs (written after round 1 starts)
E2 extraction + verifier · E3 enrichment + hybrid search + explain · I3 evaluator · I4 live batch +
bundle release · U2 UI on the real engine · U3 README with animated explainers.
