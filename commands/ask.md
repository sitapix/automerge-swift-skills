---
description: Natural-language entry point for Automerge Swift. Use when the user has an Automerge question but does not know which skill to invoke.
argument-hint: [question]
---

# Automerge Swift Ask

Use this command when the user has an Automerge Swift problem but not a skill name.

## Quick Decision

- Broad Automerge question -> `/skill automerge-swift`
- Schema design, initial data problem, save/load, UTType -> `/skill automerge-swift-modeling`
- Errors, debugging, "why does my merge/decode fail" -> `/skill automerge-swift-diag`
- Document API, ObjId, maps/lists, Codable, text, sync, API reference -> launch **automerge-reference** agent
- Code audit for anti-patterns -> launch **automerge-auditor** agent

## Core Guidance

Treat `$ARGUMENTS` as the user's Automerge problem statement.

### Routing rules

1. If the request mentions schema design, initial data, skeleton, UTType, Transferable, or save/load, use `/skill automerge-swift-modeling`.
2. If the request mentions errors, debugging, "why does X fail", schema mismatch, or merge producing garbage, use `/skill automerge-swift-diag`.
3. If the request needs specific API details, implementation patterns, or reference content (ObjId, Codable, text, sync, method signatures), launch the **automerge-reference** agent.
4. If the request is broad or ambiguous but obviously about Automerge Swift, use `/skill automerge-swift`.
5. If the request is too ambiguous to route safely, ask exactly one concise clarification question.

### How to launch domain agents

Use the Agent tool with `subagent_type` set to one of these registered agents. Pass the user's question as the prompt.

| Agent | subagent_type | Covers |
|-------|--------------|--------|
| automerge-reference | `automerge-swift:automerge-reference` | Document API, ObjId, Codable mapping, collaborative text, sync protocol, API reference |
| automerge-auditor | `automerge-swift:automerge-auditor` | Automated code scan for Automerge anti-patterns |

### Why agents for reference

Domain agents run in isolated context. They have the full reference material, answer the specific question, and return a focused response. This keeps the main conversation clean.

## Response style

- Do not explain the full skill taxonomy unless the user asks.
- Prefer acting over describing which route you might take.
