# Automerge Swift MCP Server

MCP server that brings Automerge Swift documentation, skills, and command entrypoints to any MCP-compatible AI coding tool — VS Code with GitHub Copilot, Claude Desktop, Cursor, Gemini CLI, OpenCode, and more.

## What You Get

The MCP server exposes Automerge Swift guidance through the MCP protocol:

- **8 tools** — `ask`, `list_skills`, `search_skills`, `get_skill`, `list_docs`, `search_docs`, `search_symbols`, `get_doc`
- **MCP resources** for each skill and documentation page
- **2 MCP prompts** — `ask` and `audit`
- Full-text search across skill metadata, DocC articles, and source-derived symbol docs

## Prerequisites

- **Node.js 18+** — check with `node --version`

That's it.

## Installation by Tool

Each tool needs a configuration snippet that tells it how to launch the MCP server.

### VS Code + GitHub Copilot

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "automerge-swift": {
      "command": "npx",
      "args": ["-y", "automerge-swift-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Cursor

Add to `.cursor/mcp.json` in your workspace:

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

### Gemini CLI

Add to `~/.gemini/config.toml`:

```toml
[[mcp_servers]]
name = "automerge-swift"
command = "npx"
args = ["-y", "automerge-swift-mcp"]
```

### OpenCode

Add to `opencode.jsonc` in your project root (or `~/.config/opencode/opencode.jsonc` for global):

```json
{
  "mcp": {
    "automerge-swift": {
      "type": "local",
      "command": ["npx", "-y", "automerge-swift-mcp"]
    }
  }
}
```

### Local Clone (Any Tool)

If you cloned the repo instead of installing from npm:

```json
{
  "mcpServers": {
    "automerge-swift": {
      "command": "node",
      "args": ["/path/to/automerge-swift-skills/src/server.mjs"]
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `AUTOMERGE_SWIFT_DOCS_AUTO_SYNC` | `0`, `1` | `1` in repo clone, forced to `0` in npm package | Auto-refresh docs from local checkout on startup |
| `AUTOMERGE_SWIFT_REPO` | File path | `/tmp/automerge-swift` | Path to local automerge-swift checkout |
| `AUTOMERGE_SWIFT_DOCS_DEBUG_LOG` | File path | — | Write debug log to this file |

## Verify It Works

### Quick Test

Run the server directly to confirm it launches without errors:

```bash
npx automerge-swift-mcp
```

The server should start and wait for stdin input (MCP uses stdio transport). Press Ctrl+C to stop.

### MCP Inspector

For interactive testing, use the official MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx automerge-swift-mcp
```

This opens a web UI where you can browse resources, test prompts and tools, and search docs.

### In Your Tool

Once configured, try asking your AI tool:

> "Search the Automerge Swift docs for Document"

It should route through the `ask` tool or prompt and point you at the right skill.

## Available Tools

| Tool | Description |
|------|-------------|
| `ask` | Route a natural-language Automerge Swift question to the best skill |
| `list_skills` | List all Automerge Swift skills exposed as MCP resources |
| `search_skills` | Search skills by name, aliases, and descriptions |
| `get_skill` | Retrieve a specific skill by name or URI |
| `list_docs` | List all vendored documentation pages, optionally filtered by module or source kind |
| `search_docs` | Full-text search across all documentation pages |
| `search_symbols` | Search only source-derived public Swift symbol docs |
| `get_doc` | Retrieve a specific documentation page by ID, URI, or title |

## Troubleshooting

### Server Won't Start

Check Node version — must be 18+:

```bash
node --version
```

### No Search Results

The server reads vendored docs from `vendor/automerge-swift/`. If this directory is empty, run:

```bash
npm run sync-docs
```

### Client Can't Connect

MCP uses stdin/stdout for communication. Common issues:

- **Wrong config** — ensure `command` is `"npx"` and `args` is `["-y", "automerge-swift-mcp"]`
- **Other stdout writers** — make sure nothing else writes to stdout; logs go to stderr only

Test the command from your config manually:

```bash
npx automerge-swift-mcp
# Should start without errors, waiting for stdin
```

## License

MIT
