import { CAMPAIGN_TILES, EMPLOYEES, type Good, isManager } from '../engine/data';
import { chainEntrances, entranceSquares, houseSquares, rangeTo, roadCosts } from '../engine/geometry';
import { isLegal } from '../engine/game';
import { legalActions } from '../engine/legal';
import { reachedHouses } from '../engine/marketing';
import { ceoUid, salaryDue, structureFits, typeOf } from '../engine/rules';
import type { Action, GameState, Player, PlayerId } from '../engine/types';

const HIRE_PLAN: [string, number][] = [
  ['kitchen-trainee', 1],
  ['marketing-trainee', 1],
  ['errand-boy', 1],
  ['management-trainee', 1],
  ['trainer', 1],
  ['kitchen-trainee', 2],
  ['recruiting-girl', 1],
  ['marketing-trainee', 2],
  ['waitress', 1],
  ['management-trainee', 2],
  ['errand-boy', 2],
  ['waitress', 2],
];

const TRAIN_PRIORITY: [string, number][] = [
  ['campaign-manager', 1],
  ['burger-cook', 1],
  ['pizza-cook', 1],
  ['junior-vice-president', 1],
  ['cart-operator', 1],
  ['burger-chef', 1],
  ['pizza-chef', 1],
  ['brand-manager', 1],
  ['vice-president', 1],
  ['truck-driver', 1],
  ['cfo', 1],
  ['campaign-manager', 2],
  ['local-manager', 1],
  ['coach', 1],
  ['senior-vice-president', 1],
];

/** Staff value order used to fill the pyramid (managers are placed first). */
const STAFF_ORDER = [
  'cfo', 'burger-chef', 'pizza-chef', 'brand-director', 'brand-manager', 'campaign-manager', 'burger-cook', 'pizza-cook',
  'zeppelin-pilot', 'truck-driver', 'cart-operator', 'regional-manager', 'local-manager', 'guru', 'coach', 'trainer',
  'marketing-trainee', 'kitchen-trainee', 'errand-boy', 'hr-director', 'recruiting-manager', 'recruiting-girl',
  'waitress', 'new-business-developer', 'discount-manager', 'pricing-manager', 'luxuries-manager',
];

const owned = (p: Player, type: string) => p.cards.filter((c) => c.type === type).length;

function preferredFood(p: Player): Good {
  const burger = p.cards.filter((c) => ['burger-cook', 'burger-chef'].includes(c.type)).length;
  const pizza = p.cards.filter((c) => ['pizza-cook', 'pizza-chef'].includes(c.type)).length;
  if (burger !== pizza) return burger > pizza ? 'burger' : 'pizza';
  return p.id % 2 ? 'pizza' : 'burger';
}

/** Houses close to a restaurant footprint; nearer and hungrier houses weigh more. */
function spotScore(state: GameState, x: number, y: number, entrance: number): number {
  const cost = roadCosts(state.map, entranceSquares({ x, y, entrance }, false));
  let score = 0;
  for (const h of state.houses) {
    const d = rangeTo(state.map, cost, houseSquares(h));
    if (d <= 3) score += (4 - d) * (1 + h.demand.length) * (h.garden ? 2 : 1);
  }
  return score;
}

function best<T>(items: readonly T[], score: (t: T) => number): T | undefined {
  let top: T | undefined;
  let topScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > topScore) [top, topScore] = [it, s];
  }
  return top;
}

/** Managers by slots first, then staff by value, as long as the pyramid fits. */
function buildStructure(state: GameState, p: Player): Action | undefined {
  const free = p.cards.filter((c) => c.type !== 'ceo' && !c.busyWith);
  const managers = free.filter((c) => isManager(c.type)).sort((a, b) => (EMPLOYEES[b.type].slots ?? 0) - (EMPLOYEES[a.type].slots ?? 0));
  const rank = (t: string) => (STAFF_ORDER.includes(t) ? STAFF_ORDER.indexOf(t) : 99);
  const staff = free.filter((c) => !isManager(c.type)).sort((a, b) => rank(a.type) - rank(b.type));
  const chosen = [ceoUid(p)];
  for (const c of [...managers, ...staff]) if (structureFits(state, p, [...chosen, c.uid])) chosen.push(c.uid);
  const action: Action = { type: 'restructure', atWork: chosen };
  return isLegal(state, p.id, action) ? action : undefined;
}

/** Drink most demanded by houses, defaulting to beer. */
function demandedDrink(state: GameState): Good {
  const counts: Partial<Record<Good, number>> = {};
  for (const h of state.houses) for (const g of h.demand) if (g !== 'burger' && g !== 'pizza') counts[g] = (counts[g] ?? 0) + 1;
  return best(Object.keys(counts) as Good[], (g) => counts[g]!) ?? 'beer';
}

