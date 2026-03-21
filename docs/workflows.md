# Workflows

## Read Automerge Swift docs

The vendored docs live under `vendor/automerge-swift/`.

Useful patterns:

- Search by symbol or topic with `rg`.
- Open the specific Markdown file instead of scanning the full vendor tree.
- Use `symbols.json` when you need source-derived symbol coverage.

## Refresh vendored docs

If you have a local checkout of `automerge/automerge-swift`, run:

```bash
node scripts/sync-docs.mjs /path/to/automerge-swift
```

If your checkout is already at `/tmp/automerge-swift`, the path argument is optional.

## Run the custom server

```bash
npm start
```

## Validate the project

```bash
npm run check
```

## Filesystem MCP expectations

The filesystem MCP is only a file-access layer. It does not provide semantic tools by itself.

Use it for:

- reading `docs/`
- reading `vendor/automerge-swift/`
- traversing the repo from clients that rely on MCP instead of direct workspace access

Do not expect it to replace custom MCP tools like `ask`, `search_skills`, `search_docs`, or `get_doc` unless the agent is doing plain file search on top of it.
