---
name: automerge-swift-ref
description: Use when you need to look up a specific Automerge Swift API — method signatures, property types, error types, enum cases, or protocol conformances. This is a dense reference, not a tutorial. Use automerge-swift-core, automerge-swift-codable, or automerge-swift-sync for patterns and examples. Use this when you need the exact signature or want to check what methods are available on a type.
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
