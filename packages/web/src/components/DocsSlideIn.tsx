/**
 * DocsSlideIn — the generic docs panel opened from the Duel screen "?" button.
 * (B4-REQ-5)
 *
 * V1: Opens the generic docs surface (Quick Answers + search + link to /learn).
 * NOT a "why did that happen?" engine-event explainer — that is V2.
 *
 * Reuses .overlay-backdrop pattern and the docs CSS.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import type { DocsManifestEntry } from "@yugioh-app/contracts";
import { QUICK_ANSWERS } from "../content/learn/quickAnswers";
import { resolveCanonicalId, searchDocs } from "../utils/docsSearch";
import manifestData from "../content/learn/generated/docsManifest.json";
import "../styles/docs.css";

const manifest = manifestData as DocsManifestEntry[];

interface DocsSlideInProps {
  onClose: () => void;
}

export function DocsSlideIn({ onClose }: DocsSlideInProps) {
  const [query, setQuery] = useState("");
  const searchResults = query.trim().length > 1 ? searchDocs(manifest, query, 8) : [];
  const showSearch = query.trim().length > 1;

  return (
    <div
      className="docs-slidein-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Rules & Guides"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="docs-slidein-panel">
        {/* Header */}
        <div className="docs-slidein-header">
          <span className="docs-slidein-title">📖 Rules & Guides</span>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close rules panel"
            style={{ padding: "4px 10px", minHeight: 36, fontSize: "1.125rem" }}
          >
            ✕
          </button>
        </div>

        <div className="docs-slidein-body">
          {/* Search */}
          <div className="docs-search-wrap" style={{ maxWidth: "100%", marginBottom: 20 }}>
            <span className="docs-search-icon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              className="docs-search-input"
              placeholder="Search rules…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search documentation"
              autoFocus
            />
          </div>

          {showSearch ? (
            /* Search results */
            <div>
              {searchResults.length === 0 ? (
                <p style={{ color: "var(--text-1)", fontSize: "0.9375rem" }}>
                  No results for "{query}". Try: <em>priority</em>, <em>damage step</em>,{" "}
                  <em>SEGOC</em>.
                </p>
              ) : (
                searchResults.map((r) => (
                  <Link key={r.id} to={r.url} className="docs-search-result" onClick={onClose}>
                    <div className="docs-search-result-title">
                      {r.anchorText ? `${r.title} — ${r.anchorText}` : r.title}
                    </div>
                    <div className="docs-search-result-snippet">{r.snippet}</div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            /* Quick Answers */
            <div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-2)",
                  marginBottom: 10,
                }}
              >
                ⚡ Quick Answers
              </div>
              <ul style={{ listStyle: "none" }}>
                {QUICK_ANSWERS.slice(0, 8).map((qa) => {
                  const url = resolveCanonicalId(manifest, qa.canonicalId) ?? "/learn";
                  return (
                    <li key={qa.canonicalId}>
                      <Link
                        to={url}
                        className="docs-qa-link"
                        onClick={onClose}
                        style={{ display: "block", padding: "7px 0" }}
                      >
                        {qa.question}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <Link
                  to="/learn"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  Open full Rules & Guides →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