/** Simple greedy policy used by the "easy" CPU and as a fallback. */
export function chooseEasy(state: GameState, me: PlayerId): Action {
  const p = state.players[me];
  const actions = legalActions(state);
  const of = <T extends Action['type']>(type: T) => actions.filter((a): a is Extract<Action, { type: T }> => a.type === type);
  const end: Action = actions.find((a) => a.type === 'endStep') ?? actions[0];

  switch (state.phase) {
    case 'setup-restaurant':
      return best(of('placeRestaurant'), (a) => spotScore(state, a.x, a.y, a.entrance)) ?? actions[0];
    case 'setup-reserve':
      return actions[1] ?? actions[0];
    case 'restructuring':
      return buildStructure(state, p) ?? best(of('restructure'), (a) => a.atWork.length) ?? actions[0];
    case 'order-of-business':
      return best(of('chooseOrder'), (a) => -a.position) ?? actions[0];
    case 'payday': {
      const pay = actions.find((a) => a.type === 'endPayday');
      const idle = of('fire').filter((a) => {
        const def = EMPLOYEES[typeOf(p, a.card)];
        return def.salary && def.category !== 'kitchen' && !p.atWork.includes(a.card);
      });
      if (idle.length && salaryDue(p) > p.cash * 0.4) return idle[0];
      if (pay) return pay;
      const fire = of('fire');
      return best(fire, (a) => (EMPLOYEES[typeOf(p, a.card)].salary ? 10 : 0) - (p.atWork.includes(a.card) ? 5 : 0)) ?? actions[0];
    }
    case 'working':
      return chooseWork(state, p, of, end);
    default:
      return actions[0];
  }
}

function chooseWork(
  state: GameState,
  p: Player,
  of: <T extends Action['type']>(type: T) => Extract<Action, { type: T }>[],
  end: Action,
): Action {
  const food = preferredFood(p);

  const recruit = of('recruit');
  if (recruit.length) {
    for (const [type, n] of HIRE_PLAN) {
      if (owned(p, type) < n) {
        const a = recruit.find((r) => r.employee === type);
        if (a) return a;
      }
    }
    return recruit.find((r) => r.employee === 'waitress') ?? end;
  }

  const train = of('train');
  if (train.length) {
    const salaried = p.cards.filter((c) => EMPLOYEES[c.type].salary).length;
    const affordable = (from: string) => EMPLOYEES[from].salary || p.cash >= (salaried + 1) * 10;
    for (const [to, cap] of TRAIN_PRIORITY) {
      if (owned(p, to) >= cap) continue;
      const a = train.find(
        (t) => t.to === to && affordable(typeOf(p, t.card)) && !(to === 'pizza-cook' && food === 'burger') && !(to === 'burger-cook' && food === 'pizza'),
      );
      if (a) return a;
    }
    return end;
  }

  const campaigns = of('campaign').filter((a) => a.good === food);
  if (campaigns.length) {
    const cost = roadCosts(state.map, chainEntrances(state, p.id, true));
    const reach = (a: Extract<Action, { type: 'campaign' }>) => {
      const tile = CAMPAIGN_TILES.find((t) => t.number === a.tile)!;
      const fake = { number: a.tile, type: tile.type, owner: p.id, marketeer: 0, good: a.good, remaining: 1, eternal: false, rect: a.rect } as GameState['campaigns'][number];
      if (a.band) fake.band = { ...a.band, size: tile.size! };
      return reachedHouses(state, fake)
        .filter((h) => rangeTo(state.map, cost, houseSquares(h)) <= 3)
        .reduce((s, h) => s + (h.garden ? 2 : 1), 0);
    };
    const pick = best(campaigns, reach);
    if (pick && reach(pick) > 0) return pick;
  }

  const produce = of('produce');
  if (produce.length) return produce.find((a) => !a.good || a.good === food) ?? produce[0];
  const buy = of('buyDrinks');
  if (buy.length) {
    const wanted = demandedDrink(state);
    return best(buy, (a) => a.route.length + (a.drink === wanted ? 0.5 : 0)) ?? end;
  }

  const gardens = of('placeGarden');
  if (gardens.length) {
    const cost = roadCosts(state.map, chainEntrances(state, p.id, true));
    const pick = best(gardens, (a) => -rangeTo(state.map, cost, houseSquares(state.houses.find((h) => h.number === a.house)!)));
    if (pick) return pick;
  }

  const places = of('placeRestaurant');
  if (places.length) return best(places, (a) => spotScore(state, a.x, a.y, a.entrance)) ?? end;

  return end;
}
