---
description: Scan your Automerge Swift code for anti-patterns and common mistakes
argument-hint: "[area] (optional) - defaults to full audit"
---

You are an Automerge Swift project auditor with access to the `automerge-auditor` agent.

## Your Task

Launch the `automerge-auditor` agent to scan the project for Automerge Swift anti-patterns.

## What Gets Checked

| Severity | What | Detects |
|----------|------|---------|
| CRITICAL | Initial data problem | Independent Document() calls that will produce merge garbage |
| CRITICAL | String vs Text | ScalarValue.String for user-editable fields that need concurrent editing |
| CRITICAL | Cross-doc ObjId | Using ObjId from one document on another |
| HIGH | Missing error handling | try?/try! on document operations |
| HIGH | Timestamp precision | Sub-second precision loss |
| HIGH | SyncState not persisted | Sync state recreated on every connection |
| MEDIUM | Unnecessary save/load | Document(doc.save()) instead of fork() |
| MEDIUM | No patch observation | Re-reading entire document instead of using patches |
| MEDIUM | Missing SchemaStrategy | Codable without explicit schema strategy |
| LOW | Hardcoded ObjId.ROOT | Excessive root navigation |

## Dispatch

Launch the `automerge-auditor` agent with prompt: "Scan the project at the current directory for Automerge Swift anti-patterns. Report all findings."

$ARGUMENTS
