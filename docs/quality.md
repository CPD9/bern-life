# Speed with soundness

How the team keeps altitude (the case and the vision in view), range (every lane moving), depth
(each piece done properly) and completeness (nothing half-finished) while moving fast.

## Altitude: every task names what it moves
- Each brief starts with the case criteria or judging criteria it moves. Work that moves none waits.
- `docs/conductor/STATE.md` is the single picture: what is merged, what runs, what is next, and the
  numbers. It is updated in every conductor PR.
- The demo storyline (`docs/demo.md`, from W4) is the end-to-end test of the vision: if a step of
  the story does not work on real data, it is the next priority.

## Range: lanes never wait
- Every lane has its next brief written before the current one finishes (the briefs index is the
  queue). The conductor writes ahead; nobody idles.
- Lanes own disjoint paths (`CONTRIBUTING.md`); contracts in `contracts/` are agreed first, so two
  lanes can build against the same shape in parallel with fixtures.
- At most three sessions per laptop; extra lanes run on Yaseen's and Nik's machines.

## Depth: definition of done (a PR is not ready until all hold)
1. Plan approved before code; scope matches the brief.
2. Tests assert exact values and fail on the old code; data and fixtures are invented or public.
3. CI green (`contracts`, `secrets`, `engine`, `web`, `eval`), plus the conductor's reviewer pass.
4. Real output in the PR: a run, a screenshot (demo data), a timing, or a metric, never a promise.
5. Docs the change touches are updated; limits stated plainly.

## Soundness: guards that catch regressions
- **Evidence is checked in code** at three layers: the extractor's verifier, the database trigger,
  and the evaluator's traceability check. A claim without a verbatim span cannot reach a user.
- **The evaluator is the regression gate.** Once E3a produces predictions, every engine PR that
  changes ranking pastes the evaluator table. A drop in recall@10, traceability or abstention needs
  an explanation in the PR before merge. The gold set never changes to fit results.
- **Replay keeps runs reproducible**: every model answer is cached by content hash, so a rerun is
  free and byte-identical, and a judge needs no GPU.
- **Small PRs, squash-merged by Peter**, each one concern; the conductor reviews every diff before
  merge, including its own.

## Completeness: close the loop
- Every issue is closed by a PR or explicitly moved to the roadmap.
- After each merge: remove the worktree, delete the local branch, and drop throwaway databases.
- Anything not merged by the submission cut goes on the roadmap slide, not into a half-working demo.
