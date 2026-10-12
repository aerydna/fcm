import { CONFIG, DRINKS, type Good, GOODS } from './data';
import { chainEntrances, houseSquares, rangeTo, roadCosts } from './geometry';
import { claimMilestone, has, hasActive, hasCfo, payFromBank, unitPrice, waitresses } from './rules';
import type { GameEvent, GameState, Goods, HouseState, Player } from './types';

const countGoods = (goods: readonly Good[]) => {
  const n = Object.fromEntries(GOODS.map((g) => [g, 0])) as Goods;
  goods.forEach((g) => n[g]++);
  return n;
};

const canServe = (stock: Goods, need: Goods) => GOODS.every((g) => stock[g] >= need[g]);

function bonusFor(p: Player, good: Good): number {
  if (good === 'burger') return has(p, 'first-burger-marketed') ? 5 : 0;
  if (good === 'pizza') return has(p, 'first-pizza-marketed') ? 5 : 0;
  return DRINKS.includes(good as never) && has(p, 'first-drink-marketed') ? 5 : 0;
}

export interface HouseChoice {
  player: number;
  price: number;
  distance: number;
}

/** Ranks chains able to serve a house: lowest price+distance, then most waitresses, then turn order. */
export function rankChains(state: GameState, house: HouseState, costs: (Int16Array | null)[]): HouseChoice[] {
  const need = countGoods(house.demand);
  const squares = houseSquares(house);
  const options: HouseChoice[] = [];
  for (const p of state.players) {
    const cost = costs[p.id];
    if (!cost || !canServe(p.stock, need)) continue;
    const distance = rangeTo(state.map, cost, squares);
    if (distance === Infinity) continue;
    options.push({ player: p.id, price: unitPrice(state, p), distance });
  }
  const order = (id: number) => state.turnOrder.indexOf(id);
  return options.sort(
    (a, b) =>
      a.price + a.distance - (b.price + b.distance) ||
      waitresses(state.players[b.player]) - waitresses(state.players[a.player]) ||
      order(a.player) - order(b.player),
  );
}

export function dinnertime(state: GameState, events: GameEvent[]): void {
  const earned = state.players.map(() => 0);
  const costs = state.players.map((p) => {
    const entrances = chainEntrances(state, p.id, false);
    return entrances.length ? roadCosts(state.map, entrances) : null;
  });

  for (const house of [...state.houses].sort((a, b) => a.number - b.number)) {
    if (!house.demand.length) continue;
    const [best] = rankChains(state, house, costs);
    if (!best) continue;
    const p = state.players[best.player];
    const goods = house.demand;
    let income = 0;
    for (const g of goods) {
      p.stock[g]--;
      income += best.price * (house.garden ? 2 : 1) + bonusFor(p, g);
    }
    house.demand = [];
    events.push({ type: 'served', house: house.number, player: p.id, goods, income });
    payFromBank(state, p, income, 'dinner', events);
    earned[p.id] += income;
  }

  for (const p of state.players) {
    const tips = waitresses(p) * (has(p, 'first-waitress-played') ? CONFIG.waitressPayWithMilestone : CONFIG.waitressPayBase);
    payFromBank(state, p, tips, 'waitresses', events);
    earned[p.id] += tips;
  }
  for (const p of state.players) {
    if (hasCfo(state, p) && earned[p.id] > 0) {
      payFromBank(state, p, Math.ceil((earned[p.id] * CONFIG.cfoBonusPercent) / 100), 'cfo', events);
    }
  }
  for (const p of state.players) {
    if (p.cash >= 20) claimMilestone(state, p, 'first-to-have-20', events);
    if (p.cash >= 100 && !hasActive(state, p, 'first-to-have-100')) claimMilestone(state, p, 'first-to-have-100', events);
  }
}
