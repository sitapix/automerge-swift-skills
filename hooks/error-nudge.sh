#!/usr/bin/env bash
# PostToolUse hook for Bash — pattern-match Automerge Swift errors and nudge toward skills.
# Returns additionalContext suggestions; never blocks.

O="$CLAUDE_TOOL_OUTPUT"

# Exit early if output is empty or very short
[ ${#O} -lt 10 ] && exit 0

HINTS=""

# DocError / LoadError — core document operation failures
if echo "$O" | grep -qE "DocError|LoadError|doc\.save|Document\(.*bytes"; then
    HINTS="${HINTS}Automerge document error detected. Try: /skill automerge-swift-diag\n"
fi

# CodingKeyLookupError / PathParseError — Codable layer issues
if echo "$O" | grep -qE "CodingKeyLookupError|PathParseError|AutomergeEncoder|AutomergeDecoder|DecodingError.*Automerge"; then
    HINTS="${HINTS}Automerge Codable error detected. Try: /skill automerge-swift-codable or /skill automerge-swift-diag\n"
fi

# BindingError — AutomergeText/Counter not bound to document
if echo "$O" | grep -qE "BindingError|not bound|AutomergeText.*error|Counter.*error"; then
    HINTS="${HINTS}Automerge binding error detected. Try: /skill automerge-swift-diag\n"
fi

# Sync errors — corrupt sync state or bad sync messages
if echo "$O" | grep -qE "DecodeSyncStateError|ReceiveSyncError|SyncState.*error|generateSyncMessage|receiveSyncMessage.*error"; then
    HINTS="${HINTS}Automerge sync error detected. Try: /skill automerge-swift-sync or /skill automerge-swift-diag\n"
fi

# Merge producing unexpected results
if echo "$O" | grep -qE "merge.*duplicate|merge.*garbage|merge.*unexpected|doc\.merge.*error"; then
    HINTS="${HINTS}Automerge merge issue detected. Try: /skill automerge-swift-modeling (initial data problem) or /skill automerge-swift-diag\n"
fi

# ObjId errors — wrong document, invalid ObjId
if echo "$O" | grep -qE "ObjId.*invalid|invalid.*ObjId|objectType.*nil|object not found"; then
    HINTS="${HINTS}Automerge ObjId error detected. Try: /skill automerge-swift-core\n"
fi

# ScalarValue conversion errors
if echo "$O" | grep -qE "ScalarValueConversionError|ScalarValue.*conversion|unexpected scalar"; then
    HINTS="${HINTS}Automerge type conversion error detected. Try: /skill automerge-swift-diag\n"
fi

# Output hints if any matched
if [ -n "$HINTS" ]; then
    ESCAPED=$(echo -e "$HINTS" | sed 's/"/\\"/g' | tr '\n' ' ')
    cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "${ESCAPED}"
  }
}
ENDJSON
fi

exit 0
