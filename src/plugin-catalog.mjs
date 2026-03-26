import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_ROOT = path.resolve(__dirname, "../skills");
export const DEFAULT_COMMANDS_ROOT = path.resolve(__dirname, "../commands");

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Section Parsing ─────────────────────────────────────────────────────────

function parseSections(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let currentHeading = "_preamble";
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,2})\s+(.+)$/);
    if (headingMatch) {
      if (i > currentStart) {
        const content = lines.slice(currentStart, i).join("\n");
        sections.push({
          heading: currentHeading,
          startLine: currentStart,
          endLine: i - 1,
          charCount: content.length,
        });
      }
      currentHeading = headingMatch[2].trim();
      currentStart = i;
    }
  }

  const content = lines.slice(currentStart).join("\n");
  sections.push({
    heading: currentHeading,
    startLine: currentStart,
    endLine: lines.length - 1,
    charCount: content.length,
  });

  return sections;
}

// ── MiniSearch Index ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "have", "how", "i", "in", "is", "it", "its", "my", "of",
  "on", "or", "that", "the", "this", "to", "was", "were", "will",
  "with", "you", "your", "do", "does", "what", "when", "where",
]);

function tokenize(text) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9@_]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const MINISEARCH_OPTIONS = {
  fields: ["nameText", "description", "tags", "body"],
  storeFields: ["description", "category", "kind"],
  idField: "name",
  tokenize,
  searchOptions: {
    boost: { nameText: 3, description: 2, tags: 2, body: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
};

function buildIndex(skills) {
  const engine = new MiniSearch(MINISEARCH_OPTIONS);
  const documents = skills.map((s) => ({
    name: s.name,
    nameText: s.name.replace(/[-_]/g, " "),
    description: s.description,
    tags: [
      ...s.aliases,
      ...(s.triggerQueries || []),
    ].join(" "),
    body: s.markdown,
    category: s.category,
    kind: s.kind,
  }));
  engine.addAll(documents);
  return engine;
}

// ── Category Labels ─────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  "entrypoints": "Getting Started",
  "document-api": "Document API",
  "codable-layer": "Codable Layer",
  "sync-collaboration": "Sync & Collaboration",
  "collaborative-text": "Collaborative Text",
  "data-modeling": "Data Modeling",
  "troubleshooting": "Troubleshooting",
  "api-reference": "API Reference",
};

// ── Catalog Loading ─────────────────────────────────────────────────────────

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
      triggerQueries: Array.isArray(metadata.trigger_queries) ? metadata.trigger_queries : [],
      relatedSkills: Array.isArray(metadata.related_skills) ? metadata.related_skills : [],
      sections: parseSections(body),
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
    const cmdName = path.basename(entry.name, ".md");

    commands.push({
      name: cmdName,
      title: extractTitle(body, cmdName),
      description: attributes.description || "",
      argumentHint: attributes["argument-hint"] || "",
      markdown,
      uri: `automerge-swift://commands/${encodeURIComponent(cmdName)}`,
      relativePath: toPosixPath(path.relative(commandsRoot, commandPath)),
    });
  }

  commands.sort((left, right) => left.name.localeCompare(right.name));

  const searchIndex = buildIndex(skills);

  return {
    skills,
    commands,
    searchIndex,
    skillByName: new Map(skills.map((skill) => [skill.name.toLowerCase(), skill])),
    skillByUri: new Map(skills.map((skill) => [skill.uri, skill])),
    commandByName: new Map(commands.map((command) => [command.name.toLowerCase(), command])),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

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

export function searchSkills(pluginCatalog, query, options = {}) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const limit = options.limit ?? 10;
  const queryTerms = tokenize(trimmed);

  const results = pluginCatalog.searchIndex.search(trimmed, {
    filter: (result) => {
      if (options.category && result.category !== options.category) return false;
      if (options.kind && result.kind !== options.kind) return false;
      return true;
    },
  });

  return results.slice(0, limit).map((hit) => {
    const skill = findSkill(pluginCatalog, { name: hit.id });
    const matchingSections = [];
    if (skill) {
      for (const section of skill.sections) {
        const lines = skill.markdown.split("\n").slice(section.startLine, section.endLine + 1);
        const sectionText = section.heading + " " + lines.join(" ");
        const sectionTokens = new Set(tokenize(sectionText));
        if (queryTerms.some((qt) => sectionTokens.has(qt))) {
          matchingSections.push(section.heading);
        }
      }
    }

    return {
      name: hit.id,
      score: Math.round(hit.score * 100) / 100,
      description: hit.description ?? "",
      category: hit.category ?? null,
      kind: hit.kind ?? null,
      matchingSections,
    };
  });
}

export function getSkillSections(pluginCatalog, name, sectionNames) {
  const skill = findSkill(pluginCatalog, { name });
  if (!skill) return null;

  if (!sectionNames || sectionNames.length === 0) {
    return { skill, content: skill.markdown, sections: skill.sections };
  }

  const lines = skill.markdown.split("\n");
  const matched = [];
  const matchedContent = [];

  for (const section of skill.sections) {
    const lowerHeading = section.heading.toLowerCase();
    if (sectionNames.some((s) => lowerHeading.includes(s.toLowerCase()))) {
      matched.push(section);
      matchedContent.push(lines.slice(section.startLine, section.endLine + 1).join("\n"));
    }
  }

  return {
    skill,
    content: matchedContent.join("\n\n"),
    sections: matched,
  };
}

export function getCatalog(pluginCatalog, category) {
  const categories = {};

  for (const skill of pluginCatalog.skills) {
    const cat = skill.category || "uncategorized";
    if (category && cat !== category) continue;

    if (!categories[cat]) {
      categories[cat] = {
        label: CATEGORY_LABELS[cat] || cat,
        skills: [],
      };
    }
    categories[cat].skills.push({
      name: skill.name,
      description: skill.description,
      kind: skill.kind,
    });
  }

  return {
    categories,
    totalSkills: pluginCatalog.skills.length,
  };
}

export function getPrompt(pluginCatalog, name, args = {}) {
  const command = pluginCatalog.commandByName.get(String(name).toLowerCase());
  if (!command) {
    return null;
  }

  if (command.name === "ask") {
    const question = String(args.question ?? args.arguments ?? "").trim();
    let preamble = "";
    if (question) {
      const results = searchSkills(pluginCatalog, question, { limit: 3 });
      if (results.length > 0) {
        const best = findSkill(pluginCatalog, { name: results[0].name });
        if (best) {
          preamble = [
            `Top skill match: ${best.name}`,
            `Description: ${best.description}`,
            "",
            "---",
            "",
            best.markdown.trim(),
          ].join("\n");
        }
      }
    }

    return {
      description: command.description,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: preamble
              ? `${preamble}\n\n---\n\nPrompt template:\n\n${command.markdown.trim()}`
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
