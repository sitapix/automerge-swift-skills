# Changelog

## 1.0.0

- Initial release with 5 Automerge Swift skills: router, core API, Codable layer, sync/collaboration, and API reference.
- Custom MCP server exposing vendored Automerge Swift DocC documentation.
- Natural-language `/ask` command for routing questions to the right skill.

## Unreleased

- Added tooling infrastructure: lint, validation, version sync, bootstrap, git hooks.
- Added CI workflow, devcontainer, and marketplace packaging.
- Added `.agents/` symlinks for skill discovery.
- Fixed `automerge-swift-mcp` packaging so the published npm tarball includes the server code and vendored docs.
- Added a packaged-artifact smoke test and wired it into `npm run check`.
- Extended version sync to update the MCP subpackage and reported server version.
