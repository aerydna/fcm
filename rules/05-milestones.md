# Milestones

18 distinct milestones (see [`../assets/milestones/`](../assets/milestones/),
cropped from rulebook page 4). Physical count: 84 cards (duplicates).

## How milestones work

- When a player first meets a milestone's requirement **at any point in a turn**,
  they immediately gain that milestone card. Benefits take effect immediately and
  are **permanent** — you must apply them for the rest of the game, even if unhelpful.
- Other players may claim the **same** milestone, but only **during the same turn**.
  If copies run out, make a proxy.
- In **Phase 7 (Clean up)**, every milestone type that was claimed at least once
  this turn has its remaining copies removed from the game — no longer claimable.
- Milestones are central to strategy; plan around them.

## The 18 milestones

| Milestone | Trigger | Permanent effect |
|-----------|---------|------------------|
| **First billboard placed** | Place a billboard campaign. | (1) You **no longer pay salaries for marketeers** (mandatory — may not pay voluntarily). (2) Your marketing campaigns become **eternal** (never end); place on the eternal side with one wooden piece; the marketeer is gone for the rest of the game. Applies to the triggering billboard. |
| **First to train someone** | Train an employee to a higher level. | **$15 discount** on salary costs each Payday (min $0; mandatory). |
| **First to hire three people in one turn** | Hire ≥3 people in one turn. | Immediately gain **2 Management Trainee** cards on the beach (may be trained this turn since recruit precedes train). |
| **First burger marketed** | Place a campaign advertising **burgers**. | "Home of the original burger": **+$5** per burger sold (bonus, not unit price; not doubled by gardens; boosted by CFO). |
| **First pizza marketed** | Place a campaign advertising **pizza**. | "Home of the original pizza": **+$5** per pizza sold (bonus only). |
| **First drink marketed** | Place a campaign advertising **any drink**. | "Home of the original drink": **+$5** per **drink** sold — counts for **all** drink types. |
| **First errand boy played** | Play an errand boy in your structure. | Buyers get **+1 drink per source**; errand boys bring **2** identical drinks. Applies to the triggering errand boy. |
| **First to have $20** | Have $20 cash at any time (after income, before salaries). | May **look at** the face-down reserve cards (may bluff about them, may not show others). |
| **First burger produced** | Produce a burger. | Immediately receive a **Burger Cook** card (cannot train it this turn; it needs a salary or fire it). If none left, nothing. |
| **First pizza produced** | Produce a pizza. | Immediately receive a **Pizza Cook** card (same rules as burger). |
| **First waitress played** | Play a waitress in your structure. | Each waitress earns **$5** instead of $3 (applies to the triggering waitress). |
| **First cart operator played** | Place your first cart operator. | Cart operators, truck drivers, and zeppelin pilots get **+1 range** (applies immediately — first cart operator range 3). |
| **First airplane campaign** | Place an airplane campaign. | When determining order of play, count **+2 open slots** (bonus only; can't hold employees). |
| **First to lower prices** | Play a pricing manager or a discount manager. | Your prices are permanently **−$1** (e.g. $9 with no price managers). Immediate. |
| **First to have $100** | Have ≥$100 cash at the **end of Phase 4**. | Your **CEO also acts as a CFO** (+50% cash at end of Phase 4). No CFO card given; must fire any existing CFO in Phase 5; may not train a CFO afterward. Takes effect **next turn**. |
| **First radio campaign** | Place a radio campaign. | If you have a radio running in Phase 6, place **2 goods** of the advertised type on each reached house (0/1 if the house is nearly full). Cannot choose to place 1; markets the same good twice. Immediate. |
| **First to throw away drink/food** | Throw away ≥1 food/drink token in Phase 7. | The card becomes a **freezer**: store up to **10** tokens across turns (sellable later). Not usable the turn you gain it. |
| **First to pay $20 or more in salaries** | Pay ≥$20 in **actually-paid** salaries in Phase 5 (discounts don't count; must use all available discounts first). | May use **multiple trainers/coaches/gurus on the same person** (e.g. train a Management Trainee up to Executive VP in one turn). |

## Notes for CPU logic

- Track, per milestone type, whether it has been claimed this turn (to lock it in
  Phase 7) and which players hold it.
- Several milestones grant permanent modifiers to income/salary/range/pricing — the
  engine should represent these as flags on the player state:
  - `noMarketeerSalary`, `eternalCampaigns` (First billboard)
  - `salaryDiscount += 15` (First to train)
  - `burgerBonus/pizzaBonus/drinkBonus += 5` (First …​ marketed)
  - `buyerExtraDrinkPerSource`, `errandBoyDoubleDrink` (First errand boy)
  - `canSeeReserveCards` (First to have $20)
  - `waitressPay = 5` (First waitress)
  - `buyerRange += 1` (First cart operator)
  - `orderOfPlayBonusSlots += 2` (First airplane)
  - `priceModifier -= 1` (First to lower prices)
  - `ceoIsCfo` from next turn (First to have $100)
  - `radioDoublePlacement` (First radio)
  - `freezerCapacity = 10` (First to throw away)
  - `multiTrainSamePerson` (First to pay $20 salaries)

See [`../data/milestones.json`](../data/milestones.json) for the machine-readable form.
