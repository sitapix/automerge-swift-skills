import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_ROOT = path.resolve(__dirname, "../skills");
export const DEFAULT_COMMANDS_ROOT = path.resolve(__dirname, "../commands");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function loadFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { attributes: {}, body: markdown };
  }

  const attributes = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes(":")) {
      continue;
    }

    const separator = line.indexOf(":");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    attributes[key] = value;
  }

  return {
    attributes,
    body: markdown.slice(match[0].length),
  };
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.replaceAll("`", "").trim() || fallback;
}

function wordTokens(query) {
  return String(query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean);
}

function makeSnippet(markdown, query) {
  const singleLine = markdown.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return "";
  }

  const lower = singleLine.toLowerCase();
  const normalized = String(query ?? "").trim().toLowerCase();
  const hit = normalized ? lower.indexOf(normalized) : -1;
  const start = hit >= 0 ? Math.max(0, hit - 80) : 0;
  const snippet = singleLine.slice(start, start + 220).trim();
  return start > 0 ? `...${snippet}` : snippet;
}

function scoreSkill(skill, query, tokens) {
  const lowerQuery = query.toLowerCase();
  const haystacks = [
    skill.name.toLowerCase(),
    skill.title.toLowerCase(),
    skill.description.toLowerCase(),
    skill.markdown.toLowerCase(),
    ...skill.aliases.map((alias) => alias.toLowerCase()),
  ];

  let score = 0;
  for (const haystack of haystacks) {
    if (haystack.includes(lowerQuery)) {
      score += haystack === skill.markdown.toLowerCase() ? 20 : 80;
    }
  }

  for (const token of tokens) {
    for (const haystack of haystacks) {
      if (haystack.includes(token)) {
        score += haystack === skill.markdown.toLowerCase() ? 2 : 12;
      }
    }
  }

  return score;
}

function routePatterns() {
  return [
    {
      name: "automerge-swift-ref",
      reason: "matched reference-oriented terms like methods, signatures, or API lookup",
      patterns: [
        /\b(method|methods|signature|signatures|api|enum case|enum cases|protocol conformances?)\b/i,
        /\bwhat methods\b/i,
      ],
    },
    {
      name: "automerge-swift-diag",
      reason: "matched error or troubleshooting terms",
      patterns: [
        /\b(error|debug|debugging|troubleshoot|troubleshooting|fail|fails|failing|garbage|schema mismatch|binding)\b/i,
        /\bwhy does\b/i,
      ],
    },
    {
      name: "automerge-swift-text",
      reason: "matched collaborative text terms",
      patterns: [/\b(automergetext|cursor|position|mark|expand mark|splicetext|text editing|collaborative text)\b/i],
    },
    {
      name: "automerge-swift-sync",
      reason: "matched sync, merge, or history terms",
      patterns: [/\b(sync|merge|fork|syncstate|patch|patches|history|changes|diff|diffing)\b/i],
    },
    {
      name: "automerge-swift-codable",
      reason: "matched Codable or schema strategy terms",
      patterns: [/\b(codable|automergeencoder|automergedecoder|counter|schema strategy)\b/i],
    },
    {
      name: "automerge-swift-modeling",
      reason: "matched schema design or save/load terms",
      patterns: [/\b(schema design|document structure|initial data|skeleton|uttype|transferable|save\/load|save load)\b/i],
    },
    {
      name: "automerge-swift-core",
      reason: "matched low-level document API terms",
      patterns: [/\b(objid|put|get|map|maps|list|lists|document creation|scalar value|core api)\b/i],
    },
  ];
}

export function assertPluginRoots(skillsRoot = DEFAULT_SKILLS_ROOT, commandsRoot = DEFAULT_COMMANDS_ROOT) {
  const skillStats = statSync(skillsRoot, { throwIfNoEntry: false });
  if (!skillStats?.isDirectory()) {
    throw new Error(`Skills root does not exist: ${skillsRoot}`);
  }

  const commandStats = statSync(commandsRoot, { throwIfNoEntry: false });
  if (!commandStats?.isDirectory()) {
    throw new Error(`Commands root does not exist: ${commandsRoot}`);
  }
}

