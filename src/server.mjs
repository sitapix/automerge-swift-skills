#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_VENDOR_ROOT, assertVendorRoot, findDoc, listDocs, loadCatalog, searchDocs } from "./catalog.mjs";
import {
  DEFAULT_COMMANDS_ROOT,
  DEFAULT_SKILLS_ROOT,
  findSkill,
  getCatalog,
  getPrompt,
  getSkillSections,
  listSkills,
  loadPluginCatalog,
  searchSkills,
} from "./plugin-catalog.mjs";

const SERVER_INFO = {
  name: "automerge-swift",
  version: "1.3.1",
};

const LATEST_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_LOG_PATH = process.env.AUTOMERGE_SWIFT_DOCS_DEBUG_LOG || null;

function debugLog(event, detail = "") {
  if (!DEBUG_LOG_PATH) {
    return;
  }

  const suffix = detail ? ` ${detail}` : "";
  appendFileSync(DEBUG_LOG_PATH, `${new Date().toISOString()} ${event}${suffix}\n`, "utf8");
}

function jsonRpcError(code, message, data) {
  return { code, message, data };
}

function jsonResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: jsonRpcError(code, message, data),
  };
}

function writeMessage(message, framing = "content-length") {
  const payload = JSON.stringify(message);
  const target = Array.isArray(message)
    ? `batch=${message.length}`
    : message.id === undefined || message.id === null
      ? "notification"
      : `id=${message.id}`;
  const kind = Array.isArray(message)
    ? "batch"
    : message.error
      ? `error=${message.error.code}`
      : "ok";
  debugLog("outbound", `${target} ${kind}`);
  if (framing === "raw-json") {
    process.stdout.write(`${payload}\n`);
    return;
  }

  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
}

function makeTextResult(text) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function findHeaderBoundary(buffer) {
  const crlfBoundary = buffer.indexOf("\r\n\r\n");
  if (crlfBoundary !== -1) {
    return { headerEnd: crlfBoundary, separatorLength: 4 };
  }

  const lfBoundary = buffer.indexOf("\n\n");
  if (lfBoundary !== -1) {
    return { headerEnd: lfBoundary, separatorLength: 2 };
  }

  return null;
}

function formatDoc(doc) {
  return [
    `- ID: ${doc.id}`,
    `- Module: ${doc.moduleName}`,
    `- Kind: ${doc.kind ?? "article"}`,
    `- Source kind: ${doc.sourceKind ?? "docc"}`,
    `- Resource URI: ${doc.uri}`,
    `- Source: ${doc.githubUrl}`,
    "",
    "---",
    "",
    doc.markdown.trim(),
    "",
  ].join("\n");
}

function formatSkill(skill) {
  return [
    `- Name: ${skill.name}`,
    `- Title: ${skill.title}`,
    `- Kind: ${skill.kind ?? "workflow"}`,
    `- Category: ${skill.category ?? "uncategorized"}`,
    `- Resource URI: ${skill.uri}`,
    `- Path: skills/${skill.relativePath}`,
    "",
    "---",
    "",
    skill.markdown.trim(),
    "",
  ].join("\n");
}

