#!/usr/bin/env bash
set -euo pipefail

BUNDLED_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/run_with_runtime.sh <python-script> [args...]" >&2
  exit 2
fi

if [[ -x "$BUNDLED_PYTHON" ]]; then
  exec "$BUNDLED_PYTHON" "$@"
fi

exec "${PYTHON:-python3}" "$@"
