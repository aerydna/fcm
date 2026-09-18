# Marketing campaigns

Placed during **Phase 3** (initiate) and resolved during **Phase 6** (fire).
See marketing tile assets in [`../assets/components/`](../assets/components/).

## Initiating a campaign (Phase 3)

For each marketeer at work you may place **one** campaign. The marketeer's card
determines the allowed **type**, **range**, and **max duration**. After placing,
choose what to advertise (pizza, burgers, or one drink type) and set the duration
by placing that many wooden advertising markers on the tile.

| Marketeer | Types allowed | Range | Max duration |
|-----------|---------------|-------|--------------|
| Marketing Trainee | billboard | 2 | 2 |
| Campaign Manager | mailbox, billboard | 3 | 3 |
| Brand Manager | airplane, mailbox, billboard | unlimited | 4 |
| Brand Director | radio, airplane, mailbox, billboard | unlimited | 5 |

### Range

- **Range** = number of times you cross onto a different tile, following **roads**,
  starting from **any of your restaurant entrances**. Range 0 = same tile as the
  restaurant. Marketing Trainee range 2 = own tile, adjacent tile, or two steps.
- **Brand managers/directors** are **not** limited by range — but billboards,
  mailboxes, and radios must still be placed **adjacent to a road**.
- When a campaign spans multiple tiles, only **one** of its road-adjacent squares
  must be in range; the tile itself must be in range, not just the road used.

### Duration

- Min duration 1 turn; max = the marketeer's number. Campaigns **cannot end early**.
- Place the marketeer aside with a **busy chip** = the duration. The marketeer is
  unavailable until the campaign ends and takes **no slot** while busy (but may
  still require a salary).

### Placement rules

- **Billboards, mailboxes, radios**: on empty squares, connected to the road used
  to reach the tile.
- **Airplanes**: placed on the **side of the board**, not connected to a road and
  not affected by range. Sizes 1, 3, or 5 squares; must fly over exactly that many
  rows/columns and not extend off the board.
- A campaign may be placed where it currently reaches no houses (still legal).

### "First billboard placed" milestone

The player's campaigns become **eternal** (never end); place on the eternal side
with a single wooden piece. The marketeer is gone for the rest of the game. That
player also stops paying marketeer salaries.

## Resolving campaigns (Phase 6)

All campaigns fire in order of their **printed number**, lowest first.

**Demand cap per house: 3 tokens (5 if it has a garden).** A campaign reaching a
full house has no effect there.

| Campaign | Reaches |
|----------|---------|
| **Billboard** | All houses **orthogonally adjacent** to it (usually 1–2). A house is reached even if only its garden is adjacent. |
| **Mailbox** | All houses in the same **block** — everything reachable **without crossing a road** (roads bound the block; passes freely through restaurants/houses). |
| **Airplane** | Every house in a line of **1, 3, or 5** rows/columns across the board from the airplane counter. Reached even if only part of the house/garden is in the fly-over zone. |
| **Radio** | Every house on the **tile** where the radio sits, **plus** houses on all **8 surrounding tiles**. Reached even if only part of the house/garden is on those tiles. |

Place **one** demand token of the advertised type on each reached house (or **two**
for a radio if the player has the **"First radio campaign"** milestone).

After firing, remove **one** advertising token from the campaign (unless eternal).
When it hits zero tokens, return it to stock and free the marketeer; otherwise it
stays and the marketeer stays busy.

See [`../data/marketing.json`](../data/marketing.json).
