---
name: automerge-reference
description: Look up Automerge Swift APIs, Document operations, Codable mapping, collaborative text, sync protocol, and schema patterns.
model: sonnet
tools:
  - Glob
  - Grep
  - Read
---

# Automerge Reference Agent

You answer specific questions about Automerge Swift APIs and implementation patterns.

## Instructions

1. Read the user's question carefully.
2. Find the relevant section in the reference material below.
3. Return ONLY the information that answers their question — maximum 40 lines.
4. Include exact API signatures, code examples, and gotchas when relevant.
5. Do NOT dump all reference material — extract what is relevant.
6. Always warn about the top gotchas: Text vs String, initial data problem, Codable performance, timestamp precision.
7. If the question is about schema design or the initial data problem, recommend the user also consult the automerge-swift-modeling skill.
8. If the question is about debugging errors, recommend the user consult the automerge-swift-diag skill.

---

# Automerge Swift Core Document API

## Real questions this skill answers

- "How do I create an Automerge Document and add a map key?"
- "How do I navigate ObjId to reach nested data?"
- "How do I insert into a list inside a map?"
- "What's the difference between Value, ScalarValue, and ObjType?"
- "How do I read all keys from a map ObjId?"
- "When should I use the core API instead of Codable?"

---

The core API gives direct control over the document tree. Every operation takes an `ObjId` to identify where in the tree you're working.

## Data Model

The document is a tree of nested CRDTs. The root is always a Map at `ObjId.ROOT`.

**Object types** (have their own ObjId, can contain children):

| Type | Swift | Create in Map | Create in List |
|------|-------|--------------|----------------|
| Map | `ObjType.Map` | `putObject(obj:key:ty: .Map)` | `insertObject(obj:index:ty: .Map)` |
| List | `ObjType.List` | `putObject(obj:key:ty: .List)` | `insertObject(obj:index:ty: .List)` |
| Text | `ObjType.Text` | `putObject(obj:key:ty: .Text)` | `insertObject(obj:index:ty: .Text)` |

**Scalar types** (leaf values, no ObjId):

| Automerge | Swift | ScalarValue |
|-----------|-------|-------------|
| null | nil | `.Null` |
| boolean | Bool | `.Boolean(_:)` |
| unsigned int | UInt | `.Uint(_:)` |
| signed int | Int | `.Int(_:)` |
| float | Double | `.F64(_:)` |
| string | String | `.String(_:)` — atomic, not concurrent |
| bytes | Data | `.Bytes(_:)` |
| timestamp | Date | `.Timestamp(_:)` — Int64 seconds, loses sub-second |
| counter | Counter | `.Counter(_:)` — concurrent increment |

**The `Value` enum wraps both:**
- `Value.Object(ObjId, ObjType)` — nested object
- `Value.Scalar(ScalarValue)` — leaf value

## Document Lifecycle

```swift
// Create empty
let doc = Document()

// Load from bytes
let doc = try Document(savedBytes)

// Save (compacts all changes)
let bytes: Data = doc.save()

// Fork (in-memory copy sharing history)
let fork = doc.fork()

// Fork at a point in history
let oldFork = doc.forkAt(heads: someHeads)
```

## Building Schema

You must create the nested structure before writing values. Every `putObject` / `insertObject` returns the new `ObjId`.

```swift
let doc = Document()

// Create a list at root
let itemsId = try doc.putObject(obj: ObjId.ROOT, key: "items", ty: .List)

// Insert a map into the list
let contactId = try doc.insertObject(obj: itemsId, index: 0, ty: .Map)

// Put scalar values into the map
try doc.put(obj: contactId, key: "age", value: .Int(30))
try doc.put(obj: contactId, key: "active", value: .Boolean(true))

// Create a Text object for concurrent string editing
let nameId = try doc.putObject(obj: contactId, key: "name", ty: .Text)
try doc.spliceText(obj: nameId, start: 0, delete: 0, value: "Alice")
```

## Reading Values

### Maps

```swift
// Get single value — returns Value? (can be .Object or .Scalar)
let val = try doc.get(obj: ObjId.ROOT, key: "title")
switch val {
case .Scalar(.String(let s)):
    print(s)
case .Object(let id, .Text):
    let text = try doc.text(obj: id)
case .Object(let id, .List):
    // navigate into list with id
default: break
}

// All keys
let keys = try doc.keys(obj: someMapId)

// All entries as (String, Value) pairs
let entries = try doc.mapEntries(obj: someMapId)

// Size
let count = try doc.length(obj: someMapId)
```

### Lists

```swift
// Get by index
let val = try doc.get(obj: listId, index: 0)

// All values
let vals = try doc.values(obj: listId)

// Size
let count = try doc.length(obj: listId)
```

### Text

```swift
let str = try doc.text(obj: textId)
let len = try doc.length(obj: textId)
```

For marks, cursors, and full text editing patterns, see the text section in this reference.

## Writing Values

### Maps

```swift
// Set scalar
try doc.put(obj: mapId, key: "name", value: .String("Bob"))

// Set/create nested object (returns new ObjId)
let nestedId = try doc.putObject(obj: mapId, key: "address", ty: .Map)

// Delete key
try doc.delete(obj: mapId, key: "oldField")
```

