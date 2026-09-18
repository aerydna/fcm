# Food Chain Magnate — Overview

> Source: official rulebook (`r175914.pdf`, Splotter Spellen, 3rd printing 2015).
> These files are a structured, implementation-oriented transcription intended to
> drive a web implementation with CPU opponents. Original game © Splotter Spellen BV.

## What the game is

Food Chain Magnate is a heavy economic strategy game about building a fast-food
chain. Each player starts as a single entrepreneur (a **CEO**) and grows a company
by **hiring** and **training** staff (represented by cards) and by running
**operations** on a variable board: purchasing, marketing, and sales, plus a job
market for key staff.

- Players: 2–5
- No luck: 100% dice-free; everything is skill/planning.
- The game ends when the **bank breaks twice**. The richest player then wins.

## Core loop (one turn = 7 phases)

1. **Restructuring** — simultaneously choose which employees work this turn and
   build your company pyramid.
2. **Order of business** — choose turn-order position (most open slots picks first).
3. **Working 9:00–5:00** — in turn order, perform each at-work card's action
   (recruit, train, market, produce/collect, place/move restaurants, houses/gardens).
4. **Dinnertime** — houses with demand buy food/drinks; chains earn income.
5. **Payday** — fire staff, pay salaries.
6. **Marketing campaigns** — campaigns fire and place demand tokens on houses.
7. **Clean up** — discard unstored food/drinks, recover cards, flip restaurants, etc.

## Reading order of these files

| File | Contents |
|------|----------|
| [01-components.md](01-components.md) | Physical/logical components inventory |
| [02-setup.md](02-setup.md) | Game setup, map, bank, goals |
| [03-turn-phases.md](03-turn-phases.md) | The 7 phases in detail |
| [04-employees.md](04-employees.md) | Every employee card and its ability |
| [05-milestones.md](05-milestones.md) | Every milestone and its permanent effect |
| [06-marketing.md](06-marketing.md) | Marketing campaign rules (types, range, duration) |
| [07-dinnertime-and-pricing.md](07-dinnertime-and-pricing.md) | Demand resolution, pricing, income |
| [08-bank-and-endgame.md](08-bank-and-endgame.md) | Breaking the bank, end game, scoring |
| [09-introductory-and-strategy.md](09-introductory-and-strategy.md) | Beginner variant + strategy notes |
| [10-glossary.md](10-glossary.md) | Terms used throughout |

Machine-readable data for these rules lives in [`../data/`](../data/).

## Key concepts (quick reference)

- **Employee card**: depicts a person; text under the picture = what they can do.
  - Top-left recruit icon = can be hired by a recruiter (entry position).
  - A salary icon (💲) = requires a salary in Payday.
  - Bottom-left arrows = training career options; a reserve/top marker = **top
    position** (only one copy per player).
  - Top-right "range" = counted by road or zeppelin.
- **Open slot**: an unused position in the company structure (a CEO/manager slot).
- **Range**: number of times you cross onto a different tile (by road unless the
  card shows a zeppelin symbol, which ignores roads).
- **Chain**: a player's set of restaurants + owned food/drinks; food/drinks are
  shared across all of that player's restaurants.
- **Unit price**: base $10 per good, modified by pricing/discount/luxury managers
  and the "First to lower prices" milestone. Bonuses (CFO, "home of the original…")
  do **not** change unit price.
