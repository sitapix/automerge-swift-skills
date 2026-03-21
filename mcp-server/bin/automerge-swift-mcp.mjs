#!/usr/bin/env node

/**
 * Automerge Swift MCP Server
 *
 * Exposes vendored Automerge Swift DocC documentation as MCP resources and tools.
 * Works with any MCP-compatible client: VS Code, Claude Desktop, Cursor, Gemini CLI, etc.
 *
 * Usage:
 *   npx automerge-swift-mcp
 *
 * Or configure in your MCP client:
 *   { "command": "npx", "args": ["-y", "automerge-swift-mcp"] }
 */

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagedServerPath = path.resolve(__dirname, "../dist/src/server.mjs");
const workspaceServerPath = path.resolve(__dirname, "../../src/server.mjs");
const serverPath = existsSync(packagedServerPath) ? packagedServerPath : workspaceServerPath;

// The packaged npm artifact should always serve its vendored snapshot. The sync
// script is a repo-only maintenance tool and is not shipped in the tarball.
if (serverPath === packagedServerPath) {
  process.env.AUTOMERGE_SWIFT_DOCS_AUTO_SYNC = "0";
}

const { start } = await import(serverPath);

await start();
