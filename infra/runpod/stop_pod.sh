#!/usr/bin/env bash
# Stop the model servers, then the pod itself, so billing ends. Run on the pod:
#   ssh -p <PORT> root@<IP> 'bash /workspace/stop_pod.sh'
# The pod's own RunPod credentials live in the environment of PID 1; nothing is typed in.
# From CPD9/apertus-redteam-graph, track_1a/infra/runpod (Apache-2.0).
set -euo pipefail

# One variable of PID 1's environment, read as text and never run as shell code.
pod_env() {
  local value
  value=$(tr '\0' '\n' < /proc/1/environ | sed -n "s/^$1=//p")
  if [[ -z $value ]]; then
    echo "$1 is not in the pod's environment; stop the pod in the RunPod console" >&2
    exit 1
  fi
  printf '%s\n' "$value"
}

pkill -f "[v]llm serve" || true
sleep 3
# Shows that the GPUs are free; a failure here must not keep the pod billing.
nvidia-smi --query-gpu=memory.used --format=csv,noheader || true
RUNPOD_API_KEY=$(pod_env RUNPOD_API_KEY)
RUNPOD_POD_ID=$(pod_env RUNPOD_POD_ID)
export RUNPOD_API_KEY RUNPOD_POD_ID
runpodctl stop pod "$RUNPOD_POD_ID"
