#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSymbolDocs, writeSymbolDocs } from "./lib/extract-symbol-docs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const vendorRoot = path.resolve(
  process.env.AUTOMERGE_SWIFT_DOCS_ROOT || path.join(repoRoot, "vendor", "automerge-swift"),
);
const symbolOutputPath = path.join(vendorRoot, "symbols.json");
const upstreamRoot = path.resolve(
  process.argv[2] || process.env.AUTOMERGE_SWIFT_REPO || "/tmp/automerge-swift",
);

const sourcesToCopy = [
  {
    from: path.join(upstreamRoot, "Sources", "Automerge", "Automerge.docc"),
    to: path.join(vendorRoot, "Automerge.docc"),
  },
  {
    from: path.join(upstreamRoot, "Sources", "AutomergeUtilities", "AutomergeUtilities.docc"),
    to: path.join(vendorRoot, "AutomergeUtilities.docc"),
  },
];

for (const source of sourcesToCopy) {
  if (!existsSync(source.from)) {
    throw new Error(`Upstream docs path does not exist: ${source.from}`);
  }
}

mkdirSync(vendorRoot, { recursive: true });

for (const source of sourcesToCopy) {
  rmSync(source.to, { recursive: true, force: true });
  cpSync(source.from, source.to, { recursive: true });
}

const existingTitles = new Set();
for (const doccDir of readdirSync(vendorRoot, { withFileTypes: true })) {
  if (!doccDir.isDirectory() || !doccDir.name.endsWith(".docc")) {
    continue;
  }

  const doccPath = path.join(vendorRoot, doccDir.name);
  const queue = [doccPath];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const markdown = readFileSync(entryPath, "utf8");
      const match = markdown.match(/^#\s+(.+)$/m);
      if (match) {
        existingTitles.add(match[1].replaceAll("`", "").trim().toLowerCase());
      }
    }
  }
}

const symbolDocs = extractSymbolDocs({ upstreamRoot, existingTitles });
writeSymbolDocs(symbolOutputPath, symbolDocs);

process.stdout.write(`Synced Automerge Swift docs from ${upstreamRoot}\n`);
