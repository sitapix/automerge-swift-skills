---
name: automerge-swift-codable
description: Use when encoding/decoding Swift Codable types to/from Automerge documents, working with AutomergeEncoder or AutomergeDecoder, using AutomergeText for collaborative text fields, using Counter for concurrent counters, choosing SchemaStrategy, or deciding between Codable layer vs core API. Also use when you see 'automerge encoder', 'automerge decoder', 'AutomergeText', or schema strategy questions.
---

# Automerge Swift Codable Layer

## Real questions this skill answers

- "How do I encode my Swift model into an Automerge document?"
- "What SchemaStrategy should I use — createWhenNeeded or cautiousWrite?"
- "How do I use AutomergeText in my Codable model for collaborative text?"
- "How do I use Counter for concurrent increments?"
- "When should I use Codable vs the core Document API?"
- "Why is my Codable encode/decode slow?"

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

For full AutomergeText coverage including Cursors, Marks, SwiftUI patterns, and manual binding, see `/skill automerge-swift-text`.

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
