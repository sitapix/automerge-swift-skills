#!/usr/bin/env bash
# PostToolUse hook for Write|Edit on .swift files
# Catches common Automerge Swift anti-patterns as code is written.
#
# Returns JSON with decision:"block" for critical issues (Claude must fix),
# or additionalContext for warnings.

FILE_PATH="$TOOL_INPUT_FILE_PATH"

# Only check Swift files
[[ "$FILE_PATH" != *.swift ]] && exit 0

# Only check files that exist
[[ ! -f "$FILE_PATH" ]] && exit 0

# Only check files that import Automerge
grep -q "import Automerge" "$FILE_PATH" 2>/dev/null || exit 0

ISSUES=""
CRITICAL=false

# --- CRITICAL: Independent document creation that will break merges ---
# Two Document() calls in the same scope without fork() is almost always
# the "initial data problem" — merges will produce duplicated structures.
# Look for multiple Document() initializers without fork().
DOC_INITS=$(grep -cn 'Document()' "$FILE_PATH" 2>/dev/null || echo "0")
HAS_FORK=$(grep -c '\.fork()' "$FILE_PATH" 2>/dev/null || echo "0")

if [ "$DOC_INITS" -gt 1 ] && [ "$HAS_FORK" -eq 0 ]; then
    LINES=$(grep -n 'Document()' "$FILE_PATH" | head -3)
    ISSUES="${ISSUES}\n[CRITICAL] Multiple Document() calls without fork() — merging these documents will produce duplicated structures instead of merged values. Use doc.fork() to create documents that share history.\nLines: ${LINES}\n"
    CRITICAL=true
fi

# --- WARNING: String where Text should be used ---
# If someone puts a String scalar for a field that sounds user-editable,
# they probably want Text for concurrent editing.
# This is a heuristic — warn, don't block.
if grep -n 'put(obj:.*key:.*value:.*\.String(' "$FILE_PATH" 2>/dev/null | grep -qiE '"(name|title|description|content|body|note|comment|message|bio|text)"'; then
    LINES=$(grep -n 'put(obj:.*key:.*value:.*\.String(' "$FILE_PATH" | grep -iE '"(name|title|description|content|body|note|comment|message|bio|text)"' | head -3)
    ISSUES="${ISSUES}\n[WARNING] ScalarValue.String used for a field that may need concurrent editing. Consider using putObject(obj:key:ty: .Text) + spliceText() instead — String is atomic last-writer-wins, Text supports character-level merging.\nLines: ${LINES}\n"
fi

# --- WARNING: doc.merge without shared history check ---
# Merging documents that were created independently (not forked) produces garbage.
if grep -qn '\.merge(other:' "$FILE_PATH" 2>/dev/null; then
    if ! grep -q '\.fork()' "$FILE_PATH" 2>/dev/null && ! grep -q 'Document(.*bytes\|Document(.*data\|Document(.*saved' "$FILE_PATH" 2>/dev/null; then
        LINES=$(grep -n '\.merge(other:' "$FILE_PATH" | head -3)
        ISSUES="${ISSUES}\n[WARNING] merge(other:) called but no fork() or Document(bytes) found — documents must share history for merges to work correctly. See the 'initial data problem' in /skill automerge-swift-modeling.\nLines: ${LINES}\n"
    fi
fi

# Output results
if [ -n "$ISSUES" ]; then
    ESCAPED_ISSUES=$(echo -e "$ISSUES" | sed 's/"/\\"/g' | tr '\n' ' ')

    if [ "$CRITICAL" = "true" ]; then
        cat <<ENDJSON
{
  "decision": "block",
  "reason": "Automerge guardrail: Multiple Document() without fork() will cause the 'initial data problem' — merges will produce duplicated structures. Use doc.fork() to create documents that share history, or load from shared bytes with Document(bytes).",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "${ESCAPED_ISSUES}"
  }
}
ENDJSON
    else
        cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "${ESCAPED_ISSUES}"
  }
}
ENDJSON
    fi
fi

exit 0
