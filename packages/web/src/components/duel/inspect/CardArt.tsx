/**
 * CardArt (§10a) — shows the real card face, and fails invisibly when it cannot.
 *
 * - Loading: placeholder at exact 813:1185 aspect ratio with slow shimmer.
 *   All surrounding text is already readable — nothing waits on the image.
 * - Failed / offline / unknown passcode: zero DOM. No box, no icon, no gap.
 * - Timeout: if image has not resolved within 5 000 ms, move to "failed".
 * - code === 0: nothing (face-down; no art we are entitled to show).
 * - Content-type guard: an HTTP 200 that delivers JSON (unknown passcode 404 body)
 *   reaches onError via the browser's natural image decoding failure.
 * - alt="" and aria-hidden: the image duplicates text already on the page.
 */

import React, { useEffect, useRef, useState } from "react";
import { cardImageUrl } from "../../../utils/cardImageUrl";

export type ArtState = "idle" | "loading" | "ok" | "failed";

const ASPECT = 813 / 1185; // width / height
const TIMEOUT_MS = 5000;

interface Props {
  /** Passcode. 0 = face-down / unknown → renders nothing. */
  code: number;
  /** Rendered width in px; height derived from 813:1185. */
  width: number;
  /** Absolutely fill parent tile — overlays sit on top. */
  fill?: boolean;
  /** Eagerly load (inspector art). Omit to lazy-load. */
  eager?: boolean;
  /** Notifies parent of state changes so ProvenanceBadge can gate on "ok". */
  onState?: (s: ArtState) => void;
}

export function CardArt({ code, width, fill = false, eager = false, onState }: Props) {
  const [state, setState] = useState<ArtState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  function notifyState(s: ArtState) {
    setState(s);
    onState?.(s);
  }

  // Reset when code changes.
  useEffect(() => {
    if (code === 0) {
      notifyState("idle");
      return;
    }
    notifyState("loading");

    // Start 5s timeout.
    timeoutRef.current = setTimeout(() => {
      // If still loading after 5s, move to failed.
      setState((prev) => {
        if (prev === "loading") {
          onState?.("failed");
          return "failed";
        }
        return prev;
      });
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [code]); // onState intentionally excluded — ref-stable in practice

  if (code === 0) return null;

  const height = Math.round(width / ASPECT);

  if (state === "failed") return null;

  const containerStyle: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, overflow: "hidden" }
    : { width, height, position: "relative", flexShrink: 0 };

  return (
    <div style={containerStyle}>
      {/* Shimmer placeholder while loading */}
      {state === "loading" && (
        <div
          aria-hidden="true"
          style={{
            position: fill ? "absolute" : "relative",
            inset: fill ? 0 : undefined,
            width: fill ? "100%" : width,
            height: fill ? "100%" : height,
            background:
              "linear-gradient(90deg, var(--bg-2,#1a1a2e) 25%, var(--bg-3,#2a2a3e) 50%, var(--bg-2,#1a1a2e) 75%)",
            backgroundSize: "200% 100%",
            animation: "cardart-shimmer 1.6s infinite",
            borderRadius: fill ? 0 : 4,
          }}
        />
      )}

      <img
        ref={imgRef}
        src={cardImageUrl(code)}
        alt=""
        aria-hidden="true"
        loading={eager ? "eager" : "lazy"}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        onLoad={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          notifyState("ok");
        }}
        onError={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          notifyState("failed");
        }}
        style={{
          display: state === "ok" ? "block" : "none",
          width: fill ? "100%" : width,
          height: fill ? "100%" : height,
          objectFit: fill ? "cover" : "contain",
          borderRadius: fill ? 0 : 4,
          opacity: state === "ok" ? 1 : 0,
          transition: "opacity 120ms ease",
        }}
      />
    </div>
  );
}

// Inject shimmer keyframes once.
if (typeof document !== "undefined") {
  const id = "cardart-shimmer-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes cardart-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
