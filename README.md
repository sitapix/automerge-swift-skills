# Automerge Swift

Deep Automerge Swift CRDT expertise for AI coding assistants. Covers the Document API, Codable mapping, collaborative text, sync protocol, schema design, and troubleshooting.

## What is Automerge Swift?

Automerge Swift gives AI coding assistants focused guidance on the [Automerge Swift](https://github.com/automerge/automerge-swift) CRDT library — Document creation and navigation, model encoding, real-time sync, collaborative text editing, and merge conflict resolution.

- **8 focused skills** covering core API, Codable mapping, text, sync, modeling, diagnostics, and full API reference
- **2 commands** for plain-language questions and codebase auditing
- **1 MCP server** for skills, prompts, and searchable vendored Automerge Swift docs

> **Status:** Automerge Swift is in active development. Some routes or packaging paths may still be incomplete. If you hit a bug or something looks off, please open an issue.

## Quick Start

Automerge Swift is one collection with three practical entry points:

- **Claude Code plugin** for the native `/plugin` and `/automerge-swift:ask` flow
- **MCP server** (`npx automerge-swift-mcp`) for VS Code, Cursor, Gemini CLI, Claude Desktop, and more
- **Repo clone** for Agent Skills discovery

### 1. Add the Marketplace

```
/plugin marketplace add sitapix/automerge-swift-skills
```

### 2. Install the Plugin

Use `/plugin` to open the plugin menu, search for **automerge-swift**, then install it.

### 3. Verify Installation

Use `/plugin`, then open **Manage and install**. Automerge Swift should be listed there.

### 4. Ask Questions

Skills are suggested automatically in Claude Code based on your question and context. Start with prompts like these:

```
"How do I create an Automerge Document and add nested data?"
"What's the right way to encode my model with AutomergeEncoder?"
"How do I sync two documents across devices?"
"My merge is producing garbage — help me debug it"
"What methods are available on Document?"
"How do I set up collaborative text with Cursor and Mark?"
```

The default starting point for broad questions is `/automerge-swift:ask`. It routes to the right specialist skill automatically.

```
/automerge-swift:ask your question here
```

You don't need to know which skill to use — just describe your problem and the router figures it out.

### 5. Audit Your Code

Run the audit command to scan your Automerge Swift code for anti-patterns and common mistakes:

```
/automerge-swift:audit
```

Catches independent document creation, String instead of Text, missing SchemaStrategy, unpersisted SyncState, and more.

## Other Ways to Use Automerge Swift

### MCP Server

Automerge Swift includes an MCP server that brings its documentation, skills, and command entrypoints to any MCP-compatible AI coding tool — VS Code with GitHub Copilot, Claude Desktop, Cursor, Gemini CLI, OpenCode, and more.

**What you get:** vendored docs plus skill markdown as MCP resources, command prompts for `ask` and `audit`, and tools for `ask`, `list_skills`, `search_skills`, `get_skill`, `list_docs`, `search_docs`, `search_symbols`, and `get_doc`.

**Prerequisites:** Node.js 18+

#### VS Code + GitHub Copilot

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

#### Claude Desktop

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

#### Cursor

Add to `.cursor/mcp.json`:

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

#### Gemini CLI

Add to `~/.gemini/config.toml`:

```toml
[[mcp_servers]]
name = "automerge-swift"
command = "npx"
args = ["-y", "automerge-swift-mcp"]
```

#### Local Clone (Any Tool)

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

Full MCP server documentation, environment variables, and troubleshooting are in [mcp-server/README.md](mcp-server/README.md).

### Repo Clone for Agent Skills Clients

```bash
git clone https://github.com/sitapix/automerge-swift-skills
cd automerge-swift-skills
```

Use this path when your client can discover skills from a cloned repo or workspace.

If that client exposes commands, start with `/automerge-swift:ask` for broad Automerge questions.

If it only loads direct skills, open the matching skill or copy one focused skill into your local skills folder.

### Copy Specific Skills Elsewhere

```bash
mkdir -p /path/to/your/project/.agents/skills
cp -R skills/automerge-swift-core /path/to/your/project/.agents/skills/
```

Or copy everything:

```bash
# Copy all skills
cp -r /path/to/automerge-swift-skills/skills/* .claude/skills/

# Copy the ask command
mkdir -p .claude/commands
cp /path/to/automerge-swift-skills/commands/ask.md .claude/commands/automerge.md
```

## Troubleshooting

- If Automerge Swift does not appear after install, use `/plugin` and check **Manage and install** first.
- If `/automerge-swift:ask` is unavailable, confirm the plugin is installed from the marketplace flow above.

## What's Inside

The `/automerge-swift:ask` command routes your question to the right specialist skill automatically. Here's what it can reach:

| Skill | Kind | What It Covers |
|-------|------|----------------|
| `automerge-swift` | Router | Picks the right sub-skill for your task |
| `automerge-swift-core` | Workflow | Document API — ObjId navigation, maps, lists, text |
| `automerge-swift-codable` | Workflow | AutomergeEncoder/Decoder, AutomergeText, Counter |
| `automerge-swift-text` | Workflow | Collaborative text, Cursor, Mark, spliceText, formatting |
| `automerge-swift-sync` | Workflow | Sync protocol, fork/merge, history, patches |
| `automerge-swift-modeling` | Workflow | Schema design, initial data problem, UTType, save/load |
| `automerge-swift-diag` | Diagnostic | Errors, debugging, schema mismatch, merge problems |
| `automerge-swift-ref` | Reference | Dense API reference for quick type/method lookup |

### Skill Families

- **Front Door** — Start here when the request is broad or needs triage. Use `/automerge-swift:ask`.
- **Document API** — Creating, navigating, or mutating Document content directly. Routes to `automerge-swift-core`.
- **Model Mapping** — Encoding Swift models into Automerge documents or decoding them back. Routes to `automerge-swift-codable` and `automerge-swift-modeling`.
- **Collaboration** — Syncing, merging, forking, or real-time text editing. Routes to `automerge-swift-sync` and `automerge-swift-text`.
- **Troubleshooting and Reference** — Debugging issues or looking up exact API signatures. Routes to `automerge-swift-diag` and `automerge-swift-ref`.

## Refreshing Vendored Docs

Clone or update `automerge/automerge-swift`, then run:

```bash
node scripts/sync-docs.mjs /path/to/automerge-swift
```

If you have the repo at `/tmp/automerge-swift`, the path argument is optional. The server also auto-refreshes from a local checkout at startup — set `AUTOMERGE_SWIFT_DOCS_AUTO_SYNC=0` to disable, or `AUTOMERGE_SWIFT_REPO` to point at a different checkout.

## Development

### Prerequisites

- Node.js 22+
- Python 3.12+

### Setup

```bash
npm run setup
```

### Common Commands

| Command | What It Does |
|---------|-------------|
| `npm run setup` | Bootstrap dev environment (deps, skills-ref, git hooks) |
| `npm run check` | Full validation (lint + plugin validation + workspace + packaged MCP smoke tests) |
| `npm run lint` | Repo hygiene checks |
| `npm test` | MCP server smoke test |
| `npm run sync-docs` | Refresh vendored Automerge Swift docs |
| `npm run version:set -- X.Y.Z` | Sync version across all manifests and the MCP server version |

## Contributing

Contributor setup, validation, and release notes live in `.github/CONTRIBUTING.md`.

When adding or modifying a skill:

1. Update `skills/catalog.json` with the skill's category, kind, priority, aliases, and related skills.
2. Link the skill from the router (`skills/automerge-swift/SKILL.md`) if it should be discoverable.
3. Ensure the directory name matches the `name` field in the skill's frontmatter.
4. Run `npm run check` to validate everything.

## License

[MIT](LICENSE)
