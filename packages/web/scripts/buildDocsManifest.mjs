/**
 * buildDocsManifest.mjs — Prebuild script for the /learn docs surface (B4-REQ-2).
 *
 * Reads all .md files under src/content/learn/, parses their frontmatter and
 * anchored headings, then emits:
 *   1. src/content/learn/generated/docsManifest.json   — the flat manifest array
 *   2. src/content/learn/generated/articles.ts          — slug→{html,meta} map
 *
 * Run with: node packages/web/scripts/buildDocsManifest.mjs
 * Invoked automatically by the Vite plugin in vite.config.ts at build start.
 *
 * Validates:
 *   - All required frontmatter fields present
 *   - All anchor IDs unique within a page
 *   - Canonical ID format matches grammar
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "src", "content", "learn");
const OUT_DIR = join(CONTENT_DIR, "generated");

mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Frontmatter parser (minimal YAML subset — no external deps)
// ---------------------------------------------------------------------------

/** Parse the YAML-like frontmatter block between the first two `---` lines. */
function parseFrontmatter(src) {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Missing frontmatter block");
  const block = match[1];
  const result = {};

  // Join multi-line arrays (prettier may reformat `key: [a, b]` as:
  //   key:
  //     [
  //       a,
  //       b,
  //     ]
  // ) into `key: [a, b]` before parsing.
  const lines = block.split("\n");
  const joinedLines = [];
  let accumulating = false;
  let accKey = "";
  let accItems = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (accumulating) {
      if (trimmed === "[" || trimmed === "") continue; // skip open bracket or blank
      if (trimmed === "]" || trimmed === "],") {
        // End of array
        joinedLines.push(`${accKey}: [${accItems.join(", ")}]`);
        accumulating = false;
        accKey = "";
        accItems = [];
      } else {
        // Array item line, may end with comma
        accItems.push(trimmed.replace(/,$/, "").trim());
      }
    } else {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const rawVal = line.slice(colonIdx + 1).trim();
        // Inline array [a, b]
        if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
          joinedLines.push(line);
        } else if (rawVal === "" || rawVal === "[") {
          // Multi-line array: `key:` followed by array on next lines
          // OR `key: [` on same line
          accumulating = true;
          accKey = key;
          accItems = [];
          if (rawVal === "[") continue; // open bracket on same line; items follow
        } else {
          joinedLines.push(line);
        }
      } else {
        joinedLines.push(line);
      }
    }
  }
  if (accumulating) joinedLines.push(`${accKey}: [${accItems.join(", ")}]`);

  for (const line of joinedLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();
    if (!key) continue;

    // Array: [a, b, c]
    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      result[key] = rawVal
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else if (rawVal === "true") {
      result[key] = true;
    } else if (rawVal === "false") {
      result[key] = false;
    } else if (!isNaN(Number(rawVal)) && rawVal !== "") {
      result[key] = Number(rawVal);
    } else {
      // Strip surrounding quotes
      result[key] = rawVal.replace(/^['"]|['"]$/g, "");
    }
  }
  return result;
}

/** Return the body (everything after the closing `---`). */
function extractBody(src) {
  const match = src.match(/^---\r?\n[\s\S]*?\r?\n---([\s\S]*)$/);
  return match ? match[1].trim() : src;
}

// ---------------------------------------------------------------------------
// Markdown → HTML converter (build-time; no external deps)
// ---------------------------------------------------------------------------

/**
 * Parse anchored headings from the body.
 * Looks for `## Heading Text {#anchor-slug}` patterns.
 * Returns array of { anchorSlug, headingText, level }.
 */
function parseAnchors(body) {
  const anchors = [];
  // Match headings at any level with {#slug}
  const re = /^(#{2,4})\s+(.+?)\s+\{#([\w-]+)\}\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    anchors.push({
      level: m[1].length,
      headingText: m[2].trim(),
      anchorSlug: m[3],
    });
  }
  return anchors;
}

