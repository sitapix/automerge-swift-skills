# Overview

This repository has two roles:

1. It contains a custom MCP server implementation in `src/` for serving Automerge Swift skills, prompts, and docs.
2. It contains a local Markdown corpus that agents can read directly through normal workspace access or a filesystem MCP server.

## Read this first

For most agent tasks, use this order:

1. `README.md` for the high-level purpose.
2. `docs/workflows.md` for common maintenance commands.
3. `src/server.mjs` for MCP behavior.
4. `src/plugin-catalog.mjs` for skill/prompt loading and ask routing.
5. `src/catalog.mjs` for doc indexing and search behavior.
6. `vendor/automerge-swift/` for the actual vendored docs.

## Repo map

- `src/server.mjs`: server entry point, protocol handling, tools, and resources.
- `src/plugin-catalog.mjs`: loads skills and commands, searches them, and routes `ask`.
- `src/catalog.mjs`: scans vendored Markdown, builds the catalog, and implements search helpers.
- `scripts/sync-docs.mjs`: copies DocC content from a local `automerge-swift` checkout and regenerates symbol docs.
- `scripts/smoke-test.mjs`: basic validation for the custom MCP server.
- `vendor/automerge-swift/`: vendored DocC Markdown and generated `symbols.json`.

## Guidance for agents

- If you only need documentation or examples, read `vendor/automerge-swift/` directly.
- If you need to change server behavior, read `src/server.mjs` and `src/catalog.mjs`.
- Prefer narrow file reads and `rg` over loading the whole vendored corpus.
