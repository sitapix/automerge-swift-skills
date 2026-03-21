---
name: automerge-swift-core
description: Use when creating Automerge documents, navigating with ObjId, reading/writing maps/lists/text using the core Document API, working with ScalarValue or Value types, or needing fine-grained control over document mutations. Use this instead of the Codable skill when you need performance (high-frequency updates) or when working with the low-level document structure directly.
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

For marks, cursors, and full text editing patterns, see `/skill automerge-swift-text`.

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

For marks, formatting, and full text editing patterns, see `/skill automerge-swift-text`.

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
