# Employees

32 distinct employee cards (see [`../assets/employees/`](../assets/employees/)).
Card faces cropped from rulebook page 5.

## Card anatomy

- **Recruit icon** (top-left): entry position — can be hired by a recruiter.
- **Salary icon** (💲): requires a $5 salary in Payday. Rule of thumb used by this
  transcription: **entry-level cards and the CEO have no salary; every trained
  (non-entry) card has a salary.** (Verify against card art if implementing exact
  edge cases.)
- **Slots** (managers, black cards): the number of subordinates the card can hold.
- **Range / duration** (top-right or in text): buyers use range; marketeers use
  range + max campaign duration.
- **Training options** (bottom-left): what this card can be trained into.
- **Top position** (reserve marker, bottom-left): only **one** copy per player.

## Entry-level cards (recruitable)

These 9 cards can be hired directly by a recruitment action. None require a salary.

| Card | Category | Ability | Trains into |
|------|----------|---------|-------------|
| Waitress | service | Get **$3** cash (or $5 with milestone). Win ties vs. a restaurant with fewer waitresses. | — |
| New Business Developer | expansion | Place a **house or garden**. | — |
| Management Trainee | manager (2 slots) | A black manager; holds 2 subordinates. | Junior Vice President |
| Pricing Manager | pricing | **Price −$1**. (Mandatory.) | Luxuries Manager, Discount Manager |
| Recruiting Girl | recruiter | **Hire 1 person** (1 recruit action). | Recruiting Manager |
| Trainer | trainer | **Train 1 person** (1 training slot). | Coach |
| Errand Boy | buyer | Get **1 drink** of any type. | Cart Operator |
| Marketing Trainee | marketeer | Place a **billboard**, max duration **2**, range **2**. | Campaign Manager |
| Kitchen Trainee | kitchen | Produce **1 burger or 1 pizza**. | Burger Cook, Pizza Cook |

## Managers (black cards — the VP line)

| Card | Slots | Notes | Trains into |
|------|-------|-------|-------------|
| CEO | 3 | Always at work; 1 free recruit action. No salary. Slots can become 2/3/4 via reserve cards. | (top — not trainable) |
| Management Trainee | 2 | Entry manager. | Junior Vice President |
| Junior Vice President | 3 | | Vice President |
| Vice President | 4 | | Senior Vice President |
| Senior Vice President | 5 | | Executive Vice President |
| Executive Vice President | 10 | Top of the manager line. | — |

> Managers may only sit directly under the CEO (or as allowed). Only normal
> employees (not managers) may report to a manager.

## Pricing / margin managers

| Card | Effect (mandatory) |
|------|--------------------|
| Pricing Manager | Unit price **−$1** |
| Luxuries Manager | Unit price **+$10** |
| Discount Manager | Unit price **−$3** |

## Recruiters

| Card | Recruit actions | Trains into | Notes |
|------|-----------------|-------------|-------|
| Recruiting Girl | 1 | Recruiting Manager | entry |
| Recruiting Manager | 2 | HR Director | Unused actions → $5 salary discount each (mandatory). |
| HR Director | 4 | — | Unused actions → $5 salary discount each (mandatory). Top position. |

## Trainers

| Card | Training slots | Special | Trains into |
|------|----------------|---------|-------------|
| Trainer | 1 | one card, one step | Coach |
| Coach | 2 | may train the **same** card **2 steps** | Guru |
| Guru | 3 | may train the **same** card up to **3 steps** | — (top) |

## Buyers (drink collectors)

| Card | Range | Drinks per source | Notes | Trains into |
|------|-------|-------------------|-------|-------------|
| Errand Boy | — | 1 drink (choice) | entry | Cart Operator |
| Cart Operator | 2 | 2 per drink symbol | route over roads, no U-turns | Truck Driver |
| Truck Driver | 3 | 3 per drink symbol | route over roads | Zeppelin Pilot |
| Zeppelin Pilot | 4 | 2 per drink symbol | **ignores roads**; up to 5 tiles | — (top) |

## Marketeers

| Card | Campaign types | Range | Max duration | Trains into |
|------|----------------|-------|--------------|-------------|
| Marketing Trainee | billboard | 2 | 2 | Campaign Manager |
| Campaign Manager | mailbox, billboard | 3 | 3 | Brand Manager |
| Brand Manager | airplane, mailbox, billboard | unlimited | 4 | Brand Director |
| Brand Director | radio, airplane, mailbox, billboard | unlimited | 5 | — (top) |

While running a campaign the marketeer is put aside with a **busy chip** (equal to
the campaign duration) and takes no slot until the campaign ends.

## Kitchen staff (producers)

| Card | Produces | Trains into |
|------|----------|-------------|
| Kitchen Trainee | 1 burger **or** 1 pizza | Burger Cook, Pizza Cook |
| Burger Cook | 3 burgers | Burger Chef |
| Burger Chef | 8 burgers | — |
| Pizza Cook | 3 pizzas | Pizza Chef |
| Pizza Chef | 8 pizzas | — |

## Restaurant managers & finance (top / specialist)

| Card | Ability | Notes |
|------|---------|-------|
| Local Manager | Place a **new** restaurant (COMING SOON) within range 3 tiles by road; chain gains **drive-in** while active. | Trains into Regional Manager |
| Regional Manager | Place/move a restaurant **anywhere**, active immediately; chain gains **drive-in**. | — |
| CFO | **+50%** to cash earned this round (rounded up). | Top position; salary required. |

> Training sources for the specialist cards (Local Manager, CFO, Luxuries/Discount
> Managers, the VP line targets) follow each card's printed bottom-left options and
> the rulebook rule: "all other non-entry employees are trained directly from
> managers (black cards)." Confirm exact source cards against the card art when
> wiring up CPU training logic. The linear sub-tracks above (managers, recruiters,
> trainers, buyers, marketeers, kitchen) are exact.

See [`../data/employees.json`](../data/employees.json) for the machine-readable form.
