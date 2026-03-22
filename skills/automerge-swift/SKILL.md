---
name: automerge-swift
description: Use when working with Automerge Swift, automerge-swift package, CRDTs in Swift, collaborative/real-time data, Document merge/fork/sync, or any code importing Automerge. Routes to specialized sub-skills for core API, Codable mapping, sync protocol, and API reference. Even if the task seems simple, check this skill first - Automerge has non-obvious patterns that differ from typical Swift data handling.
---

# Automerge Swift Router

Use this router when the request is clearly about Automerge Swift but not yet scoped to one specialist skill.

## When to Use

- The user has an Automerge problem and the right specialist is not obvious yet.
- The prompt mixes concerns across document structure, encoding, and sync.
- You need a high-signal route instead of an exhaustive taxonomy dump.

## Do NOT Skip This Skill

| Your thought | Why it's wrong |
|---|---|
| "I know how CRDTs work" | Automerge's ObjId-based navigation, initial data problem, and schema strategy are unique — generic CRDT knowledge will produce broken code |
| "This is just encoding/decoding" | AutomergeEncoder walks every property every time. High-frequency updates need the core API. The Codable skill has the decision tree |
| "I'll just use String for text" | ScalarValue.String is last-writer-wins. Collaborative text requires ObjType.Text with spliceText. This is the #1 mistake |
| "Merging is straightforward" | Two independently-created documents produce garbage merges. You must fork from a common ancestor. The modeling skill explains why |
| "I can figure out the sync protocol" | SyncState must be persisted per-peer. generateSyncMessage/receiveSyncMessage have ordering requirements. The sync skill covers the full loop |
| "Let me just check the docs" | Automerge Swift docs are sparse. These skills synthesize patterns, gotchas, and decision tables from the full source + DocC |
| "This is a simple bug fix" | Automerge errors (DocError, BindingError, schema drift) have non-obvious root causes. Use automerge-swift-diag |

## Quick Decision

Choose the topic family first, then the right destination:

- Schema design, initial data problem, UTType, save/load, document structure -> `/skill automerge-swift-modeling`
- Errors, debugging, troubleshooting, schema mismatch, merge problems -> `/skill automerge-swift-diag`
- Document creation, ObjId navigation, reading/writing maps/lists -> launch **automerge-reference** agent
- Codable structs, AutomergeEncoder/Decoder, Counter, schema strategy -> launch **automerge-reference** agent
- Collaborative text, AutomergeText, Cursor, Mark, spliceText, formatting -> launch **automerge-reference** agent
- Sync protocol, fork/merge, SyncState, patches, history, diffing -> launch **automerge-reference** agent
- Exact method signature, type definition, "what methods exist on X" -> launch **automerge-reference** agent

## How to Route

**Registered skills** (invoke via `/skill`):

| Skill | Use for |
|-------|---------|
| `automerge-swift` | Broad routing — start here when the right destination is not obvious |
| `automerge-swift-modeling` | Schema design, initial data problem, UTType, save/load |
| `automerge-swift-diag` | Errors, debugging, troubleshooting, merge problems |

**Domain agents** (launch via Agent tool with the given `subagent_type`):

| Agent | subagent_type | Covers |
|-------|--------------|---------|
| automerge-reference | `automerge-swift:automerge-reference` | Document API, ObjId, Codable mapping, collaborative text, sync protocol, API reference |
| automerge-auditor | `automerge-swift:automerge-auditor` | Automated code scan for Automerge anti-patterns |

To launch an agent, pass the user's question as the prompt. The agent runs in isolated context and returns a focused answer without polluting the main conversation.

## When Multiple Apply

- **"Map my model to a document"** -> `/skill automerge-swift-modeling` for schema decisions, then launch **automerge-reference** agent for Codable implementation
- **"Build a collaborative text editor"** -> launch **automerge-reference** agent (covers both text and sync)
- **"Sync and update UI"** -> launch **automerge-reference** agent for the sync loop and patches
- **"Build a collaborative feature from scratch"** -> `/skill automerge-swift-modeling` for schema, then launch **automerge-reference** agent
- **"My merge produced garbage"** -> `/skill automerge-swift-diag` for diagnosis
- **"What's the exact signature for X"** -> launch **automerge-reference** agent directly

## Critical Mental Model

An Automerge `Document` is **not** a Swift dictionary. It's a tree of nested CRDTs:

```
ROOT (Map)
  |-- "title" -> ScalarValue.String("My Doc")
  |-- "items" -> List (ObjId)
  |      |-- [0] -> Map (ObjId)
  |      |       |-- "name" -> Text (ObjId)  <- concurrent edits OK
  |      |       |-- "done" -> ScalarValue.Boolean(false)
```

Every nested Map, List, and Text has its own `ObjId`. You navigate by ObjId, not by key path. The root is always `ObjId.ROOT`.

## Top 5 Gotchas

1. **Text vs String**: `ScalarValue.String` is a single atomic value. `ObjType.Text` supports character-level concurrent edits. Use Text for anything users type collaboratively.

2. **Codable is convenient but expensive**: `AutomergeEncoder` walks every property on every encode. For high-frequency updates (typing, dragging), use the core API to update only what changed.

3. **Timestamps lose precision**: Automerge stores dates as Int64 seconds since epoch. Sub-second granularity is lost. Round-tripped `Date` values may not be `==`.

4. **Schema can drift**: A merge or sync can change the document schema. Your Codable types might not decode anymore. Use `cautiousWrite` on the encoder.

5. **Initial data matters for merges**: Two documents created independently (not forked from a common ancestor) produce unpredictable merges. Always fork from a shared base or sync first.

## Package Setup

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/automerge/automerge-swift", from: "0.5.2")
]

// Target
.target(name: "MyApp", dependencies: [
    .product(name: "Automerge", package: "automerge-swift"),
    // Optional: .product(name: "AutomergeUtilities", package: "automerge-swift")
])
```

## Saving and Loading

```swift
// Save
let bytes: Data = doc.save()  // compacted snapshot

// Load
let doc = try Document(bytes)

// UTType
UTType.automerge  // com.github.automerge, conforms to public.data

// Transferable conformance is built-in
```

## Related Skills and Agents

- `/skill automerge-swift-modeling` for schema design and save/load.
- `/skill automerge-swift-diag` for errors and troubleshooting.
- Launch **automerge-reference** agent for Document API, Codable, text, sync, and API reference lookups.
- Launch **automerge-auditor** agent for code scanning.
