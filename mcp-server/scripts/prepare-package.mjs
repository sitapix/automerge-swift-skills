import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..");
const distRoot = path.join(packageRoot, "dist");

const stagedPaths = [
  {
    from: path.join(repoRoot, "src"),
    to: path.join(distRoot, "src"),
  },
  {
    from: path.join(repoRoot, "skills"),
    to: path.join(distRoot, "skills"),
  },
  {
    from: path.join(repoRoot, "commands"),
    to: path.join(distRoot, "commands"),
  },
  {
    from: path.join(repoRoot, "vendor", "automerge-swift"),
    to: path.join(distRoot, "vendor", "automerge-swift"),
  },
];

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

for (const { from, to } of stagedPaths) {
  if (!existsSync(from)) {
    throw new Error(`Cannot stage missing path: ${from}`);
  }

  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

process.stdout.write(`Prepared packaged MCP server assets in ${distRoot}\n`);