function toolDefinitions() {
  return [
    {
      name: "list_skills",
      description: "List the Automerge Swift skills exposed by this MCP server.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "search_skills",
      description: "Search Automerge Swift skills by keyword query. Returns ranked results with matching section names. Use to find relevant skills for a topic like \"sync\", \"ObjId\", or \"merge garbage\".",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (e.g. \"sync protocol\", \"AutomergeText cursor\").",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Max results (default 10).",
          },
          category: {
            type: "string",
            description: "Filter by category (e.g. \"sync-collaboration\", \"document-api\").",
          },
          kind: {
            type: "string",
            description: "Filter by kind (e.g. \"ref\", \"diag\", \"router\").",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "read_skill",
      description: "Read skill content with optional section filtering. Supports reading specific sections to reduce token usage. Use listSections to see available sections first.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Skill name (e.g. \"automerge-swift-sync\").",
          },
          uri: {
            type: "string",
            description: "Skill resource URI (alternative to name).",
          },
          sections: {
            type: "array",
            items: { type: "string" },
            description: "Section headings to include (case-insensitive substring match). Omit for full content.",
          },
          listSections: {
            type: "boolean",
            description: "If true, return only the section table of contents (heading + size) without content.",
          },
        },
      },
    },
    {
      name: "get_catalog",
      description: "Get the Automerge Swift skills catalog organized by category. Returns skill names, kinds, and descriptions grouped by category.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter to a specific category (e.g. \"sync-collaboration\"). Omit for all categories.",
          },
          includeDescriptions: {
            type: "boolean",
            description: "Include skill descriptions in output. Default false for compact listing.",
          },
        },
      },
    },
    {
      name: "list_docs",
      description: "List the vendored Automerge Swift markdown docs available in this server.",
      inputSchema: {
        type: "object",
        properties: {
          module: {
            type: "string",
            description: "Optional module filter, for example Automerge or AutomergeUtilities.",
          },
          sourceKind: {
            type: "string",
            enum: ["docc", "symbol"],
            description: "Optional source kind filter.",
          },
        },
      },
    },
    {
      name: "search_docs",
      description: "Search the Automerge Swift markdown docs and return the best matching pages.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search text.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of results to return.",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_symbols",
      description: "Search only the source-derived public Swift symbol docs.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search text.",
          },
          module: {
            type: "string",
            description: "Optional module filter, for example Automerge or AutomergeUtilities.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of results to return.",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_doc",
      description: "Return the full markdown for a specific Automerge Swift doc by id, uri, or exact title.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Doc id, for example Automerge/Sync.",
          },
          uri: {
            type: "string",
            description: "Resource URI from resources/list or search_docs.",
          },
          title: {
            type: "string",
            description: "Exact doc title.",
          },
        },
      },
    },
  ];
}

