# Contributing

## Issue, branch, worktree
The full flow, versions and releases are in `docs/git-workflow.md`.

Open or claim an issue first. One concern per PR, 150–400 lines where possible. Branch from current
`origin/main` as `<issue>-<slug>`, in your own worktree, on your lane's port:

```bash
git worktree add ../bern-life-<issue> -b <issue>-<slug> origin/main
```

| Lane | Owns | Dev port | Engine port | Database |
|---|---|---|---|---|
| 1 data / engine / agents | `engine/`, `sources/` | 3011 | 8101 | `bernlife_l1` |
| 2a world shell | `web/` except `web/features/world/` | 3012 | 8102 | `bernlife_l2` |
| 2b world 3D | `web/features/world/`, `web/public/world/` | 3014 | 8104 | `bernlife_l2` |
| 3 infra / hosting (Yaseen) | `db/`, `infra/`, `Makefile`, `Dockerfile*`, `compose.yaml`, `.github/workflows/`, `eval/src/` | 3013 | 8103 | `bernlife_l3` |
| conductor | `contracts/`, `eval/gold.jsonl`, `eval/PREREGISTRATION.md`, `docs/`, `handoff/`, `.claude/prompts/` | — | — | — |

Edit only what your brief names. A change to `contracts/` goes through the conductor first, because
both lanes build against it. Prisma migrations are serialised: one open migration PR at a time.

Build a worktree's env from `.env.example`; never copy another `.env`. Throwaway databases are
dropped after the PR merges.

## Plan, then implement
Start in plan mode, read the files your brief lists, and implement only after Peter says
**approved**.

## Commits
- `git commit -S -s`, short conventional messages (`feat(crawl): respect robots.txt crawl-delay`).
- Run git as its own command or as `git -C <worktree> …`, never `cd … && git …`.
- No `Co-authored-by`, no "Generated with", no mention of AI in commits, PRs, code or docs.
- Workers may `gh issue create`, push their own branch and `gh pr create`. Workers never merge,
  force-push, rebase shared branches, delete branches or change repo settings.
- **Only Peter merges.** The `main` ruleset restricts updates to the repo admin (via a PR), and
  every PR needs Peter's approval as code owner after its last push. Yaseen and Nik push branches
  and open PRs; Peter reviews and merges with `gh pr merge <n> --squash --admin`.

## Pull requests
Body: one line saying what and why, 3–6 bullets, then a `Checked:` line and a `Limits:` line.
Under ~120 words, plain. CI green is required but is not "ready": every PR gets a separate reviewer
pass, and its fix commits must be on the branch before merge. Before a branch is deleted,
`git log --oneline origin/<b>..<b>` must print nothing.

### Reviewer pass
Review only `origin/main...HEAD`. Answer each item PASS / FAIL / N/A with file:line evidence; order
findings BLOCK / FIX-BEFORE-MERGE / FOLLOW-UP / NOTE; verdict MERGE / MERGE-AFTER-FIXES / DO-NOT-MERGE.
1. Scope: every changed file is inside the brief's paths.
2. Evidence: no field reaches a profile or result without a verbatim span the verifier checked.
3. Tests: exact values, injected dependencies, and a new test fails on `origin/main`.
4. Secrets and data: no keys, tokens, `.env` values, crawled page copies, emails or real people in
   fixtures, logs or screenshots.
5. Model calls: through the router and the cache; no raw error text stored or shown.
6. Contracts: output validates against `contracts/`; old stored records still parse.
7. Docs: every doc the change invalidates is updated; `docs/conductor/STATE.md` if it changes the plan.
8. Commit hygiene: signed, signed-off, one concern, no AI trailer.

## Checks before push
```bash
make test
gitleaks detect --source . --no-git
```
Each package's own commands are listed in its README once it lands (`engine/`, `web/`, `db/`).
