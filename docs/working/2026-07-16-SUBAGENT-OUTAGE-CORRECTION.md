# CORRECTION — the 2026-07-15 "subagent outage" never existed (2026-07-16)

**Author:** CEO-side root-cause investigation (external to team sessions).
**Supersedes** the outage framing in: `2026-07-15-HANDOFF-2-closeout-and-next-build.md`
(first actions), `2026-07-15-cto-closeout-report.md` ("The subagent outage" section),
`2026-07-15-residual-gap-list.md`, and `2026-07-15-interactive-duel-ui-plan.md`
("once subagent spawn is restored").

## What the error actually means

`Look up subagent config failed (NotFound)` from `create_agent` means **the `agent_name`
string did not exactly match a roster agent name**. It does not indicate a platform
outage, quota, or config-service failure.

Roster agent names include a bracketed project suffix. Correct: `agent_name="QA Engineer
[yugioh-app]"` — copied verbatim from the create_agent tool description's "Agents
available in this session" list. Incorrect (always NotFound): `agent_name="QA Engineer"`.

Proven deterministically on 2026-07-16: exact name 4/4 success, bare name 4/4 NotFound,
interleaved on this project's real roster. Spawning was never down.

## How the "outage" narrative happened

The 07-15 close-out session's first spawn attempts used bare role names (as the persona's
team list suggests), got NotFound, and — anchored by "it worked earlier today" — diagnosed
a transient platform outage instead of re-checking the name. (The 07-14 session hit the
same error and recovered: "The names include the `[yugioh-app]` suffix.") The outage
framing then entered this handoff's first-actions ("if that fails, stop and tell the
CEO"), so every subsequent fresh thread ran the connectivity check with a bare name,
failed, and stopped — making the failure look total and persistent.

## What to do

- Spawn with exact roster names, always. On NotFound: re-read the roster list in the
  create_agent tool description and retry with the exact string.
- The CTO persona now carries a DELEGATION NAMING rule to this effect.
- Team memory: `/lessons/subagent-spawn-notfound-means-name.md` records this lesson.
- Do not write failure-cause narratives into handoffs unless verified; a mis-diagnosis
  in a handoff propagates to every future session.
