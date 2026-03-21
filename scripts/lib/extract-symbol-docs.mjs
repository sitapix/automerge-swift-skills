import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function walkSwiftFiles(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSwiftFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".swift")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function normalizeTitle(rawTitle) {
  return rawTitle.replaceAll("`", "").trim().toLowerCase();
}

function stripStringsAndComments(line, state) {
  let result = "";
  let inString = false;
  let stringDelimiter = "";

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (state.inBlockComment) {
      if (char === "*" && next === "/") {
        state.inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      state.inBlockComment = true;
      index += 1;
      continue;
    }

    if (!inString && char === "/" && next === "/") {
      break;
    }

    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      if (!inString) {
        inString = true;
        stringDelimiter = char;
        result += " ";
        continue;
      }

      if (stringDelimiter === char) {
        inString = false;
        stringDelimiter = "";
        result += " ";
        continue;
      }
    }

    result += inString ? " " : char;
  }

  return result;
}

function countBraces(line, state) {
  const sanitized = stripStringsAndComments(line, state);
  let delta = 0;

  for (const char of sanitized) {
    if (char === "{") {
      delta += 1;
    } else if (char === "}") {
      delta -= 1;
    }
  }

  return { sanitized, delta };
}

function cleanDocLine(line) {
  return line.replace(/^\s*\/\/\/\s?/, "");
}

function parseExtensionDeclaration(trimmed) {
  const match = trimmed.match(/^(public|open)?\s*extension\s+(.+?)\s*\{$/);
  if (!match) {
    return null;
  }

  const access = match[1] || null;
  let target = match[2].trim();
  target = target.replace(/\s+where\s+.+$/, "");
  target = target.split(":")[0].trim();

  return {
    access,
    name: target,
  };
}

function parseTypeDeclaration(trimmed) {
  const match = trimmed.match(
    /^(public|open)?\s*(?:final\s+|indirect\s+)?(class|struct|enum|protocol|actor|typealias)\s+([A-Za-z_][A-Za-z0-9_]*)/,
  );
  if (!match) {
    return null;
  }

  return {
    access: match[1] || null,
    kind: match[2],
    name: match[3],
  };
}

function isExplicitlyNonPublic(trimmed) {
  return /^(private|fileprivate|internal)\b/.test(trimmed);
}

function trimDeclarationModifiers(trimmed) {
  let text = trimmed;
  const modifierPattern =
    /^(public|open|static|class|final|override|required|convenience|mutating|nonmutating|nonisolated|lazy|weak|unowned|indirect)\b\s*/;

  while (modifierPattern.test(text)) {
    text = text.replace(modifierPattern, "");
  }

  return text.trimStart();
}

function labelsFromParams(paramsText) {
  if (!paramsText || paramsText === "()") {
    return "()";
  }

  const inner = paramsText.slice(1, -1).trim();
  if (!inner) {
    return "()";
  }

  const labels = inner
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const label = part.split(":")[0].trim().split(/\s+/)[0];
      return `${label || "_"}:`;
    })
    .join("");

  return `(${labels})`;
}

function parseMemberDeclaration(trimmed) {
  const text = trimDeclarationModifiers(trimmed);

  let match = text.match(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\([^)]*\))?/);
  if (match) {
    return {
      kind: "func",
      name: match[1],
      callSuffix: labelsFromParams(match[2] || "()"),
    };
  }

  match = text.match(/^init\s*(\([^)]*\))?/);
  if (match) {
    return {
      kind: "init",
      name: "init",
      callSuffix: labelsFromParams(match[1] || "()"),
    };
  }

  match = text.match(/^subscript\s*(\([^)]*\))?/);
  if (match) {
    return {
      kind: "subscript",
      name: "subscript",
      callSuffix: labelsFromParams(match[1] || "()"),
    };
  }

  match = text.match(/^(var|let)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) {
    return {
      kind: match[1],
      name: match[2],
      callSuffix: "",
    };
  }

  match = text.match(/^typealias\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) {
    return {
      kind: "typealias",
      name: match[1],
      callSuffix: "",
    };
  }

  match = text.match(/^associatedtype\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) {
    return {
      kind: "associatedtype",
      name: match[1],
      callSuffix: "",
    };
  }

  return null;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function ownerPath(contextStack) {
  return contextStack.map((context) => context.name).join(".");
}