### Lists

```swift
// Insert at index
try doc.insert(obj: listId, index: 0, value: .String("first"))

// Insert nested object
let itemId = try doc.insertObject(obj: listId, index: 0, ty: .Map)

// Overwrite at index
try doc.put(obj: listId, index: 0, value: .String("replaced"))

// Delete at index
try doc.delete(obj: listId, index: 2)

// Splice (like Array replaceSubrange)
try doc.splice(obj: listId, start: 1, delete: 2, values: [.String("a"), .String("b")])
```

### Text

```swift
try doc.spliceText(obj: textId, start: 5, delete: 3, value: "inserted")
try doc.updateText(obj: textId, value: "new content")
```

For marks, formatting, and full text editing patterns, see the text section in this reference.

### Counters

```swift
// Increment counter in map
try doc.increment(obj: mapId, key: "views", by: 1)

// Increment counter in list
try doc.increment(obj: listId, index: 0, by: 1)
```

## Navigation Helpers

```swift
// Get object type
let type = try doc.objectType(obj: someId)  // .Map, .List, or .Text

// Get path to an object
let path: [PathElement] = try doc.path(obj: someId)
let pathString = path.stringPath()  // e.g. ".items[0].name"

// Look up object by string path
let id = try doc.lookupPath(path: ".items[0].name")
```

## Pattern: Safely Extracting a Nested ObjId

This comes up constantly — getting a nested object's ObjId from a parent:

```swift
func getListId(from doc: Document, key: String) throws -> ObjId {
    guard case .Object(let id, .List) = try doc.get(obj: ObjId.ROOT, key: key) else {
        throw MyError.expectedList(key)
    }
    return id
}

// Usage
let itemsId = try getListId(from: doc, key: "items")
for i in 0..<(try doc.length(obj: itemsId)) {
    if case .Object(let contactId, .Map) = try doc.get(obj: itemsId, index: i) {
        // work with contactId
    }
}
```

## Pattern: Full Document Traversal

When you need to walk the whole tree:

```swift
import AutomergeUtilities

// Get full schema as AutomergeValue tree
let schema = try doc.schema()

// Walk document tree
try doc.walk()

// Check if empty
let empty = try doc.isEmpty()

// Compare two documents
let same = try doc.equivalentContents(otherDoc)
```

## Common Mistakes

1. **Forgetting to capture ObjId from putObject/insertObject**: These methods return the new ObjId. If you discard it, you can't reference the new object.

2. **Using String scalar for user-editable text**: Use `ObjType.Text` with `spliceText` for anything that will be concurrently edited. String scalars are last-writer-wins.

3. **Indexing after delete**: After `delete(obj:index:)`, all subsequent indices shift down. Delete from high to low, or use splice.

4. **Not handling Value.Object vs Value.Scalar**: `get()` returns a `Value?` which can be either. Always pattern-match both cases.

---

# Automerge Swift Codable Layer

## Real questions this skill answers

- "How do I encode my Swift model into an Automerge document?"
- "What SchemaStrategy should I use — createWhenNeeded or cautiousWrite?"
- "How do I use AutomergeText in my Codable model for collaborative text?"
- "How do I use Counter for concurrent increments?"
- "When should I use Codable vs the core Document API?"
- "Why is my Codable encode/decode slow?"
- "How do I keep my Swift model in sync with the Automerge document?"

---

The Codable layer maps Swift structs to Automerge documents automatically. It's the fastest way to get started, but has tradeoffs you need to understand.

## Basic Workflow

```swift
import Automerge

// 1. Define your model
struct ColorList: Codable {
    var colors: [String]
}

// 2. Create document and encode
let doc = Document()
let encoder = AutomergeEncoder(doc: doc)
var myColors = ColorList(colors: ["blue", "red"])
try encoder.encode(myColors)

// 3. Make changes and re-encode
myColors.colors.append("green")
try encoder.encode(myColors)

// 4. Decode from any document
let decoder = AutomergeDecoder(doc: doc)
let decoded = try decoder.decode(ColorList.self)
```

## AutomergeEncoder

```swift
let encoder = AutomergeEncoder(
    doc: doc,
    strategy: .createWhenNeeded,   // default: create schema if missing
    cautiousWrite: false,          // default: don't type-check before write
    reportingLoglevel: .errorOnly  // default: minimal logging
)

// Encode to root
try encoder.encode(myModel)

// Encode to a specific path within the document
try encoder.encode(subModel, at: [AnyCodingKey("settings")])

// Access underlying document
let doc = encoder.doc

// Custom user info
encoder.userInfo[myKey] = someValue
```

### SchemaStrategy

| Strategy | Behavior | Use When |
|----------|----------|----------|
| `.createWhenNeeded` | Creates maps/lists/text in document if missing | First encode, or schema evolves |
| `.readonly` | Never modifies schema, only writes values | Reading or updating existing fields only |
| `.override` | Replaces existing schema structure | Resetting document to match new model |

