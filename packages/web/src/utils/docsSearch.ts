import type { DocsManifestEntry } from "@yugioh-app/contracts";

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  snippet: string;
  section: "rules" | "howto";
  /** If matching a specific anchor, this is the heading text. */
  anchorText?: string;
}

/** Tokenise a query string into lower-case words. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Score a manifest entry against the query tokens. Higher = better match. */
function scoreEntry(entry: DocsManifestEntry, queryTokens: string[]): number {
  const haystack = [
    entry.title,
    entry.summary,
    ...entry.keywords,
    ...entry.anchors.map((a) => a.text),
  ]
    .join(" ")
    .toLowerCase();

  return queryTokens.reduce((score, token) => {
    if (entry.title.toLowerCase().includes(token)) return score + 3;
    if (haystack.includes(token)) return score + 1;
    return score;
  }, 0);
}

/**
 * Client-side search over the docs manifest.
 *
 * Returns up to `limit` results, grouped by section.
 * Searches: titles, summaries, keywords, and anchored heading text.
 */
export function searchDocs(
  manifest: DocsManifestEntry[],
  query: string,
  limit = 12,
): SearchResult[] {
  const qt = tokens(query);
  if (qt.length === 0) return [];

  const results: SearchResult[] = [];

  for (const entry of manifest) {
    const score = scoreEntry(entry, qt);
    if (score === 0) continue;

    // Page-level result
    results.push({
      id: entry.id,
      url: entry.url,
      title: entry.title,
      snippet: entry.summary,
      section: entry.section,
    });

    // Check individual anchors
    for (const anchor of entry.anchors) {
      const anchorScore = qt.filter((t) => anchor.text.toLowerCase().includes(t)).length;
      if (anchorScore > 0) {
        results.push({
          id: anchor.id,
          url: anchor.url,
          title: entry.title,
          snippet: anchor.text,
          section: entry.section,
          anchorText: anchor.text,
        });
      }
    }
  }

  // Sort by score (higher first), deduplicate by url
  const seen = new Set<string>();
  return results
    .sort((a, b) => {
      const sa = scoreEntry(
        manifest.find((e) => e.id === a.id.split("#")[0])!,
        qt,
      );
      const sb = scoreEntry(
        manifest.find((e) => e.id === b.id.split("#")[0])!,
        qt,
      );
      return sb - sa;
    })
    .filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    })
    .slice(0, limit);
}

/**
 * Resolve a canonicalId (page id or "page.id#anchor") to a URL, using
 * the manifest. Returns undefined if the ID is not found.
 */
export function resolveCanonicalId(
  manifest: DocsManifestEntry[],
  canonicalId: string,
): string | undefined {
  const [pageId, anchor] = canonicalId.split("#");
  const entry = manifest.find((e) => e.id === pageId);
  if (!entry) return undefined;
  if (anchor) return `${entry.url}#${anchor}`;
  return entry.url;
}
