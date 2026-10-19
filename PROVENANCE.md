# Provenance

Where code, data and models come from. Update this file in the same PR that adds one.

## Code adapted from other projects

| Bern Life file | Adapted from | Licence | Notes |
|---|---|---|---|
| `engine/src/bernlife/lang.py`, `lang_markers.json` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/lang_profile.py`, `lang_markers.json` (e52f5e1) | Apache-2.0 | de/en/fr/it marker lists copied unchanged; Swiss German and Romansh dropped; falls back to `<html lang>` |
| `engine/src/bernlife/cache.py`, `llm.py`, `llm_http.py`, `llm_json.py` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/cache.py`, `llm.py`, `llm_json.py` (f5e07d3) | Apache-2.0 | Brief I2. Five engine roles instead of target and red team; failures become markers; prompt version in the cache key; audit log. |
| `infra/pack_cache.py` | `CPD9/apertus-redteam-graph` `track_1a/scripts/pack_cache.py` (f5e07d3) | Apache-2.0 | Brief I4. Folds the live call files into the bundle's pack (not the live folder's own) and carries `models.json`. |
| `eval/src/evaluator/stats.py` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/stats.py` (f5e07d3) | Apache-2.0 | Brief I3. `wilson` unchanged; the two-way cluster bootstrap becomes one-way (a base need with its variants). |

## Characters and art

| Bern Life file | Origin | Licence | Notes |
|---|---|---|---|
| `web/features/avatar/` (the bear family) | drawn by the team from three.js primitives | ours | Brief W3-bear. Style reference only: the Apertus Agents avatars in `CPD9/apertus-redteam-graph` `track_1a/web/avatars/`. The Dot Avatar Maker studio that made those was not used: its repo records no licence that allows redistributing it (`track_1a/.gitignore`), so no code or asset from it is in Bern Life. |

## Design references

| Bern Life file | Reference | Licence | Notes |
|---|---|---|---|
| `web/features/agents/skills.ts`, `skill-evidence.ts`, `evidence-list.tsx` (a skill's evidence rows) | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/agent_facts.py` `skill()` and `evidence()` (`ml/win-sprint`, 13f7ec9) | Apache-2.0 | Brief R3. The shape is followed (each row a label, a value and a source); the TypeScript is written anew and no code is copied. |

## Models

| Model | Revision | Role | Where it runs |
|---|---|---|---|
| `swiss-ai/Apertus-v1.5-70B`, served by the event gateway as `apertus-v1-5-70b` | as served by CSCS on the day (`infra/cscs.md`) | every model role: query expansion, enrichment terms, extraction proposals, "why it matches", brief needs | CSCS API (Swiss) through the event gateway, for the demo |
| `onprem-ai/Apertus-v1.5-70B-FP8` | `70378c8df951c9f932e0a28f72e0148d868b5f6b` | as above, for smoke tests | vLLM on RunPod (`infra/runpod/serve_70b.sh`) |
| `swiss-ai/Apertus-v1.5-8B` | `ef4bbc54d6fe658bc782280ff9f3b53a10a9758f` on RunPod | fallback only while no 70B route is set, never for facts about people | the event gateway as `apertus-v1-5-8b`, or vLLM on RunPod (`infra/runpod/serve_8b.sh`) |
| `intfloat/multilingual-e5-small` (MIT) | `614241f622f53c4eeff9890bdc4f31cfecc418b3`; `onnx/model.onnx` sha256 `ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665` | query and passage embeddings, 384-d (`engine/src/bernlife/embed.py`) | CPU via fastembed/ONNX, inside the engine |

No profile field comes from a model's memory. Every field carries a verbatim span from a stored page.

## Data

| Data | Source | Licence / status | In git? |
|---|---|---|---|
| Source configs `sources/*.json` | the case's UniBE subdomain inventory, the ARTORG and DCB home pages, and the public pages of the six opportunity sources (Bern Economic Development Agency, Innosuisse, SNSF, PROGR, Effinger, Switzerland Innovation Park Biel/Bienne) | facts (host names, seed URLs) | yes |
| Crawled pages, LLM cache, vectors | public pages of the hosts in `sources/` | copyright of their publishers, the nine organisations in `sources/`; personal data under nDSG; carried for the replay demo, the hosted copy and the evaluation, with no licence to reuse ([below](#the-snapshot-bundle)) | **no**: SHA-pinned release asset (`make fetch`) |
| Gold set `eval/gold.jsonl` | written by the team from public pages, before search existed | names and proof URLs only | yes |
| Contract fixtures `contracts/fixtures/` | invented, describe no real person | ours | yes |
| Place addresses `web/features/world/places.json` | one street address per unit, a verbatim span of a stored page of its own host (URL, date, sha256 per row) | facts (institutional addresses); no page copies | yes |
| Opportunity place positions in `places.json` | the address's LV95 point in the federal building address register (geo.admin.ch, open data), mapped into the frame of `geography.ts`; coordinates not stored | facts | yes |
| Map geography `web/features/world/geography.ts` | drawn by hand from public maps (Aare, bridges, districts, landmarks), approximate | ours | yes |
| Map geodata `web/public/world/bern.geo` | swisstopo: swissBUILDINGS3D 3.0 (2021 CityGML tiles 1166-24, 1166-41, 1166-42), swissTLM3D roads, water network and railways (geo.admin identify API), building address register (geo.admin search); built by `infra/geo/build.py` | swisstopo free geodata (OGD), use and redistribution allowed with attribution "©swisstopo" | the derived file only (sha256 in `web/public/world/manifest.json`); raw downloads stay in `$BERNLIFE_DATA_DIR/geo/raw` |

## The snapshot bundle

The crawled pages stay their publishers' (copyright, and for people the nDSG). The release bundle
pinned in `bundle.lock` carries them so that the replay demo (`make run`), the hosted copy
([`infra/exoscale.md`](infra/exoscale.md)) and the evaluation all run from the same snapshot, and
grants no licence to reuse them. A page is removed on request by publishing a new bundle without
it, pinning that bundle, withdrawing the earlier release assets that hold it and reloading the
hosted copy from the new bundle; the hosted copy's nightly database backups age out after 14 days.
Git holds no copy of any page, so nothing in its history needs rewriting.
