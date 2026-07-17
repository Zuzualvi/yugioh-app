/**
 * DocsLandingScreen — the /learn route (B4-REQ-1, B4-REQ-3).
 *
 * Three-layer fast-find over one surface:
 *   1. Quick Answers (curated Q→anchor, table-side reflex)
 *   2. Search (client-side over manifest — title, headings, keywords)
 *   3. Category nav (rail desktop / accordion mobile)
 */
import { useState, useDeferredValue } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DocsManifestEntry } from "@yugioh-app/contracts";
import { searchDocs, resolveCanonicalId } from "../../utils/docsSearch";
import { QUICK_ANSWERS } from "../../content/learn/quickAnswers";
import manifestData from "../../content/learn/generated/docsManifest.json";
import "../../styles/docs.css";

const manifest = manifestData as DocsManifestEntry[];

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

/** Resolve a Quick Answer canonicalId to a URL (falls back to /learn if not found). */
function qaUrl(canonicalId: string): string {
  return resolveCanonicalId(manifest, canonicalId) ?? "/learn";
}

/** Find a manifest entry by id (for diff pages). */
function findEntry(id: string): DocsManifestEntry | undefined {
  return manifest.find((e) => e.id === id);
}

/** URL for a rule-difference page (uses manifest if present, else constructs stub). */
function diffUrl(num: number): string {
  const entry = findEntry(`rules.diff.${zeroPad(num)}`);
  if (entry) return entry.url;
  // Placeholder URL for not-yet-authored pages
  return `/learn/rules/difference-${zeroPad(num)}`;
}

