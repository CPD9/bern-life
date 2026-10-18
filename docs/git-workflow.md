# Git workflow and versions

Trunk-based: `main` is the only long-lived branch and is always runnable. Work happens on short
branches, one per issue, each in its own worktree, merged by Peter as one squashed commit.

```
issue #n ──► worktree ../bern-life-<n>, branch <n>-<slug> from origin/main
             commits (git commit -S -s) ──► push ──► PR "Closes #n"
             CI green + conductor reviewer pass + Peter approves ──► Peter squash-merges
             worktree removed, branch deleted
```

## Branches and worktrees
- `~/Developer/bern-life` stays on `main` and is only ever pulled (`git -C ~/Developer/bern-life pull`).
  Sessions are opened there; their work happens in their own worktree.
- One branch per issue: `<issue>-<slug>`, from current `origin/main`:
  `git worktree add ../bern-life-<n> -b <n>-<slug> origin/main`.
- **If a PR is stacked on another, retarget it to `main` before merging its base with
  `--delete-branch`.** Deleting the base branch closes the stacked PR, and a closed PR cannot be
  retargeted (PR #12 was lost this way and reopened as #13).
- Never stack a branch on an open PR. If work depends on an unmerged PR, wait for the merge (W2
  waited for W1's scaffold) or ask the conductor to split differently.
- Keep branches short: hours, not days. A PR is 150–400 lines where possible.

## Commits
- `git commit -S -s` (GPG-signed and signed-off), conventional style, imperative, one logical change:
  `feat(crawl): match robots.txt wildcards per RFC 9309`.
- Scopes: `crawl`, `extract`, `verify`, `enrich`, `search`, `api`, `web`, `world`, `phone`, `agent`,
  `db`, `infra`, `ci`, `eval`, `contracts`, `docs`, `conductor`.
- No AI attribution in commits, PRs, code or docs.

## Pull requests
- Body: one line, 3–6 bullets, `Checked:` and `Limits:` lines, `Closes #n`. Under ~120 words.
- Required on `main` (ruleset): checks `contracts`, `secrets`, `engine` (and `web` once it exists)
  green on the latest commit, branch up to date, Peter's code-owner approval after the last push,
  threads resolved, signed commits, linear history.
- **Bringing a branch up to date** without force-pushing: `gh pr update-branch <n>` (GitHub merges
  `main` into the branch; the squash merge keeps `main` linear). Resolve conflicts locally with
  `git -C <worktree> merge origin/main`, then push.
- **Merging:** only Peter, `gh pr merge <n> --squash --admin --delete-branch`. Squash keeps history
  linear and the merge commit signed by GitHub.
- After merge: `git worktree remove ../bern-life-<n>`, then `git -C ~/Developer/bern-life branch -D
  <n>-<slug>` once `git diff origin/main <n>-<slug> --stat` shows only what main changed since.

## Shared files
Owned paths are in `CONTRIBUTING.md`. A few files are touched by several lanes: `ci.yml`,
`PROVENANCE.md`, `NOTICE`, `engine/pyproject.toml`, `docs/conductor/STATE.md` (conductor only).
Edit them in small additive hunks; whoever merges second brings their branch up to date.

## Data between worktrees
`data/` is gitignored and would otherwise be separate in every worktree. All worktrees on one
machine share one data directory: set `BERNLIFE_DATA_DIR=~/Developer/bern-life-data` in each
worktree's `.env` (the engine falls back to `<repo>/data`). The crawl, the model cache and the
bundle then exist once.

## Versions
| What | Where | Rule |
|---|---|---|
| Contracts | `contracts/*.schema.json` | Additive only during the hackathon (new optional fields); old records keep parsing. A breaking change needs a new `$id` version and the `contract` label. |
| Engine | `engine/pyproject.toml` `version`, returned in `versions.engine` | Bump the minor version when output changes. |
| Prompts | a version string per prompt in the engine, part of every cache key | Any prompt edit bumps it and says so in the PR; old cached answers stay replayable. |
| Snapshot bundle | GitHub release `bundle-YYYYMMDD-N` with the tarball as an asset; `bundle.lock` holds version and sha256 | A new crawl or batch is a new release; `bundle.lock` changes in a PR. Old bundles can be deleted (deletion path). |
| Gold set | `eval/gold.jsonl` | Frozen; changes only with a dated amendment in `eval/PREREGISTRATION.md`. |
| Submission | signed tag `v1.0.0-hackapertus` (`git tag -s`) and a GitHub release with the report PDF | Cut by Peter on Monday morning. After it, only `fix:` PRs until the finals. |
