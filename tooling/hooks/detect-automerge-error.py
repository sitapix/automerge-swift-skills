#!/usr/bin/env python3

"""PostToolUse hook for Bash — detect Automerge Swift errors in tool output and suggest skills."""

import re
import sys

# Error patterns → (skill suggestion, short explanation)
PATTERNS = [
    (r"DocError", "automerge-swift-diag", "DocError detected — invalid ObjId, wrong object type, or out-of-bounds access"),
    (r"LoadError", "automerge-swift-diag", "LoadError detected — corrupt or invalid Automerge bytes"),
    (r"CodingKeyLookupError", "automerge-swift-diag", "CodingKeyLookupError — key missing in document, likely schema drift after merge"),
    (r"PathParseError", "automerge-swift-diag", "PathParseError — bad path format (must start with '.' and use [N] for indices)"),
    (r"BindingError", "automerge-swift-diag", "BindingError — AutomergeText/Counter not bound to document"),
    (r"DecodeSyncStateError", "automerge-swift-diag", "DecodeSyncStateError — corrupt SyncState bytes or version mismatch"),
    (r"ReceiveSyncError", "automerge-swift-diag", "ReceiveSyncError — bad sync message, possible corruption in transit"),
    (r"ScalarValueConversionError", "automerge-swift-diag", "ScalarValueConversionError — extracting wrong Swift type from ScalarValue"),
    (r"BooleanScalarConversionError|IntScalarConversionError|FloatingPointScalarConversionError|StringScalarConversionError", "automerge-swift-diag", "Scalar conversion error — type mismatch when extracting value"),
    (r"merge.*duplicate|duplicate.*merge", "automerge-swift-modeling", "Merge producing duplicates — documents likely don't share history (initial data problem)"),
    (r"SchemaStrategy", "automerge-swift-codable", "SchemaStrategy issue — check createWhenNeeded vs cautiousWrite tradeoffs"),
    (r"AutomergeEncoder|AutomergeDecoder", "automerge-swift-codable", "Codable encoding/decoding issue detected"),
    (r"import Automerge", "automerge-swift", "Automerge Swift code detected — use /automerge-swift:ask for guidance"),
]


def check_output(text: str) -> str | None:
    for pattern, skill, message in PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return f"{message}. Try: /skill {skill}"
    return None


def main() -> int:
    if len(sys.argv) < 2:
        return 0

    text = sys.argv[1]
    suggestion = check_output(text)
    if suggestion:
        print(suggestion)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
