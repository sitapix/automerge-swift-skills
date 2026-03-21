---
name: automerge-swift-sync
description: Use when synchronizing Automerge documents between peers, implementing sync protocols over network/WebSocket, forking and merging documents, tracking change history, reading historical values, using patches for UI updates, or working with SyncState, ChangeHash, Change, Patch, or PatchAction types. Also use when asking 'how do I sync automerge documents', 'how do merges work', or 'how do I get notified of changes'.
---

# Automerge Swift Sync, Fork, Merge & History

## Real questions this skill answers

- "How do I sync two Automerge documents over a network?"
- "How do I fork a document and merge it back?"
- "How do I use SyncState with WebSocket or Bluetooth?"
- "How do I get patches to update my UI after a merge?"
- "How do I read the change history of a document?"
- "Do I need to persist SyncState between sessions?"

---

Automerge documents are network-agnostic. The library gives you bytes to send and accepts bytes to receive — you choose the transport (WebSocket, Bluetooth, file sync, etc.).

## Fork and Merge

The simplest form of collaboration: fork a document, edit independently, merge back.

```swift
let doc = Document()
// ... set up initial data ...

// Fork creates an in-memory copy sharing history
let fork = doc.fork()

// Edit independently
try doc.put(obj: ObjId.ROOT, key: "color", value: .String("blue"))
try fork.put(obj: ObjId.ROOT, key: "color", value: .String("red"))

// Merge — both changes are now in doc
try doc.merge(other: fork)
// "color" is now in conflict — getAll returns both values
```

### Merge with Patches (for UI updates)

```swift
let patches = try doc.mergeWithPatches(other: fork)
for patch in patches {
    print(patch.path.stringPath())  // e.g. ".color"
    print(patch.action)             // e.g. .Put(ObjId, Prop, Value)
}
```

## The Sync Protocol

For ongoing peer-to-peer sync, use `SyncState` with `generateSyncMessage` / `receiveSyncMessage`. This is more efficient than re-sending the whole document — it only transfers the changes each peer is missing.

### The Sync Loop

```swift
let doc1 = Document()
let doc2 = doc1.fork()  // must share history for predictable sync

// Each peer maintains a SyncState for each remote peer
let syncState1 = SyncState()  // doc1's view of doc2
let syncState2 = SyncState()  // doc2's view of doc1

// Sync loop — run until both return nil
var quiet = false
while !quiet {
    quiet = true

    // doc1 -> doc2
    if let msg = doc1.generateSyncMessage(state: syncState1) {
        quiet = false
        try doc2.receiveSyncMessage(state: syncState2, message: msg)
    }

    // doc2 -> doc1
    if let msg = doc2.generateSyncMessage(state: syncState2) {
        quiet = false
        try doc1.receiveSyncMessage(state: syncState1, message: msg)
    }
}
// Both docs are now identical
```

### Key Rules

1. **One SyncState per peer pair**: If doc1 syncs with doc2 and doc3, it needs two SyncStates.
2. **Keep calling until nil**: `generateSyncMessage` returns `nil` when there's nothing left to send. Multiple round trips may be needed.
3. **SyncState is persistent**: Save it between sessions to avoid re-syncing everything.

```swift
// Save sync state
let stateBytes = syncState.encode()
// ... persist stateBytes ...

// Restore sync state
let restored = try SyncState(bytes: savedBytes)

// Reset if corrupted
syncState.reset()

// Check what the other peer has
let theirHeads: Set<ChangeHash> = syncState.theirHeads
```

### Sync with Patches (for UI updates)

```swift
let patches = try doc.receiveSyncMessageWithPatches(state: syncState, message: msg)
for patch in patches {
    // Update UI based on what changed
    handlePatch(patch)
}
```

## Network Integration Pattern

The sync protocol is transport-agnostic. Here's the pattern for any network layer:

```swift
class SyncManager {
    let doc: Document
    var syncStates: [PeerID: SyncState] = [:]

    // Call when you want to push changes to a peer
    func sendChanges(to peer: PeerID, send: (Data) -> Void) {
        let state = syncStates[peer, default: SyncState()]
        syncStates[peer] = state

        while let msg = doc.generateSyncMessage(state: state) {
            send(msg)
        }
    }

    // Call when you receive a message from a peer
    func receiveMessage(_ msg: Data, from peer: PeerID) throws -> [Patch] {
        let state = syncStates[peer, default: SyncState()]
        syncStates[peer] = state

        return try doc.receiveSyncMessageWithPatches(state: state, message: msg)
    }
}
```

## Alternative: Manual Change Tracking

For simpler scenarios (one-way sync, append-only logs), you can work with raw changes instead of the sync protocol:

```swift
// Encode only new changes since last save
let newChanges: Data = doc.encodeNewChanges()

// Encode changes since a specific point
let changes: Data = doc.encodeChangesSince(heads: lastKnownHeads)

// Apply encoded changes (from another peer)
try doc.applyEncodedChanges(encoded: receivedChanges)

// Apply with patches for UI updates
let patches = try doc.applyEncodedChangesWithPatches(encoded: receivedChanges)
```

