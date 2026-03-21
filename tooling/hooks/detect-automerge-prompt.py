#!/usr/bin/env python3

"""UserPromptSubmit hook — detect Automerge-related questions and nudge toward skills."""

import re
import sys

# Prompt patterns → skill suggestion
PATTERNS = [
    (r"\b(automerge|crdt|conflict.free)\b", "automerge-swift", "Automerge question detected — use /automerge-swift:ask for guided routing"),
    (r"\b(ObjId|objid|obj_id)\b", "automerge-swift-core", "ObjId question — try /skill automerge-swift-core for Document API guidance"),
    (r"\b(AutomergeEncoder|AutomergeDecoder|SchemaStrategy|schema.?strategy)\b", "automerge-swift-codable", "Codable layer question — try /skill automerge-swift-codable"),
    (r"\b(AutomergeText|spliceText|updateText|text.*cursor|cursor.*text)\b", "automerge-swift-text", "Collaborative text question — try /skill automerge-swift-text"),
    (r"\b(SyncState|sync.*state|receiveSyncMessage|generateSyncMessage)\b", "automerge-swift-sync", "Sync protocol question — try /skill automerge-swift-sync"),
    (r"\b(fork|merge.*document|document.*merge)\b", "automerge-swift-sync", "Fork/merge question — try /skill automerge-swift-sync"),
    (r"\b(DocError|LoadError|BindingError|decode.*fail|schema.*mismatch)\b", "automerge-swift-diag", "Automerge error — try /skill automerge-swift-diag for troubleshooting"),
]


def check_prompt(text: str) -> str | None:
    for pattern, skill, message in PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return message
    return None


def main() -> int:
    if len(sys.argv) < 2:
        return 0

    text = sys.argv[1]
    suggestion = check_prompt(text)
    if suggestion:
        print(suggestion)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
