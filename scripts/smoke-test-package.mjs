import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(repoRoot, "mcp-server");
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "automerge-swift-mcp-"));

function packPackage() {
  const packOutput = execFileSync("npm", ["pack", "--silent"], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  const tarballName = packOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  assert.ok(tarballName, "expected npm pack to return a tarball name");
  const tarballPath = path.join(packageRoot, tarballName);
  const listing = execFileSync("tar", ["-tzf", tarballPath], {
    encoding: "utf8",
  });

  assert.match(listing, /package\/dist\/src\/server\.mjs/, "expected packaged server entrypoint");
  assert.match(
    listing,
    /package\/dist\/skills\/automerge-swift\/SKILL\.md/,
    "expected packaged skill resources",
  );
  assert.match(
    listing,
    /package\/dist\/commands\/ask\.md/,
    "expected packaged command prompts",
  );
  assert.match(
    listing,
    /package\/dist\/vendor\/automerge-swift\/symbols\.json/,
    "expected packaged vendored docs",
  );

  execFileSync("tar", ["-xzf", tarballPath, "-C", tmpRoot]);
  rmSync(tarballPath, { force: true });

  return path.join(tmpRoot, "package");
}

async function runProbe(packageDir, { input, expectedOutput, forbidOutput = null }) {
  const child = spawn(process.execPath, [path.join(packageDir, "bin/automerge-swift-mcp.mjs")], {
    cwd: packageDir,
    env: {
      ...process.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdin.end(input);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out waiting for packaged MCP response. stdout=${stdout} stderr=${stderr}`));
    }, 2000);

    function maybeResolve() {
      if (!expectedOutput.every((snippet) => stdout.includes(snippet))) {
        return;
      }
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve();
    }

    child.stdout.on("data", maybeResolve);
    child.on("exit", () => {
      clearTimeout(timeout);
      if (!expectedOutput.every((snippet) => stdout.includes(snippet))) {
        reject(new Error(`Packaged MCP exited early. stdout=${stdout} stderr=${stderr}`));
      }
    });
    maybeResolve();
  });

  await once(child, "exit");

  if (forbidOutput) {
    assert.doesNotMatch(stdout, forbidOutput, `unexpected packaged MCP output: ${stdout}`);
  }
}

const packedPackageDir = packPackage();

// Install dependencies (e.g. minisearch) in the extracted package
execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts"], {
  cwd: packedPackageDir,
  encoding: "utf8",
  stdio: ["ignore", "ignore", "pipe"],
});

try {
  const contentLengthInitialize = JSON.stringify({
    jsonrpc: "2.0",
    id: 201,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "package-smoke-test",
        version: "1.0.0",
      },
    },
  });

  await runProbe(packedPackageDir, {
    input: `Content-Length: ${Buffer.byteLength(contentLengthInitialize, "utf8")}\r\n\r\n${contentLengthInitialize}`,
    expectedOutput: ['"id":201', '"protocolVersion":"2024-11-05"', "Content-Length:"],
  });

  const rawInitialize = JSON.stringify({
    jsonrpc: "2.0",
    id: 202,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "package-smoke-test",
        version: "1.0.0",
      },
    },
  });

  const rawToolsList = JSON.stringify({
    jsonrpc: "2.0",
    id: 203,
    method: "tools/list",
    params: {},
  });

  await runProbe(packedPackageDir, {
    input: `${rawInitialize}${rawToolsList}`,
    expectedOutput: ['"id":202', '"id":203', '"name":"get_catalog"', '"name":"list_docs"'],
    forbidOutput: /Content-Length:/,
  });

  process.stdout.write("packaged smoke test passed\n");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
