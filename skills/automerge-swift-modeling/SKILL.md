---
name: automerge-swift-modeling
description: Use when designing Automerge document schemas, choosing between Text and String, structuring nested data for correct merges, solving the "initial data" problem, setting up UTType/Transferable for file sharing, or asking 'how should I structure my Automerge document', 'why do my merges produce garbage', or 'how do I save/load Automerge files'.
---

# Automerge Swift Data Modeling

## Real questions this skill answers

- "How should I structure my Automerge document for clean merges?"
- "Why do my merges produce duplicate data?"
- "What is the initial data problem and how do I solve it?"
- "Should I use Text or String for this field?"
- "How do I save and load Automerge documents?"
- "How do I set up UTType and Transferable for file sharing?"
- "How do I build a document-based app with Automerge?"
- "Should I use FileDocument or ReferenceFileDocument?"

---

How you structure your Automerge document determines whether merges work correctly. This skill covers schema design, the initial data problem, and file I/O.

## The Document Tree

An Automerge document is a tree of nested CRDTs. The root is always a Map.

```
ROOT (Map)
  |-- "title" -> ScalarValue.String("My Doc")     <- atomic, last-writer-wins
  |-- "items" -> List (ObjId)
  |      |-- [0] -> Map (ObjId)
  |      |       |-- "name" -> Text (ObjId)        <- concurrent char edits
  |      |       |-- "done" -> ScalarValue.Boolean
  |      |-- [1] -> Map (ObjId)
  |-- "viewCount" -> ScalarValue.Counter(42)       <- concurrent increment
```

Every nested Map, List, and Text has its own `ObjId`. You navigate by ObjId, not by key path.

## Type Selection Guide

| Data | Automerge Type | Why |
|------|---------------|-----|
| User-editable text | `ObjType.Text` | Character-level concurrent edits |
| Enum/tag/ID | `ScalarValue.String` | Atomic last-writer-wins is correct |
| Boolean flag | `ScalarValue.Boolean` | Atomic |
| Number | `ScalarValue.Int` / `.F64` / `.Uint` | Atomic |
| Counter (likes, views) | `Counter` via `.Counter` or Counter class | Concurrent increment/decrement |
| Timestamp | `ScalarValue.Timestamp` | Int64 seconds — **loses sub-second precision** |
| Binary blob | `ScalarValue.Bytes` | Atomic replacement |
| Collection of items | `ObjType.List` | Concurrent insert/delete at different positions |
| Named fields | `ObjType.Map` | Concurrent edits to different keys merge cleanly |

## The Initial Data Problem

**This is the most important concept for correct merges.**

Two documents must share history for merges to be predictable. If two peers independently create a document with the same schema, the ObjIds will differ and merges produce duplicated structures instead of merging values.

### Wrong: Independent Creation

```swift
// Peer A
let docA = Document()
let listA = try docA.putObject(obj: ObjId.ROOT, key: "items", ty: .List)

// Peer B
let docB = Document()
let listB = try docB.putObject(obj: ObjId.ROOT, key: "items", ty: .List)

// listA and listB have DIFFERENT ObjIds
// Merging these = two "items" lists, not one merged list
try docA.merge(other: docB)  // garbage result
```

### Right: Fork from Common Ancestor

```swift
// Create skeleton once
let skeleton = Document()
let _ = try skeleton.putObject(obj: ObjId.ROOT, key: "items", ty: .List)
let skeletonBytes = skeleton.save()

// All peers load from the same skeleton
let docA = try Document(skeletonBytes)
let docB = try Document(skeletonBytes)
// OR: let docB = docA.fork()

// Now both share the same ObjId for "items"
// Merges work correctly
```

### Skeleton Strategies

1. **Bundle a skeleton file** in your app resources:
   ```swift
   let url = Bundle.main.url(forResource: "skeleton", withExtension: "automerge")!
   let doc = try Document(Data(contentsOf: url))
   ```

