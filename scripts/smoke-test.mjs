import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = createServer();
const { catalog, pluginCatalog } = server;

assert.ok(catalog.docs.length >= 10, "expected vendored docs to be loaded");
assert.ok(
  catalog.docs.some((doc) => doc.sourceKind === "symbol"),
  "expected source-derived symbol docs to be loaded",
);
assert.ok(pluginCatalog.skills.length >= 8, "expected Automerge Swift skills to be loaded");
assert.ok(pluginCatalog.commands.length >= 2, "expected command prompts to be loaded");

const rootDoc = catalog.docs.find((doc) => doc.id === "Automerge/Automerge");
assert.ok(rootDoc, "expected Automerge overview doc");

const searchResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "search_docs",
    arguments: {
      query: "sync",
      limit: 3,
    },
  },
});

assert.equal(searchResponse.error, undefined, "expected search_docs to succeed");
assert.match(
  searchResponse.result.content[0].text,
  /Automerge\/Sync/,
  "expected sync search to surface the Sync doc",
);

const readResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 2,
  method: "resources/read",
  params: {
    uri: rootDoc.uri,
  },
});

assert.equal(readResponse.error, undefined, "expected resources/read to succeed");
assert.match(readResponse.result.contents[0].text, /Create, Update, and Synchronize data/);

const templateListResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 6,
  method: "resources/templates/list",
});

assert.equal(
  templateListResponse.error,
  undefined,
  "expected resources/templates/list to succeed",
);
assert.deepEqual(templateListResponse.result.resourceTemplates, []);

const resourcesListResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 8,
  method: "resources/list",
});

assert.equal(resourcesListResponse.error, undefined, "expected resources/list to succeed");
assert.match(
  JSON.stringify(resourcesListResponse.result.resources),
  /automerge-swift:\/\/skills\/automerge-swift/,
  "expected skill resources to be listed",
);
assert.match(
  JSON.stringify(resourcesListResponse.result.resources),
  /automerge-swift:\/\/docs\/Automerge\/Automerge/,
  "expected doc resources to be listed",
);

const promptListResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 7,
  method: "prompts/list",
});

assert.equal(promptListResponse.error, undefined, "expected prompts/list to succeed");
assert.match(JSON.stringify(promptListResponse.result.prompts), /"name":"ask"/);
assert.match(JSON.stringify(promptListResponse.result.prompts), /"name":"audit"/);

const promptGetResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 9,
  method: "prompts/get",
  params: {
    name: "ask",
    arguments: {
      question: "How do I sync two documents across devices?",
    },
  },
});

assert.equal(promptGetResponse.error, undefined, "expected prompts/get to succeed");
assert.match(promptGetResponse.result.messages[0].content.text, /Recommended skill: automerge-swift-sync/);

const skillResource = pluginCatalog.skills.find((skill) => skill.name === "automerge-swift-sync");
assert.ok(skillResource, "expected sync skill resource");
const skillReadResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 10,
  method: "resources/read",
  params: {
    uri: skillResource.uri,
  },
});

assert.equal(skillReadResponse.error, undefined, "expected skill resources/read to succeed");
assert.match(skillReadResponse.result.contents[0].text, /Automerge Swift Sync, Fork, Merge & History/);

const symbolHit = server.handleRequest({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "search_docs",
    arguments: {
      query: "objectDidChange",
      limit: 3,
    },
  },
});

assert.equal(symbolHit.error, undefined, "expected symbol search to succeed");
assert.match(symbolHit.result.content[0].text, /Document\.objectDidChange/);

const symbolOnlyResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "search_symbols",
    arguments: {
      query: "sync",
      limit: 3,
    },
  },
});

assert.equal(symbolOnlyResponse.error, undefined, "expected search_symbols to succeed");
assert.doesNotMatch(symbolOnlyResponse.result.content[0].text, /"sourceKind": "docc"/);

const symbolListResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: {
    name: "list_docs",
    arguments: {
      sourceKind: "symbol",
    },
  },
});

assert.equal(symbolListResponse.error, undefined, "expected symbol list to succeed");
assert.match(symbolListResponse.result.content[0].text, /"sourceKind": "symbol"/);