export function createServer(
  vendorRoot = DEFAULT_VENDOR_ROOT,
  skillsRoot = DEFAULT_SKILLS_ROOT,
  commandsRoot = DEFAULT_COMMANDS_ROOT,
) {
  assertVendorRoot(vendorRoot);
  const catalog = loadCatalog(vendorRoot);
  const pluginCatalog = loadPluginCatalog(skillsRoot, commandsRoot);

  function handleToolCall(name, args = {}) {
    if (name === "list_skills") {
      return makeTextResult(JSON.stringify(listSkills(pluginCatalog), null, 2));
    }

    if (name === "search_skills") {
      if (!args.query || !String(args.query).trim()) {
        throw jsonRpcError(-32602, "search_skills requires a non-empty query");
      }

      const results = searchSkills(pluginCatalog, args.query, {
        limit: args.limit,
        category: args.category,
        kind: args.kind,
      });
      if (results.length === 0) {
        return makeTextResult(`No skills found for: "${args.query}"`);
      }
      const lines = [`# Search: "${args.query}"`, `${results.length} results`, ""];
      for (const r of results) {
        const kindTag = r.kind ? ` [${r.kind}]` : "";
        lines.push(`### ${r.name}${kindTag} (score: ${r.score})`);
        lines.push(r.description);
        if (r.matchingSections.length > 0) {
          lines.push(`Sections: ${r.matchingSections.join(", ")}`);
        }
        lines.push("");
      }
      return makeTextResult(lines.join("\n"));
    }

    if (name === "read_skill") {
      const skill = findSkill(pluginCatalog, { name: args.name, uri: args.uri });
      if (!skill) {
        throw jsonRpcError(-32001, "Skill not found", args);
      }

      if (args.listSections) {
        const lines = [`## ${skill.name} — Sections`, `Total: ${skill.markdown.length} chars`, ""];
        lines.push("| Section | Chars |");
        lines.push("|---------|-------|");
        for (const s of skill.sections) {
          lines.push(`| ${s.heading} | ${s.charCount} |`);
        }
        return makeTextResult(lines.join("\n"));
      }

      if (args.sections && args.sections.length > 0) {
        const result = getSkillSections(pluginCatalog, skill.name, args.sections);
        if (!result || !result.content) {
          return makeTextResult(`No matching sections found in ${skill.name}.`);
        }
        const header = `## ${skill.name} (filtered: ${result.sections.map((s) => s.heading).join(", ")})\n\n`;
        return makeTextResult(header + result.content);
      }

      return makeTextResult(formatSkill(skill));
    }

    if (name === "get_catalog") {
      const skillCatalog = getCatalog(pluginCatalog, args.category);
      const includeDescriptions = args.includeDescriptions === true;
      const lines = [`# Automerge Swift Skills Catalog`, `${skillCatalog.totalSkills} skills`, ""];

      const sorted = Object.entries(skillCatalog.categories).sort(([a], [b]) => a.localeCompare(b));
      for (const [, cat] of sorted) {
        lines.push(`## ${cat.label} (${cat.skills.length})`);
        for (const s of cat.skills) {
          const kindTag = s.kind && s.kind !== "workflow" ? ` [${s.kind}]` : "";
          if (includeDescriptions) {
            lines.push(`- **${s.name}**${kindTag}: ${s.description}`);
          } else {
            lines.push(`- ${s.name}${kindTag}`);
          }
        }
        lines.push("");
      }

      return makeTextResult(lines.join("\n"));
    }

    if (name === "list_docs") {
      const docs = listDocs(catalog, {
        module: args.module,
        sourceKind: args.sourceKind,
      });
      return makeTextResult(JSON.stringify(docs, null, 2));
    }

    if (name === "search_docs") {
      if (!args.query || !String(args.query).trim()) {
        throw jsonRpcError(-32602, "search_docs requires a non-empty query");
      }

      const limit = Number.isInteger(args.limit) ? args.limit : 5;
      const results = searchDocs(catalog, args.query, Math.max(1, Math.min(20, limit)), {
        module: args.module,
        sourceKind: args.sourceKind,
      });
      return makeTextResult(JSON.stringify(results, null, 2));
    }

    if (name === "search_symbols") {
      if (!args.query || !String(args.query).trim()) {
        throw jsonRpcError(-32602, "search_symbols requires a non-empty query");
      }

      const limit = Number.isInteger(args.limit) ? args.limit : 5;
      const results = searchDocs(catalog, args.query, Math.max(1, Math.min(20, limit)), {
        module: args.module,
        sourceKind: "symbol",
      });
      return makeTextResult(JSON.stringify(results, null, 2));
    }

    if (name === "get_doc") {
      const doc = findDoc(catalog, args);
      if (!doc) {
        throw jsonRpcError(-32001, "Document not found", args);
      }
      return makeTextResult(formatDoc(doc));
    }

    throw jsonRpcError(-32601, `Unknown tool: ${name}`);
  }

  function handleRequest(message) {
    const { id, method, params = {} } = message;

    if (method === "initialize") {
      const requestedVersion =
        params?.protocolVersion && String(params.protocolVersion).trim()
          ? String(params.protocolVersion).trim()
          : LATEST_PROTOCOL_VERSION;
      const capabilities = {
        prompts: {
          listChanged: true,
        },
        resources: {
          listChanged: true,
        },
        tools: {
          listChanged: true,
        },
      };
      return jsonResponse(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
          ? requestedVersion
          : LATEST_PROTOCOL_VERSION,
        capabilities,
        serverInfo: SERVER_INFO,
      });
    }

    if (method === "ping") {
      return jsonResponse(id, {});
    }

    if (method === "notifications/initialized") {
      return null;
    }

    if (method === "resources/list") {
      return jsonResponse(id, {
        resources: [
          ...pluginCatalog.skills.map((skill) => ({
            uri: skill.uri,
            name: skill.title,
            description: `${skill.name} (${skill.kind ?? "workflow"})`,
            mimeType: "text/markdown",
          })),
          ...catalog.docs.map((doc) => ({
            uri: doc.uri,
            name: doc.title,
            description: `${doc.id} (${doc.moduleName})`,
            mimeType: "text/markdown",
          })),
        ],
      });
    }

    if (method === "resources/templates/list") {
      return jsonResponse(id, {
        resourceTemplates: [],
      });
    }

    if (method === "prompts/list") {
      return jsonResponse(id, {
        prompts: pluginCatalog.commands.map((command) => ({
          name: command.name,
          description: command.description,
          arguments: command.name === "ask"
            ? [
                {
                  name: "question",
                  description: command.argumentHint || "Natural-language Automerge Swift question.",
                  required: false,
                },
              ]
            : [
                {
                  name: "area",
                  description: command.argumentHint || "Optional area to audit.",
                  required: false,
                },
              ],
        })),
      });
    }

    if (method === "prompts/get") {
      const prompt = getPrompt(pluginCatalog, params.name, params.arguments);
      if (!prompt) {
        return jsonError(id, -32001, "Prompt not found", params);
      }
      return jsonResponse(id, {
        ...prompt,
      });
    }

    if (method === "resources/read") {
      const skill = findSkill(pluginCatalog, { uri: params.uri });
      if (skill) {
        return jsonResponse(id, {
          contents: [
            {
              uri: skill.uri,
              mimeType: "text/markdown",
              text: formatSkill(skill),
            },
          ],
        });
      }

      const doc = findDoc(catalog, { uri: params.uri });
      if (!doc) {
        return jsonError(id, -32001, "Resource not found", params);
      }

      return jsonResponse(id, {
        contents: [
          {
            uri: doc.uri,
            mimeType: "text/markdown",
            text: formatDoc(doc),
          },
        ],
      });
    }

    if (method === "tools/list") {
      return jsonResponse(id, {
        tools: toolDefinitions(),
      });
    }

    if (method === "tools/call") {
      try {
        return jsonResponse(id, handleToolCall(params.name, params.arguments));
      } catch (error) {
        if (error?.code && error?.message) {
          return jsonError(id, error.code, error.message, error.data);
        }

        return jsonError(id, -32603, error instanceof Error ? error.message : String(error));
      }
    }

    return jsonError(id, -32601, `Method not found: ${method}`);
  }

  return { catalog, pluginCatalog, handleRequest };
}
class HybridStdioTransport {
  constructor(stdin = process.stdin, stdout = process.stdout) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.buffer = Buffer.alloc(0);
    this.framing = null;
    this.started = false;
    this.onmessage = undefined;
    this.onerror = undefined;
    this.onclose = undefined;

