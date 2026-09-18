# Food Chain Magnate — assets & rules

This repository is a structured breakdown of the **Food Chain Magnate** rulebook
(`r175914.pdf`, Splotter Spellen, 3rd printing 2015), prepared to build a **web
version of the game with CPU-controlled players**.

> The original game, artwork, and rules are © **Splotter Spellen BV**. The material
> here is a personal transcription/asset extraction of an owned rulebook for a
> software implementation. Do not redistribute the artwork commercially.

## Layout

```
r175914.pdf                 # original rulebook (source)
rules_raw.txt               # raw text extraction (reference)
rules/                      # rules split into Markdown by topic
data/                       # machine-readable game data (JSON) for the engine + CPU
assets/
  pages/    page-01..15.png # full-page renders (200 DPI)
  svg/      page-01..15.svg # vector page exports (scalable)
  employees/*.png           # 32 employee card faces
  milestones/*.png          # 18 milestone card faces
  components/*.png          # marketing tiles, restaurants, chain logos, busy chip, turn track, sample tiles
tools/crop_cards.py         # script that segmented the card sheets
```

## Rules (Markdown)

| File | Contents |
|------|----------|
| [rules/00-overview.md](rules/00-overview.md) | Summary, core loop, key concepts |
| [rules/01-components.md](rules/01-components.md) | Component inventory, chains, goods, tile anatomy |
| [rules/02-setup.md](rules/02-setup.md) | Setup, map, bank, initial placement, goals |
| [rules/03-turn-phases.md](rules/03-turn-phases.md) | The 7 phases in detail |
| [rules/04-employees.md](rules/04-employees.md) | Every employee card + tech tree |
| [rules/05-milestones.md](rules/05-milestones.md) | Every milestone + permanent effects |
| [rules/06-marketing.md](rules/06-marketing.md) | Marketing campaign rules |
| [rules/07-dinnertime-and-pricing.md](rules/07-dinnertime-and-pricing.md) | Demand resolution, pricing, income |
| [rules/08-bank-and-endgame.md](rules/08-bank-and-endgame.md) | Bank breaks, end game, scoring |
| [rules/09-introductory-and-strategy.md](rules/09-introductory-and-strategy.md) | Beginner variant + strategy |
| [rules/10-glossary.md](rules/10-glossary.md) | Terms |

## Data (JSON) — for the engine & CPU

| File | Contents |
|------|----------|
| [data/config.json](data/config.json) | Player-count tables, bank, unit price, phases, intro variant |
| [data/employees.json](data/employees.json) | 33 cards (32 deck + CEO): abilities, slots, ranges, salary, training tracks |
| [data/milestones.json](data/milestones.json) | 18 milestones with triggers and suggested state flags |
| [data/marketing.json](data/marketing.json) | Campaign types, marketeers, reach rules |
| [data/goods.json](data/goods.json) | Burgers, pizzas, drinks |
| [data/restaurants.json](data/restaurants.json) | The 5 chains + placement rules |
| [data/tiles.schema.json](data/tiles.schema.json) | JSON Schema for the map tiles (supplied separately) |

## Asset coverage

Present (from the rulebook):

- ✅ All 32 employee card faces + CEO data
- ✅ All 18 milestone card faces
- ✅ 4 marketing tile types (billboard, mailbox, airplane, radio)
- ✅ 5 restaurant chains (WELCOME side + logo/turn-order marker)
- ✅ Busy chip, turn-order track
- ✅ Sample house / garden / map tile (for reference)
- ✅ Page renders (PNG) + vector exports (SVG)

Supplied separately (per project owner):

- ⏳ **Map tiles** — model them against [data/tiles.schema.json](data/tiles.schema.json)
  and drop artwork into `assets/tiles/`.

## Notes for implementation

- Phase 4 (Dinnertime) and Phase 6 (Marketing) are **fully deterministic** — good
  to implement first and unit-test. Decisions only happen in phases 1, 2, 3, 5, 7.
- The transcription applies one simplifying rule for salaries (entry cards + CEO =
  no salary; trained cards = salary). This matches the game but should be
  spot-checked against card art for any edge cases.
- Training edges for the linear sub-tracks are exact; specialist training sources
  (local/regional manager, CFO, luxuries/discount managers) should be confirmed
  against the card faces in `assets/employees/` before finalizing CPU training AI.

## Regenerating the card crops

```bash
python3 tools/crop_cards.py --save   # requires numpy + Pillow
```
