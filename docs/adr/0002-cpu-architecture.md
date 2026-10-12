# ADR 0002 — CPU: plans + predictive evaluator, three difficulties, no cheating

Status: accepted (2026-10-11)

## Context
FCM's action space (hire/train/pyramid/marketing placement/restaurant placement/
pricing) is too large for MCTS over primitive actions. Some information is hidden
(reserve cards, simultaneous restructuring).

## Decision
- Two layers: a **plan generator** produces a few candidate **macro-moves**; a
  **predictive evaluator** scores them by simulating Dinnertime and the following
  turns against an **opponent model**.
- Difficulty:
  - **easy** — greedy 1-turn heuristic + noise, no opponent model, ~0.2s.
  - **medium** — 1-turn lookahead with simulated Dinnertime vs predicted opponent moves, ~1s.
  - **hard** — ISMCTS over macro-moves, 2–3 turn horizon, reserve-card inference, ~3s.
- **The CPU never sees hidden information** at any level; it receives only
  *visible state* and uses **determinization**.

## Consequences
- Engine must expose `visibleState(state, player)` and fast cloning.
- Dinnertime must be fast enough to be called thousands of times per decision.
