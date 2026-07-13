// ---------------------------------------------------------------------------
// Web package public entry-point
// The real React app wiring (Vite entry, router, components) lives in src/main.tsx.
// This module exports pure utilities that don't depend on any framework.
// ---------------------------------------------------------------------------

/** Format a timestamp (seconds since epoch) as a human-readable string. */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}
