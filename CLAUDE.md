# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin and MCP server that provides Automerge Swift CRDT expertise to AI coding assistants. It delivers 8 skills, 2 agents, and 2 commands via both the Claude Code plugin system and an MCP server for non-Claude clients.

## Commands

```bash
npm run setup              # bootstrap dev environment (installs git hooks)
npm run check              # full validation pipeline (lint + agents:check + plugin validation + evals + unit tests + smoke tests + package tests)
npm run lint               # repo hygiene
npm run agents:build       # rebuild domain agents from source skills
npm run agents:check       # verify agents match source skills (staleness check)
npm run test               # MCP smoke test + routing accuracy
npm run test:unit          # Python unit tests (tooling/tests/)
npm run test:package       # MCP package smoke test
npm run eval:descriptions  # skill description trigger evaluation
npm start                  # run the MCP server
npm run sync-docs          # refresh vendored Automerge Swift docs from local checkout
npm run version:set -- X.Y.Z  # sync version across all manifests
npm run release -- X.Y.Z      # bump, rebuild, validate, commit, tag, push
```

## Architecture

### Two-tier delivery model

- **3 registered skills** load inline in Claude Code for routing and quick answers: `automerge-swift` (router), `automerge-swift-modeling`, `automerge-swift-diag`
- **5 agent-backed skills** run in isolated context via the `automerge-reference` domain agent to avoid polluting the main conversation: `automerge-swift-core`, `automerge-swift-codable`, `automerge-swift-text`, `automerge-swift-sync`, `automerge-swift-ref`
- **MCP server** (`src/server.mjs`) serves all 8 skills directly for non-Claude clients

### Key source files

- `src/server.mjs` — MCP server entry point, JSON-RPC protocol, tool definitions (search/read/catalog for skills, list/search/get for docs)
- `src/plugin-catalog.mjs` — loads skills and commands from disk, MiniSearch BM25 index, section parsing, catalog grouping
- `src/catalog.mjs` — vendored doc indexing, search helpers, `symbols.json` loading
- `scripts/build-agents.mjs` — generates `agents/automerge-reference.md` by bundling 5 skill SKILL.md files into one agent file
- `skills/catalog.json` — machine-readable routing metadata (aliases, categories, related skills)

### Generated files

`agents/automerge-reference.md` is **generated** from source skills by `scripts/build-agents.mjs`. Edit the source `skills/*/SKILL.md` files, then run `npm run agents:build`. The pre-commit hook does this automatically and stages the result.

### Plugin manifests

- `.claude-plugin/plugin.json` — Claude Code plugin manifest (skills, agents, commands)
- `.claude-plugin/marketplace.json` — marketplace listing
- `claude-code.json` — top-level plugin descriptor
- `mcp-server/package.json` — publishable npm package (`automerge-swift-mcp`)

### Vendored docs

`vendor/automerge-swift/` contains DocC Markdown and `symbols.json` extracted from the upstream automerge-swift repo. Refresh with `npm run sync-docs /path/to/automerge-swift`.

### Tooling

Python scripts under `tooling/scripts/` handle quality checks (`lint_repo.py`, `validate_plugin.py`, `evaluate_skill_descriptions.py`, `skill_freshness.py`), release (`release.sh`, `set_version.py`), and dev setup (`bootstrap_dev.py`, `install_git_hooks.py`). Python unit tests are in `tooling/tests/`.

## Git Hooks

- **pre-commit** (~2s): rebuilds agents, stages `agents/automerge-reference.md`, runs lint + staleness check
- **pre-push**: runs full `npm run check`

Install hooks with `npm run setup` or `npm run hooks:install`.

## Adding a Skill

1. Create `skills/<skill-name>/SKILL.md` with front matter matching the directory name
2. Add a catalog entry in `skills/catalog.json`
3. Add it to the domain agent definition in `scripts/build-agents.mjs`
4. Run `npm run agents:build` to regenerate the agent file
5. If the skill should be a registered entry point (rare), add to `.claude-plugin/plugin.json` and update the router
6. Run `npm run check` to validate

## Version Sync

Version appears in `package.json`, `claude-code.json`, `.claude-plugin/plugin.json`, `mcp-server/package.json`, and `src/server.mjs`. Always use `npm run version:set -- X.Y.Z` to keep them in sync.
