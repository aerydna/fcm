# Phase 4 — Dinnertime, pricing & income

In the evening, houses go out to eat, processed in order of the **house number**
(lowest first). Players make **no decisions** in this phase; resolution is fully
determined by the rules below (ideal for a deterministic engine).

## Resolving a single house

1. **No demand tokens** → the inhabitants don't go out. Skip.
2. **Has demand tokens** → find chains that can deliver the **entire** demanded
   menu (e.g. demand of 2 burgers + 1 beer needs a chain with 2 burgers **and** a
   beer available) **and** have a restaurant connected to the house **by road**.
   - No range restriction, but a **road connection** is required. You may start at
     any road square orthogonally adjacent to the house **or its garden**.
   - If **no** chain qualifies → inhabitants stay home.
   - If **exactly one** chain qualifies → they eat there.
3. **Multiple qualifying chains** → competition, decided by **(unit price + distance)**.

## Unit price

Base **unit price = $10** per good, modified by managers/milestones (these change
the unit price and therefore the buying decision):

| Modifier | Effect on unit price |
|----------|----------------------|
| Pricing Manager (each) | −$1 |
| Discount Manager (each) | −$3 |
| Luxuries Manager (each) | +$10 |
| "First to lower prices" milestone | −$1 (permanent) |

> Bonuses like CFO and "Home of the original …" (+$5) do **not** alter unit price —
> they don't influence where inhabitants eat, and are not doubled by gardens.

Example: 2 active price managers + 1 active discount manager → unit price
$10 − $2 − $3 = **$5**.

## Distance

Distance = the **range** from the house to the **closest** restaurant of each
chain, following roads to an **entrance**. Each tile border crossed = 1 step. A
house on the same tile as an entrance, connected by a road on that tile, is
distance **0**.

## Choosing the restaurant

- Compute **unit price + distance** for each qualifying chain. The number of demand
  tokens does **not** matter here.
- Inhabitants pick the **lowest** total (they'll walk one step further to save $1
  per item, etc.).
- **Tie-breakers**:
  1. Most **waitresses** in the chain's structure.
  2. Then the chain **earlier in turn order**.

## Getting paid

The chosen chain must **serve** the demand: discard the house's demand tokens and
the matching goods from the chain's stock. The chain is paid **per item sold**:

`income per item = unit price + milestone/CFO bonuses`

- **Garden**: the chain receives **double the unit price** per item. Bonuses are
  **not** doubled → `income = (2 × unit price) + bonuses`.

### Worked example (from the rulebook)

A player sells 1 burger + 2 beer to a house **with a garden**. He has "First burger
marketed" (+$5 on burgers) and an active Luxuries Manager (+$10 unit price).

- Unit price = $10 + $10 = **$20**.
- Burger: garden doubles unit price → 2 × $20 = $40, then +$5 burger bonus = **$45**.
- Beer (no drink bonus): 2 × $20 = **$40** each.
- Total = $45 + 2 × $40 = **$125**.

### Running out mid-order

Because houses are processed by number, a chain can run out of goods for
later houses, which then look elsewhere or stay home. Long distances or no food at
all are possible.

## End-of-phase bonuses

- **Waitresses**: after all houses, each chain gets **$3** (or **$5** with "First
  waitress played") per waitress in its structure.
- **CFO** (or "First to have $100" milestone): each such chain gets **+50%** on all
  cash earned this turn, including waitress tips (**rounded up**).

If the bank cannot pay all income at any point in this phase, it **breaks** and
reserve cards are opened (see [08-bank-and-endgame.md](08-bank-and-endgame.md)).

See [`../data/goods.json`](../data/goods.json) and
[`../data/config.json`](../data/config.json).
