# From CPD9/apertus-redteam-graph, track_1a/infra/runpod (Apache-2.0).
set -ex
cd /workspace
[ -d vllm-apertus ] || git clone --depth 1 -b apertus-1-5-final https://github.com/swiss-ai/vllm.git vllm-apertus
cd vllm-apertus && git log -1 --format="%H %cd %s"
python3 -m venv /workspace/venv
. /workspace/venv/bin/activate
pip install -q -U pip uv
# Try precompiled kernels first (fast); fall back to a full build on 64 cores.
VLLM_USE_PRECOMPILED=1 uv pip install -e . || MAX_JOBS=64 TORCH_CUDA_ARCH_LIST="12.0" uv pip install -e . --no-build-isolation
# Apertus 1.5 needs the swiss-ai Transformers fork (pinned commit from the model card).
# No [torch] extra: it would replace the torch build vLLM was installed against.
uv pip install "transformers[vision,audio] @ git+https://github.com/swiss-ai/transformers@3797303dda74844e3d1f8977ff5518bb91f818b4"
python -c "import vllm; print(\"VLLM_OK\", vllm.__version__)"