/** Strip the {#anchor} marker from heading text for display. */
function stripAnchorMarker(text) {
  return text.replace(/\s*\{#[\w-]+\}\s*$/, "").trim();
}

/** Escape HTML special characters. */
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Apply inline Markdown: **bold**, *em*, `code`. */
function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Convert Markdown body to HTML (minimal, build-time only). */
function markdownToHtml(body) {
  const lines = body.split("\n");
  const html = [];
  let inList = false;
  let inBlockquote = false;
  let paraLines = [];

  function flushPara() {
    if (paraLines.length === 0) return;
    html.push(`<p>${inlineMarkdown(paraLines.join(" "))}</p>`);
    paraLines = [];
  }

  function flushList() {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  }

  function flushBlockquote() {
    if (!inBlockquote) return;
    html.push("</blockquote>");
    inBlockquote = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip HTML comments
    if (line.match(/^\s*<!--/) || line.match(/-->\s*$/)) {
      continue;
    }

    // Heading with anchor marker
    const headingAnchor = line.match(/^(#{1,4})\s+(.+?)\s+\{#([\w-]+)\}\s*$/);
    if (headingAnchor) {
      flushPara();
      flushList();
      flushBlockquote();
      const level = headingAnchor[1].length;
      const text = esc(headingAnchor[2]);
      const slug = headingAnchor[3];
      html.push(
        `<h${level} id="${slug}"><a href="#${slug}" class="anchor-link" aria-label="Link to ${text}">🔗</a>${inlineMarkdown(text)}</h${level}>`,
      );
      continue;
    }

    // Plain heading (no anchor)
    const plainHeading = line.match(/^(#{1,4})\s+(.+)$/);
    if (plainHeading) {
      flushPara();
      flushList();
      flushBlockquote();
      const level = plainHeading[1].length;
      html.push(`<h${level}>${inlineMarkdown(esc(plainHeading[2]))}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushPara();
      flushList();
      if (!inBlockquote) {
        html.push("<blockquote>");
        inBlockquote = true;
      }
      html.push(`<p>${inlineMarkdown(esc(line.slice(2)))}</p>`);
      continue;
    }

    // Numbered list item
    const numberedList = line.match(/^\d+\.\s+(.+)$/);
    if (numberedList) {
      flushPara();
      flushBlockquote();
      if (!inList) {
        html.push('<ol class="docs-list">');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(esc(numberedList[1]))}</li>`);
      continue;
    }

    // Unordered list item
    if (line.match(/^[-*]\s+/)) {
      flushPara();
      flushBlockquote();
      if (!inList) {
        html.push('<ul class="docs-list">');
        inList = true;
      }
      const item = line.replace(/^[-*]\s+/, "");
      html.push(`<li>${inlineMarkdown(esc(item))}</li>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushPara();
      flushList();
      flushBlockquote();
      html.push("<hr />");
      continue;
    }

    // Blank line — flush accumulated paragraph
    if (line.trim() === "") {
      flushPara();
      flushList();
      flushBlockquote();
      continue;
    }

    // Regular text — accumulate into paragraph
    flushList();
    flushBlockquote();
    paraLines.push(inlineMarkdown(esc(line.trim())));
  }

  flushPara();
  flushList();
  flushBlockquote();

  return html.join("\n");
}

// ---------------------------------------------------------------------------
// Walk content directory and collect .md files
// ---------------------------------------------------------------------------

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "generated") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkDir(full, files);
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["id", "section", "group", "title", "slug", "summary"];
const VALID_SECTIONS = ["rules", "howto"];
const VALID_GROUPS = ["primer", "difference", "card", "howto"];
const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;

function validateFrontmatter(meta, filePath) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!meta[f]) errors.push(`missing required field: ${f}`);
  }
  if (meta.section && !VALID_SECTIONS.includes(meta.section)) {
    errors.push(`invalid section "${meta.section}" (must be: ${VALID_SECTIONS.join(", ")})`);
  }
  if (meta.group && !VALID_GROUPS.includes(meta.group)) {
    errors.push(`invalid group "${meta.group}" (must be: ${VALID_GROUPS.join(", ")})`);
  }
  if (meta.id && !ID_PATTERN.test(meta.id)) {
    errors.push(`id "${meta.id}" does not match grammar {section}.{group}.{key}`);
  }
  if (errors.length > 0) {
    throw new Error(`Frontmatter errors in ${filePath}:\n  ${errors.join("\n  ")}`);
  }
}

// ---------------------------------------------------------------------------
// Build URL from meta
// ---------------------------------------------------------------------------

function buildUrl(meta) {
  if (meta.section === "howto") {
    return `/learn/how-to/${meta.slug}`;
  }
  // rules group
  return `/learn/rules/${meta.slug}`;
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

function build() {
  const mdFiles = walkDir(CONTENT_DIR);
  if (mdFiles.length === 0) {
    console.warn("buildDocsManifest: no .md files found in", CONTENT_DIR);
    return;
  }

  const manifest = [];
  const articlesMap = {}; // id → { meta, html }
  const allAnchorIds = new Set();

  for (const filePath of mdFiles) {
    const src = readFileSync(filePath, "utf8");
    let meta;
    try {
      meta = parseFrontmatter(src);
    } catch (e) {
      throw new Error(`Failed to parse frontmatter in ${filePath}: ${e.message}`);
    }

    validateFrontmatter(meta, filePath);

    const body = extractBody(src);
    const parsedAnchors = parseAnchors(body);
    const html = markdownToHtml(body);
    const url = buildUrl(meta);

    // Build anchor entries
    const anchors = parsedAnchors.map(({ anchorSlug, headingText }) => {
      const anchorId = `${meta.id}#${anchorSlug}`;
      if (allAnchorIds.has(anchorId)) {
        throw new Error(`Duplicate anchor ID "${anchorId}" in ${filePath}`);
      }
      allAnchorIds.add(anchorId);
      return {
        id: anchorId,
        text: headingText,
        url: `${url}#${anchorSlug}`,
      };
    });

    const entry = {
      id: meta.id,
      url,
      section: meta.section,
      group: meta.group,
      title: meta.title,
      slug: meta.slug,
      summary: meta.summary,
      keywords: meta.keywords ?? [],
      anchors,
      aliases: meta.aliases ?? [],
      ...(meta.ruleNumber !== undefined && { ruleNumber: meta.ruleNumber }),
      ...(meta.prevId && { prevId: meta.prevId }),
      ...(meta.nextId && { nextId: meta.nextId }),
    };

    manifest.push(entry);
    articlesMap[meta.id] = {
      meta: { ...meta, keywords: meta.keywords ?? [], aliases: meta.aliases ?? [] },
      html,
    };
  }

  // Sort: howto first (by nextId chain), then rules by group/ruleNumber/id
  manifest.sort((a, b) => {
    if (a.section !== b.section) return a.section === "howto" ? -1 : 1;
    if (a.group !== b.group) {
      const groupOrder = { primer: 0, difference: 1, card: 2, howto: 3 };
      return (groupOrder[a.group] ?? 99) - (groupOrder[b.group] ?? 99);
    }
    if (a.ruleNumber !== undefined && b.ruleNumber !== undefined) {
      return a.ruleNumber - b.ruleNumber;
    }
    return a.id.localeCompare(b.id);
  });

  // Emit docs-manifest.json
  const manifestJson = JSON.stringify(manifest, null, 2);
  writeFileSync(join(OUT_DIR, "docsManifest.json"), manifestJson, "utf8");
  console.log(`buildDocsManifest: wrote docsManifest.json (${manifest.length} entries)`);

  // Emit articles.json (raw data; typed via the articles.ts wrapper)
  const articlesJson = JSON.stringify(articlesMap, null, 2);
  writeFileSync(join(OUT_DIR, "articles.json"), articlesJson, "utf8");
  console.log(
    `buildDocsManifest: wrote articles.json (${Object.keys(articlesMap).length} articles)`,
  );
}

build();