### cautiousWrite

When `true`, the encoder checks that existing document values match expected types before writing. Protects against schema drift from merges/syncs. Slightly slower but safer for production.

## AutomergeDecoder

```swift
let decoder = AutomergeDecoder(doc: doc)

// Decode from root
let model = try decoder.decode(MyModel.self)

// Decode from a specific path
let sub = try decoder.decode(SubModel.self, from: [AnyCodingKey("settings")])

// Custom user info
decoder.userInfo[myKey] = someValue
```

## AutomergeText — Collaborative Text Fields

Use `AutomergeText` in your Codable models for any field that needs concurrent character-level editing:

```swift
struct Note: Codable {
    let created: Date
    var title: AutomergeText   // concurrent editing support
    var body: AutomergeText    // concurrent editing support
    var category: String       // last-writer-wins (fine for single-value fields)
}
```

`AutomergeText` is a reference type (class) that auto-binds to the document on decode. Use `textBinding()` for SwiftUI bindings.

For full AutomergeText coverage including Cursors, Marks, SwiftUI patterns, and manual binding, see the text section in this reference.

## Counter — Concurrent Increment

`Counter` is a reference type for values that multiple peers increment concurrently (like view counts, scores).

```swift
struct Stats: Codable {
    var viewCount: Counter
    var likeCount: Counter
}

// After decoding:
let stats = try decoder.decode(Stats.self)
stats.viewCount.increment(by: 1)
print(stats.viewCount.value)  // current total

// Manual binding (if not decoded)
let counter = Counter()
try counter.bind(doc: doc, path: [AnyCodingKey("views")])
counter.increment(by: 5)
```

Counters merge correctly: if peer A increments by 3 and peer B increments by 2, the merged result is +5.

## AnyCodingKey — Path Navigation

`AnyCodingKey` is used to specify paths within the document:

```swift
// From string (map key)
let key = AnyCodingKey("settings")

// From int (list index)
let index = AnyCodingKey(intValue: 0)

// Parse a dot-separated path
let path = AnyCodingKey.parsePath(".settings.theme")
// Returns [AnyCodingKey("settings"), AnyCodingKey("theme")]

// ROOT constant
let root = AnyCodingKey.ROOT
```

## When to Use Codable vs Core API

| Codable Layer | Core API |
|---------------|----------|
| Rapid prototyping | High-frequency updates (typing, dragging) |
| Simple data models | Large documents (>1000 items) |
| Infrequent full-document updates | Surgical single-field updates |
| Familiar Swift patterns | Maximum performance |

**The tradeoff**: `AutomergeEncoder` iterates through **every property** on every `encode()` call. For a model with 50 fields, changing one field still touches all 50. The core API lets you update just the one field that changed.

### Hybrid Pattern

Use Codable for initial setup and reading, core API for writes:

```swift
// Set up schema with Codable
let encoder = AutomergeEncoder(doc: doc)
try encoder.encode(initialModel)

// Read with Codable
let decoder = AutomergeDecoder(doc: doc)
let model = try decoder.decode(MyModel.self)

// Write with core API for performance
let titleId = try doc.lookupPath(path: ".title")!
try doc.updateText(obj: titleId, value: "new title")
```

## Dual Update Flow — Keeping Model and Document in Sync

In a real app, your Swift model and the Automerge document can get out of sync in two directions: local user edits change the model, and remote sync changes the document. Handle both with explicit methods:

```swift
final class MyDocument: ReferenceFileDocument {
    let doc: Document
    let modelEncoder: AutomergeEncoder
    let modelDecoder: AutomergeDecoder
    @Published var model: MyModel

    /// After local user edits: push model changes into the Automerge document
    func storeModelUpdates() throws {
        try modelEncoder.encode(model)
        self.objectWillChange.send()
    }

    /// After remote sync: pull document changes into the Swift model
    func getModelUpdates() throws {
        model = try modelDecoder.decode(MyModel.self)
    }
}
```

### Two Update Patterns in Practice

Value-type fields (title, attendees, flags) and reference-type fields (`AutomergeText`) update differently:

| Field Type | Update Pattern | When |
|------------|---------------|------|
| `String`, `Bool`, `Int`, etc. | Call `storeModelUpdates()` after editing | On commit (e.g., `onSubmit`, focus loss) |
| `AutomergeText` | Use `textBinding()` — writes directly to document | Every keystroke, no re-encode needed |

```swift
// Value-type field: explicit store after edit
TextField("Title", text: $document.model.title)
    .onSubmit {
        try? document.storeModelUpdates()
    }

// AutomergeText field: direct binding, no storeModelUpdates needed
TextEditor(text: document.model.notes.textBinding())
```

This split is important for performance. `storeModelUpdates()` re-encodes the entire model (walks every property). `textBinding()` writes only the changed characters directly to the Automerge text object.

## Gotchas

### Date Precision Loss

```swift
struct Event: Codable {
    var created: Date  // stored as Int64 seconds since epoch
}

let original = Date.now  // 2024-01-15 10:30:45.123456
// After encode -> decode:
// decoded.created == 2024-01-15 10:30:45.000000
// original != decoded.created  (sub-second lost!)
```

