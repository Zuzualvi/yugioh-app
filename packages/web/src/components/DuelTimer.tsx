/**
 * DuelTimer / ClockPanel — both clocks, always visible, labelled running or banked.
 *
 * Design spec §9 (ClockPanel): both clocks always on screen; labelled RUNNING/BANKED;
 * urgency escalation applies only to YOUR clock (requirements D2, D3, D4).
 *
 * Exports:
 *   `ClockPanel` — the canonical new component
 *   `DuelTimer` — alias kept so existing tests continue to import by name
 */
export { ClockPanel as DuelTimer, ClockPanel } from "./duel/chrome/ClockPanel";