function currentPublicContext(contextStack) {
  return [...contextStack].reverse().find(
    (context) => context.kind === "type" || context.kind === "extension",
  );
}

function hasPublicAccess(trimmed, context) {
  if (/^(public|open)\b/.test(trimmed)) {
    return true;
  }

  if (isExplicitlyNonPublic(trimmed)) {
    return false;
  }

  if (!context?.access) {
    return false;
  }

  if (context.kind === "extension") {
    return true;
  }

  if (context.kind === "type" && context.typeKind === "protocol") {
    return true;
  }

  return false;
}

function markdownForSymbol(symbol) {
  const lines = [
    `# ${symbol.displayTitle || symbol.title}`,
    "",
    `- Symbol kind: \`${symbol.kind}\``,
    `- Module: \`${symbol.moduleName}\``,
    `- Source: ${symbol.githubUrl}`,
    "",
    "## Declaration",
    "",
    "```swift",
    symbol.signature,
    "```",
  ];

  if (symbol.docComment) {
    lines.push("", "## Discussion", "", symbol.docComment.trim());
  } else {
    lines.push("", "## Discussion", "", "_No source doc comment was extracted for this symbol._");
  }

  return `${lines.join("\n")}\n`;
}

function buildSymbolDoc({
  moduleName,
  sourcePath,
  lineNumber,
  kind,
  title,
  displayTitle,
  signature,
  docComment,
}) {
  const symbolSlug = slugify(displayTitle || title) || `symbol-l${lineNumber}`;
  const id = `${moduleName}/Symbols/${symbolSlug}-l${lineNumber}`;
  const githubUrl = `https://github.com/automerge/automerge-swift/blob/main/${sourcePath}#L${lineNumber}`;

  return {
    id,
    uri: `automerge-swift://docs/${encodeURI(id)}`,
    title: displayTitle || title,
    symbolTitle: title,
    moduleName,
    sourcePath,
    githubUrl,
    kind,
    sourceKind: "symbol",
    markdown: markdownForSymbol({
      title,
      displayTitle: displayTitle || title,
      moduleName,
      kind,
      githubUrl,
      signature,
      docComment,
    }),
  };
}