## History and Change Inspection

Every mutation creates a `Change` identified by a `ChangeHash`. The document's current state is identified by its "heads" — the set of latest changes.

### Heads

```swift
// Current heads (one per concurrent branch)
let heads: Set<ChangeHash> = doc.heads()

// After a merge, heads may reduce (concurrent branches joined)
```

### Inspecting Changes

```swift
// All changes in order
let history: [Change] = doc.getHistory()

for change in history {
    print(change.hash)               // ChangeHash — unique ID
    print(change.actorId)            // ActorId — who made it
    print(change.deps)               // [ChangeHash] — dependencies
    print(change.message ?? "none")  // optional commit message
    print(change.timestamp)          // optional timestamp
}

// Get a specific change
let change = doc.change(hash: someHash)

// Commit with metadata (call before save)
try doc.commitWith(message: "Added contact", timestamp: Date.now)
```

### Diffing

```swift
// What changed between two points in history
let patches = try doc.difference(from: oldHeads, to: newHeads)

// What changed since a point
let patches = try doc.difference(since: oldHeads)

// What changed up to a point
let patches = try doc.difference(to: targetHeads)
```

### Reading Historical Values

Every read method has an `At` variant that accepts heads:

```swift
let oldHeads: [ChangeHash] = [...]

// Map values at a point in time
let val = try doc.getAt(obj: ObjId.ROOT, key: "title", heads: oldHeads)
let keys = try doc.keysAt(obj: mapId, heads: oldHeads)
let entries = try doc.mapEntriesAt(obj: mapId, heads: oldHeads)

// List values at a point in time
let item = try doc.getAt(obj: listId, index: 0, heads: oldHeads)
let vals = try doc.valuesAt(obj: listId, heads: oldHeads)

// Text at a point in time
let text = try doc.textAt(obj: textId, heads: oldHeads)
let marks = try doc.marksAt(obj: textId, heads: oldHeads)

// Size at a point in time
let len = try doc.lengthAt(obj: objId, heads: oldHeads)
```

## Patches — What Changed

Patches tell you exactly what changed, for updating UI efficiently.

### Patch Structure

```swift
struct Patch {
    let action: PatchAction  // what happened
    let path: [PathElement]  // where in the tree
}

struct PathElement {
    let obj: ObjId
    let prop: Prop  // .Key(String) or .Index(Int64)
}

// Convert path to readable string
let pathStr = patch.path.stringPath()  // ".items[0].name"
```

### PatchAction Cases

| Action | Meaning |
|--------|---------|
| `.Put(ObjId, Prop, Value)` | Value was set |
| `.Insert(obj:index:values:)` | Items inserted into list |
| `.DeleteMap(ObjId, String)` | Key deleted from map |
| `.DeleteSeq(DeleteSeq)` | Range deleted from list |
| `.Increment(ObjId, Prop, Int64)` | Counter incremented |
| `.SpliceText(obj:index:value:marks:)` | Text was spliced |
| `.Marks(ObjId, [Mark])` | Marks changed on text |
| `.Conflict(ObjId, Prop)` | Concurrent conflict detected |

### Pattern: Patch-Based UI Updates

```swift
func handlePatches(_ patches: [Patch]) {
    for patch in patches {
        let path = patch.path.stringPath()

        switch patch.action {
        case .Put(_, _, let value):
            updateField(at: path, value: value)
        case .Insert(_, let index, let values):
            insertItems(at: path, index: Int(index), values: values)
        case .DeleteSeq(let del):
            removeItems(at: path, index: Int(del.index), count: Int(del.length))
        case .SpliceText(_, let index, let value, _):
            updateText(at: path, index: Int(index), inserted: value)
        case .Increment(_, _, let by):
            incrementCounter(at: path, by: by)
        case .Conflict(_, _):
            showConflictUI(at: path)
        default:
            break
        }
    }
}
```

## Observable Document

`Document` conforms to `ObservableObject`:

```swift
class MyViewModel: ObservableObject {
    let doc: Document

    private var cancellable: AnyCancellable?

    init(doc: Document) {
        self.doc = doc
        cancellable = doc.objectWillChange.sink { [weak self] in
            self?.objectWillChange.send()
        }
    }
}
```

## Common Mistakes

1. **Syncing unrelated documents**: Documents must share history (forked or previously synced) for merges to be predictable. Two independently-created documents will produce garbage merges.

2. **Forgetting SyncState is stateful**: Don't create a new `SyncState()` for every sync round. Reuse and persist it — that's how the protocol knows what's already been sent.

3. **Ignoring patches**: After `receiveSyncMessage` or `merge`, use the `WithPatches` variants to know what changed. Without this, you'd have to diff the whole document to update UI.

4. **Not looping generateSyncMessage**: One call may not be enough. Keep calling until it returns `nil`.
