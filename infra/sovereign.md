# The sovereign path: Apertus on your own GPUs, or no model at all

The demo's model calls go to CSCS, the Swiss National Supercomputing Centre
([`cscs.md`](cscs.md)). The same engine also runs against Apertus served by vLLM on GPUs you
control, or answers from the snapshot bundle with no model and no network. Only values in `.env`
change, never the code.

The serve scripts ran on RunPod for smoke tests ([`runpod/README.md`](runpod/README.md)). Neither
path below was rehearsed end to end for the submission: no loopback endpoint answered here, so
these are the documented commands, not a recorded run. GPUs cost money: nothing runs without
Peter's go-ahead.

## Apertus on your own GPUs

The 70B FP8 build ran on one 96 GB GPU (RTX PRO 6000 Blackwell); an 80 GB card is untested and may
be too small for the weights plus the cache at `--max-model-len 16384`. The scripts were written
for a two-GPU pod: `serve_70b.sh` uses GPU 1 and the optional 8B GPU 0, unless
`CUDA_VISIBLE_DEVICES` is set in the shell. On a host with one GPU, run
`CUDA_VISIBLE_DEVICES=0 bash serve_70b.sh`. The scripts keep the virtualenv and the Hugging
Face cache in `/workspace`; on another machine, make that directory on a disk with room for the
weights (about 70 GB for the 70B FP8).

| Script (`infra/runpod/`) | What | Listens on | Pinned at |
|---|---|---|---|
| `install_vllm.sh` | the swiss-ai vLLM fork and the swiss-ai Transformers fork | | Transformers `3797303dda74844e3d1f8977ff5518bb91f818b4`; vLLM: a branch only (below) |
| `serve_70b.sh` | `onprem-ai/Apertus-v1.5-70B-FP8`, every model role | `127.0.0.1:8002` | `70378c8df951c9f932e0a28f72e0148d868b5f6b`, weights and tokenizer |
| `serve_8b.sh` | `swiss-ai/Apertus-v1.5-8B`, smoke tests only, never facts about people | `127.0.0.1:8000` | `ef4bbc54d6fe658bc782280ff9f3b53a10a9758f`, weights and tokenizer |

On the GPU host, in `/workspace`:

```bash
bash install_vllm.sh
bash serve_70b.sh    # the 70B FP8 build is not gated; the 8B needs `hf auth login` once
```

A GPU host with no internet: on a connected machine with the same OS and CUDA, run
`install_vllm.sh` and download the pinned weights into `/workspace`, copy `/workspace` across, and
start offline:

```bash
. /workspace/venv/bin/activate                       # connected machine
HF_HOME=/workspace/.cache/huggingface hf download onprem-ai/Apertus-v1.5-70B-FP8 \
  --revision 70378c8df951c9f932e0a28f72e0148d868b5f6b
HF_HUB_OFFLINE=1 bash serve_70b.sh                   # GPU host, after the copy
```

Both serve scripts pass `--host 127.0.0.1`, so nothing on the GPU host listens on a public
interface, and vLLM takes no key: the SSH tunnel is the access control, so the GPU host must be
yours alone. Anyone else with a shell there could call the model, or answer on its port in its
place. On a shared host, add `--api-key <key>` to the serve script's `vllm serve` line and put the
same key in `EXPAND_LLM_API_KEY`. From the machine that runs the engine:

```bash
ssh -N -L 127.0.0.1:8002:127.0.0.1:8002 <gpu-host>
```

Then in that machine's `.env`:

| Name | Value |
|---|---|
| `EXPAND_LLM_BASE_URL` | `http://127.0.0.1:8002/v1` |
| `EXPAND_LLM_MODEL` | `onprem-ai/Apertus-v1.5-70B-FP8`, required: left empty, the engine takes whatever one model answers on the port |
| `EXPAND_LLM_API_KEY` | empty on a host of your own: the engine then sends no `Authorization` header; the vLLM key on a shared one |

Every role takes this route while it is set, and the engine stops with `model_not_served` when the
port serves any other model, such as the 8B tunnelled there by mistake. `make live` prints the mode
and the model per role, or stops with a marker (`unreachable`, `model_not_served`);
`make live ARGS="<command>"` then runs that engine command against it. Answers are cached under the
served name, `onprem-ai/Apertus-v1.5-70B-FP8`, so they never mix with the gateway's
`apertus-v1-5-70b`: the bundle's recorded answers are not reused on this route, and each new call
reaches the GPU once.

### Pinned revisions

- **Weights and chat template:** `--revision` and `--tokenizer-revision` in the serve scripts, the
  same hashes as [`PROVENANCE.md`](../PROVENANCE.md). Serving another commit means new cached
  answers: change the script and `PROVENANCE.md` together.
- **vLLM is not pinned yet.** `install_vllm.sh` clones the branch `apertus-1-5-final` and prints the
  commit it got (`git log -1`). To pin it, record that hash in `PROVENANCE.md` and check it out
  after the clone (`git -C vllm-apertus checkout <hash>`, with a full clone instead of
  `--depth 1`). No hash is recorded in the repo.
- **The full-precision `swiss-ai/Apertus-v1.5-70B`**, which CSCS serves, has no pinned revision
  here. To serve it yourself, read the commit the Hub serves today,
  `python3 -c "from huggingface_hub import HfApi; print(HfApi().model_info('swiss-ai/Apertus-v1.5-70B').sha)"`,
  set it as `REVISION` in a copy of `serve_70b.sh`, and record it in `PROVENANCE.md`. Its bf16
  weights are about 140 GB, so that copy needs two 80 GB GPUs and `--tensor-parallel-size 2`.

## Air-gapped replay

No GPU, no key, no network. The engine answers every model call from the cache in the snapshot
bundle (`BERNLIFE_BACKEND=replay`, which `make run`'s services set). A call the bundle did not
record is a cache miss inside the engine, never a request: that question is searched without
expansion and keeps the plain reason.

On a connected machine, in a clone at the commit you will run:

```bash
make fetch                # the bundle in bundle.lock; sha256 and every file checked
make run && make stop     # builds the images; the first start downloads the embedding model
docker save -o bernlife-images.tar $(docker compose --profile run config --images)
docker run --rm -v bernlife_models:/app/data/models:ro --entrypoint tar bernlife-engine \
  -cf - -C /app/data/models . > bernlife-models.tar
```

Copy to the air-gapped machine: the tracked files (`git ls-files | tar -czf repo.tar.gz -T -`), the
verified tarball that `make fetch` kept in `${BERNLIFE_DATA_DIR:-data}/downloads/` (its name is
`asset` in `bundle.lock`), `bernlife-images.tar` and `bernlife-models.tar`. There, in the unpacked
clone:

```bash
python3 infra/fetch_bundle.py --archive <tarball>   # the same checks, no download
docker load -i bernlife-images.tar
docker run --rm -i -v bernlife_models:/app/data/models --entrypoint tar bernlife-engine \
  -xf - -C /app/data/models < bernlife-models.tar
BERNLIFE_BUNDLE_DIR="$PWD/data/bundle" \
  docker compose --profile run up -d --no-build --wait migrate load serve web
python3 -m infra.check_hosted --url http://127.0.0.1:3000
```

The last line asks the app's `/api/health` and compares its version and counts with the bundle's.
`--no-build` matters: `make run` rebuilds, which needs the network. Compose warns that it did not
create the `bernlife_models` volume; that is expected. Docker's classic image store may drop the
registry digest that `compose.yaml` pins for Postgres on `docker load`, and compose would then try
to pull it; the containerd image store keeps it.