2. **Generate with CLI** (requires `automerge-cli`):
   ```bash
   echo '{"contacts": []}' | automerge import > skeleton.automerge
   ```

3. **Create programmatically and share**:
   ```swift
   func createSkeleton() -> Data {
       let doc = Document()
       let _ = try! doc.putObject(obj: ObjId.ROOT, key: "contacts", ty: .List)
       let _ = try! doc.putObject(obj: ObjId.ROOT, key: "settings", ty: .Map)
       return doc.save()
   }
   ```

4. **Sync before editing**: Connect to a peer and sync before making local changes.

## Schema Evolution

Automerge schemas are dynamic — the document can be modified at any time. But Swift Codable types are static. This creates tension.

### Adding Fields

Safe if you use optionals:
```swift
// V1
struct Profile: Codable {
    var name: AutomergeText
}

// V2 — old documents still decode fine
struct Profile: Codable {
    var name: AutomergeText
    var avatar: String?       // nil if not in document
}
```

### Renaming Fields

Unsafe — old and new names are different keys. Use `CodingKeys`:
```swift
struct Profile: Codable {
    var displayName: AutomergeText

    enum CodingKeys: String, CodingKey {
        case displayName = "name"  // maps to old schema key
    }
}
```

### Schema Drift from Merges

A remote peer might add unexpected types. Defend:
```swift
// cautiousWrite checks types before writing
let encoder = AutomergeEncoder(doc: doc, cautiousWrite: true)

// Catch decode failures
do {
    let model = try decoder.decode(MyModel.self)
} catch {
    // Schema mismatch — show conflict UI or use core API to inspect
}
```

## Saving and Loading

### Save / Load Bytes

```swift
// Save (compacts all changes into efficient binary)
let bytes: Data = doc.save()
try bytes.write(to: fileURL)

// Load
let loaded = try Document(Data(contentsOf: fileURL))
```

### Incremental Saves

For append-only persistence (like a log):
```swift
// Only new changes since last save
let delta: Data = doc.encodeNewChanges()
// Append delta to a log file

// Apply deltas
try doc.applyEncodedChanges(encoded: delta)
```

## UTType and Transferable

Automerge documents have a registered Uniform Type Identifier for system integration.

### UTType

```swift
import UniformTypeIdentifiers
UTType.automerge  // "com.github.automerge", conforms to public.data
```

### Transferable

`Document` conforms to `Transferable` automatically — you can use it with drag-and-drop, share sheets, and document-based apps.

### Info.plist Setup

Register as an imported type in your app's Info.plist:

```xml
<key>UTImportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeConformsTo</key>
        <array><string>public.data</string></array>
        <key>UTTypeDescription</key>
        <string>Automerge document</string>
        <key>UTTypeIdentifier</key>
        <string>com.github.automerge</string>
        <key>UTTypeReferenceURL</key>
        <string>https://automerge.org/</string>
    </dict>
</array>
```

## Modeling Patterns

### Flat vs Nested

```swift
// Flat: every field at root — simple but doesn't scale
ROOT.title = Text
ROOT.author = String
ROOT.content = Text

// Nested: group related fields — better for large models
ROOT.metadata = Map { title: Text, author: String }
ROOT.content = Text
ROOT.comments = List [ Map { author: String, body: Text } ]
```

Prefer nested when you have >10 fields or logically distinct groups.

### Collections of Complex Items

```swift
// Each item is a Map in a List
let itemsId = try doc.putObject(obj: ObjId.ROOT, key: "items", ty: .List)
let item0 = try doc.insertObject(obj: itemsId, index: 0, ty: .Map)
try doc.put(obj: item0, key: "done", value: .Boolean(false))
let nameId = try doc.putObject(obj: item0, key: "name", ty: .Text)
try doc.spliceText(obj: nameId, start: 0, delete: 0, value: "Buy milk")
```

### When Not to Use Automerge