const askResponse = server.handleRequest({
  jsonrpc: "2.0",
  id: 11,
  method: "tools/call",
  params: {
    name: "ask",
    arguments: {
      question: "How do I persist SyncState between reconnects?",
      includeSkillContent: false,
    },
  },
});

assert.equal(askResponse.error, undefined, "expected ask tool to succeed");
assert.match(askResponse.result.content[0].text, /Recommended skill: automerge-swift-sync/);
assert.match(askResponse.result.content[0].text, /Why: matched sync, merge, or history terms/);

async function probeTransport(headerSeparator) {
  const child = spawn(process.execPath, [path.join(__dirname, "../src/server.mjs")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      AUTOMERGE_SWIFT_DOCS_AUTO_SYNC: "0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "smoke-test",
        version: "1.0.0",
      },
    },
  });

  child.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}${headerSeparator}${body}`);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out waiting for initialize response for separator ${JSON.stringify(headerSeparator)}`));
    }, 1000);

    function maybeResolve() {
      if (!stdout.includes('"id":99')) {
        return;
      }
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve();
    }

    child.stdout.on("data", maybeResolve);
    child.on("exit", () => {
      clearTimeout(timeout);
      if (!stdout.includes('"id":99')) {
        reject(new Error(`Server exited before responding for separator ${JSON.stringify(headerSeparator)}`));
      }
    });
    maybeResolve();
  });

  await once(child, "exit");
  assert.match(stdout, /"protocolVersion":"2024-11-05"/, "expected initialize response over stdio");
}

async function probeRawJsonTransport() {
  const child = spawn(process.execPath, [path.join(__dirname, "../src/server.mjs")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      AUTOMERGE_SWIFT_DOCS_AUTO_SYNC: "0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 100,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "smoke-test",
        version: "1.0.0",
      },
    },
  });

  child.stdin.write(body);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting for raw JSON initialize response"));
    }, 1000);

    function maybeResolve() {
      if (!stdout.includes('"id":100')) {
        return;
      }
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve();
    }

    child.stdout.on("data", maybeResolve);
    child.on("exit", () => {
      clearTimeout(timeout);
      if (!stdout.includes('"id":100')) {
        reject(new Error("Server exited before responding to raw JSON initialize"));
      }
    });
    maybeResolve();
  });

  await once(child, "exit");
  assert.doesNotMatch(stdout, /Content-Length:/, "expected raw JSON response framing");
  assert.match(stdout, /"protocolVersion":"2025-06-18"/, "expected negotiated protocol version for raw JSON");
}

async function probeConcatenatedRawJsonTransport() {
  const child = spawn(process.execPath, [path.join(__dirname, "../src/server.mjs")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      AUTOMERGE_SWIFT_DOCS_AUTO_SYNC: "0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  const initialize = JSON.stringify({
    jsonrpc: "2.0",
    id: 101,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "smoke-test",
        version: "1.0.0",
      },
    },
  });

  const toolsList = JSON.stringify({
    jsonrpc: "2.0",
    id: 102,
    method: "tools/list",
    params: {},
  });

  child.stdin.write(`${initialize}${toolsList}`);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting for concatenated raw JSON responses"));
    }, 1000);

    function maybeResolve() {
      if (!stdout.includes('"id":101') || !stdout.includes('"id":102')) {
        return;
      }
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve();
    }

    child.stdout.on("data", maybeResolve);
    child.on("exit", () => {
      clearTimeout(timeout);
      if (!stdout.includes('"id":101') || !stdout.includes('"id":102')) {
        reject(new Error("Server exited before responding to concatenated raw JSON messages"));
      }
    });
    maybeResolve();
  });

  await once(child, "exit");
  assert.doesNotMatch(stdout, /Content-Length:/, "expected raw JSON response framing");
  assert.match(stdout, /"name":"list_docs"/, "expected tools/list response over concatenated raw JSON");
}

await probeTransport("\r\n\r\n");
await probeTransport("\n\n");
await probeRawJsonTransport();
await probeConcatenatedRawJsonTransport();

process.stdout.write("smoke test passed\n");
