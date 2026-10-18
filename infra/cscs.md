# Apertus at CSCS, through the event gateway

The demo's models run at CSCS (Swiss National Supercomputing Centre). At HackApertus the organisers
hand out keys for the Keera gateway, which forwards to the CSCS Inference API; the engine talks to it
like any OpenAI-compatible endpoint. Keys live in `.env` only: never commit, print or paste one.

## Settings in `.env`

| Name | Value |
|---|---|
| `EXPAND_LLM_BASE_URL` | `https://gateway.keera.ch/api/v1` |
| `EXPAND_LLM_MODEL` | `apertus-v1-5-70b` |
| `EXPAND_LLM_API_KEY` | your gateway key |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | the same gateway with `apertus-v1-5-8b`; used only while `EXPAND_LLM_*` is unset |

Every role (expand, enrich, extract, explain, brief) takes the `EXPAND_LLM_*` route when it is set,
so nothing about people reaches the 8B. The gateway names models its own way; CSCS's direct API
(`https://api.inference.cscs.ch/v1`, which needs a CSCS key) calls the same model
`swiss-ai/Apertus-v1.5-70B`. Set the name your endpoint serves: the router refuses any other
(`model_not_served`).

## Check

    make live                     # mode and model per role, or the marker that stopped it
    make live ARGS="<command>"    # then runs that bernlife command live

`make live` reads `.env` in its own shell, prints model names and never the key or the address, and
stops with a marker (`http_403`, `unreachable`, `model_not_served`) instead of falling back to the
cache. Listing models runs no model, so the check costs nothing.

## Probe, 18 October 2026

Apertus models the gateway served: `apertus-v1-5-70b`, `apertus-v1-5-70b-thinking`,
`apertus-v1-5-8b`, `apertus-v1-5-8b-thinking`. The engine does not use the `-thinking` variants,
which have tool use disabled.

One short message per role ("Antworte mit einem Wort: Hallo", at most 8 tokens). Each answered
"Hallo" and is cached:

| Role | Model | Latency |
|---|---|---|
| expand | `apertus-v1-5-70b` | 584 ms |
| enrich | `apertus-v1-5-70b` | 140 ms |
| extract | `apertus-v1-5-70b` | 223 ms |
| explain | `apertus-v1-5-70b` | 249 ms |
| brief | `apertus-v1-5-70b` | 365 ms |

With no `.env` loaded and the network unreachable, `BERNLIFE_BACKEND=replay` answered all five from
the cache. The same gateway key sent to `https://api.inference.cscs.ch/v1` gets `http_403`: a
gateway key works only at the gateway.

## Cost

CSCS bills cached and uncached input tokens alike, so a loop that resends long context pays every
time. The router reaches the model only on a cache miss and at most `LLM_MAX_CONCURRENCY` (default
4) calls at once. Anything beyond a smoke test needs Peter's go-ahead.
