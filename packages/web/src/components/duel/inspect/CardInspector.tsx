/**
 * CardInspector (§8, §10) — full-detail card view for the duel.
 *
 * Layout: 254px floating panel over the left edge of the board.
 * Contents:
 *   1. CardArt (813:1185, 228px wide, eager)
 *   2. ProvenanceBadge (only when preErrataText && artState === "ok")
 *   3. Rendered record: name, type/stat line, full effect text
 *
 * Entry points:
 *   - auto-push (no click): opponent activation, resolving chain link
 *   - hover (150ms delay)
 *   - click (pins — autopush queues behind pin)
 *
 * Exit: Esc, mouse-out (hover-entered), next auto-push replaces (unless pinned).
 *
 * code === 0 → "Face-down card" + location, no art.
 * code not in DB → "Unknown card (code)", no art.
 * No art → panel collapses to pre-art layout, no gap.
 */

import React, { useCallback, useEffect, useState } from "react";
import type { CardInfo } from "../../../duel/contracts";
import type { ArtState } from "./CardArt";
import { CardArt } from "./CardArt";
import { ProvenanceBadge } from "./ProvenanceBadge";

export type InspectorSource = "hover" | "click" | "autopush";

interface Props {
  /** Passcode. null → component absent. 0 → face-down. */
  code: number | null;
  /** Card info from the cache. null while loading or on error. */
  info: CardInfo | null;
  /** True while the cache is fetching. */
  loading?: boolean;
  /** Fetch failed. */
  error?: boolean;
  /** How the inspector was opened. click → pinned. */
  source: InspectorSource;
  /** Human-readable location, e.g. "Monster Zone 1" */
  locationLabel?: string;
  onClose: () => void;
  /** Number of queued auto-pushes (shown as chip when pinned). */
  queuedCount?: number;
}

const FRAME_COLOURS: Record<string, string> = {
  normal: "#d4a843",
  effect: "#b05c1e",
  ritual: "#3c5fb5",
  fusion: "#6a3c9e",
  synchro: "#e8e8e8",
  spell: "#1e7a5c",
  trap: "#9e1e6e",
};

function metaLine(info: CardInfo): string {
  const parts: string[] = [];
  if (info.attribute) parts.push(info.attribute);
  if (info.level != null) parts.push(`★${info.level}`);
  parts.push(info.race);
  if (info.atk != null || info.def != null) {
    parts.push(`ATK ${info.atk ?? "?"} / DEF ${info.def ?? "?"}`);
  }
  return parts.join(" · ");
}

export function CardInspector({
  code,
  info,
  loading = false,
  error = false,
  source,
  locationLabel,
  onClose,
  queuedCount = 0,
}: Props) {
  const [artState, setArtState] = useState<ArtState>("idle");
  const isPinned = source === "click";

  // Reset art state when code changes.
  useEffect(() => {
    setArtState("idle");
  }, [code]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Absent state.
  if (code === null) return null;

  const frameColor = info ? (FRAME_COLOURS[info.frame] ?? "#555") : "#555";

  return (
    <div
      role="complementary"
      aria-label="Card Inspector"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 254,
        background: "var(--bg-1)",
        borderRight: isPinned ? "2px solid var(--accent,#4a90d9)" : "1px solid var(--border)",
        borderTop: `3px solid ${frameColor}`,
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "6px 8px",
          gap: 6,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {isPinned && queuedCount > 0 && (
          <span
            style={{
              fontSize: "0.7rem",
              background: "var(--accent,#4a90d9)",
              color: "#fff",
              borderRadius: 9999,
              padding: "1px 6px",
              fontWeight: 600,
            }}
          >
            {queuedCount} new
          </span>
        )}
        <button
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          aria-label="Close inspector"
          style={{ minWidth: 28, minHeight: 28, padding: 0, fontSize: "0.9rem" }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "10px 10px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Hidden card */}
        {code === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>🂠</div>
            <p style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-0)", margin: 0 }}>
              Face-down card
            </p>
            {locationLabel && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 4 }}>
                {locationLabel}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Art (228px wide; height derived from 813:1185) */}
            <CardArt code={code} width={228} eager onState={setArtState} />

            {/* Provenance badge — only when preErrataText && artState === "ok" */}
            {info?.preErrataText && artState === "ok" && (
              <div style={{ marginTop: 6 }}>
                <ProvenanceBadge />
              </div>
            )}

            {/* Record */}
            {loading && !info ? (
              <div style={{ marginTop: 8 }}>
                {/* Name placeholder */}
                <div
                  style={{
                    height: 18,
                    background: "var(--bg-2)",
                    borderRadius: 4,
                    marginBottom: 6,
                    animation: "cardart-shimmer 1.6s infinite",
                    backgroundSize: "200% 100%",
                    backgroundImage:
                      "linear-gradient(90deg, var(--bg-2,#1a1a2e) 25%, var(--bg-3,#2a2a3e) 50%, var(--bg-2,#1a1a2e) 75%)",
                  }}
                />
                <div
                  style={{
                    height: 80,
                    background: "var(--bg-2)",
                    borderRadius: 4,
                    animation: "cardart-shimmer 1.6s infinite",
                    backgroundSize: "200% 100%",
                    backgroundImage:
                      "linear-gradient(90deg, var(--bg-2,#1a1a2e) 25%, var(--bg-3,#2a2a3e) 50%, var(--bg-2,#1a1a2e) 75%)",
                  }}
                />
              </div>
            ) : error ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>
                  Card text unavailable —{" "}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent,#4a90d9)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      padding: 0,
                    }}
                    onClick={() => window.location.reload()}
                  >
                    retry
                  </button>
                </p>
              </div>
            ) : !info ? (
              <div style={{ marginTop: 8 }}>
                <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>Unknown card ({code})</p>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <h3
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-0)",
                    margin: "0 0 4px",
                    lineHeight: 1.3,
                  }}
                >
                  {info.name}
                </h3>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-2)",
                    margin: "0 0 8px",
                    lineHeight: 1.4,
                  }}
                >
                  {metaLine(info)}
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-1)",
                    lineHeight: 1.55,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {info.desc}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
