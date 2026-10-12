# Food Chain Magnate (web) — Domain Context

Shared language for code, docs, and conversations. Game-rule terms are defined in
[rules/10-glossary.md](rules/10-glossary.md); this file pins down how they map to the
software model and adds engine/AI terms. When a term here conflicts with code, fix
the code.

## Product scope (first release)

- Web, **desktop only**, **English only** UI.
- **1 human vs 2 CPU** (3 players, 3×4 map, 12 tiles, billboards #15 and #16 removed).
  Architecture supports 2–5 players.
- **Full rules only**: milestones, bank reserve cards, payday. No introductory
  variant, no Ketchup expansions.
- Original art (saturated cartoon, 50s Americana). Rulebook crops in `assets/` are
  **placeholders/reference only**.

## Board geometry

| Term | Definition |
|------|------------|
| **Square** | The atomic board cell. Content: `empty`, `road`, `drink`, `house` part, `garden` part, `restaurant` part, `marketing` part. |
| **Tile** | A 5×5 block of squares (rules_raw.txt L153). 20 base tiles, ids `A`..`T` (lettering from boardgamehelpers.com). Layout identical to the original; art is ours. |
| **Rotation** | Tile orientation `0 \| 90 \| 180 \| 270` (clockwise). Applied at map build time; the engine only sees rotated squares. |
| **Map** | Grid of tiles sized by `data/config.json` (3 players → 3×4 = 12 tiles), always laid out landscape (4 cols × 3 rows) for desktop. Square coordinates are global `(x, y)`, origin top-left. |
| **Road square** | A square fully occupied by road. Connects to orthogonally adjacent road squares on the same tile; across a tile border only through the edge **midpoint** square (index 2), never along parallel border roads. |
| **Tile crossing** | Moving along roads from a square on one tile to a square on another. **Range** = number of tile crossings. |
| **Block** | Maximal set of non-road squares connected orthogonally without crossing a road square. Used by mailboxes. |
| **Entrance** | The corner square of a 2×2 restaurant used for range/distance. With **drive-in**, every corner is an entrance. |
| **Footprint** | The set of squares an object occupies: house 2×2, house+garden 2×3, restaurant 2×2. |

## Economy & state

| Term | Definition |
|------|------------|
| **Chain** | A player's company (one of 5 brands). Owns cash, restaurants, stock, cards, milestones. |
| **Stock** | Food and drinks a chain holds; shared by all its restaurants. Discarded at clean-up unless it has a freezer. |
| **Demand** | Goods tokens on a house. Cap 3, or 5 with garden. |
| **Unit price** | Per-chain price per good used in Dinnertime. Base $10 + modifiers. |
| **Reserve card** | `+$100 → 2 CEO slots`, `+$200 → 3`, `+$300 → 4`. Each player has one of each and picks one secretly. |

## Engine

| Term | Definition |
|------|------------|
| **GameState** | Immutable, serializable snapshot of everything. No functions, no references to rendering. |
| **Action** | A player decision as plain data (e.g. `{type:'recruit', card:'waitress'}`). The only way to change state besides automatic steps. |
| **Step** | A deterministic transition the engine runs on its own (Dinnertime, marketing resolution, clean-up). |
| **Reducer** | `apply(state, action) → state`. Pure. Same input → same output. Randomness comes from a seeded RNG stored in state. |
| **Legal moves** | `legalActions(state, player)`: used by the UI for highlighting and by the CPU for search. |
| **Event** | Description of what happened in a transition (e.g. `houseServed`, `bankBroken`). The renderer animates events; it never diffs state. |
| **Action log** | Seed + ordered actions. Replaying it reproduces the game; used for save/resume and undo. |
| **Visible state** | `GameState` filtered for one player: hides other players' reserve cards and unrevealed restructuring. The CPU only ever receives visible state. |

## CPU

| Term | Definition |
|------|------------|
| **Plan** | A macro-strategy for one turn or a few turns (e.g. *burger rush*, *CFO race*, *price war*, *marketing blitz*). |
| **Macro-move** | A plan instantiated into a concrete bundle of actions for a phase (whom to hire/train, pyramid layout, where to place). |
| **Evaluator** | Scores a state for a player: cash, projected income from simulated Dinnertime, structure value, milestones, distance to end. |
| **Opponent model** | Predicts other players' macro-moves from their visible state (cheap heuristic policy). |
| **Determinization** | Sampling a full hidden state (reserve cards, simultaneous choices) consistent with what a player can see. CPU never reads hidden info. |
| **Difficulty** | `easy` greedy + noise, 0.2s · `medium` 1-turn lookahead with simulated Dinnertime vs opponent model, 1s · `hard` ISMCTS over macro-moves, 2–3 turns, reserve inference, 3s. |

## Presentation

| Term | Definition |
|------|------------|
| **Board view** | PixiJS v8 scene: map, buildings, marketing, animated customers. Top-down with depth (shadows, relief, light parallax), pan/zoom. |
| **HUD** | React DOM overlay: player panels, company pyramid, card market, phase bar, tooltips, Dinnertime explanation. |
| **Time of day** | Visual cycle per round: day during Working, sunset + neon in Dinnertime, night in clean-up. |
| **Asset manifest** | Maps logical asset keys to files. Assets are hand-authored SVG rasterized at runtime; swappable without code changes. |
