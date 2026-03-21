---
description: Natural-language entry point for Automerge Swift. Use when the user has an Automerge question but does not know which skill to invoke.
argument-hint: [question]
---

# Automerge Swift Ask

Use this command when the user has an Automerge Swift problem but not a skill name.

## When to Use

Use this front door for broad Automerge questions, routing-heavy prompts, or requests that mention symptoms instead of APIs.

## Quick Decision

- Broad Automerge question -> `/skill automerge-swift`
- Creating documents, navigating ObjId, reading/writing maps/lists -> `/skill automerge-swift-core`
- Encoding/decoding Codable models, Counter, schema strategy -> `/skill automerge-swift-codable`
- Collaborative text, AutomergeText, Cursor, Mark, spliceText -> `/skill automerge-swift-text`
- Syncing, merging, forking, history, patches -> `/skill automerge-swift-sync`
- Schema design, initial data problem, save/load, UTType -> `/skill automerge-swift-modeling`
- Errors, debugging, "why does my merge/decode fail" -> `/skill automerge-swift-diag`
- Looking up a specific type or method signature -> `/skill automerge-swift-ref`

## Core Guidance

Treat `$ARGUMENTS` as the user's Automerge problem statement.

Use the shared routing taxonomy from `skills/catalog.json`:

- `router`: broad intake and redirection
- `workflow`: guided implementation patterns
- `diag`: symptom-based troubleshooting
- `ref`: direct API and behavior reference

## Routing rules

1. If the request mentions ObjId, put/get, maps, lists, or document creation, use `/skill automerge-swift-core`.
2. If the request mentions Codable, AutomergeEncoder, AutomergeDecoder, Counter, or schema strategy, use `/skill automerge-swift-codable`.
3. If the request mentions AutomergeText, Cursor, Position, Mark, spliceText, text editing, or collaborative text, use `/skill automerge-swift-text`.
4. If the request mentions sync, merge, fork, SyncState, patches, history, changes, or diffing, use `/skill automerge-swift-sync`.
5. If the request mentions schema design, document structure, initial data, skeleton, UTType, Transferable, or save/load, use `/skill automerge-swift-modeling`.
6. If the request mentions errors, debugging, "why does X fail", schema mismatch, or merge producing garbage, use `/skill automerge-swift-diag`.
7. If the request asks for a specific method signature, type definition, or "what methods are available on X", use `/skill automerge-swift-ref`.
8. If the request is broad or ambiguous but obviously about Automerge Swift, use `/skill automerge-swift`.
9. If the request is too ambiguous to route safely, ask exactly one concise clarification question.

## Response style

- Do not explain the full skill taxonomy unless the user asks.
- Prefer acting over describing which route you might take.

## Related Skills

- `/skill automerge-swift` is the broad router when the right specialist is not obvious yet.
- `/skill automerge-swift-core` for low-level Document API work.
- `/skill automerge-swift-codable` for Codable mapping patterns.
- `/skill automerge-swift-text` for collaborative text editing.
- `/skill automerge-swift-sync` for sync protocol and collaboration.
- `/skill automerge-swift-modeling` for schema design and save/load.
- `/skill automerge-swift-diag` for errors and troubleshooting.
- `/skill automerge-swift-ref` for exact API signatures and type definitions.
