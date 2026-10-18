# Provenance

Where code, data and models come from. Update this file in the same PR that adds one.

## Code adapted from other projects

| Bern Life file | Adapted from | Licence | Notes |
|---|---|---|---|
| `engine/src/bernlife/lang.py`, `lang_markers.json` | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/lang_profile.py`, `lang_markers.json` (e52f5e1) | Apache-2.0 | de/en/fr/it marker lists copied unchanged; Swiss German and Romansh dropped; falls back to `<html lang>` |
| — | `CPD9/apertus-redteam-graph` `track_1a/src/redteam/cache.py`, `llm.py`, `llm_json.py`, `stats.py` | Apache-2.0 | Planned in briefs I2 and I3. Fill in the row when the port lands. |

## Models

| Model | Revision | Role | Where it runs |
|---|---|---|---|
| `swiss-ai/Apertus-v1.5-70B` (or the `onprem-ai/Apertus-v1.5-70B-FP8` build) | pinned in brief I2 | query expansion, enrichment terms, "why it matches" from retrieved evidence | CSCS API (Swiss) for the demo; vLLM on RunPod for smoke tests only |
| `swiss-ai/Apertus-v1.5-8B` | `ef4bbc54d6fe658bc782280ff9f3b53a10a9758f` | optional fast path, never for facts about people | as above |
| `intfloat/multilingual-e5-small` | pinned in brief E3 | query and passage embeddings, 384-d | CPU, inside the engine container |

No profile field comes from a model's memory. Every field carries a verbatim span from a stored page.

## Data

| Data | Source | Licence / status | In git? |
|---|---|---|---|
| Source configs `sources/*.json` | the case's UniBE subdomain inventory, ARTORG and DCB home pages | facts (host names) | yes |
| Crawled pages, LLM cache, vectors | public pages of the hosts in `sources/` | copyright of the institutions; personal data under nDSG | **no**: SHA-pinned release asset (`make fetch`) |
| Gold set `eval/gold.jsonl` | written by the team from public pages, before search existed | names and proof URLs only | yes |
| Contract fixtures `contracts/fixtures/` | invented, describe no real person | ours | yes |
