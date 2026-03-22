# Automerge Swift

Deep Automerge Swift CRDT expertise for AI coding assistants. Covers the Document API, Codable mapping, collaborative text, sync protocol, schema design, and troubleshooting.

## What is Automerge Swift?

Automerge Swift gives AI coding assistants focused guidance on the [Automerge Swift](https://github.com/automerge/automerge-swift) CRDT library — Document creation and navigation, model encoding, real-time sync, collaborative text editing, and merge conflict resolution.

- **8 focused skills** covering core API, Codable mapping, text, sync, modeling, diagnostics, and full API reference
- **2 agents** for isolated reference lookups and autonomous code auditing
- **2 commands** for plain-language questions and codebase auditing

> **Status:** Automerge Swift is in active development. Some routes or packaging paths may still be incomplete. If you hit a bug or something looks off, please open an issue.

## Quick Start

### Claude Code (native plugin)

```bash
# Add marketplace
/plugin marketplace add sitapix/automerge-swift-skills

# Install plugin
/plugin install automerge-swift@automerge-swift-marketplace
```

### MCP (VS Code, Cursor, Gemini CLI, and more)

Add to your MCP config:

```json
{
  "mcpServers": {
    "automerge-swift": {
      "command": "npx",
      "args": ["-y", "automerge-swift-mcp"]
    }
  }
}
```

Client-specific paths (VS Code, Cursor, Claude Desktop, Gemini CLI) are in the [MCP setup guide](mcp-server/README.md).

## Getting Started

Skills activate automatically based on your questions. Just ask:

```
"How do I create an Automerge Document and add nested data?"
"What's the right way to encode my model with AutomergeEncoder?"
"How do I sync two documents across devices?"
"My merge is producing garbage — help me debug it"
"What methods are available on Document?"
```

You can also use commands directly:

```
/automerge-swift:ask your question here
/automerge-swift:audit                    # scan code for anti-patterns
/skill automerge-swift-modeling           # schema design, initial data problem
/skill automerge-swift-diag              # debug errors and merge problems
```

## How It Works

8 skills organized into 3 lightweight entry points and 1 domain agent. Entry-point skills load inline for routing and quick answers. The domain agent handles deep API lookups in isolated context — the full reference runs in a separate agent and only the focused answer comes back.

## Documentation

Full documentation, skill catalog, and MCP server setup at **[sitapix.github.io/automerge-swift-skills](https://sitapix.github.io/automerge-swift-skills/)**.

## Contributing

Contributor setup, validation, and release notes live in [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).

## License

[MIT](LICENSE)
