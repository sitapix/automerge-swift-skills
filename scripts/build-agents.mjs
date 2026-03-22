#!/usr/bin/env node

/**
 * Combines skill SKILL.md files into domain agent files.
 *
 * Each domain agent bundles related reference/workflow content so the full
 * text runs inside an isolated agent context instead of polluting the main
 * conversation.
 *
 * Run:           node scripts/build-agents.mjs
 * Check only:    node scripts/build-agents.mjs --check
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const AGENTS_DIR = join(ROOT, "agents");

// ── Domain agent definitions ────────────────────────────────────────────────

const agents = [
  {
    name: "automerge-reference",
    description:
      "Look up Automerge Swift APIs, Document operations, Codable mapping, collaborative text, sync protocol, and schema patterns.",
    skills: [
      "automerge-swift-core",
      "automerge-swift-codable",
      "automerge-swift-text",
      "automerge-swift-sync",
      "automerge-swift-ref",
    ],
    preamble: `You answer specific questions about Automerge Swift APIs and implementation patterns.

## Instructions

1. Read the user's question carefully.
2. Find the relevant section in the reference material below.
3. Return ONLY the information that answers their question — maximum 40 lines.
4. Include exact API signatures, code examples, and gotchas when relevant.
5. Do NOT dump all reference material — extract what is relevant.
6. Always warn about the top gotchas: Text vs String, initial data problem, Codable performance, timestamp precision.
7. If the question is about schema design or the initial data problem, recommend the user also consult the automerge-swift-modeling skill.
8. If the question is about debugging errors, recommend the user consult the automerge-swift-diag skill.`,
  },
];

// ── Skill-to-agent mapping (for rewriting cross-references) ─────────────────

const skillToAgent = new Map();
for (const agent of agents) {
  for (const skill of agent.skills) {
    skillToAgent.set(skill, agent.name);
  }
}

// Skills that remain registered (keep as `/skill` references)
const registeredSkills = new Set([
  "automerge-swift",
  "automerge-swift-diag",
  "automerge-swift-modeling",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function readSkillContent(skillName) {
  const path = join(SKILLS_DIR, skillName, "SKILL.md");
  if (!existsSync(path)) {
    console.error(`  ⚠ Skill not found: ${path}`);
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  // Strip YAML frontmatter
  const match = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : raw.trim();
}

/**
 * Rewrite `/skill automerge-swift-X` references:
 * - If skill is still registered, keep the `/skill` reference
 * - If skill is bundled in the SAME agent, replace with "see the X section above"
 * - If skill is bundled in a DIFFERENT agent, replace with "ask the Y agent"
 */
function rewriteCrossReferences(content, currentAgentName) {
  return content.replace(
    /`?\/skill (automerge-swift[\w-]*)`?/g,
    (match, skillName) => {
      if (registeredSkills.has(skillName)) {
        return match; // keep registered skill references
      }
      const targetAgent = skillToAgent.get(skillName);
      if (!targetAgent) {
        return match; // unknown skill, leave as-is
      }
      const label = skillName
        .replace("automerge-swift-", "")
        .replace(/-/g, " ");
      if (targetAgent === currentAgentName) {
        return `the ${label} section in this reference`;
      }
      return `the **${targetAgent}** agent`;
    },
  );
}

function buildAgent(agent) {
  const sections = [];

  for (const skillName of agent.skills) {
    const content = readSkillContent(skillName);
    if (!content) continue;
    sections.push(rewriteCrossReferences(content, agent.name));
  }

  const frontmatter = [
    "---",
    `name: ${agent.name}`,
    `description: ${agent.description}`,
    "model: sonnet",
    "tools:",
    "  - Glob",
    "  - Grep",
    "  - Read",
    "---",
  ].join("\n");

  const heading = `# ${agent.name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")} Agent`;

  const body = [
    frontmatter,
    "",
    heading,
    "",
    agent.preamble,
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "", // trailing newline
  ].join("\n");

  return body;
}

// ── Main ────────────────────────────────────────────────────────────────────

const checkMode = process.argv.includes("--check");

if (checkMode) {
  let stale = 0;
  for (const agent of agents) {
    const expected = buildAgent(agent);
    const outPath = join(AGENTS_DIR, `${agent.name}.md`);
    if (!existsSync(outPath)) {
      console.error(`Missing agent file: ${outPath}`);
      stale++;
      continue;
    }
    const actual = readFileSync(outPath, "utf-8");
    if (actual !== expected) {
      console.error(`Stale agent file: agents/${agent.name}.md`);
      stale++;
    }
  }
  if (stale > 0) {
    console.error(`\nERROR: ${stale} agent file(s) out of date. Run: node scripts/build-agents.mjs`);
    process.exit(1);
  }
  console.log("Agent files are up to date.");
  process.exit(0);
}

console.log("Building domain agents from skills...\n");

for (const agent of agents) {
  const output = buildAgent(agent);
  const outPath = join(AGENTS_DIR, `${agent.name}.md`);
  writeFileSync(outPath, output, "utf-8");

  const lineCount = output.split("\n").length;
  console.log(`  ✓ ${agent.name}.md (${lineCount} lines, ${agent.skills.length} skills)`);
}

console.log("\nDone. Agent files written to agents/");
