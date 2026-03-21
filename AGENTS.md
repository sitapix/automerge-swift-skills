# AGENTS.md

Use the `filesystem` MCP server when MCP-based file access is needed for this workspace.

This repo no longer depends on the custom `automerge_swift_docs` MCP server for normal agent work. Prefer reading local files directly or through the filesystem MCP.

## Plugin structure

This repo is a Claude Code plugin. The plugin manifest is at `.claude-plugin/plugin.json` and top-level registration at `claude-code.json`.

- `commands/ask.md`: Natural-language entry point — routes to the right skill via `/ask`.
- `commands/audit.md`: Dispatches the `automerge-auditor` agent to scan for anti-patterns via `/audit`.
- `skills/`: Claude Code skills for working with the Automerge Swift API.
- `skills/catalog.json`: Machine-readable routing metadata (categories, kinds, aliases, relationships).
- `skills/automerge-swift/SKILL.md`: Router skill — start here when the right specialist is not obvious.
- `agents/automerge-auditor.md`: Autonomous agent that scans Swift code for Automerge anti-patterns.
- `hooks/`: Plugin hooks — session-start detection, error nudges, and write-time guardrails.
- `.agents/skills`: Symlink for Agent Skills discovery.

When adding or modifying a skill:
- Update `skills/catalog.json` with the skill's category, kind, priority, aliases, and related skills.
- Link the skill from the router (`skills/automerge-swift/SKILL.md`) if it should be discoverable.
- Directory name must match the `name` field in the skill's frontmatter.

## Key files and directories

- `README.md`: project overview and local commands.
- `docs/overview.md`: repo map and what content agents should read first.
- `docs/workflows.md`: maintenance steps for syncing vendored docs and validating the repo.
- `src/server.mjs`: MCP server implementation.
- `src/catalog.mjs`: vendored doc indexing and search logic.
- `vendor/automerge-swift/`: vendored Automerge Swift Markdown docs and generated symbol docs.

## Tooling

- `tooling/config/`: Skill category and kind definitions.
- `tooling/scripts/quality/`: Repo lint (`lint_repo.py`) and plugin validation (`validate_plugin.py`).
- `tooling/scripts/release/`: Version sync (`set_version.py`) across all manifests.
- `tooling/scripts/dev/`: Bootstrap (`bootstrap_dev.py`) and git hooks installer.
- `tooling/hooks/`: Claude Code hooks configuration.
- `.githooks/`: Git pre-commit and pre-push hooks.
- `.github/workflows/`: CI validation workflow.

## Common commands

- `npm run setup`: Bootstrap dev environment (deps, skills-ref, git hooks).
- `npm run check`: Full validation (lint + plugin validation + smoke test).
- `npm run lint`: Repo hygiene checks.
- `npm run test`: MCP server smoke test.
- `npm run version:set -- X.Y.Z`: Sync version across all manifests.
- `npm run sync-docs`: Refresh vendored Automerge Swift docs.

When a task involves Automerge Swift documentation:

- Search `vendor/automerge-swift/` first.
- Prefer the local Markdown docs over guessing API behavior.
- Use `rg` for lookup and open only the relevant files.

When a task involves this MCP project itself:

- Treat `docs/` as the high-level context.
- Treat `src/` as the source of truth for behavior.