Work around by using TimeInterval (Double) if you need precision.

### Homogeneous Collections Only

Swift arrays and dictionaries are homogeneous. Automerge documents can have mixed types. If a peer adds mixed types to a list via the core API, Codable decoding will throw.

### Schema Drift from Merges

A remote peer might merge changes that add/remove/rename fields. Your Codable type may fail to decode. Defensive patterns:

```swift
// 1. Use optionals for fields that might not exist
struct FlexibleModel: Codable {
    var name: String
    var newField: String?  // won't crash if missing
}

// 2. Use cautiousWrite to detect mismatches
let encoder = AutomergeEncoder(doc: doc, cautiousWrite: true)

// 3. Catch decoding errors
do {
    let model = try decoder.decode(MyModel.self)
} catch {
    // Handle schema mismatch — maybe show "sync conflict" UI
}
```

### LogVerbosity for Debugging

When things aren't encoding/decoding as expected:

```swift
let encoder = AutomergeEncoder(doc: doc, reportingLoglevel: .tracing)
// .errorOnly — default, errors only
// .debug    — schema creation, key lookups
// .tracing  — every encode step (very verbose)
```

---

# Automerge Swift Collaborative Text

## Real questions this skill answers

- "How do I set up collaborative text editing with Automerge?"
- "What's the difference between Text and String in Automerge?"
- "How do Cursor and Position work for tracking edit locations?"
- "How do I add bold/italic marks to Automerge text?"
- "How do I use spliceText vs updateText?"
- "How does ExpandMark control formatting spread?"

---

Automerge has two ways to represent strings — and picking the wrong one is the #1 mistake.

## Text vs String: The Critical Distinction

| Type | Swift API | Merge Behavior | Use For |
|------|-----------|----------------|---------|
| `ObjType.Text` | `spliceText`, `updateText` | Character-level concurrent edits | Anything users type |
| `ScalarValue.String` | `put(value: .String(...))` | Last-writer-wins (whole value replaced) | Labels, IDs, enums |

**Rule**: If two users might edit the same field at the same time, use Text. If it's a setting or identifier, String is fine.

## Core API: Text Operations

### Creating Text

```swift
// In a map
let titleId = try doc.putObject(obj: ObjId.ROOT, key: "title", ty: .Text)

// In a list
let noteId = try doc.insertObject(obj: listId, index: 0, ty: .Text)

// Set initial content
try doc.spliceText(obj: titleId, start: 0, delete: 0, value: "Hello world")
```

### Reading Text

```swift
// Full string
let str = try doc.text(obj: textId)

// Length (character count)
let len = try doc.length(obj: textId)

// Historical value
let oldText = try doc.textAt(obj: textId, heads: oldHeads)
```

### Editing Text

```swift
// Replace entire content
try doc.updateText(obj: textId, value: "completely new text")

// Splice: insert/delete at position
try doc.spliceText(obj: textId, start: 5, delete: 3, value: "inserted")
// "Hello world" -> "Hello inserted world" (if delete=0, start=5, value=" inserted")

// Delete characters
try doc.spliceText(obj: textId, start: 5, delete: 6, value: "")
```

## Marks: Text Formatting Metadata

Marks attach metadata to ranges of text — like bold, italic, links, or any custom annotation. They survive concurrent edits: if user A marks "hello" as bold while user B inserts text before it, the bold range adjusts correctly.

### Setting Marks

```swift
try doc.mark(
    obj: textId,
    start: 0,
    end: 5,
    expand: .after,     // how the mark grows when text is inserted at boundaries
    name: "bold",
    value: .Boolean(true)
)

// Link example
try doc.mark(
    obj: textId,
    start: 10,
    end: 20,
    expand: .none,      // links shouldn't expand
    name: "link",
    value: .String("https://example.com")
)

// Remove a mark (set to null)
try doc.mark(
    obj: textId,
    start: 0,
    end: 5,
    expand: .after,
    name: "bold",
    value: .Null
)
```

### ExpandMark — How Marks Grow

| Value | Behavior | Use For |
|-------|----------|---------|
| `.before` | Expands when text inserted before the mark | Rarely used |
| `.after` | Expands when text inserted after the mark | Bold, italic, headings |
| `.both` | Expands in both directions | Block-level formatting |
| `.none` | Never expands | Links, mentions, annotations |

### Reading Marks

```swift
// All marks on a text object
let marks: [Mark] = try doc.marks(obj: textId)

for mark in marks {
    print(mark.name)    // e.g. "bold"
    print(mark.start)   // start position (UInt64)
    print(mark.end)     // end position (UInt64)
    print(mark.value)   // ScalarValue — e.g. .Boolean(true)
}

// Marks at a specific position
let marksHere: [Mark] = try doc.marksAt(obj: textId, position: 5)

// Historical marks
let oldMarks = try doc.marksAt(obj: textId, heads: oldHeads)
let oldMarksAtPos = try doc.marksAt(obj: textId, position: 5, heads: oldHeads)
```

## Cursors and Positions

