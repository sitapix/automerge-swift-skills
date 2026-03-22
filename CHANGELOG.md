# Changelog

## Unreleased

### Architecture: Context-Aware Skill Delivery

- Reduced registered Claude Code skills from 8 to 3 entry points (automerge-swift, automerge-swift-modeling, automerge-swift-diag)
- Created automerge-reference domain agent bundling 5 skills (core, codable, text, sync, ref) for isolated-context lookups
- Added `scripts/build-agents.mjs` with `--check` mode for staleness validation
- Added 7 routing accuracy tests to MCP smoke test
- Added agent content verification to smoke test
- Split git hooks: pre-commit is fast (lint + regenerate), pre-push runs full validation
- Added `npm run release -- X.Y.Z` for one-command releases
- Updated plugin.json and marketplace.json with explicit skills/agents arrays
- Updated router skill and ask command to reference domain agents
- MCP server unchanged — still serves all 8 skills directly

### Earlier Unreleased

- Added tooling infrastructure: lint, validation, version sync, bootstrap, git hooks.
- Added CI workflow, devcontainer, and marketplace packaging.
- Added `.agents/` symlinks for skill discovery.
- Fixed `automerge-swift-mcp` packaging so the published npm tarball includes the server code and vendored docs.
- Added a packaged-artifact smoke test and wired it into `npm run check`.
- Extended version sync to update the MCP subpackage and reported server version.

## 1.0.0

- Initial release with 5 Automerge Swift skills: router, core API, Codable layer, sync/collaboration, and API reference.
- Custom MCP server exposing vendored Automerge Swift DocC documentation.
- Natural-language `/ask` command for routing questions to the right skill.
