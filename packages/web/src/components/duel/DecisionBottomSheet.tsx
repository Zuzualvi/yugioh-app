/**
 * DecisionBottomSheet — mobile/tablet decision prompt surface.
 *
 * A sheet that slides up from the bottom of the screen when a DuelDecision
 * needs user input. The board remains visible above. Focus is trapped while
 * open (§5.6). Cancel is suppressed when cancelable===false.
 *
 * Shared component — panel engineers (2B/2C/2D) render their panels INSIDE
 * this shell via the `children` prop.
 */

import React, { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  cancelable?: boolean;
  onCancel?: () => void;
  children: React.ReactNode;
}

export function DecisionBottomSheet({ open, title, cancelable = true, onCancel, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus trap: when open, Tab stays inside the sheet
  useEffect(() => {
    if (!open) return;
    const el = sheetRef.current;
    if (!el) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && cancelable && onCancel) {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = el!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    // Move focus into sheet on open
    const first = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )[0];
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancelable, onCancel]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
      aria-hidden={!open}
    >
      {/* Backdrop — semi-transparent, tappable to cancel if cancelable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          pointerEvents: "auto",
        }}
        onClick={cancelable && onCancel ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dbs-title"
        style={{
          position: "absolute",
          bottom: "env(safe-area-inset-bottom, 0px)",
          left: 0,
          right: 0,
          background: "var(--bg-1)",
          borderTop: "1px solid var(--border)",
          borderRadius: "16px 16px 0 0",
          padding: "20px 16px",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "70dvh",
          overflowY: "auto",
          pointerEvents: "auto",
          /* Slide-up animation; reduced-motion: instant */
          animation: "sheet-slide-up var(--duration-med) ease",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "var(--bg-3)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
          aria-hidden="true"
        />

        {/* Title */}
        <h2
          id="dbs-title"
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--text-0)",
            marginBottom: 16,
          }}
        >
          {title}
        </h2>

        {/* Panel content */}
        {children}

        {/* Cancel — only shown when cancelable */}
        {cancelable && onCancel && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={onCancel}
              style={{
                width: "100%",
                minHeight: 44,
                padding: "10px 16px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-2)",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              ✕ Dismiss
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes sheet-slide-up {
            from { transform: none; }
            to   { transform: none; }
          }
        }
      `}</style>
    </div>
  );
}