Cursors track a logical position in text that survives concurrent edits. Think of them as bookmarks that move with the text.

```swift
// Create a cursor at character position 10
let cursor: Cursor = try doc.cursor(obj: textId, position: 10)

// Later (after merges/edits), get the current position
let currentPos: UInt64 = try doc.position(obj: textId, cursor: cursor)
// Position may have shifted due to insertions/deletions before it

// Historical cursor/position
let oldCursor = try doc.cursor(obj: textId, position: 10, heads: oldHeads)
let oldPos = try doc.position(obj: textId, cursor: cursor, heads: oldHeads)
```

**Use cases**: Selection ranges, scroll position, find-and-replace highlights — anything that should track a logical position across concurrent edits.

`Cursor` conforms to `Equatable`, `Hashable`, and `Codable` — you can persist and transmit them.

## AutomergeText — Codable Wrapper

`AutomergeText` is a **reference type** (class) that wraps an Automerge Text object for use in Codable models. It bridges the gap between Swift's value-oriented Codable and Automerge's reference-based text.

### In Codable Models

```swift
struct Note: Codable {
    let created: Date
    var title: AutomergeText   // concurrent editing
    var body: AutomergeText    // concurrent editing
    var category: String       // last-writer-wins (fine for enums/tags)
}

// Create
var note = Note(
    created: Date.now,
    title: AutomergeText("My Note"),
    body: AutomergeText(""),
    category: "work"
)

// Encode into document
let encoder = AutomergeEncoder(doc: doc)
try encoder.encode(note)

// After decode, AutomergeText is bound to the document
let decoder = AutomergeDecoder(doc: doc)
let decoded = try decoder.decode(Note.self)
print(decoded.title.value)  // "My Note"
```

### SwiftUI Binding

```swift
struct NoteEditor: View {
    @State var note: Note

    var body: some View {
        TextField("Title", text: note.title.textBinding())
        TextEditor(text: note.body.textBinding())
    }
}
```

`textBinding()` returns a `Binding<String>` that reads from and writes to the Automerge document directly.

### Manual Binding

If you create an AutomergeText outside of decoding:

```swift
let text = AutomergeText("initial")
try text.bind(doc: doc, path: [AnyCodingKey("title")])
print(text.isBound)  // true
```

### Properties & Methods

```swift
class AutomergeText {
    init(_ value: String = "")
    init(_ value: String, doc: Document, path: [AnyCodingKey])
    init(doc: Document, objId: ObjId)

    var value: String { get }       // current text (reads from doc if bound)
    var isBound: Bool { get }       // connected to a document?

    func bind(doc: Document, path: [AnyCodingKey]) throws
    func textBinding() -> Binding<String>
}
```

Conforms to: `Codable`, `Equatable`

## Patch Actions for Text

When receiving patches from sync or merge, text changes appear as:

| PatchAction | Meaning |
|-------------|---------|
| `.SpliceText(obj:index:value:marks:)` | Characters inserted/replaced at index |
| `.Marks(ObjId, [Mark])` | Mark formatting changed |

```swift
func handleTextPatch(_ patch: Patch) {
    switch patch.action {
    case .SpliceText(_, let index, let value, let marks):
        // Characters changed at index
        updateTextView(at: Int(index), inserted: value, marks: marks)
    case .Marks(_, let marks):
        // Formatting changed
        updateFormatting(marks)
    default:
        break
    }
}
```

## Common Mistakes

1. **Using `ScalarValue.String` for user-editable text**: Concurrent edits will silently overwrite each other. Always use `ObjType.Text` with `spliceText`.

2. **Forgetting `ExpandMark` semantics**: If you use `.after` on a link mark, typing at the end of the link extends the link — use `.none` for links.

3. **Not binding AutomergeText**: If you create `AutomergeText("foo")` manually and skip `bind()`, writes go nowhere. Always bind or use encode/decode which binds automatically.

4. **Treating text positions as stable**: After a merge, character positions shift. Use `Cursor` if you need to track a position across edits.

---

# Automerge Swift Sync, Fork, Merge & History

## Real questions this skill answers

- "How do I sync two Automerge documents over a network?"
- "How do I fork a document and merge it back?"
- "How do I use SyncState with WebSocket or Bluetooth?"
- "How do I get patches to update my UI after a merge?"
- "How do I read the change history of a document?"
- "Do I need to persist SyncState between sessions?"
- "How do I throttle UI updates from remote sync?"
- "How do I use automerge-repo with WebSocket and peer-to-peer?"

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

## Throttled objectWillChange for Remote Sync

`Document.objectWillChange` fires on every remote sync change, which can flood SwiftUI with view rebuilds. Throttle it and check whether the document actually changed using heads:

```swift
import Combine

final class MyDocument: ReferenceFileDocument, ObservableObject {
    let doc: Document
    var latestHeads: Set<ChangeHash>
    private var syncSubscription: AnyCancellable?

    func observeRemoteChanges() {
        latestHeads = doc.heads()

        syncSubscription = doc.objectWillChange
            .throttle(for: 1.0, scheduler: DispatchQueue.main, latest: true)
            .receive(on: RunLoop.main)
            .sink { [weak self] in
                guard let self else { return }
                let currentHeads = self.doc.heads()
                guard currentHeads != self.latestHeads else { return }
                self.latestHeads = currentHeads
                try? self.getModelUpdates() // Re-decode model from document
                self.objectWillChange.send()
            }
    }
}
```

