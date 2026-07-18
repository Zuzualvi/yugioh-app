/**
 * DocArticleScreen — renders a single /learn article (B4-REQ-3, B4-REQ-4).
 *
 * Displays: breadcrumb, rule badge (for differences), title, TL;DR, On-this-page
 * TOC, body HTML, and prev/next navigation.
 *
 * Article HTML is pre-rendered at build time by buildDocsManifest.mjs.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DocsManifestEntry } from "@yugioh-app/contracts";
import { articles } from "../../content/learn/generated/articles";
import manifestData from "../../content/learn/generated/docsManifest.json";
import "../../styles/docs.css";

const manifest = manifestData as DocsManifestEntry[];

function findBySlug(slug: string): DocsManifestEntry | undefined {
  return manifest.find((e) => e.slug === slug);
}

function findById(id: string): DocsManifestEntry | undefined {
  return manifest.find((e) => e.id === id);
}

interface DocArticleScreenProps {
  /** When called from a route, pass the slug via useParams. */
  slugOverride?: string;
}

export function DocArticleScreen({ slugOverride }: DocArticleScreenProps) {
  const params = useParams<{ slug: string }>();
  const slug = slugOverride ?? params.slug ?? "";
  const entry = findBySlug(slug);

  if (!entry) {
    return <ArticleNotFound slug={slug} />;
  }

  const articleData = articles[entry.id];

  return <ArticleView entry={entry} html={articleData?.html ?? ""} />;
}

// ---------------------------------------------------------------------------
// ArticleView
// ---------------------------------------------------------------------------

interface ArticleViewProps {
  entry: DocsManifestEntry;
  html: string;
}

