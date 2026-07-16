/**
 * ActionContextMenu — desktop decision prompt surface.
 *
 * A non-modal panel that appears near the triggering element (or inline) when
 * the engine issues a DuelDecision on desktop. Keyboard-dismissible (Escape).
 * Shared component — panels render their content inside this shell.
 */

import React, { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  /** If provided, rendered near this anchor element; otherwise renders inline. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}

export function ActionContextMenu({ open, title, onClose, children }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={title}
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        minWidth: 240,
        maxWidth: 400,
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12,
        }}
      >
        {title}
      </p>
      {children}
      <button
        onClick={onClose}
        style={{
          marginTop: 10,
          width: "100%",
          minHeight: 44,
          padding: "8px 12px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-2)",
          fontSize: "0.875rem",
          cursor: "pointer",
        }}
        aria-label="Close menu (Escape)"
      >
        ✕ Close
      </button>
    </div>
  );
}