### ChangeHash-Based Staleness Detection

`doc.heads()` returns the set of latest change hashes. Compare before and after to determine if the document actually changed — avoids unnecessary work when throttled notifications fire but no new changes arrived:

```swift
let before = doc.heads()
try doc.receiveSyncMessage(state: syncState, message: msg)
let after = doc.heads()
if before != after {
    // Document actually changed — update UI
}
```

## Using automerge-repo-swift

For production apps, `automerge-repo-swift` provides higher-level sync infrastructure with WebSocket and peer-to-peer transports, so you don't need to manage the sync loop manually.

### Setup

```swift
// Package.swift
.package(url: "https://github.com/automerge/automerge-repo-swift", from: "0.3.0")
```

### Global Repo and Network Providers

Create the `Repo` and network providers once at app startup as globals or in the `@main` App:

```swift
import AutomergeRepo

// Module-level globals — initialized once
let repo = Repo(sharePolicy: SharePolicy.agreeable)
let websocket = WebSocketProvider(.init(reconnectOnError: true))
let peerToPeer = PeerToPeerProvider(
    PeerToPeerProviderConfiguration(
        passcode: "MyAppSync",
        reconnectOnError: true,
        autoconnect: false
    )
)
```

### Importing Documents into the Repo

Register documents with the repo when their view appears:

```swift
struct DocumentView: View {
    @ObservedObject var document: MyDocument

    var body: some View {
        // ... your UI ...
        .task {
            _ = try? await repo.import(
                handle: DocHandle(id: document.id, doc: document.doc)
            )
        }
    }
}
```

Once imported, the repo handles sync automatically over connected transports. Connect transports via toolbar controls or at app launch depending on your UX.

## Common Mistakes

1. **Syncing unrelated documents**: Documents must share history (forked or previously synced) for merges to be predictable. Two independently-created documents will produce garbage merges.

2. **Forgetting SyncState is stateful**: Don't create a new `SyncState()` for every sync round. Reuse and persist it — that's how the protocol knows what's already been sent.

3. **Ignoring patches**: After `receiveSyncMessage` or `merge`, use the `WithPatches` variants to know what changed. Without this, you'd have to diff the whole document to update UI.

4. **Not looping generateSyncMessage**: One call may not be enough. Keep calling until it returns `nil`.

---

# Automerge Swift API Reference

## Real questions this skill answers

- "What methods are available on Document?"
- "What are the enum cases for Value and ScalarValue?"
- "What's the signature for spliceText?"
- "What protocols does Document conform to?"
- "What error types does Automerge Swift throw?"
- "What does AutomergeUtilities provide?"

---

Package: `automerge-swift` 0.5.2+ | Modules: `Automerge`, `AutomergeUtilities`

---

## Document

Core type. Conforms to `ObservableObject`, `Transferable`.

### Creation & Loading
```
init(textEncoding: TextEncoding = .utf8, logLevel: LogVerbosity = .errorOnly)
init(_ data: Data, logLevel: LogVerbosity = .errorOnly) throws
```

### Properties
```
var actor: ActorId { get }
var objectWillChange: ObservableObjectPublisher
var objectDidChange: Publishers.MakeConnectable<...>
static var transferRepresentation: some TransferRepresentation
```

### Map Operations
```
func get(obj: ObjId, key: String) throws -> Value?
func getAll(obj: ObjId, key: String) throws -> [Value]
func keys(obj: ObjId) throws -> [String]
func mapEntries(obj: ObjId) throws -> [(String, Value)]
func put(obj: ObjId, key: String, value: ScalarValue) throws
func putObject(obj: ObjId, key: String, ty: ObjType) throws -> ObjId
func delete(obj: ObjId, key: String) throws
```

### List Operations
```
func get(obj: ObjId, index: UInt64) throws -> Value?
func getAll(obj: ObjId, index: UInt64) throws -> [Value]
func values(obj: ObjId) throws -> [Value]
func length(obj: ObjId) throws -> UInt64
func insert(obj: ObjId, index: UInt64, value: ScalarValue) throws
func insertObject(obj: ObjId, index: UInt64, ty: ObjType) throws -> ObjId
func put(obj: ObjId, index: UInt64, value: ScalarValue) throws
func putObject(obj: ObjId, index: UInt64, ty: ObjType) throws -> ObjId
func delete(obj: ObjId, index: UInt64) throws
func splice(obj: ObjId, start: UInt64, delete: Int64, values: [ScalarValue]) throws
```

### Text Operations
```
func text(obj: ObjId) throws -> String
func updateText(obj: ObjId, value: String) throws
func spliceText(obj: ObjId, start: UInt64, delete: Int64, value: String) throws
func mark(obj: ObjId, start: UInt64, end: UInt64, expand: ExpandMark, name: String, value: ScalarValue) throws
func marks(obj: ObjId) throws -> [Mark]
func marksAt(obj: ObjId, position: UInt64) throws -> [Mark]
```