export function loadPluginCatalog(
  skillsRoot = DEFAULT_SKILLS_ROOT,
  commandsRoot = DEFAULT_COMMANDS_ROOT,
) {
  assertPluginRoots(skillsRoot, commandsRoot);

  const skillMetadataPath = path.join(skillsRoot, "catalog.json");
  const skillMetadata = existsSync(skillMetadataPath)
    ? JSON.parse(readFileSync(skillMetadataPath, "utf8")).skills ?? []
    : [];
  const metadataByName = new Map(
    skillMetadata
      .filter((entry) => entry?.name)
      .map((entry) => [entry.name, entry]),
  );

  const skills = [];
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) {
      continue;
    }

    const markdown = readFileSync(skillPath, "utf8");
    const { attributes, body } = loadFrontmatter(markdown);
    const metadata = metadataByName.get(entry.name) ?? {};
    const title = extractTitle(body, entry.name);
    const name = attributes.name || entry.name;
    const uri = `automerge-swift://skills/${encodeURIComponent(name)}`;

    skills.push({
      name,
      title,
      description: attributes.description || metadata.description || "",
      category: metadata.category || null,
      kind: metadata.kind || null,
      entrypointPriority: metadata.entrypoint_priority ?? Number.MAX_SAFE_INTEGER,
      aliases: Array.isArray(metadata.aliases) ? metadata.aliases : [],
      relatedSkills: Array.isArray(metadata.related_skills) ? metadata.related_skills : [],
      uri,
      relativePath: toPosixPath(path.relative(skillsRoot, skillPath)),
      markdown,
    });
  }

  skills.sort((left, right) => left.name.localeCompare(right.name));

  const commands = [];
  for (const entry of readdirSync(commandsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const commandPath = path.join(commandsRoot, entry.name);
    const markdown = readFileSync(commandPath, "utf8");
    const { attributes, body } = loadFrontmatter(markdown);
    const name = path.basename(entry.name, ".md");

    commands.push({
      name,
      title: extractTitle(body, name),
      description: attributes.description || "",
      argumentHint: attributes["argument-hint"] || "",
      markdown,
      uri: `automerge-swift://commands/${encodeURIComponent(name)}`,
      relativePath: toPosixPath(path.relative(commandsRoot, commandPath)),
    });
  }

  commands.sort((left, right) => left.name.localeCompare(right.name));

  return {
    skills,
    commands,
    skillByName: new Map(skills.map((skill) => [skill.name.toLowerCase(), skill])),
    skillByUri: new Map(skills.map((skill) => [skill.uri, skill])),
    commandByName: new Map(commands.map((command) => [command.name.toLowerCase(), command])),
  };
}

export function listSkills(pluginCatalog) {
  return pluginCatalog.skills.map((skill) => ({
    name: skill.name,
    title: skill.title,
    description: skill.description,
    category: skill.category,
    kind: skill.kind,
    uri: skill.uri,
    relatedSkills: skill.relatedSkills,
  }));
}

export function findSkill(pluginCatalog, locator = {}) {
  const { name, uri } = locator;
  if (uri) {
    return pluginCatalog.skillByUri.get(String(uri)) ?? null;
  }
  if (name) {
    return pluginCatalog.skillByName.get(String(name).toLowerCase()) ?? null;
  }
  return null;
}

export function searchSkills(pluginCatalog, query, limit = 5) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const tokens = wordTokens(trimmed);
  return pluginCatalog.skills
    .map((skill) => ({
      skill,
      score: scoreSkill(skill, trimmed, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.skill.name.localeCompare(right.skill.name);
    })
    .slice(0, limit)
    .map(({ skill, score }) => ({
      name: skill.name,
      title: skill.title,
      description: skill.description,
      category: skill.category,
      kind: skill.kind,
      uri: skill.uri,
      score,
      snippet: makeSnippet(skill.markdown, trimmed),
    }));
}

export function routeAsk(pluginCatalog, question) {
  const normalized = String(question ?? "").trim();
  if (!normalized) {
    return null;
  }

  for (const route of routePatterns()) {
    if (route.patterns.some((pattern) => pattern.test(normalized))) {
      const skill = findSkill(pluginCatalog, { name: route.name });
      if (skill) {
        return {
          skill,
          reason: route.reason,
        };
      }
    }
  }

  const [bestHit] = searchSkills(pluginCatalog, normalized, 1);
  if (bestHit) {
    const skill = findSkill(pluginCatalog, { name: bestHit.name });
    if (skill) {
      return {
        skill,
        reason: "matched the closest skill by aliases and description",
      };
    }
  }

  const fallback = findSkill(pluginCatalog, { name: "automerge-swift" });
  if (!fallback) {
    return null;
  }

  return {
    skill: fallback,
    reason: "fell back to the broad Automerge Swift router",
  };
}

export function buildAskResponse(pluginCatalog, question, options = {}) {
  const route = routeAsk(pluginCatalog, question);
  if (!route) {
    return null;
  }

  const includeSkillContent = options.includeSkillContent !== false;
  const { skill, reason } = route;

  const lines = [
    `Recommended skill: ${skill.name}`,
    `Title: ${skill.title}`,
    `Why: ${reason}`,
    `Resource URI: ${skill.uri}`,
  ];

  if (skill.description) {
    lines.push(`Description: ${skill.description}`);
  }

  if (includeSkillContent) {
    lines.push("", "---", "", skill.markdown.trim());
  }

  return lines.join("\n");
}

export function getPrompt(pluginCatalog, name, args = {}) {
  const command = pluginCatalog.commandByName.get(String(name).toLowerCase());
  if (!command) {
    return null;
  }

  if (command.name === "ask") {
    const question = String(args.question ?? args.arguments ?? "").trim();
    const routed = question ? buildAskResponse(pluginCatalog, question, { includeSkillContent: true }) : null;
    return {
      description: command.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: routed
              ? `${routed}\n\n---\n\nPrompt template:\n\n${command.markdown.trim()}`
              : command.markdown.trim(),
          },
        },
      ],
    };
  }

  const suffix = String(args.area ?? args.arguments ?? "").trim();
  return {
    description: command.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: suffix ? `${command.markdown.trim()}\n\nArguments: ${suffix}` : command.markdown.trim(),
        },
      },
    ],
  };
}
