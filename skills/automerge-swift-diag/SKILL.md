---
name: automerge-swift-diag
description: Use when debugging Automerge Swift errors, decoding failures, binding crashes, sync message corruption, type conversion errors, schema mismatches after merge, or any Automerge runtime problem. Also use when asking 'why does my decode fail', 'what does DocError mean', 'why did merge produce garbage', or 'AutomergeText binding error'.
---

# Automerge Swift Diagnostics

## Real questions this skill answers

- "What does DocError mean and how do I fix it?"
- "My Codable decode is failing after a merge — what happened?"
- "AutomergeText binding throws an error"
- "My merge produced duplicate data instead of merging"
- "SyncState won't decode — DecodeSyncStateError"
- "Why is my Date value different after round-tripping?"

---

Symptom-based troubleshooting for Automerge Swift runtime errors.

## Quick Diagnosis

| Symptom | Likely Cause | Go To |
|---------|-------------|-------|
| `DocError` thrown | Invalid operation on document | [Document Errors](#document-errors) |
| `LoadError` thrown | Corrupt or invalid bytes | [Load Errors](#load-errors) |
| Decode throws, no specific error type | Schema mismatch after merge | [Schema Drift](#schema-drift-after-merge) |
| `CodingKeyLookupError` | Key missing in document | [Codable Errors](#codable-errors) |
| `PathParseError` | Bad path string format | [Codable Errors](#codable-errors) |
| `BindingError` | AutomergeText/Counter not bound | [Binding Errors](#binding-errors) |
| `DecodeSyncStateError` | Corrupt SyncState bytes | [Sync Errors](#sync-errors) |
| `ReceiveSyncError` | Bad sync message | [Sync Errors](#sync-errors) |
| `ScalarValueConversionError` | Wrong type extraction | [Type Conversion](#type-conversion-errors) |
| Merge produces duplicate data | Documents don't share history | [Merge Problems](#merge-problems) |
| Values silently overwritten | Using String instead of Text | [Merge Problems](#merge-problems) |
| Date values not equal after round-trip | Timestamp precision loss | [Precision Issues](#precision-issues) |

## Document Errors

### DocError

Thrown by core Document operations — invalid ObjId, out-of-bounds index, wrong object type.

```swift
do {
    try doc.get(obj: invalidId, key: "foo")
} catch let error as DocError {
    print(error.errorDescription)  // human-readable
    print(error.failureReason)     // technical detail
}
```

**Common causes**:
- Using an ObjId from a different document
- Indexing past the end of a list
- Calling map operations on a list (or vice versa)
- Operating on an ObjId that was deleted

**Fix**: Verify the ObjId is valid and from the same document. Check `objectType(obj:)` before operating.

### LoadError

Thrown by `Document(bytes)` when bytes are invalid.

```swift
do {
    let doc = try Document(someData)
} catch let error as LoadError {
    print(error.errorDescription)
}
```

**Common causes**:
- Truncated data (partial file write)
- Wrong data format (not Automerge binary)
- Passing encoded changes to `Document(bytes)` instead of `applyEncodedChanges`
- Version incompatibility

**Fix**: Verify the data was produced by `doc.save()`. Check for file corruption.

## Codable Errors

### CodingKeyLookupError

The encoder/decoder couldn't find an expected key in the document.

```swift
do {
    let model = try decoder.decode(MyModel.self)
} catch let error as CodingKeyLookupError {
    print(error.errorDescription)
}
```

**Common causes**:
- Decoding a model with required fields from a document that doesn't have those fields
- Schema was never created (empty document, no prior encode)
- Field was deleted by a merge from another peer

**Fix**: Use optionals for fields that might not exist. Or encode a default model first to establish schema.

### PathParseError

Thrown by `AnyCodingKey.parsePath()` or `doc.lookupPath()`.

**Common causes**:
- Missing leading dot: `"items[0]"` instead of `".items[0]"`
- Invalid index format: `".items[abc]"` instead of `".items[0]"`

**Fix**: Paths must start with `.` and use `[N]` for indices: `".items[0].name"`

## Binding Errors

### BindingError

Thrown when `AutomergeText.bind()` or `Counter.bind()` fails.

```swift
do {
    try text.bind(doc: doc, path: [AnyCodingKey("title")])
} catch let error as BindingError {
    print(error.errorDescription)
}
```

**Common causes**:
- Path doesn't exist in document
- Object at path is wrong type (Map instead of Text)
- Document was deallocated (AutomergeText holds a weak reference)

**Fix**: Ensure the path exists and points to the correct object type. Encode a model first to establish schema.

### AutomergeText Not Updating

**Symptom**: `text.value` returns stale data or empty string.

**Decision tree**:
1. Is `text.isBound` true? If not → call `bind()` or decode from the document
2. Was the document modified after binding? → Re-read `text.value`
3. Is the document still alive? → AutomergeText holds a reference to the document

## Sync Errors

### DecodeSyncStateError

Thrown by `SyncState(bytes:)`.

**Common causes**:
- Bytes were truncated or corrupted
- Bytes are from a different Automerge version
- Passing document bytes instead of sync state bytes

**Fix**: Verify you're passing bytes from `syncState.encode()`, not `doc.save()`.

### ReceiveSyncError

Thrown by `doc.receiveSyncMessage(state:message:)`.

**Common causes**:
- Message bytes corrupted in transit
- Message from wrong peer (SyncState mismatch)
- Out-of-order message delivery (rare — protocol is mostly order-independent)

**Fix**: Verify message integrity. If persistent, `syncState.reset()` and re-sync from scratch.

## Type Conversion Errors

### ScalarValueConversionError

Thrown when extracting a Swift type from a `ScalarValue` that doesn't match.

Subtypes for specific conversions:
- `BooleanScalarConversionError` — expected Bool, got something else
- `IntScalarConversionError` — expected Int
- `FloatingPointScalarConversionError` — expected Double/Float
- `StringScalarConversionError` — expected String
- `UIntScalarConversionError` — expected UInt
- `URLScalarConversionError` — expected URL-parseable string
- `BytesScalarConversionError` — expected Data
- `TimestampScalarConversionError` — expected Date

```swift
do {
    let intVal = try Int.fromScalarValue(someScalar)
} catch let error as IntScalarConversionError {
    print(error.errorDescription)
    // "Expected Int scalar value, got: .String("hello")"
}
```

**Fix**: Pattern-match the `Value`/`ScalarValue` to check the actual type before converting. Use `switch` on `ScalarValue` cases.

## Merge Problems

### Merge Produces Duplicated Structure

**Symptom**: After `doc.merge(other:)`, you get two copies of everything instead of a merged result.

**Cause**: The two documents were created independently (not forked from a common ancestor). Each document created its own ObjIds for the schema, so Automerge treats them as separate objects.

**Fix**: Always fork from a shared skeleton:
```swift
// WRONG
let doc1 = Document()
let doc2 = Document()  // independent — merge will duplicate

// RIGHT
let doc1 = Document()
let doc2 = doc1.fork()  // shared history — merge works
```

See `/skill automerge-swift-modeling` for the initial data problem and skeleton strategies.

### Concurrent Edits to String Silently Overwrite

**Symptom**: One user's edit disappears after merge.

**Cause**: Using `ScalarValue.String` (last-writer-wins) for a field that should support concurrent editing.

**Fix**: Use `ObjType.Text` with `spliceText`/`updateText` instead.

### getAll Returns Multiple Values

**Symptom**: `doc.getAll(obj:key:)` returns more than one value.

**Cause**: Two peers concurrently set different values for the same key. Automerge keeps both — this is a conflict.

**Resolution**: Pick a winner or show conflict UI:
```swift
let values = try doc.getAll(obj: ObjId.ROOT, key: "color")
if values.count > 1 {
    // Conflict — values[0] is the "winner" (deterministic), rest are alternates
}
```

## Precision Issues

### Date Round-Trip Inequality

**Symptom**: `originalDate != decodedDate` after encode/decode.

**Cause**: Automerge stores dates as `Int64` seconds since epoch. Sub-second precision is lost.

**Workaround**:
```swift
// Option 1: Compare with tolerance
abs(original.timeIntervalSince(decoded)) < 1.0

// Option 2: Use Double for precise timestamps
struct Event: Codable {
    var preciseTimestamp: Double  // stored as F64, keeps full precision
}
```

## Debugging Tools

### LogVerbosity

Turn up logging to see what the encoder/decoder is doing:

```swift
let encoder = AutomergeEncoder(doc: doc, reportingLoglevel: .tracing)
// .errorOnly — default
// .debug    — schema creation, key lookups
// .tracing  — every encode step (very verbose)
```

### Document Inspection (AutomergeUtilities)

```swift
import AutomergeUtilities

// Visualize document tree
try doc.walk()

// Get tree as value
let schema = try doc.schema()

// Check if empty
let empty = try doc.isEmpty()

// Compare two documents
let same = try doc.equivalentContents(otherDoc)
```

### Patch Inspection

When sync or merge produces unexpected results, inspect patches:
```swift
let patches = try doc.mergeWithPatches(other: otherDoc)
for patch in patches {
    print("\(patch.path.stringPath()) -> \(patch.action)")
}
```

## Error Type Reference

| Error | Conforms To | Has errorDescription | Has failureReason |
|-------|-------------|---------------------|-------------------|
| `DocError` | `LocalizedError` | Yes | Yes |
| `LoadError` | `LocalizedError` | Yes | Yes |
| `CodingKeyLookupError` | `LocalizedError` | Yes | No |
| `PathParseError` | `LocalizedError` | Yes | No |
| `BindingError` | `LocalizedError` | Yes | No |
| `DecodeSyncStateError` | `LocalizedError` | Yes | No |
| `ReceiveSyncError` | `LocalizedError` | Yes | No |
| `ScalarValueConversionError` | `LocalizedError` | Yes | Yes |

All errors provide `errorDescription` for user-facing messages.
