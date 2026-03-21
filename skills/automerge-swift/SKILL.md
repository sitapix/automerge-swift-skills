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

Choose the topic family first, then the skill role:

- Document creation, ObjId navigation, reading/writing maps/lists -> `/skill automerge-swift-core`
- Codable structs, AutomergeEncoder/Decoder, Counter, schema strategy -> `/skill automerge-swift-codable`
- Collaborative text, AutomergeText, Cursor, Mark, spliceText, formatting -> `/skill automerge-swift-text`
- Sync protocol, fork/merge, SyncState, patches, history, diffing -> `/skill automerge-swift-sync`
- Schema design, initial data problem, UTType, save/load, document structure -> `/skill automerge-swift-modeling`
- Errors, debugging, troubleshooting, schema mismatch, merge problems -> `/skill automerge-swift-diag`
- Exact method signature, type definition, "what methods exist on X" -> `/skill automerge-swift-ref`

## Core Guidance

Use the shared routing taxonomy from `skills/catalog.json`:

- `router`: broad intake and redirection (this skill)
- `workflow`: guided implementation patterns (`automerge-swift-core`, `automerge-swift-codable`, `automerge-swift-sync`, `automerge-swift-text`, `automerge-swift-modeling`)
- `diag`: symptom-based troubleshooting (`automerge-swift-diag`)
- `ref`: direct API and behavior reference (`automerge-swift-ref`)

## When Multiple Apply

- **"Map my model to a document"** -> `automerge-swift-modeling` for schema decisions, then `automerge-swift-codable` for implementation
- **"Build a collaborative text editor"** -> `automerge-swift-text` for text patterns, then `automerge-swift-sync` for sync
- **"Sync and update UI"** -> `automerge-swift-sync` for the sync loop, then check patches section for UI updates
- **"Build a collaborative feature from scratch"** -> `automerge-swift-modeling` for schema, then `automerge-swift-codable` or core API
- **"My merge produced garbage"** -> `automerge-swift-diag` for diagnosis
- **"What's the exact signature for X"** -> `automerge-swift-ref` directly

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

## Related Skills

- `/skill automerge-swift-core` for low-level Document API work.
- `/skill automerge-swift-codable` for Codable mapping patterns.
- `/skill automerge-swift-text` for collaborative text editing.
- `/skill automerge-swift-sync` for sync protocol and collaboration.
- `/skill automerge-swift-modeling` for schema design and save/load.
- `/skill automerge-swift-diag` for errors and troubleshooting.
- `/skill automerge-swift-ref` for exact API signatures and type definitions.
