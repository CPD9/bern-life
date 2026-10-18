# Apertus on RunPod (vLLM), for smoke tests

The demo runs on CSCS (`infra/cscs.md`). RunPod is not in Switzerland, so it serves smoke tests
only. The same scripts run Apertus on local or air-gapped GPUs. Peter owns the pod; nothing runs on
it without his go-ahead.

Pod: two GPUs with at least 80 GB each (the recorded runs used 2 × RTX PRO 6000 Blackwell, 96 GB).

## Start

From the laptop, copy the scripts up:

    scp -P <PORT> infra/runpod/*.sh root@<IP>:/workspace/

On the pod, in `/workspace`:

1. `bash install_vllm.sh`: the swiss-ai vLLM fork `apertus-1-5-final` and the swiss-ai
   Transformers fork at the commit the model card names.
2. `hf auth login`, by hand: the 8B is gated, the 70B FP8 build is not.
3. `bash serve_70b.sh`: `onprem-ai/Apertus-v1.5-70B-FP8` on GPU 1, `127.0.0.1:8002`.
4. Optional: `bash serve_8b.sh`: `swiss-ai/Apertus-v1.5-8B` on GPU 0, `127.0.0.1:8000`.

## Tunnel

Both ends listen on loopback only:

    ssh -N -L 127.0.0.1:8002:127.0.0.1:8002 -L 127.0.0.1:8000:127.0.0.1:8000 -p <PORT> root@<IP>

Then in `.env`: `EXPAND_LLM_BASE_URL=http://127.0.0.1:8002/v1` with `EXPAND_LLM_MODEL` empty (the
one served model is used), and `LLM_BASE_URL=http://127.0.0.1:8000/v1` if the 8B runs. Check with
`make live`: it prints the model per role or stops.

## Gotchas

- The pod's SSH port changes on every restart. Read it again from the RunPod Connect panel.
- A pod without a network volume is wiped on stop, and `/workspace` here lives on the container
  disk: rerun steps 1 and 2 after a reset.
- Peter adds your public key to the pod (RunPod → Settings → SSH public keys).
- The serve scripts pin `--revision` and `--tokenizer-revision`, so vLLM loads fixed weights and
  chat template, not whatever is on the Hub that day. Serving another commit means new cached
  answers, never editing a script alone.
- `VLLM_USE_FLASHINFER_SAMPLER=0` works around FlashInfer's architecture check failing on Blackwell.

## Stop

Stop the pod when done, so billing ends (this also stops the model servers):

    ssh -p <PORT> root@<IP> 'bash /workspace/stop_pod.sh'
