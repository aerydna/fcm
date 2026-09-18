# Components

Physical inventory from the rulebook (see [`../assets/components/`](../assets/components/)
and [`../assets/pages/page-03.png`](../assets/pages/page-03.png)).

| Qty | Component | Asset(s) | Notes for the digital game |
|-----|-----------|----------|----------------------------|
| 1 | Turn order track | `components/turn-order-track.png` | Holds as many spots as players. |
| 20 | Map tiles | `components/map-tile.png` (sample) | **Provided separately** (per user). Each tile is a 3×3 grid of squares with roads, drink sources, and printed houses. |
| 8 | House tiles | `components/house-tile.png` | Numbered houses (order of eating = house number). |
| 8 | Garden tiles | `components/garden-tile.png` | A garden extends a house into a 2×3 rectangle; doubles unit price income. |
| 16 | Marketing tiles | `components/marketing-billboard.png`, `-mailbox.png`, `-airplane.png`, `-radio.png` | 6 billboards, 4 mailboxes, 3 airplanes, 3 radios. Each has a printed number (campaign resolution order) and an "eternal" side. |
| 16 | "Busy" chips | `components/busy-chip.png` | Numbered 1..; placed on a marketeer to show how many turns they are busy. |
| 3×players | Restaurants | `components/restaurant-*-welcome.png` | Two sides: **COMING SOON** / **WELCOME**. |
| 1/player | Turn order marker | `components/chain-logo-*.png` | One per chain. |
| 5 | German player menus | `pages/page-03.png` | Phase summary reference. |
| 5 | English player menus | `pages/page-03.png` | Phase summary reference. |
| 222 | Employee cards | `../assets/employees/*.png` | 32 distinct card types (see [04-employees.md](04-employees.md)). |
| 84 | Milestone cards | `../assets/milestones/*.png` | 18 distinct milestones (see [05-milestones.md](05-milestones.md)). |
| 18 | Bank reserve cards | — | 3 per player; show a money value and 2/3/4 CEO slots. |
| — | Money | — | Bank pool = $50 × players (introductory: $75 × players). |
| — | Wooden goods | — | Burgers, pizzas, and 3 drink types: soft drink, beer, lemonade. Used both as inventory and as advertising/demand markers. |

## The 5 restaurant chains

| Chain slug | Display name |
|------------|--------------|
| `fried-geese-donkey` | Fried Geese & Donkey |
| `golden-duck-diner` | Golden Duck Diner |
| `santa-maria-pizza` | Santa Maria pizza |
| `xango-blues-bar` | Xango Blues Bar |
| `gluttony-burgers` | Gluttony Inc. Burgers |

## Goods

| Good | Category | Notes |
|------|----------|-------|
| Burger | food | Produced by kitchen staff. |
| Pizza | food | Produced by kitchen staff. |
| Soft drink | drink | Collected from drink sources by buyers. |
| Beer | drink | Collected from drink sources by buyers. |
| Lemonade | drink | Collected from drink sources by buyers. |

A house's demand may be for any mix of burgers, pizzas, and specific drinks. A
chain must satisfy the **entire** demanded menu to serve a house.

## Map tile anatomy

Each map tile is a 3×3 grid of squares and may contain:

- **Roads** (connect squares/tiles; movement and range follow roads).
- **Drink sources** (drink symbols on squares; buyers collect from adjacent road squares).
- **Printed houses** (numbered; can receive demand and later gardens).
- **Empty squares** (where restaurants, marketing tiles, new houses/gardens go).

> Tiles will be supplied separately; the digital model should treat a tile as a
> 3×3 array of square descriptors plus road edges. See
> [`../data/tiles.schema.json`](../data/tiles.schema.json) for the intended shape.
