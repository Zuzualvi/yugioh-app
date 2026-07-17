// ---------------------------------------------------------------------------
// @yugioh-app/contracts — Docs Manifest types (B4-REQ-6 typed contract)
//
// SCHEMA SUMMARY — for Track C content authors and the future chatbot:
//
// ## Frontmatter (every .md content file must include these fields)
//
// REQUIRED:
//   id        string   Canonical, immutable page ID.
//                      Grammar: {section}.{group}.{key}
//                      Examples:
//                        "howto.getting-started"
//                        "rules.primer.turn"
//                        "rules.diff.06"           ← zero-padded, 01–13, frozen to edisonformat.com
//                        "rules.card.brionac"
//   section   "rules" | "howto"
//   group     "primer" | "difference" | "card" | "howto"
//   title     string   Display title — MAY be reworded at any time. The id never changes.
//   slug      string   URL tail used in the React route. Stable once shipped; renames
//                      require an entry in aliases[].
//   summary   string   One-sentence plain-text answer. Shown in the TL;DR box, search
//                      result snippets, and (future) chatbot citation cards.
//
// OPTIONAL:
//   ruleNumber  number   1–13. Present ONLY on the 13 rule-difference pages.
//   keywords    string[] Extra search terms: card names, aliases, mechanical concepts.
//   aliases     string[] Old slugs that redirect to this page (e.g. after a rename).
//   prevId      string   Canonical ID of the preceding article within the same group.
//   nextId      string   Canonical ID of the following article within the same group.
//
// ## Heading anchors
//
// Every section heading that should be deep-linked MUST carry an explicit,
// author-assigned anchor:
//
//   ## My Heading Text {#my-anchor-slug}
//
// The {#anchor-slug} is IMMUTABLE once the page ships. You may reword the visible
// heading freely at any time; the anchor slug never changes. This is what lets Quick
// Answers, Search, and the future chatbot cite a specific case within a page without
// breaking when headings are reworded.
//
// ## Canonical ID grammar
//
//   Page:    {section}.{group}.{key}
//   Heading: {pageId}#{anchor}
//
//   Examples:
//     rules.diff.06                         → /learn/rules/difference-06-...
//     rules.diff.06#summon-no-chain         → /learn/rules/difference-06-...#summon-no-chain
//     rules.primer.turn#who-goes-first      → /learn/rules/primer-how-a-turn-works#who-goes-first
//     howto.build-deck                      → /learn/how-to/build-a-deck
//
// ## Quick Answers
//
// Declared separately (quick-answers.ts in the content dir) as an array of
// { question: string; canonicalId: string } objects. The canonicalId must match
// either a page id or a page id + "#" + anchor slug present in the manifest.
//
// ## docs-manifest.json structure
//
// A flat array of DocsManifestEntry objects — one per page. Generated at build
// time from the .md source files. This is the single source of truth for:
//   • Client-side search (title, headings, keywords, summary)
//   • Quick Answers link resolution (canonicalId → url)
//   • Prev/next navigation
//   • Future chatbot retrieval and citation
// ---------------------------------------------------------------------------

/** Section of the docs: "rules" or "howto" (using the app). */
export type DocsSection = "rules" | "howto";

/** Content group within a section. */
export type DocsGroup = "primer" | "difference" | "card" | "howto";

/**
 * Frontmatter declared at the top of every .md content file.
 * The build script validates that all required fields are present.
 */
export interface DocsFrontmatter {
  /** Canonical, immutable page ID. Grammar: {section}.{group}.{key} */
  id: string;
  section: DocsSection;
  group: DocsGroup;
  /** Display title — may be reworded freely; the id never changes. */
  title: string;
  /** URL tail, stable once shipped. Renames require an aliases[] entry. */
  slug: string;
  /** One-sentence plain-text summary. Shown in TL;DR + search + chatbot. */
  summary: string;

  // Optional fields
  /** 1–13. Present only on the 13 rule-difference pages. */
  ruleNumber?: number;
  /** Extra search terms: card names, aliases, mechanical concepts. */
  keywords?: string[];
  /** Old slugs that redirect to this page. */
  aliases?: string[];
  /** Canonical ID of the preceding article in the same group (for prev/next). */
  prevId?: string;
  /** Canonical ID of the following article in the same group (for prev/next). */
  nextId?: string;
}

/**
 * A single anchored heading within a page.
 * Emitted into DocsManifestEntry.anchors[] by the build script.
 */
export interface DocsAnchor {
  /**
   * Compound canonical ID: "{pageId}#{anchorSlug}".
   * e.g. "rules.diff.06#summon-no-chain"
   * Immutable once shipped.
   */
  id: string;
  /** Visible heading text (without the {#slug} marker). */
  text: string;
  /** Absolute URL path including fragment: "/learn/rules/difference-06-...#summon-no-chain" */
  url: string;
}

/**
 * One entry in docs-manifest.json — one per page.
 *
 * The manifest is the single source of truth for search, Quick Answers,
 * prev/next navigation, and the future chatbot.
 */
export interface DocsManifestEntry {
  /** Canonical, immutable page ID. */
  id: string;
  /** Absolute URL path (no trailing slash): "/learn/rules/difference-06-..." */
  url: string;
  section: DocsSection;
  group: DocsGroup;
  /** Display title. */
  title: string;
  /** One-sentence summary (plain text). */
  summary: string;
  /** Search keywords (card names, aliases, mechanical terms). */
  keywords: string[];
  /** URL tail, stable once shipped. Renames require an aliases[] entry. */
  slug: string;
  /** 1–13. Only present on rule-difference pages. */
  ruleNumber?: number;
  /** All anchored headings on this page. Used by search + Quick Answers. */
  anchors: DocsAnchor[];
  /** Old slugs that should 301-redirect to this page's url. */
  aliases: string[];
  /** Canonical ID of the previous article in the same group. */
  prevId?: string;
  /** Canonical ID of the next article in the same group. */
  nextId?: string;
}

/** The full docs manifest: a flat array of all pages. */
export type DocsManifest = DocsManifestEntry[];

/**
 * A single Quick Answer entry — the curated table-side fast path.
 * Declares one question and the canonical target (page id or id#anchor).
 */
export interface QuickAnswer {
  /** Question as a player would phrase it at the table. */
  question: string;
  /**
   * Canonical target ID. Either a page id ("rules.diff.06") or a compound
   * id+anchor ("rules.primer.turn#who-goes-first").
   * The app resolves this to a URL via the manifest.
   */
  canonicalId: string;
}
