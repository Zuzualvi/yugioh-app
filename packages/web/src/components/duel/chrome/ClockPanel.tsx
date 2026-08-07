/**
 * ClockPanel — both clocks, always visible, labelled running or banked.
 *
 * Design spec §9: Both clocks always on screen. Each labelled with owner name
 * and RUNNING/BANKED. Urgency escalation applies only to YOUR clock (4 states).
 * Requirement D2, D3, D4.
 */
import React, { useEffect, useState } from "react";
import type { Seat } from "@yugioh-app/contracts";

interface Props {
  myDeadlineAt: number | null;
  oppDeadlineAt: number | null;
  onClockSeat: Seat;
  mySeat: Seat;
  myName?: string;
  oppName?: string;
  connection?: "open" | "reconnecting" | "closed";
}

function formatMmSs(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type Urgency = "normal" | "warn" | "high" | "alarm";

function getUrgency(msLeft: number): Urgency {
  if (msLeft <= 10_000) return "alarm";
  if (msLeft <= 30_000) return "high";
  if (msLeft <= 60_000) return "warn";
  return "normal";
}

interface ClockRowProps {
  label: string;
  deadlineAt: number | null;
  running: boolean;
  isOwn: boolean;
  connection: "open" | "reconnecting" | "closed";
}

function ClockRow({ label, deadlineAt, running, isOwn, connection }: ClockRowProps) {
  const [msLeft, setMsLeft] = useState(() => (deadlineAt != null ? deadlineAt - Date.now() : null));

  useEffect(() => {
    if (deadlineAt == null) {
      setMsLeft(null);
      return;
    }
    setMsLeft(deadlineAt - Date.now());
    if (!running) return; // banked clock doesn't count down
    const interval = setInterval(() => setMsLeft(deadlineAt - Date.now()), 200);
    return () => clearInterval(interval);
  }, [deadlineAt, running]);

  const disconnected = connection !== "open";
  const urgency: Urgency = isOwn && running && msLeft != null ? getUrgency(msLeft) : "normal";

  const displayMs = msLeft ?? 0;
  const displayText = disconnected
    ? "?"
    : msLeft == null
      ? "—:—"
      : displayMs <= 0
        ? "0:00"
        : formatMmSs(displayMs);

  // Urgency styles — own clock only
  const rowBackground =
    isOwn && urgency === "alarm"
      ? "var(--warning)"
      : isOwn && urgency === "high"
        ? "rgba(212,135,42,0.15)"
        : "transparent";

  const fontSize =
    urgency === "alarm"
      ? "1.375rem" // 22px
      : urgency === "high"
        ? "1.25rem" // 20px
        : urgency === "warn"
          ? "1.0625rem" // 17px
          : "0.875rem"; // 14px

  const borderStyle = running
    ? `2px solid ${disconnected ? "var(--text-2)" : isOwn && urgency !== "normal" ? "var(--warning)" : "var(--border)"}`
    : "1px solid var(--border)";

  const stateLabel = disconnected ? "?" : running ? "RUNNING" : "BANKED";

  const warning =
    isOwn && urgency !== "normal" && !disconnected
      ? urgency === "alarm"
        ? `${Math.ceil(displayMs / 1000)}s — TIMEOUT FORFEITS THE DUEL`
        : "timeout forfeits the duel"
      : null;

  return (
    <div
      data-testid={isOwn ? "clock-row-own" : "clock-row-opp"}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "4px 8px",
        background: rowBackground,
        border: borderStyle,
        borderRadius: 4,
        minWidth: 130,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--text-2)",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: disconnected
              ? "var(--text-2)"
              : isOwn && urgency !== "normal"
                ? urgency === "alarm"
                  ? "var(--bg-0)"
                  : "var(--warning)"
                : running
                  ? isOwn
                    ? "var(--own)"
                    : "var(--text-0)"
                  : "var(--text-2)",
            transition: "font-size 0.15s",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={`${label} clock: ${displayText}`}
        >
          {displayText}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            color: disconnected ? "var(--text-2)" : running ? "var(--text-0)" : "var(--text-2)",
            fontWeight: 600,
          }}
        >
          {stateLabel}
        </span>
      </div>
      {warning && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: urgency === "alarm" ? "var(--bg-0)" : "var(--warning)",
            marginTop: 1,
          }}
        >
          {warning}
        </p>
      )}
    </div>
  );
}

/** ClockPanel — always shows both clocks. */
export function ClockPanel({
  myDeadlineAt,
  oppDeadlineAt,
  onClockSeat,
  mySeat,
  myName = "You",
  oppName = "Opponent",
  connection = "open",
}: Props) {
  const myRunning = onClockSeat === mySeat;

  return (
    <div data-testid="clock-panel" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ClockRow
        label={myName}
        deadlineAt={myDeadlineAt}
        running={myRunning}
        isOwn
        connection={connection}
      />
      <ClockRow
        label={oppName}
        deadlineAt={oppDeadlineAt}
        running={!myRunning}
        isOwn={false}
        connection={connection}
      />
    </div>
  );
}