- **Large binary blobs** (images, audio): Store references, not content
- **Append-only logs** where order must be total: Automerge merges may interleave
- **Data that must never conflict**: If last-writer-wins is wrong but concurrent edits are possible, you need application-level conflict resolution on top of Automerge

## Document-Based App Architecture

### Use ReferenceFileDocument, Not FileDocument

`Automerge.Document` is a reference type that accumulates changes over time. `FileDocument` copies values on every edit cycle, which breaks Automerge's change tracking. Always use `ReferenceFileDocument`:

```swift
import SwiftUI
import Automerge

final class MyDocument: ReferenceFileDocument {
    static var readableContentTypes: [UTType] { [.automerge] }

    let doc: Document
    let modelEncoder: AutomergeEncoder
    let modelDecoder: AutomergeDecoder
    @Published var model: MyModel

    // New document — seed the schema immediately
    init() {
        let newDoc = Document()
        self.doc = newDoc
        self.modelEncoder = AutomergeEncoder(doc: newDoc, strategy: .createWhenNeeded)
        self.modelDecoder = AutomergeDecoder(doc: newDoc)
        let newModel = MyModel()
        self.model = newModel
        try! modelEncoder.encode(newModel) // Seeds the Automerge schema
    }

    // Load from file
    required init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        let loadedDoc = try Document(data)
        self.doc = loadedDoc
        self.modelEncoder = AutomergeEncoder(doc: loadedDoc, strategy: .createWhenNeeded)
        self.modelDecoder = AutomergeDecoder(doc: loadedDoc)
        self.model = try modelDecoder.decode(MyModel.self)
    }

    func snapshot(contentType: UTType) throws -> Data {
        doc.save()
    }

    func fileWrapper(snapshot: Data, configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: snapshot)
    }
}
```

### Schema Seeding via Codable Encode

When creating a new document, immediately encode your default model. This establishes the Automerge schema (creates all the Maps, Lists, and Text objects) so that future forks and merges work correctly. This is the simplest approach to the initial data problem:

```swift
let doc = Document()
let encoder = AutomergeEncoder(doc: doc, strategy: .createWhenNeeded)
try encoder.encode(MyModel()) // Schema now exists in the document
```

### UndoManager Trick for iOS Autosave

In document-based iOS apps, changes from network sync don't mark the document as dirty, so iOS won't autosave them. Register a no-op undo action after applying remote changes to trigger autosave:

```swift
// After receiving remote sync changes:
undoManager?.registerUndo(withTarget: document) { _ in }
```

Without this, synced changes persist in memory but are lost if the app is backgrounded before the user makes a local edit.

### Custom File Format with Document Identity

For apps that support merging files, wrap Automerge bytes with an identifier to prevent merging unrelated documents:

```swift
struct WrappedDocument: Codable {
    let id: UUID           // shared origin identity
    let data: Data         // doc.save() bytes
}

// On merge from file:
func mergeFile(_ fileURL: URL) throws {
    let wrapped = try decoder.decode(WrappedDocument.self, from: Data(contentsOf: fileURL))
    guard wrapped.id == self.documentId else {
        throw MergeError.noSharedHistory
    }
    let otherDoc = try Document(wrapped.data)
    try doc.merge(other: otherDoc)
    model = try modelDecoder.decode(MyModel.self) // Re-decode after merge
}
```

## Common Mistakes

1. **Creating documents independently instead of forking**: The #1 cause of broken merges. Always fork from a shared ancestor.

2. **Using String for user-editable fields**: Use `ObjType.Text`. Strings are last-writer-wins.

3. **Ignoring Date precision loss**: `Timestamp` stores Int64 seconds. Sub-second granularity is lost. Use `Double` (via `.F64`) if you need milliseconds.

4. **Deep nesting without ObjId tracking**: Every `putObject` returns an ObjId you need to keep. If you lose it, you must traverse the tree to find the object again.

5. **Not using cautiousWrite in production**: Without it, the encoder silently overwrites mismatched types from merged documents.
