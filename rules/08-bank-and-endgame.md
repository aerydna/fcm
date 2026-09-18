# Breaking the bank & end of game

## Breaking the bank — 1st time

Triggered when, during **Phase 4 (Dinnertime)**, the bank has insufficient funds to
pay all income.

1. Open the **reserve cards** chosen by the players at setup.
2. Sum the money amounts on those reserve cards and add the total to the bank.
3. Each reserve card also shows **2, 3, or 4 open slots**. The number that occurs
   **most often** becomes the number of slots **all CEOs** have from the **next
   turn** onward.
   - Tie between two counts → the **higher** number wins.
   - Example: two "2-slot", one "3-slot", one "4-slot" → all CEOs use **2** slots.
   - Example: two "2-slot" and two "4-slot" → all CEOs use **4** slots.
4. Place the reserve cards under the CEOs as a reminder of the new slot count.

## Breaking the bank — 2nd time

Triggered when the bank breaks a **second** time.

- The game **ends**. Finish Phase 4 and pay all players their earnings — if
  necessary, write down cash still owed on paper.
- **Salaries are not paid** this final turn (Phase 5 is effectively skipped for the
  end).

## Winning

- Whoever has the **most cash** at the end of this phase wins.
- Tie → the tied player **earlier in turn order** wins.

## Engine notes

- Track bank balance; on any payout that would go negative during Phase 4, trigger
  a break (1st or 2nd). Continue paying (possibly into negative, recorded on paper)
  and set the end-of-game flag on the 2nd break.
- After the 1st break, recompute and store `ceoSlots` for all players (applies next
  turn).
- Reserve card values and slot counts should be data-driven; see
  [`../data/config.json`](../data/config.json) (`bankReserveCards`).
