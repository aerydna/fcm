# ADR 0004 — Scope of the first release

Status: accepted (2026-10-11)

## Decision
- **1 human vs 2 CPU** (3 players). Architecture and data cover 2–5 players.
- **Full rules only** (milestones, reserve cards, payday). No introductory variant.
  No Ketchup expansions for now.
- **Autosave** each phase to IndexedDB (seed + action log), resume game, CPU animation
  speed (1x/2x/4x/skip), **undo** of own actions until the phase is confirmed.
- Player help: rich tooltips, legal-move highlighting, Dinnertime explanation panel.
  No guided tutorial yet.

## Open data (reconstructed from online sources, flagged `toVerify`)
- Copies per employee card type (only total 222 is known from the rulebook).
- Training sources for local/regional manager, CFO, luxuries/discount manager.
- Marketing tile numbers per type and footprints.