function extractFromFile(moduleName, filePath, repoRoot, existingTitles) {
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join("/");
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const commentState = { inBlockComment: false };
  const contextStack = [];
  const results = [];

  let braceDepth = 0;
  let pendingDocLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("///")) {
      pendingDocLines.push(cleanDocLine(rawLine));
      continue;
    }

    if (!trimmed) {
      pendingDocLines = [];
      const { delta } = countBraces(rawLine, commentState);
      braceDepth += delta;
      while (contextStack.length && braceDepth < contextStack[contextStack.length - 1].depth) {
        contextStack.pop();
      }
      continue;
    }

    const { sanitized, delta } = countBraces(rawLine, commentState);
    const sanitizedTrimmed = sanitized.trim();

    if (trimmed.startsWith("@")) {
      braceDepth += delta;
      while (contextStack.length && braceDepth < contextStack[contextStack.length - 1].depth) {
        contextStack.pop();
      }
      continue;
    }

    const extDecl = parseExtensionDeclaration(sanitizedTrimmed);
    if (extDecl) {
      const nextDepth = braceDepth + Math.max(delta, 0);
      contextStack.push({
        kind: "extension",
        name: extDecl.name,
        access: extDecl.access,
        depth: nextDepth,
      });
      pendingDocLines = [];
      braceDepth += delta;
      continue;
    }

    const typeDecl = parseTypeDeclaration(sanitizedTrimmed);
    if (typeDecl) {
      const title = ownerPath(contextStack)
        ? `${ownerPath(contextStack)}.${typeDecl.name}`
        : typeDecl.name;

      if (pendingDocLines.length > 0 && !existingTitles.has(normalizeTitle(title))) {
        results.push(
          buildSymbolDoc({
            moduleName,
            sourcePath: relativePath,
            lineNumber: index + 1,
            kind: typeDecl.kind,
            title,
            signature: sanitizedTrimmed.replace(/\s*\{$/, "").trim(),
            docComment: pendingDocLines.join("\n").trim(),
          }),
        );
      }

      if (typeDecl.kind !== "typealias" && sanitizedTrimmed.includes("{")) {
        const nextDepth = braceDepth + Math.max(delta, 0);
        contextStack.push({
          kind: "type",
          typeKind: typeDecl.kind,
          name: typeDecl.name,
          access: typeDecl.access,
          depth: nextDepth,
        });
      }

      pendingDocLines = [];
      braceDepth += delta;
      while (contextStack.length && braceDepth < contextStack[contextStack.length - 1].depth) {
        contextStack.pop();
      }
      continue;
    }

    const publicContext = currentPublicContext(contextStack);
    const memberDecl = parseMemberDeclaration(sanitizedTrimmed);

    if (memberDecl && pendingDocLines.length > 0 && publicContext && hasPublicAccess(sanitizedTrimmed, publicContext)) {
      const owner = ownerPath(contextStack);
      const title =
        memberDecl.kind === "var" || memberDecl.kind === "let"
          ? `${owner}.${memberDecl.name}`
          : `${owner}.${memberDecl.name}${memberDecl.callSuffix}`;

      if (!existingTitles.has(normalizeTitle(title))) {
        results.push(
          buildSymbolDoc({
            moduleName,
            sourcePath: relativePath,
            lineNumber: index + 1,
            kind: memberDecl.kind,
            title,
            signature: sanitizedTrimmed.replace(/\s*\{$/, "").trim(),
            docComment: pendingDocLines.join("\n").trim(),
          }),
        );
      }
    }

    pendingDocLines = [];
    braceDepth += delta;
    while (contextStack.length && braceDepth < contextStack[contextStack.length - 1].depth) {
      contextStack.pop();
    }
  }

  return results;
}

function compactSignature(signature) {
  return signature
    .replace(/\s+/g, " ")
    .replace(/\s*->\s*/g, " -> ")
    .trim();
}

function disambiguateOverloads(docs) {
  const byTitle = new Map();

  for (const doc of docs) {
    const key = normalizeTitle(doc.symbolTitle || doc.title);
    const group = byTitle.get(key) ?? [];
    group.push(doc);
    byTitle.set(key, group);
  }

  for (const group of byTitle.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const doc of group) {
      const signature = doc.markdown.match(/```swift\n([\s\S]*?)\n```/)?.[1] || "";
      const signatureSummary = compactSignature(signature);
      const decoratedTitle = `${doc.symbolTitle || doc.title} :: ${signatureSummary}`;
      doc.title = decoratedTitle;
      doc.markdown = doc.markdown.replace(/^# .+$/m, `# ${decoratedTitle}`);
    }
  }
}

export function extractSymbolDocs({ upstreamRoot, existingTitles = new Set() }) {
  const sourceRoots = [
    {
      moduleName: "Automerge",
      root: path.join(upstreamRoot, "Sources", "Automerge"),
    },
    {
      moduleName: "AutomergeUtilities",
      root: path.join(upstreamRoot, "Sources", "AutomergeUtilities"),
    },
  ];

  const docs = [];

  for (const sourceRoot of sourceRoots) {
    const files = walkSwiftFiles(sourceRoot.root);
    for (const filePath of files) {
      docs.push(...extractFromFile(sourceRoot.moduleName, filePath, upstreamRoot, existingTitles));
    }
  }

  disambiguateOverloads(docs);
  docs.sort((left, right) => left.id.localeCompare(right.id));
  return docs;
}

export function writeSymbolDocs(outputPath, docs) {
  writeFileSync(outputPath, `${JSON.stringify(docs, null, 2)}\n`, "utf8");
}
