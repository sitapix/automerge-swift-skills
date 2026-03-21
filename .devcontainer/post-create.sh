#!/usr/bin/env bash

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.uv-cache}"
export npm_config_cache="${npm_config_cache:-$ROOT/.npm-cache}"

mkdir -p "$UV_CACHE_DIR" "$npm_config_cache" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

if command -v sudo >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    jq \
    ripgrep \
    shellcheck
fi

if ! command -v uv >/dev/null 2>&1; then
  python3 -m pip install --user uv
fi

npm run setup
python3 tooling/scripts/quality/validate_plugin.py
