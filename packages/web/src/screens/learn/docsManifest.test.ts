/**
 * Manifest validation tests (B4-REQ-4, B4-REQ-2).
 *
 * Verifies the generated docs-manifest.json is well-formed, all anchors are
 * unique and follow the canonical ID grammar, and the articles map matches.
 */
import { describe, expect, it } from "vitest";
import type { DocsManifestEntry } from "@yugioh-app/contracts";
import manifestData from "../../content/learn/generated/docsManifest.json";
import { articles } from "../../content/learn/generated/articles";

const manifest = manifestData as DocsManifestEntry[];

const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;
const ANCHOR_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+#[\w-]+$/;

describe("docs-manifest.json — well-formed", () => {
  it("has at least one entry", () => {
    expect(manifest.length).toBeGreaterThan(0);
  });

  it("every entry has required fields", () => {
    for (const entry of manifest) {
      expect(entry.id, `${entry.id}: missing id`).toBeTruthy();
      expect(entry.url, `${entry.id}: missing url`).toBeTruthy();
      expect(entry.title, `${entry.id}: missing title`).toBeTruthy();
      expect(entry.summary, `${entry.id}: missing summary`).toBeTruthy();
      expect(entry.section, `${entry.id}: missing section`).toMatch(/^(rules|howto)$/);
      expect(entry.group, `${entry.id}: missing group`).toMatch(/^(primer|difference|card|howto)$/);
      expect(Array.isArray(entry.keywords), `${entry.id}: keywords must be array`).toBe(true);
      expect(Array.isArray(entry.anchors), `${entry.id}: anchors must be array`).toBe(true);
      expect(Array.isArray(entry.aliases), `${entry.id}: aliases must be array`).toBe(true);
    }
  });

  it("all page IDs match the canonical grammar", () => {
    for (const entry of manifest) {
      expect(entry.id, `"${entry.id}" does not match ID grammar`).toMatch(ID_PATTERN);
    }
  });

  it("page IDs are unique", () => {
    const ids = manifest.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate page IDs: ${dupes.join(", ")}`).toHaveLength(0);
  });

  it("URLs start with /learn", () => {
    for (const entry of manifest) {
      expect(entry.url, `${entry.id}: url must start with /learn`).toMatch(/^\/learn/);
    }
  });
});

describe("docs-manifest.json — anchor IDs unique and stable", () => {
  it("all anchor IDs are globally unique", () => {
    const allAnchorIds: string[] = [];
    for (const entry of manifest) {
      for (const anchor of entry.anchors) {
        allAnchorIds.push(anchor.id);
      }
    }
    const dupes = allAnchorIds.filter((id, i) => allAnchorIds.indexOf(id) !== i);
    expect(dupes, `duplicate anchor IDs: ${dupes.join(", ")}`).toHaveLength(0);
  });

  it("anchor IDs match compound grammar {pageId}#{anchorSlug}", () => {
    for (const entry of manifest) {
      for (const anchor of entry.anchors) {
        expect(
          anchor.id,
          `anchor "${anchor.id}" on page "${entry.id}" does not match compound grammar`,
        ).toMatch(ANCHOR_ID_PATTERN);
      }
    }
  });

  it("anchor IDs are prefixed with their parent page ID", () => {
    for (const entry of manifest) {
      for (const anchor of entry.anchors) {
        const [pageId] = anchor.id.split("#");
        expect(pageId, `anchor "${anchor.id}" is not prefixed with its page id "${entry.id}"`).toBe(
          entry.id,
        );
      }
    }
  });

  it("anchor URLs point into the parent page URL", () => {
    for (const entry of manifest) {
      for (const anchor of entry.anchors) {
        expect(
          anchor.url,
          `anchor "${anchor.id}" URL does not start with parent URL "${entry.url}"`,
        ).toMatch(new RegExp(`^${entry.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#`));
      }
    }
  });
});

describe("docs-manifest.json — rule-difference pages", () => {
  it("difference pages have ruleNumber 1–13", () => {
    const diffs = manifest.filter((e) => e.group === "difference");
    for (const d of diffs) {
      expect(d.ruleNumber, `${d.id}: ruleNumber missing or out of range`).toBeGreaterThanOrEqual(1);
      expect(d.ruleNumber, `${d.id}: ruleNumber missing or out of range`).toBeLessThanOrEqual(13);
    }
  });

  it("rule-difference IDs use zero-padded format rules.diff.NN", () => {
    const diffs = manifest.filter((e) => e.group === "difference");
    for (const d of diffs) {
      expect(d.id, `"${d.id}" should match rules.diff.NN`).toMatch(/^rules\.diff\.\d{2}$/);
    }
  });
});

describe("articles map — matches manifest", () => {
  it("all manifest entries have a corresponding article in the map", () => {
    for (const entry of manifest) {
      expect(articles[entry.id], `no articles entry for manifest page "${entry.id}"`).toBeDefined();
    }
  });

  it("each article has html and meta", () => {
    for (const [id, data] of Object.entries(articles)) {
      expect(typeof data.html, `articles["${id}"].html should be string`).toBe("string");
      expect(data.meta, `articles["${id}"].meta missing`).toBeDefined();
      expect(data.meta.id, `articles["${id}"].meta.id missing`).toBeTruthy();
    }
  });

  it("article meta IDs match their map key", () => {
    for (const [id, data] of Object.entries(articles)) {
      expect(data.meta.id, `articles["${id}"].meta.id should equal key`).toBe(id);
    }
  });
});
