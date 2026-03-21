#!/usr/bin/env bash
# SessionStart hook for automerge-swift plugin
# Detects Automerge Swift projects and injects skill-first guidance.
# Avoiding 'set -euo pipefail' for robustness — hooks must not block startup.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

python3 - "$PLUGIN_ROOT" <<'PYTHON_SCRIPT'
import json, sys, os, subprocess

plugin_root = sys.argv[1]

# Detect whether the workspace uses Automerge Swift
cwd = os.getcwd()
has_automerge = False
detection_hints = []

# 1. Check Package.swift for automerge-swift dependency
pkg_swift = os.path.join(cwd, "Package.swift")
if os.path.isfile(pkg_swift):
    try:
        with open(pkg_swift) as f:
            content = f.read()
        if "automerge-swift" in content.lower() or "automerge" in content.lower():
            has_automerge = True
            detection_hints.append("Package.swift contains automerge-swift dependency")
    except Exception:
        pass

# 2. Quick grep for 'import Automerge' in Swift files (limit depth to avoid long scans)
if not has_automerge:
    try:
        result = subprocess.run(
            ["grep", "-rl", "--include=*.swift", "-m", "1", "import Automerge", cwd],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            has_automerge = True
            detection_hints.append("Swift files import Automerge")
    except Exception:
        pass

# Build context
if has_automerge:
    project_note = f"Automerge Swift project detected ({'; '.join(detection_hints)}). "
else:
    project_note = ""

additional_context = f"""<IMPORTANT>
You have Automerge Swift CRDT skills installed.

{project_note}When working with Automerge Swift code, invoke the appropriate skill BEFORE responding:

- Broad Automerge question -> /skill automerge-swift (router)
- Document creation, ObjId, maps/lists -> /skill automerge-swift-core
- Codable structs, AutomergeEncoder/Decoder -> /skill automerge-swift-codable
- Collaborative text, AutomergeText, Cursor, Mark -> /skill automerge-swift-text
- Sync protocol, fork/merge, patches, history -> /skill automerge-swift-sync
- Schema design, initial data problem, save/load -> /skill automerge-swift-modeling
- Errors, debugging, troubleshooting -> /skill automerge-swift-diag
- API signatures, type definitions -> /skill automerge-swift-ref

Key Automerge gotchas to always keep in mind:
- Documents MUST share history for merges to work (the "initial data problem")
- Use Text (not String) for user-editable fields that need concurrent editing
- Every nested Map/List/Text has its own ObjId — navigate by ObjId, not key path
- Timestamp loses sub-second precision (Int64 seconds)
- fork() shares history; Document() creates independent history
</IMPORTANT>"""

output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": additional_context
    }
}

print(json.dumps(output, indent=2))
PYTHON_SCRIPT

exit 0