function ArticleView({ entry, html }: ArticleViewProps) {
  const [tocOpen, setTocOpen] = useState(false);

  const prevEntry = entry.prevId ? findById(entry.prevId) : undefined;
  const nextEntry = entry.nextId ? findById(entry.nextId) : undefined;

  // Breadcrumb path
  const sectionLabel = entry.section === "rules" ? "Edison Rules" : "Using the App";
  const groupLabel =
    entry.group === "difference"
      ? "13 Rule-Differences"
      : entry.group === "primer"
        ? "Base-Rules Primer"
        : entry.group === "card"
          ? "Cards That Play Differently"
          : "How-To";

  return (
    <div className="docs-layout">
      {/* Sticky header */}
      <header className="docs-header">
        <Link
          to="/learn"
          className="btn btn-ghost"
          style={{ padding: "6px 12px", minHeight: 40, fontSize: "0.9375rem" }}
        >
          ← Learn
        </Link>
        <Link to="/learn" className="docs-header-wordmark">
          <span style={{ color: "var(--accent-light)" }} aria-hidden>
            ⟡
          </span>
          Learn
        </Link>
        <div style={{ flex: 1 }} />
      </header>

      <div className="docs-body">
        {/* Left nav rail */}
        <nav className="docs-nav" aria-label="Documentation navigation">
          <NavTree currentId={entry.id} />
        </nav>

        {/* Article content */}
        <main className="docs-content">
          <article className="docs-article" aria-label={entry.title}>
            {/* Breadcrumb */}
            <nav className="docs-breadcrumb" aria-label="Breadcrumb">
              <Link to="/learn">Learn</Link>
              <span aria-hidden>›</span>
              <Link to={entry.section === "rules" ? "/learn/rules" : "/learn"}>{sectionLabel}</Link>
              {entry.group !== "howto" && (
                <>
                  <span aria-hidden>›</span>
                  <span>{groupLabel}</span>
                </>
              )}
            </nav>

            {/* Rule badge */}
            {entry.ruleNumber !== undefined && (
              <div className="docs-rule-badge">Rule #{entry.ruleNumber}</div>
            )}

            {/* Title */}
            <h1 className="docs-article-title">{entry.title}</h1>

            {/* TL;DR */}
            <div className="docs-tldr">
              <strong>TL;DR</strong> {entry.summary}
            </div>

            {/* On this page — mini TOC */}
            {entry.anchors.length > 0 && (
              <div className="docs-toc">
                <div className="docs-toc-title">
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      padding: 0,
                      font: "inherit",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                    onClick={() => setTocOpen((o) => !o)}
                    aria-expanded={tocOpen}
                  >
                    On this page {tocOpen ? "▾" : "▸"}
                  </button>
                </div>
                {tocOpen && (
                  <ul className="docs-toc-list">
                    {entry.anchors.map((a) => (
                      <li key={a.id}>
                        <a href={`#${a.id.split("#")[1]}`} className="docs-toc-link">
                          {a.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Article body */}
            {html ? (
              <div className="docs-body-html" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p style={{ color: "var(--text-1)" }}>Content not yet available.</p>
            )}

            {/* Prev / Next */}
            {(prevEntry ?? nextEntry) && (
              <nav className="docs-prevnext" aria-label="Article navigation">
                {prevEntry ? (
                  <Link
                    to={prevEntry.url}
                    className="docs-prevnext-btn"
                    style={{ marginRight: "auto" }}
                  >
                    <span className="docs-prevnext-label">← Previous</span>
                    <span className="docs-prevnext-title">{prevEntry.title}</span>
                  </Link>
                ) : (
                  <div />
                )}
                {nextEntry && (
                  <Link
                    to={nextEntry.url}
                    className="docs-prevnext-btn"
                    style={{ marginLeft: "auto", textAlign: "right" }}
                  >
                    <span className="docs-prevnext-label">Next →</span>
                    <span className="docs-prevnext-title">{nextEntry.title}</span>
                  </Link>
                )}
              </nav>
            )}
          </article>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleNotFound
// ---------------------------------------------------------------------------

function ArticleNotFound({ slug }: { slug: string }) {
  return (
    <div className="docs-layout">
      <header className="docs-header">
        <Link to="/learn" className="btn btn-ghost" style={{ padding: "6px 12px", minHeight: 40 }}>
          ← Learn
        </Link>
      </header>
      <main style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>
          Article not found
        </h1>
        <p style={{ color: "var(--text-1)", marginBottom: 20 }}>
          No article found for <code>{slug}</code>.
        </p>
        <Link to="/learn" className="btn btn-primary" style={{ minHeight: 44 }}>
          Back to Learn
        </Link>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavTree (same structure as landing, highlights current)
// ---------------------------------------------------------------------------

const DIFF_STUBS = [
  { num: 1, title: "Starting player draws" },
  { num: 2, title: "One active Field Spell" },
  { num: 3, title: "Union monster conditions" },
  { num: 4, title: "Phase-dependent triggers" },
  { num: 5, title: "Trap-monster zone blocking" },
  { num: 6, title: "Ignition effect priority" },
  { num: 7, title: "SEGOC" },
  { num: 8, title: "Seven-timing Damage Step" },
  { num: 9, title: "Trigger location & recognition" },
  { num: 10, title: "Life Point costs" },
  { num: 11, title: "End-of-turn discard" },
  { num: 12, title: "Infinite loops" },
  { num: 13, title: "Zero-ATK monsters" },
];

function zeroPad(n: number) {
  return String(n).padStart(2, "0");
}

function NavTree({ currentId }: { currentId: string }) {
  const howto = manifest.filter((e) => e.section === "howto");
  const primer = manifest.filter((e) => e.group === "primer");
  const diffs = manifest
    .filter((e) => e.group === "difference")
    .sort((a, b) => (a.ruleNumber ?? 99) - (b.ruleNumber ?? 99));

  return (
    <>
      <div className="docs-nav-section">
        <div className="docs-nav-section-title">Using the App</div>
        {howto.map((e) => (
          <Link
            key={e.id}
            to={e.url}
            className={`docs-nav-link${currentId === e.id ? " active" : ""}`}
          >
            {e.title}
          </Link>
        ))}
      </div>
      <div className="docs-nav-section" style={{ marginTop: 8 }}>
        <div className="docs-nav-section-title">Edison Rules</div>
        {primer.map((e) => (
          <Link
            key={e.id}
            to={e.url}
            className={`docs-nav-link${currentId === e.id ? " active" : ""}`}
          >
            {e.title}
          </Link>
        ))}
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--text-2)",
            padding: "8px 16px 4px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          13 Differences
        </div>
        {DIFF_STUBS.map((d) => {
          const entry = diffs.find((e) => e.ruleNumber === d.num);
          const url = entry ? entry.url : `/learn/rules/difference-${zeroPad(d.num)}`;
          const isActive = entry ? currentId === entry.id : false;
          return (
            <Link key={d.num} to={url} className={`docs-nav-link${isActive ? " active" : ""}`}>
              {d.num} · {d.title}
            </Link>
          );
        })}
        <Link
          to="/learn/rules/cards"
          className={`docs-nav-link${currentId === "rules.card.reference" ? " active" : ""}`}
        >
          Cards that play differently
        </Link>
      </div>
    </>
  );
}
