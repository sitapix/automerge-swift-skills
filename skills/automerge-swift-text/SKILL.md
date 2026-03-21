---
name: automerge-swift-text
description: Use when working with collaborative text editing in Automerge — AutomergeText, Cursor, Position, Mark, ExpandMark, spliceText, updateText, text marks/formatting, or building a collaborative text editor with Automerge. Also use when asking 'how do I do concurrent text editing', 'how do marks work', or 'AutomergeText vs String'.
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
