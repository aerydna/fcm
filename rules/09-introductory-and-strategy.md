# Introductory game & strategy

## Introductory variant

Food Chain Magnate is unforgiving — a mistake can be hard or impossible to recover
from. For a **first game**, alter the rules:

- **Do not use** the reserve cards.
- Put **$75 per player** into the bank pool (instead of $50).
- **Take out all milestones.**
- **Do not pay any salaries** (skip Phase 5).
- The game **ends when the bank breaks once**.

This gives a shorter game to learn the rules without bankrupting your company. For
the **second** game, keep these alterations but **add the milestone cards** (even
if some give no benefit yet).

Engine flag suggestions: `variant: "intro"` toggles
`useReserveCards=false`, `bankPerPlayer=75`, `useMilestones=false`,
`skipPayday=true`, `endOnFirstBreak=true`.

## Strategy notes (from the rulebook)

- The best strategy depends heavily on: **board layout**, your **board position**,
  and **other players' actions**.
- **Milestones are the key** to planning. You need to reach the right ones **before
  others** — many will be locked once claimed.
- There is a **trade-off** between building up the company (recruitment/training)
  and earning money (marketing/sales). The winning mix depends on how long the game
  lasts, which the players themselves determine.
- The game **accelerates strongly** near the end. You can win by earning money only
  in the **last turn** if well prepared — or be caught still preparing for a turn
  that never comes.
- You can **hurt opponents** by advertising goods they cannot produce — but you may
  also help them sell later.
- **Price wars** are effective attacks but costly to yourself; use them tactically.
- **Houses with gardens** are very lucrative but attract competition.
- Sometimes a **few items at high prices** beat many items at a discount — or vice
  versa.
- Sometimes it's useful to advertise so that **other players earn money** — as long
  as you earn **more** yourself. Combine this with the pricing ideas above.

These pointers are useful heuristics for a CPU opponent's evaluation function:
prioritize contested milestones, value garden houses, weigh salary burden against
expected income given estimated remaining turns, and treat marketing as both demand
generation and denial.
