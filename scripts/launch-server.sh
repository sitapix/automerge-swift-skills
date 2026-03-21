#!/bin/zsh
set -eu

export AUTOMERGE_SWIFT_DOCS_AUTO_SYNC="${AUTOMERGE_SWIFT_DOCS_AUTO_SYNC:-0}"
export AUTOMERGE_SWIFT_DOCS_DEBUG_LOG="${AUTOMERGE_SWIFT_DOCS_DEBUG_LOG:-/tmp/automerge-swift-docs-mcp.log}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$SCRIPT_DIR/src/server.mjs"
