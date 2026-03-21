import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_VENDOR_ROOT = path.resolve(__dirname, "../vendor/automerge-swift");
const GITHUB_BLOB_ROOT =
  "https://github.com/automerge/automerge-swift/blob/main/Sources";

function walkMarkdownFiles(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function normalizeTitle(rawTitle, fallback) {
  return rawTitle.replaceAll("`", "").trim() || fallback;
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return normalizeTitle(match?.[1] ?? fallback, fallback);
}

function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function makeSnippet(markdown, query) {
  const singleLine = markdown.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return "";
  }

  const lower = singleLine.toLowerCase();
  const target = query.trim().toLowerCase();
  const queryIndex = target ? lower.indexOf(target) : -1;

  let start = 0;
  if (queryIndex >= 0) {
    start = Math.max(0, queryIndex - 80);
  }

  const snippet = singleLine.slice(start, start + 220).trim();
  return start > 0 ? `...${snippet}` : snippet;
}

function scoreDoc(doc, query, tokens) {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = doc.title.toLowerCase();
  const lowerId = doc.id.toLowerCase();
  const lowerContent = doc.markdown.toLowerCase();

  let score = 0;

  if (lowerTitle.includes(lowerQuery)) {
    score += 120;
  }
  if (lowerId.includes(lowerQuery)) {
    score += 80;
  }
  if (lowerContent.includes(lowerQuery)) {
    score += 30;
  }

  for (const token of tokens) {
    if (lowerTitle.includes(token)) {
      score += 25;
    }
    if (lowerId.includes(token)) {
      score += 15;
    }
    if (lowerContent.includes(token)) {
      score += 3;
    }
  }

  return score;
}

function normalizeSourceKindFilter(sourceKind) {
  return sourceKind ? String(sourceKind).toLowerCase() : null;
}

function filterDocs(catalog, options = {}) {
  const moduleFilter = options.module ? String(options.module).toLowerCase() : null;
  const sourceKindFilter = normalizeSourceKindFilter(options.sourceKind);

  return catalog.docs.filter((doc) => {
    if (moduleFilter && doc.moduleName.toLowerCase() !== moduleFilter) {
      return false;
    }

    const docSourceKind = (doc.sourceKind ?? "docc").toLowerCase();
    if (sourceKindFilter && docSourceKind !== sourceKindFilter) {
      return false;
    }

    return true;
  });
}

export function loadCatalog(vendorRoot = DEFAULT_VENDOR_ROOT) {
  const doccDirs = readdirSync(vendorRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".docc"))
    .map((entry) => path.join(vendorRoot, entry.name))
    .sort();

  const docs = [];

  for (const doccDir of doccDirs) {
    const moduleName = path.basename(doccDir, ".docc");
    const markdownFiles = walkMarkdownFiles(doccDir);

    for (const fullPath of markdownFiles) {
      const relativePath = toPosixPath(path.relative(doccDir, fullPath));
      const relativeStem = relativePath.replace(/\.md$/i, "");
      const markdown = readFileSync(fullPath, "utf8");
      const title = extractTitle(markdown, fileStem(fullPath));
      const id = `${moduleName}/${relativeStem}`;
      const uri = `automerge-swift://docs/${encodeURI(id)}`;
      const sourcePath = `Sources/${moduleName}/${moduleName}.docc/${relativePath}`;
      const githubUrl = `${GITHUB_BLOB_ROOT}/${moduleName}.docc/${relativePath}`;

      docs.push({
        id,
        uri,
        title,
        moduleName,
        relativePath,
        sourcePath,
        githubUrl,
        markdown,
      });
    }
  }

  docs.sort((left, right) => left.id.localeCompare(right.id));

  const symbolDocsPath = path.join(vendorRoot, "symbols.json");
  if (existsSync(symbolDocsPath)) {
    const symbolDocs = JSON.parse(readFileSync(symbolDocsPath, "utf8"));
    docs.push(...symbolDocs);
    docs.sort((left, right) => left.id.localeCompare(right.id));
  }

  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.id.toLowerCase(), doc])),
    byUri: new Map(docs.map((doc) => [doc.uri, doc])),
  };
}

export function listDocs(catalog, options = {}) {
  const filtered = filterDocs(catalog, options);

  return filtered.map((doc) => ({
    id: doc.id,
    title: doc.title,
    module: doc.moduleName,
    kind: doc.kind ?? "article",
    sourceKind: doc.sourceKind ?? "docc",
    uri: doc.uri,
    sourcePath: doc.sourcePath,
    githubUrl: doc.githubUrl,
  }));
}

export function findDoc(catalog, locator = {}) {
  const { id, uri, title } = locator;

  if (uri) {
    return catalog.byUri.get(uri) ?? null;
  }

  if (id) {
    return catalog.byId.get(String(id).toLowerCase()) ?? null;
  }

  if (title) {
    const wanted = String(title).toLowerCase();
    return (
      catalog.docs.find((doc) => doc.title.toLowerCase() === wanted) ??
      catalog.docs.find((doc) => doc.id.toLowerCase() === wanted) ??
      null
    );
  }

  return null;
}

export function searchDocs(catalog, query, limit = 5, options = {}) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const tokens = trimmed
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean);

  return filterDocs(catalog, options)
    .map((doc) => ({
      doc,
      score: scoreDoc(doc, trimmed, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.doc.id.localeCompare(right.doc.id);
    })
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      module: doc.moduleName,
      kind: doc.kind ?? "article",
      sourceKind: doc.sourceKind ?? "docc",
      uri: doc.uri,
      score,
      snippet: makeSnippet(doc.markdown, trimmed),
      githubUrl: doc.githubUrl,
    }));
}

export function assertVendorRoot(vendorRoot = DEFAULT_VENDOR_ROOT) {
  const stats = statSync(vendorRoot, { throwIfNoEntry: false });
  if (!stats?.isDirectory()) {
    throw new Error(`Vendor root does not exist: ${vendorRoot}`);
  }
  return vendorRoot;
}

export { DEFAULT_VENDOR_ROOT };