### Counter Operations
```
func increment(obj: ObjId, key: String, by: Int64) throws
func increment(obj: ObjId, index: UInt64, by: Int64) throws
```

### Cursor & Position
```
func cursor(obj: ObjId, position: UInt64) throws -> Cursor
func cursor(obj: ObjId, position: UInt64, heads: [ChangeHash]) throws -> Cursor
func position(obj: ObjId, cursor: Cursor) throws -> UInt64
func position(obj: ObjId, cursor: Cursor, heads: [ChangeHash]) throws -> UInt64
```

### Navigation
```
func objectType(obj: ObjId) throws -> ObjType
func path(obj: ObjId) throws -> [PathElement]
func lookupPath(path: String) throws -> ObjId?
```

### Save, Fork, Merge
```
func save() -> Data
func fork() -> Document
func forkAt(heads: Set<ChangeHash>) throws -> Document
func merge(other: Document) throws
func mergeWithPatches(other: Document) throws -> [Patch]
func commitWith(message: String?, timestamp: Date?) throws
```

### Change Encoding
```
func encodeNewChanges() -> Data
func encodeChangesSince(heads: Set<ChangeHash>) throws -> Data
func applyEncodedChanges(encoded: Data) throws
func applyEncodedChangesWithPatches(encoded: Data) throws -> [Patch]
```

### Sync
```
func generateSyncMessage(state: SyncState) -> Data?
func receiveSyncMessage(state: SyncState, message: Data) throws
func receiveSyncMessageWithPatches(state: SyncState, message: Data) throws -> [Patch]
```

### History
```
func heads() -> Set<ChangeHash>
func getHistory() -> [Change]
func change(hash: ChangeHash) -> Change?
func difference(from: Set<ChangeHash>, to: Set<ChangeHash>) throws -> [Patch]
func difference(since: Set<ChangeHash>) throws -> [Patch]
func difference(to: Set<ChangeHash>) throws -> [Patch]
```

### Historical Read (all `At` variants)
```
func getAt(obj: ObjId, key: String, heads: [ChangeHash]) throws -> Value?
func getAllAt(obj: ObjId, key: String, heads: [ChangeHash]) throws -> [Value]
func keysAt(obj: ObjId, heads: [ChangeHash]) throws -> [String]
func mapEntriesAt(obj: ObjId, heads: [ChangeHash]) throws -> [(String, Value)]
func valuesAt(obj: ObjId, heads: [ChangeHash]) throws -> [Value]
func lengthAt(obj: ObjId, heads: [ChangeHash]) throws -> UInt64
func getAt(obj: ObjId, index: UInt64, heads: [ChangeHash]) throws -> Value?
func getAllAt(obj: ObjId, index: UInt64, heads: [ChangeHash]) throws -> [Value]
func textAt(obj: ObjId, heads: [ChangeHash]) throws -> String
func marksAt(obj: ObjId, heads: [ChangeHash]) throws -> [Mark]
func marksAt(obj: ObjId, position: UInt64, heads: [ChangeHash]) throws -> [Mark]
```

---

## ObjId

Unique identifier for objects in the document tree.

```
static let ROOT: ObjId  // root map object
```

Conforms to: `Equatable`, `Hashable`, `Sendable`

---

## ObjType

```
enum ObjType {
    case Map
    case List
    case Text
}
```

---

## Value

```
enum Value {
    case Object(ObjId, ObjType)
    case Scalar(ScalarValue)
}
```

---

## ScalarValue

```
enum ScalarValue {
    case Null
    case Boolean(Bool)
    case Uint(UInt64)
    case Int(Int64)
    case F64(Double)
    case String(String)
    case Bytes(Data)
    case Timestamp(Int64)      // seconds since epoch
    case Counter(Int64)
    case Unknown(typeCode: UInt8, data: Data)
}
```

---

## ScalarValueRepresentable

Protocol for types convertible to/from `ScalarValue`.

```
protocol ScalarValueRepresentable {
    func toScalarValue() -> ScalarValue
    static func fromScalarValue(_ val: ScalarValue) throws -> Self
    associatedtype ConvertError: Error
}
```

Conforming types: Bool, String, Data, Int (and variants), UInt (and variants), Double, Float, Date

---

## ActorId

```
struct ActorId {
    init()                        // random unique ID
    init(_ data: Data)
    init(_ string: String)        // hex string
}
```

---

## SyncState

```
class SyncState {
    init()
    init(bytes: Data) throws
    func encode() -> Data
    func reset()
    var theirHeads: Set<ChangeHash> { get }
}
```

---

## Change

```
struct Change {
    var hash: ChangeHash
    var actorId: ActorId
    var deps: [ChangeHash]
    var bytes: Data
    var message: String?
    var timestamp: Int64?
}
```

---

## ChangeHash

```
struct ChangeHash: Equatable, Hashable {
    var debugDescription: String { get }
}
```

---

## Patch & PatchAction

