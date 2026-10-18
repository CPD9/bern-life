# Decisions

Newest first. Each entry: date, decision, why, who.

## 2026-10-18 20:00 — The world you live in (Peter, conductor)
- Walking (W5): kinematic movement with collision and click-to-walk, no physics engine unless Peter
  approves one; enter places through doors; your office plot on the map.
- Office (W6): furnish your office on a grid; documents on the desk open with their trace (sha256,
  size, pages, uploader, date, visibility); uploads private by default, stored outside git (S4a).
- Labs and people (W7, S4b): a real person becomes an avatar only after joining and accepting;
  before that a card with public profile and sources; demo members only in fixture mode.
- Hosting S3 on Exoscale (Swiss zone, Peter's credits), invite-only.

## 2026-10-18 14:30 — Platform features during the hackathon, and who merges (Peter)
- **Built overnight, not after:** the agent with tools (the Navigator character drives the map), the
  match report (PDF + live map link), the inquiry inbox, the sources admin (add a source by URL,
  re-crawl, health), spaces and talent as sources, feedback labels. Conditions: the inbox uses a web
  form and invented inquiries, never a real mailbox; feedback tunes only on a separate dev query set,
  never `eval/gold.jsonl`; spaces and talent figures carry a source and a date like every claim; the
  agent sends nothing outside the app without a click. No PostGIS: distances come from the map
  frame (W2: 1 unit ≈ 20 m, Zytglogge at the origin) and are shown as approximate. Order by value; what is not merged by Monday 08:00 goes on the roadmap slide.
- **Only Peter merges.** Ruleset `main`: updates restricted to the admin via PR, code-owner review
  (`* @CPD9`) after the last push. Yaseen (`yaseenmohamd`) and Nik (`nik-milcevs`) have write access.

## 2026-10-18 afternoon — The world is in the hackathon (Peter)
- **The life-sim world joins the submission**, built overnight in three.js (React Three Fiber +
  drei): game shell, phone with the Ask app as the Navigator, a stylised 3D Bern where institutions
  are places that light up by match. Peter: the format is proven, and its founder built hers in one
  night. The engine still stands alone for the jury (`/navigator`, `make run`).
- **People from public pages are never avatars.** They appear as entries with sources in a place's
  panel; an avatar is for a person who joins and claims a profile. Agents (Navigator, Scout,
  Matchmaker) are the characters in the world. (Raised in Yaseen's plan; adopted by the conductor;
  Peter may overrule.)
- **Honest HUD:** real counts only; no money, no "online" numbers, no invented activity.
- **Map without tiles:** a hand-simplified Bern (Aare loop, districts) in three.js, no map service,
  so it runs air-gapped. Institution positions come from addresses on their own pages, with the span.
- **From Yaseen's plan, adopted:** pitch in BEDA's template; his demo storyline; field completeness
  metric; per-unit caps and no prominence boost; aspect matrix and gaps for a brief; sitemap seeding;
  `EntityRelation`. Not adopted: Apertus 8B as default for people data (measured
  15/18 confirmations of invented personal details).

## 2026-10-18 — Base decisions (Peter, conductor)
- **Postgres 17 + pgvector, schema in Prisma (`db/`).** Scalability matters and work continues after
  the hackathon; the world layer will need users and claims in the same database. The Python engine
  uses raw SQL against the Prisma-made tables, so there is one schema. Search is one SQL statement
  (full-text rank + HNSW cosine, fused with reciprocal rank fusion), filters inside the index scan.
- **Embeddings: `intfloat/multilingual-e5-small` via fastembed/ONNX on CPU.** Lay-term and
  cross-language matching without torch or a GPU; MIT licence.
- **Snapshot bundle out of git.** Pages, model cache and vectors ship as a SHA-pinned release asset.
  Git history cannot forget a person (nDSG deletion path), and the pages belong to the institutions.
  The repo keeps code, configs, the gold set and short evidence spans.
- **No emails or phone numbers stored.** Data minimisation; the source page link is the contact path.
- **Models:** CSCS API (Swiss National Supercomputing Centre) for the demo and enrichment; Peter's
  RunPod vLLM (not Swiss) only for smoke tests. The same vLLM serve scripts run Apertus on local or
  air-gapped hardware, which is the sovereignty story; replay needs no model at all.
- **Brief upload is the demo story.** From Peter's "Bern Social Network" diagram: a company sends a
  project description, Apertus reads the needs (each tied to a sentence of the brief), the same
  search finds matched experts with evidence. The gold set still uses short queries, as the case
  asks.
- **Seeds:** the 22 hosts Peter supplied from the case inventory: 20 UniBE institutes and platforms,
  ARTORG, Diabetes Center Berne.
