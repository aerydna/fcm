# ADR 0001 — Tech stack: TypeScript, headless engine, PixiJS + GSAP + React

Status: accepted (2026-10-11)

## Context
We need an eye-catching 2D web game with heavy UI (company pyramid, card market,
player panels) and a CPU that searches many futures.

## Decision
- **TypeScript + Vite**, single repo, `src/engine`, `src/ai`, `src/view`, `src/ui`.
- **Engine is headless and pure** (no DOM/Pixi imports): immutable state, seeded RNG,
  `apply(state, action)`. Shared by UI and CPU.
- **PixiJS v8** renders the board; **GSAP** drives tweens/timelines;
  **React** renders HUD/menus as a DOM overlay.
- **CPU runs in a Web Worker**.
- Tests with **Vitest** (engine rules first: Dinnertime and Marketing are deterministic).

## Consequences
- Rendering consumes engine **events**; it never mutates or diffs state.
- Phaser rejected: great for action games, awkward for dense DOM-like UI.
- 3D/isometric rejected (see ADR 0003).
