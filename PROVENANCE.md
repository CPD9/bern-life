# Provenance

Where code, data and models come from. Update this file in the same PR that adds one.

## Code adapted from other projects

| Bern Life file | Adapted from | Licence | Notes |
|---|---|---|---|
| `engine/src/bernlife/lang.py`, `lang_markers.json` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/lang_profile.py`, `lang_markers.json` (e52f5e1) | Apache-2.0 | de/en/fr/it marker lists copied unchanged; Swiss German and Romansh dropped; falls back to `<html lang>` |
| `engine/src/bernlife/cache.py`, `llm.py`, `llm_http.py`, `llm_json.py` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/cache.py`, `llm.py`, `llm_json.py` (f5e07d3) | Apache-2.0 | Brief I2. Five engine roles instead of target and red team; failures become markers; prompt version in the cache key; audit log. |
| `eval/src/evaluator/stats.py` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/stats.py` (f5e07d3) | Apache-2.0 | Brief I3. `wilson` unchanged; the two-way cluster bootstrap becomes one-way (a base need with its variants). |

## Models

| Model | Revision | Role | Where it runs |
|---|---|---|---|
| `swiss-ai/Apertus-v1.5-70B`, served by the event gateway as `apertus-v1-5-70b` | as served by CSCS on the day (`infra/cscs.md`) | every model role: query expansion, enrichment terms, extraction proposals, "why it matches", brief needs | CSCS API (Swiss) through the event gateway, for the demo |
| `onprem-ai/Apertus-v1.5-70B-FP8` | `70378c8df951c9f932e0a28f72e0148d868b5f6b` | as above, for smoke tests | vLLM on RunPod (`infra/runpod/serve_70b.sh`) |
| `swiss-ai/Apertus-v1.5-8B` | `ef4bbc54d6fe658bc782280ff9f3b53a10a9758f` on RunPod | fallback only while no 70B route is set, never for facts about people | the event gateway as `apertus-v1-5-8b`, or vLLM on RunPod (`infra/runpod/serve_8b.sh`) |
| `intfloat/multilingual-e5-small` | pinned in brief E3 | query and passage embeddings, 384-d | CPU, inside the engine container |

No profile field comes from a model's memory. Every field carries a verbatim span from a stored page.

## Data

| Data | Source | Licence / status | In git? |
|---|---|---|---|
| Source configs `sources/*.json` | the case's UniBE subdomain inventory, ARTORG and DCB home pages | facts (host names) | yes |
| Crawled pages, LLM cache, vectors | public pages of the hosts in `sources/` | copyright of the institutions; personal data under nDSG | **no**: SHA-pinned release asset (`make fetch`) |
| Gold set `eval/gold.jsonl` | written by the team from public pages, before search existed | names and proof URLs only | yes |
| Contract fixtures `contracts/fixtures/` | invented, describe no real person | ours | yes |
| Place addresses `web/features/world/places.json` | one street line per unit from its own home or contact page (URL, date, sha256 per row) | facts (institutional addresses); no page copies | yes |
| Map geography `web/features/world/geography.ts` | drawn by hand from public maps (Aare, bridges, districts, landmarks), approximate | ours | yes |