export function DocsLandingScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [qaExpanded, setQaExpanded] = useState(false);
  const [appSectionOpen, setAppSectionOpen] = useState(false);
  const [rulesSectionOpen, setRulesSectionOpen] = useState(true);

  const howtoEntries = manifest.filter((e) => e.section === "howto");
  const searchResults = deferredQuery.trim().length > 1 ? searchDocs(manifest, deferredQuery) : [];
  const showSearch = deferredQuery.trim().length > 1;

  const visibleQAs = qaExpanded ? QUICK_ANSWERS : QUICK_ANSWERS.slice(0, 5);

  return (
    <div className="docs-layout">
      {/* Sticky header */}
      <header className="docs-header">
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/")}
          style={{ padding: "6px 12px", minHeight: 40, fontSize: "0.9375rem" }}
        >
          ← Home
        </button>
        <Link to="/learn" className="docs-header-wordmark">
          <span style={{ color: "var(--accent-light)" }} aria-hidden>
            ⟡
          </span>
          Learn
        </Link>
        <div className="docs-search-wrap" role="search">
          <span className="docs-search-icon" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            className="docs-search-input"
            placeholder="Search the docs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search documentation"
          />
        </div>
      </header>

      <div className="docs-body">
        {/* Left nav rail — desktop only */}
        <nav className="docs-nav" aria-label="Documentation navigation">
          <NavTree manifest={manifest} />
        </nav>

        {/* Main content */}
        <main className="docs-content">
          {showSearch ? (
            <SearchResultsView results={searchResults} query={deferredQuery} />
          ) : (
            <>
              {/* Quick Answers */}
              <section className="docs-quick-answers" aria-label="Quick Answers">
                <div className="docs-quick-answers-title">⚡ Quick Answers</div>
                <ul className="docs-qa-list">
                  {visibleQAs.map((qa) => (
                    <li key={qa.canonicalId}>
                      <Link to={qaUrl(qa.canonicalId)} className="docs-qa-link">
                        {qa.question}
                      </Link>
                    </li>
                  ))}
                </ul>
                {QUICK_ANSWERS.length > 5 && (
                  <button
                    className="docs-qa-see-all"
                    onClick={() => setQaExpanded((e) => !e)}
                    aria-expanded={qaExpanded}
                  >
                    {qaExpanded ? "Show fewer" : `See all ${QUICK_ANSWERS.length} quick answers →`}
                  </button>
                )}
              </section>

              {/* Mobile accordions — visible <1024 */}
              <div className="docs-mobile-sections" aria-label="Sections">
                {/* Using the App */}
                <button
                  className="docs-accordion-btn"
                  onClick={() => setAppSectionOpen((o) => !o)}
                  aria-expanded={appSectionOpen}
                  style={{ display: "none" }}
                  aria-hidden
                >
                  <span>📱 Using the App</span>
                  <span>{appSectionOpen ? "▾" : "▸"}</span>
                </button>
                <button
                  className="docs-accordion-btn docs-mobile-only"
                  onClick={() => setAppSectionOpen((o) => !o)}
                  aria-expanded={appSectionOpen}
                >
                  <span>📱 Using the App</span>
                  <span>{appSectionOpen ? "▾" : "▸"}</span>
                </button>
                {appSectionOpen && (
                  <div className="docs-accordion-content docs-mobile-only">
                    {howtoEntries.map((e) => (
                      <Link key={e.id} to={e.url} className="docs-nav-link">
                        {e.title}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Edison Rules */}
                <button
                  className="docs-accordion-btn docs-mobile-only"
                  onClick={() => setRulesSectionOpen((o) => !o)}
                  aria-expanded={rulesSectionOpen}
                >
                  <span>📖 Edison Format Rules</span>
                  <span>{rulesSectionOpen ? "▾" : "▸"}</span>
                </button>
                {rulesSectionOpen && (
                  <div className="docs-accordion-content docs-mobile-only">
                    {findEntry("rules.primer.turn") && (
                      <Link to={findEntry("rules.primer.turn")!.url} className="docs-nav-link">
                        Base-rules primer
                      </Link>
                    )}
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-2)",
                        padding: "4px 16px",
                        fontWeight: 600,
                      }}
                    >
                      13 Rule-Differences
                    </div>
                    {DIFF_STUBS.map((d) => (
                      <Link key={d.num} to={diffUrl(d.num)} className="docs-nav-link">
                        {d.num}. {d.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Using the App section — desktop */}
              <section className="docs-section-block docs-desktop-only" aria-label="Using the App">
                <div className="docs-section-label">📱 Using the App</div>
                {howtoEntries.length > 0 ? (
                  <div className="docs-card-grid">
                    {howtoEntries.map((e) => (
                      <Link key={e.id} to={e.url} className="docs-card">
                        <div className="docs-card-title">{e.title}</div>
                        <div className="docs-card-summary">{e.summary}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-1)", fontSize: "0.9375rem" }}>
                    How-to guides coming soon.
                  </p>
                )}
              </section>

              {/* Edison Format Rules section — desktop */}
              <section
                className="docs-section-block docs-desktop-only"
                aria-label="Edison Format Rules"
              >
                <div className="docs-section-label">📖 Edison Format Rules</div>

                {/* Primer */}
                {findEntry("rules.primer.turn") && (
                  <Link
                    to={findEntry("rules.primer.turn")!.url}
                    className="docs-card"
                    style={{ marginBottom: 16, display: "block" }}
                  >
                    <div className="docs-card-title">Base-Rules Primer</div>
                    <div className="docs-card-summary">
                      Learn the game from scratch — Edison flavoured. Phases, summoning, chains,
                      deck building.
                    </div>
                  </Link>
                )}

                {/* 13 differences */}
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-1)",
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  The 13 Rule-Differences
                </div>
                <div className="docs-diff-grid">
                  {DIFF_STUBS.map((d) => (
                    <Link key={d.num} to={diffUrl(d.num)} className="docs-diff-link">
                      <span className="docs-diff-num">{d.num}</span>
                      <span>{d.title}</span>
                    </Link>
                  ))}
                </div>

                {/* Cards reference */}
                <div style={{ marginTop: 16 }}>
                  <Link to="/learn/rules/cards" className="docs-card" style={{ display: "block" }}>
                    <div className="docs-card-title">Cards That Play Differently</div>
                    <div className="docs-card-summary">
                      ~36-card reference — the Edison functional errata list. Pre-errata text,
                      effect differences, rulings.
                    </div>
                  </Link>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NavTree({ manifest }: { manifest: DocsManifestEntry[] }) {
  const howto = manifest.filter((e) => e.section === "howto");
  const primer = manifest.filter((e) => e.group === "primer");
  const diffs = manifest
    .filter((e) => e.group === "difference")
    .sort((a, b) => {
      return (a.ruleNumber ?? 99) - (b.ruleNumber ?? 99);
    });

  return (
    <>
      {/* Using the App */}
      <div className="docs-nav-section">
        <div className="docs-nav-section-title">Using the App</div>
        {howto.map((e) => (
          <Link key={e.id} to={e.url} className="docs-nav-link">
            {e.title}
          </Link>
        ))}
      </div>

      {/* Edison Rules */}
      <div className="docs-nav-section" style={{ marginTop: 8 }}>
        <div className="docs-nav-section-title">Edison Rules</div>
        {primer.map((e) => (
          <Link key={e.id} to={e.url} className="docs-nav-link">
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
          return (
            <Link
              key={d.num}
              to={entry ? entry.url : `/learn/rules/difference-${zeroPad(d.num)}`}
              className="docs-nav-link"
            >
              {d.num} · {d.title}
            </Link>
          );
        })}
        <Link to="/learn/rules/cards" className="docs-nav-link">
          Cards that play differently
        </Link>
      </div>
    </>
  );
}

interface SearchResultsViewProps {
  results: ReturnType<typeof searchDocs>;
  query: string;
}

function SearchResultsView({ results, query }: SearchResultsViewProps) {
  if (results.length === 0) {
    return (
      <div style={{ color: "var(--text-1)", marginTop: 32, fontSize: "0.9375rem" }}>
        <p>
          No results for <strong style={{ color: "var(--text-0)" }}>"{query}"</strong>.
        </p>
        <p style={{ marginTop: 8 }}>
          Try: <em>priority</em>, <em>damage step</em>, <em>SEGOC</em>, or a card name.
        </p>
      </div>
    );
  }

  const rulesResults = results.filter((r) => r.section === "rules");
  const howtoResults = results.filter((r) => r.section === "howto");

  return (
    <div className="docs-search-results" role="region" aria-label="Search results">
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Results for "{query}"</h2>
      <p style={{ color: "var(--text-1)", fontSize: "0.875rem", marginBottom: 16 }}>
        {results.length} result{results.length !== 1 ? "s" : ""}
      </p>

      {rulesResults.length > 0 && (
        <>
          <div className="docs-search-group-title">Edison Rules</div>
          {rulesResults.map((r) => (
            <Link key={r.id} to={r.url} className="docs-search-result">
              <div className="docs-search-result-title">
                {r.anchorText ? `${r.title} — ${r.anchorText}` : r.title}
              </div>
              <div className="docs-search-result-snippet">{r.snippet}</div>
            </Link>
          ))}
        </>
      )}

      {howtoResults.length > 0 && (
        <>
          <div className="docs-search-group-title">Using the App</div>
          {howtoResults.map((r) => (
            <Link key={r.id} to={r.url} className="docs-search-result">
              <div className="docs-search-result-title">{r.title}</div>
              <div className="docs-search-result-snippet">{r.snippet}</div>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
