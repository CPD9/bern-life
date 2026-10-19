# Apertus 70B (FP8, ungated community quantisation) on GPU 1, 127.0.0.1:8002: the EXPAND_LLM_* route
# every role uses. Served under its own name, so cached answers say which weights wrote them.
# Another GPU: CUDA_VISIBLE_DEVICES=0 bash serve_70b.sh.
# From CPD9/apertus-redteam-graph, track_1a/infra/runpod/serve_70b_red.sh (Apache-2.0).
. /workspace/venv/bin/activate
export VLLM_USE_FLASHINFER_SAMPLER=0
export HF_HOME=/workspace/.cache/huggingface CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-1}"
# Pinned weights and chat template (PROVENANCE.md), not the head of main, which a new upload would
# move under the cached answers.
REVISION=70378c8df951c9f932e0a28f72e0148d868b5f6b
# The Navigator agent offers the model tools: vLLM reads its tool calls with the `apertus` parser
# of the swiss-ai fork that install_vllm.sh installs.
exec vllm serve onprem-ai/Apertus-v1.5-70B-FP8 \
  --revision "$REVISION" --tokenizer-revision "$REVISION" \
  --served-model-name onprem-ai/Apertus-v1.5-70B-FP8 \
  --host 127.0.0.1 --port 8002 \
  --chat-template-content-format string \
  --gpu-memory-utilization 0.92 \
  --max-model-len 16384 \
  --enable-auto-tool-choice --tool-call-parser apertus