    this.handleData = (chunk) => {
      debugLog(
        "chunk",
        `bytes=${chunk.length} preview=${JSON.stringify(chunk.toString("utf8").slice(0, 120))}`,
      );
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    };

    this.handleError = (error) => {
      this.onerror?.(error);
    };

    this.handleEnd = () => {
      debugLog("stdin_end");
      this.onclose?.();
    };
  }

  async start() {
    if (this.started) {
      throw new Error("HybridStdioTransport already started");
    }

    this.started = true;
    this.stdin.resume();
    this.stdin.on("data", this.handleData);
    this.stdin.on("error", this.handleError);
    this.stdin.on("end", this.handleEnd);
    this.stdin.on("close", this.handleEnd);
  }

  processBuffer() {
    while (true) {
      if (this.framing !== "content-length") {
        const rawJson = parseRawJsonMessages(this.buffer);
        if (rawJson) {
          this.framing = "raw-json";
          this.buffer = rawJson.remaining;
          for (const message of rawJson.messages) {
            if (Array.isArray(message)) {
              debugLog("inbound", `batch size=${message.length}`);
            } else {
              debugLog("inbound", message.method ?? "unknown");
            }
            debugLog("dispatch_begin");
            this.onmessage?.(message);
            debugLog("dispatch_end");
          }
          continue;
        }
      }

      const boundary = findHeaderBoundary(this.buffer);
      if (!boundary) {
        return;
      }

      this.framing = "content-length";
      const { headerEnd, separatorLength } = boundary;
      const headerText = this.buffer.slice(0, headerEnd).toString("utf8");
      const headers = headerText.split(/\r?\n/);
      const contentLengthHeader = headers.find((header) =>
        header.toLowerCase().startsWith("content-length:"),
      );

      if (!contentLengthHeader) {
        this.buffer = this.buffer.slice(headerEnd + separatorLength);
        this.onerror?.(new Error("Missing Content-Length header"));
        continue;
      }

      const contentLength = Number.parseInt(contentLengthHeader.split(":")[1].trim(), 10);
      const messageStart = headerEnd + separatorLength;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        return;
      }

      const body = this.buffer.slice(messageStart, messageEnd).toString("utf8");
      this.buffer = this.buffer.slice(messageEnd);

      try {
        const message = JSON.parse(body);
        if (Array.isArray(message)) {
          debugLog("inbound", `batch size=${message.length}`);
        } else {
          debugLog("inbound", message.method ?? "unknown");
        }
        debugLog("dispatch_begin");
        this.onmessage?.(message);
        debugLog("dispatch_end");
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  async close() {
    this.stdin.off("data", this.handleData);
    this.stdin.off("error", this.handleError);
    this.stdin.off("end", this.handleEnd);
    this.stdin.off("close", this.handleEnd);
    this.buffer = Buffer.alloc(0);
  }

  send(message) {
    const payload = JSON.stringify(message);
    const target = Array.isArray(message)
      ? `batch=${message.length}`
      : message.id === undefined || message.id === null
        ? "notification"
        : `id=${message.id}`;
    const kind = Array.isArray(message)
      ? "batch"
      : message.error
        ? `error=${message.error.code}`
        : "ok";
    debugLog("outbound", `${target} ${kind}`);

    const encoded =
      this.framing === "content-length"
        ? `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`
        : `${payload}\n`;

    return new Promise((resolve, reject) => {
      this.stdout.write(encoded, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

function handleIncomingMessage(server, message) {
  if (Array.isArray(message)) {
    const responses = message
      .map((entry) => server.handleRequest(entry))
      .filter((entry) => entry !== null);
    return responses.length ? responses : null;
  }

  return server.handleRequest(message);
}

function parseRawJsonMessages(buffer) {
  const text = buffer.toString("utf8");
  const messages = [];
  let offset = 0;

  function skipWhitespace(start) {
    let index = start;
    while (index < text.length && /\s/u.test(text[index])) {
      index += 1;
    }
    return index;
  }

  function findJsonBoundary(start) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }

        if (char === "\\") {
          escape = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{" || char === "[") {
        depth += 1;
        continue;
      }

      if (char === "}" || char === "]") {
        depth -= 1;
        if (depth === 0) {
          return index + 1;
        }
      }
    }

    return null;
  }

  while (true) {
    const start = skipWhitespace(offset);
    if (start >= text.length) {
      return { messages, remaining: Buffer.alloc(0) };
    }

    const first = text[start];
    if (first !== "{" && first !== "[") {
      return null;
    }

    const end = findJsonBoundary(start);
    if (end === null) {
      break;
    }

    const segment = text.slice(start, end);

    try {
      messages.push(JSON.parse(segment));
    } catch {
      return null;
    }

    offset = end;
  }

  if (!messages.length) {
    return null;
  }

  const consumedBytes = Buffer.byteLength(text.slice(0, offset), "utf8");

  return {
    messages,
    remaining: buffer.slice(consumedBytes),
  };
}

function maybeRefreshVendoredDocs(vendorRoot) {
  const enabled = (process.env.AUTOMERGE_SWIFT_DOCS_AUTO_SYNC ?? "1") !== "0";
  if (!enabled) {
    return;
  }

  const upstreamRoot = process.env.AUTOMERGE_SWIFT_REPO || "/tmp/automerge-swift";
  if (!existsSync(upstreamRoot)) {
    return;
  }

  const syncScriptPath = path.resolve(__dirname, "../scripts/sync-docs.mjs");

  try {
    execFileSync(process.execPath, [syncScriptPath, upstreamRoot], {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        AUTOMERGE_SWIFT_DOCS_ROOT: vendorRoot,
      },
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? "";
    process.stderr.write(
      `Failed to auto-sync Automerge Swift docs from ${upstreamRoot}${stderr ? `: ${stderr}` : "\n"}`,
    );
  }
}

export async function start() {
  const vendorRoot = process.env.AUTOMERGE_SWIFT_DOCS_ROOT || DEFAULT_VENDOR_ROOT;
  debugLog("startup", `vendorRoot=${vendorRoot}`);
  maybeRefreshVendoredDocs(vendorRoot);
  const server = createServer(vendorRoot);
  const transport = new HybridStdioTransport();
  debugLog("connect_begin");
  transport.onmessage = async (message) => {
    const response = handleIncomingMessage(server, message);
    if (!response) {
      return;
    }

    await transport.send(response);
  };
  transport.onerror = (error) => {
    debugLog("protocol_error", error instanceof Error ? error.stack ?? error.message : String(error));
  };
  transport.onclose = () => {
    debugLog("protocol_close");
  };
  await transport.start();
  debugLog("connect_ready", `onmessage=${typeof transport.onmessage}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    debugLog("fatal", message);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
