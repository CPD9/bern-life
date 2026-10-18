# Conductor handover

For the next conductor session. Read this, then `CLAUDE.md`, `docs/conductor/STATE.md`,
`docs/decisions.md`, `.claude/prompts/README.md`, `handoff/00-shared-context.md`, `docs/quality.md`,
`docs/git-workflow.md`. Then tell Peter the next step.

Written 2026-10-18 ~23:30 by the first conductor.

## Peter's vision (the promised land)
Bern Life is the Research & Expertise Navigator for Bern (HackApertus case, Bern Economic
Development Agency) **lived as a life-sim game of Bern**. A businessperson, researcher or student
moving to Bern:
1. **Lands on the map of Bern as it really is** (real streets, Aare, buildings; W12), taps places,
   tries a search that lights up the institutions holding proven experts.
2. **Joins** (invite-only accounts), **becomes a little Bern bear** (bear family: Bern brown bear,
   polar bear, panda, red panda, marmot, ibex), and goes through onboarding: role, look, expertise,
   goal, visibility, **choose where to settle** (real, sourced district facts).
3. **Sets up an office** — the heart of the game and of the work: furnish it, a **desktop** with apps
   (Navigator, Library, Opportunities, Connections, Reports, Messages, Garage), a **library** shelf of
   saved profiles, pages and uploaded documents, each with its trace, documents opened with their
   sha256, pages, uploader and visibility.
4. **Story mode, "Moving your business to Bern":** eight required quests, each showing one case
   criterion on real data (settle, find experts, ask differently, bring your brief, visit an
   institute, honest no-answer, add a new source, grow in Bern). Quests complete only on app events.
5. **Walks Bern** (W5): from the office across a bridge to the University, enters lobbies, sees who
   works there; the **floatie** (the Navigator agent's face, a small glowing companion like
   Tinkerbell) follows the bear; tap it to chat with the agent, which answers only from its tools
   and can light the map, open profiles and start match reports.
6. **Grows in Bern:** the Market (the Buy tab) of connections and knowledge, opportunities (funding
   calls, BEDA services, innovation parks, coworking spaces as sources), partners, a lab with its
   people (real people are avatars only after joining; before that, cards with sources), messages,
   visiting others' offices, match reports for prospects.
7. **The garage:** the Apertus models as vehicles with their real measured numbers (Apertus only for
   now; Qwen and TwinLLM's benchmarking arena are the next step Peter wants to connect).

Peter's style: he builds through the night, wants speed and soundness together, emotional,
warm design (bears, floatie), and the Lagos-life game's feel (soft panels, HUD, phone, home, map,
buy mode) without its name, art, text or assets, without money or fake activity numbers.

## Non-negotiables
- No profile field from a model's memory; every claim has a verbatim span checked in code (extractor
  verifier, database trigger, evaluator). Model output is retrieval help or explanation from cited
  claims only.
- Apertus through `.env` endpoints only (CSCS via the Keera gateway
  `https://gateway.keera.ch/api/v1`, `apertus-v1-5-70b`; never the `-thinking` models for JSON).
  Every call cached; replay needs no model. Never read, print or copy `.env`; never write keys.
- Real, sourced facts only in the game: no money, no invented prices or counts.
- Gold set frozen (`eval/gold.jsonl`); tuning only on `eval/dev.jsonl`; evaluator table on every
  ranking change; README numbers only from generated files.
- People from public pages are never avatars; no emails or phones stored; uploads private by default.
- Git: only Peter merges (`gh pr merge <n> --squash --admin --delete-branch`); give him commit and
  push commands for conductor PRs (signed `-S -s`, no AI attribution anywhere). Workers commit and
  push their own branches. Never stack PRs; retarget a stacked PR to main before its base merges.
  One migration PR open at a time.

## People
- **Peter (CPD9):** owner, merges, runs three sessions on his 8 GB MacBook (engine, world shell W1,
  world 3D W2). Wants briefs as `/plan @handoff/00-shared-context.md @.claude/prompts/<brief>.md`.
- **Yaseen (`yaseenmohamd`):** infra and backend, very strong: router, evaluator, bundle tools,
  `make run`, accounts, messages, documents, labs, Exoscale hosting. Works on his own machine.
- **Nik (`nik-milcevs`):** world home lane (onboarding, avatar/bears, office, library). New to coding:
  review his PRs line by line, keep them small, remind him: plan first, four checks before push,
  PRs target main.

## Where things are (2026-10-18 ~23:30)
- **Hosted:** https://151-145-197-170.sslip.io (Exoscale CH-GVA-2, ~CHF 34/month on Peter's credits;
  invite-only; search on demo fixtures until the engine and the bundle are deployed there).
- **Search quality (gold, frozen):** recall@10 0.31 → 0.22 (claim rule) → 0.27 (expansion) → 0.36
  (reasons through projects, `via`), MRR 0.43, 100% traceable, 0 invented, 0 false abstentions. The
  case asks 0.80: the gap is real and reported honestly; next levers: dev-tested ranking changes,
  more relation kinds, E4 sources do not affect it.
- **Extraction:** 3,371 profiles (2,922 people), 1,151 model proposals not on their page, all
  dropped; 29/29 gold people present.
- **Open work by lane:** see `.claude/prompts/README.md` and STATE. Briefs written and waiting:
  STORY (W1, built as #95), W4 (W2), W5, W6, W7, W8, W9, W10, W11, W12, W13, E4, G1, S4b, X1 (agent).

## Next priorities (Peter's order)
1. The map first: **W12 really Bern**, with **W13 first run** (map → interact → join → onboarding).
2. **The office**: W6 (Nik: furnish, documents), W8 desktop (W1), W9 library (Nik).
3. Story mode merged and playable on real data (W4 wiring), W11 settle, W5 walk with the floatie.
4. Deploy the engine and the first snapshot bundle to Exoscale, so the hosted site searches for real.
5. X1 agent (floatie chat), E4 opportunities, W10 market, W7 lab and people, G1 garage.
6. Monday: labelling (30-result sheet, confidence practice set), final evaluator run, pitch in BEDA's
   template (`~/Downloads/powerpoint_template.pptx`, never committed), rehearsal.

## Open questions for Peter
Where the Keera gateway runs (sovereignty); physics engine for W5 (Rapier) or not; the Dot Avatar
Maker licence (not used; Nik builds bears from primitives); exact submission time Monday.