```
struct Patch {
    let action: PatchAction
    let path: [PathElement]
}

enum PatchAction {
    case Put(ObjId, Prop, Value)
    case Insert(obj: ObjId, index: UInt64, values: [Value])
    case DeleteMap(ObjId, String)
    case DeleteSeq(DeleteSeq)
    case Increment(ObjId, Prop, Int64)
    case SpliceText(obj: ObjId, index: UInt64, value: String, marks: [Mark])
    case Marks(ObjId, [Mark])
    case Conflict(ObjId, Prop)
}
```

---

## PathElement & Prop

```
struct PathElement {
    let obj: ObjId
    let prop: Prop
}

enum Prop {
    case Key(String)
    case Index(Int64)
}

// Extension on Sequence<PathElement>
func stringPath() -> String  // e.g. ".items[0].name"
```

---

## DeleteSeq

```
struct DeleteSeq {
    let obj: ObjId
    let index: UInt64
    let length: UInt64
}
```

---

## Mark & ExpandMark

```
struct Mark {
    let start: UInt64
    let end: UInt64
    let name: String
    let value: ScalarValue
}

enum ExpandMark {
    case before  // expand when text inserted before
    case after   // expand when text inserted after
    case both    // expand in both directions
    case none    // don't expand
}
```

---

## Cursor & Position

```
struct Cursor: Equatable, Hashable, Codable {
    var description: String { get }
}

struct Position  // opaque type
```

---

## AutomergeEncoder

```
struct AutomergeEncoder {
    init(doc: Document, strategy: SchemaStrategy = .createWhenNeeded,
         cautiousWrite: Bool = false, reportingLoglevel: LogVerbosity = .errorOnly)

    var doc: Document
    var schemaStrategy: SchemaStrategy
    var cautiousWrite: Bool
    var logLevel: LogVerbosity
    var userInfo: [CodingUserInfoKey: Any]

    func encode<T: Encodable>(_ value: T) throws
    func encode<T: Encodable>(_ value: T, at path: [AnyCodingKey]) throws
}
```

---

## AutomergeDecoder

```
struct AutomergeDecoder {
    init(doc: Document)

    var doc: Document
    var userInfo: [CodingUserInfoKey: Any]

    func decode<T: Decodable>(_ type: T.Type) throws -> T
    func decode<T: Decodable>(_ type: T.Type, from path: [AnyCodingKey]) throws -> T
}
```

---

## SchemaStrategy

```
enum SchemaStrategy {
    case createWhenNeeded   // create schema if missing (default)
    case readonly           // never modify schema
    case override           // replace existing schema
}
```

---

## AutomergeText

Reference type (class). Conforms to `Codable`, `Equatable`.

```
class AutomergeText {
    init(_ value: String = "")
    init(_ value: String, doc: Document, path: [AnyCodingKey])
    init(doc: Document, objId: ObjId)

    var value: String { get }
    var isBound: Bool { get }

    func bind(doc: Document, path: [AnyCodingKey]) throws
    func textBinding() -> Binding<String>
}
```

---

## Counter

Reference type (class). Conforms to `Codable`.

```
class Counter {
    init(_ value: Int64 = 0)

    var value: Int64 { get }
    var isBound: Bool { get }

    func bind(doc: Document, path: [AnyCodingKey]) throws
    func increment(by: Int64)
}
```

---

## AnyCodingKey

```
struct AnyCodingKey: CodingKey, CustomStringConvertible {
    init(_ prop: Prop)
    init(_ pathElement: PathElement)
    init(_ codingKey: any CodingKey)
    init(_ string: String)
    init(intValue: Int)

    var intValue: Int? { get }
    var stringValue: String { get }
    var description: String { get }

    static func parsePath(_ path: String) -> [AnyCodingKey]
    static let ROOT: AnyCodingKey
}
```

---

## LogVerbosity

```
enum LogVerbosity {
    case errorOnly  // default
    case debug
    case tracing
}
```

---

## TextEncoding

```
enum TextEncoding {
    case utf8
    case utf16
}
```

---

## UTType Extension

```
extension UTType {
    static let automerge: UTType  // com.github.automerge
}
```

---

## Error Types

| Error | When |
|-------|------|
| `DocError` | Document operation failures |
| `LoadError` | Loading from bytes fails |
| `BindingError` | AutomergeText/Counter binding fails |
| `CodingKeyLookupError` | Key not found during encode/decode |
| `PathParseError` | Invalid path string |
| `DecodeSyncStateError` | SyncState deserialization fails |
| `ReceiveSyncError` | Bad sync message received |
| `ScalarValueConversionError` | Type conversion fails |

All conform to `LocalizedError` with `errorDescription` and sometimes `failureReason`.

---

## AutomergeUtilities Module

Extensions on `Document`:

```
func isEmpty() throws -> Bool
func schema() throws -> AutomergeValue
func parseToSchema(_ type: Any.Type, from path: [AnyCodingKey]) throws
func equivalentContents(_ other: Document) throws -> Bool
func walk() throws
```

`AutomergeValue` — enum representing the document tree for inspection.
