# AGENTS.md

This repo is the Automerge Swift Skills workspace — a Claude Code plugin and MCP server providing Automerge Swift CRDT expertise.

## Architecture

Automerge Swift Skills uses a two-tier delivery model to keep AI context clean:

- **3 registered skills** load inline in Claude Code for routing, schema design, and debugging
- **1 domain agent** (automerge-reference) bundles the other 5 skills into an isolated-context reference lookup
- **1 audit agent** (automerge-auditor) scans code for Automerge anti-patterns
- **MCP server** serves all 8 skills directly for non-Claude clients

The domain agent is a generated file. Edit the source skill in `skills/*/SKILL.md` and rebuild with `node scripts/build-agents.mjs`.

## Plugin structure

- `skills/`: All 8 skill source files (SKILL.md per directory)
- `agents/automerge-auditor.md`: Code scanning agent (hand-authored)
- `agents/automerge-reference.md`: Domain reference agent (generated from 5 skills by `scripts/build-agents.mjs`)
- `commands/ask.md`: Natural-language entry point — routes to skills or agents
- `commands/audit.md`: Dispatches the automerge-auditor agent
- `skills/catalog.json`: Machine-readable routing metadata
- `.agents/`: Symlinks for Agent Skills discovery
- `.claude-plugin/`: Plugin and marketplace manifests

**Registered skills** (loaded inline in Claude Code):
- `automerge-swift` — router, start here for broad questions
- `automerge-swift-modeling` — schema design, initial data problem
- `automerge-swift-diag` — errors, debugging, troubleshooting

**Agent-backed skills** (run in isolated context via automerge-reference):
- `automerge-swift-core` — Document API, ObjId, maps/lists
- `automerge-swift-codable` — AutomergeEncoder/Decoder, Counter
- `automerge-swift-text` — AutomergeText, Cursor, Mark, spliceText
- `automerge-swift-sync` — sync protocol, fork/merge, patches
- `automerge-swift-ref` — API signatures and type definitions

## When Adding a Skill

1. Create `skills/<skill-name>/SKILL.md` with front matter matching the directory name.
2. Add a catalog entry in `skills/catalog.json`.
3. Add it to the domain agent in `scripts/build-agents.mjs`.
4. Run `node scripts/build-agents.mjs` to regenerate the agent file.
5. If the skill should be a registered entry point (rare — only 3 today), add it to `plugin.json` and update the router.
6. Run `npm run check` to validate everything.

## Key files

- `src/server.mjs`: MCP server implementation
- `src/catalog.mjs`: Vendored doc indexing and search
- `vendor/automerge-swift/`: Vendored Automerge Swift docs and symbols
- `docs/overview.md`: Repo map for agents
- `docs/workflows.md`: Maintenance workflows

## Hooks and Validation

- **pre-commit** (~2s): rebuilds agents, stages, lint + staleness check
- **pre-push**: runs full `npm run check` — lint, agents:check, plugin validation, description evals, unit tests, smoke tests, package tests
- **CI** (validate.yml): runs `npm run check` on every push and PR

## Common commands

```bash
npm run setup              # bootstrap dev environment
npm run check              # full validation pipeline
npm run lint               # repo hygiene
npm run agents:build       # rebuild domain agents from skills
npm run agents:check       # verify agents match source skills
npm run test               # MCP smoke test (+ routing accuracy)
npm run sync-docs          # refresh vendored Automerge Swift docs
npm run version:set -- X.Y.Z  # sync version across manifests
npm run release -- X.Y.Z   # one-command release
```

## Releasing

```bash
npm run release -- X.Y.Z
```

Bumps version, rebuilds agents, validates, commits, tags, and pushes. CI deploys.
