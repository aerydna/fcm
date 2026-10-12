import { CAMPAIGN_TILES, EMPLOYEES, GOODS, isManager, isMarketeer, RESERVE_CARDS } from './data';
import {
  buyerOptions,
  campaignRectOk,
  gardenFits,
  isLegal,
  restaurantSpotOk,
  type RestaurantMode,
  stepAvailable,
  trainerSlotsLeft,
} from './game';
import { chainEntrances, isRectFree, occupancy, roadCosts, adjacentRoads, rectSquares } from './geometry';
import { beach, ceoUid, structureFits, typeOf } from './rules';
import { type Action, type GameState, type Player, type Rect, WORK_STEPS } from './types';

/**
 * Representative legal actions for the active player. Complete for discrete choices;
 * campaigns use the lowest free tile of each type and maximum duration.
 */
export function legalActions(state: GameState): Action[] {
  if (state.active === null) return [];
  const p = state.players[state.active];
  switch (state.phase) {
    case 'setup-restaurant': {
      const out: Action[] = restaurantSpots(state, p, 'setup').map(([x, y, entrance]) => ({ type: 'placeRestaurant', x, y, entrance }));
      if (state.setupRound === 1) out.push({ type: 'pass' });
      return out;
    }
    case 'setup-reserve':
      return RESERVE_CARDS.map((_, index) => ({ type: 'chooseReserve', index }));
    case 'restructuring':
      return structureCandidates(state, p).map((atWork) => ({ type: 'restructure', atWork }));
    case 'order-of-business':
      return state.orderPicks.flatMap((v, position) => (v === null ? [{ type: 'chooseOrder', position } as Action] : []));
    case 'working':
      return [...workingActions(state, p), { type: 'endStep' }];
    case 'payday': {
      const out: Action[] = [{ type: 'endPayday' }, ...p.cards.filter((c) => c.type !== 'ceo').map((c) => ({ type: 'fire', card: c.uid }) as Action)];
      return out.filter((a) => isLegal(state, p.id, a));
    }
    default:
      return [];
  }
}

export function restaurantSpots(state: GameState, p: Player, mode: RestaurantMode): [number, number, number][] {
  const occ = occupancy(state);
  const cost = mode === 'local' ? roadCosts(state.map, chainEntrances(state, p.id, true)) : undefined;
  const out: [number, number, number][] = [];
  for (let y = 0; y < state.map.height - 1; y++) {
    for (let x = 0; x < state.map.width - 1; x++) {
      for (let e = 0; e < 4; e++) if (restaurantSpotOk(state, occ, p.id, x, y, e, mode, cost)) out.push([x, y, e]);
    }
  }
  return out;
}

/** CEO only, the fullest greedy structure, and the greedy structure minus each single card. */
export function structureCandidates(state: GameState, p: Player): number[][] {
  const ceo = ceoUid(p);
  const free = p.cards.filter((c) => c.uid !== ceo && !c.busyWith);
  const greedy = (exclude: number | null) => {
    const pool = free.filter((c) => c.uid !== exclude);
    const managers = pool.filter((c) => isManager(c.type)).sort((a, b) => (EMPLOYEES[b.type].slots ?? 0) - (EMPLOYEES[a.type].slots ?? 0));
    const chosen = [ceo];
    for (const m of managers) if (structureFits(state, p, [...chosen, m.uid])) chosen.push(m.uid);
    for (const c of pool.filter((x) => !isManager(x.type))) if (structureFits(state, p, [...chosen, c.uid])) chosen.push(c.uid);
    return chosen;
  };
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const s of [[ceo], greedy(null), ...free.map((c) => greedy(c.uid))]) {
    const key = [...s].sort((a, b) => a - b).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

const unused = (p: Player, pred: (t: string) => boolean) =>
  p.atWork.filter((u) => !p.turn.used.includes(u) && pred(typeOf(p, u)));

export function workingActions(state: GameState, p: Player): Action[] {
  if (!stepAvailable(state, p, state.workStep)) return [];
  const out: Action[] = [];
  switch (WORK_STEPS[state.workStep]) {
    case 'recruit':
      for (const e of Object.values(EMPLOYEES)) if (e.entry && state.supply[e.id] > 0) out.push({ type: 'recruit', employee: e.id });
      break;

    case 'train':
      for (const trainer of p.atWork.filter((u) => trainerSlotsLeft(p, u) > 0)) {
        for (const c of beach(p)) {
          for (const to of EMPLOYEES[c.type].trainsInto) {
            const a: Action = { type: 'train', trainer, card: c.uid, to };
            if (isLegal(state, p.id, a)) out.push(a);
          }
        }
      }
      break;

    case 'marketing': {
      const occ = occupancy(state);
      const cost = roadCosts(state.map, chainEntrances(state, p.id, true));
      for (const m of unused(p, isMarketeer)) {
        const def = EMPLOYEES[typeOf(p, m)];
        for (const type of def.campaignTypes!) {
          const tile = CAMPAIGN_TILES.find((t) => t.type === type && state.campaignTiles.includes(t.number));
          if (!tile) continue;
          const base = { type: 'campaign', marketeer: m, tile: tile.number, duration: def.maxDuration! } as const;
          if (type === 'airplane') {
            for (const axis of ['row', 'col'] as const) {
              const limit = axis === 'row' ? state.map.height : state.map.width;
              for (let start = 0; start + tile.size! <= limit; start++) for (const good of GOODS) out.push({ ...base, good, band: { axis, start } });
            }
            continue;
          }
          const range = def.rangeUnlimited ? null : def.range!;
          const shapes = tile.w === tile.h ? [[tile.w, tile.h]] : [[tile.w, tile.h], [tile.h, tile.w]];
          for (const [w, h] of shapes) {
            for (let y = 0; y + h <= state.map.height; y++) {
              for (let x = 0; x + w <= state.map.width; x++) {
                const rect = { x, y, w, h };
                if (campaignRectOk(state, occ, rect, range, cost)) for (const good of GOODS) out.push({ ...base, good, rect });
              }
            }
          }
        }
      }
      break;
    }

    case 'food':
      for (const k of unused(p, (t) => EMPLOYEES[t].category === 'kitchen')) {
        if (EMPLOYEES[typeOf(p, k)].produces!.chooseOne) {
          out.push({ type: 'produce', card: k, good: 'burger' }, { type: 'produce', card: k, good: 'pizza' });
        } else out.push({ type: 'produce', card: k });
      }
      for (const b of unused(p, (t) => EMPLOYEES[t].category === 'buyer')) {
        const type = typeOf(p, b);
        if (type === 'errand-boy') {
          for (const drink of ['softdrink', 'beer', 'lemonade'] as const) out.push({ type: 'buyDrinks', card: b, route: [], drink });
          continue;
        }
        for (const mask of buyerOptions(state, p, type)) {
          const route: number[] = [];
          for (let i = 0; i < 31; i++) if (mask & (1 << i)) route.push(i);
          out.push({ type: 'buyDrinks', card: b, route });
        }
      }
      break;

    case 'houses': {
      const occ = occupancy(state);
      for (const card of unused(p, (t) => t === 'new-business-developer')) {
        if (!state.gardensLeft) break;
        for (const h of state.houses.filter((x) => x.printed && !x.garden)) {
          for (const g of gardenRects(h)) if (isRectFree(state, occ, g)) out.push({ type: 'placeGarden', house: h.number, garden: g, card });
        }
        const number = state.houseNumbers[0];
        if (number === undefined) continue;
        for (let y = 0; y + 2 <= state.map.height; y++) {
          for (let x = 0; x + 2 <= state.map.width; x++) {
            const house = { x, y, w: 2, h: 2 };
            if (!isRectFree(state, occ, house)) continue;
            for (const garden of gardenRects(house)) {
              if (!gardenFits(house, garden) || !isRectFree(state, occ, garden)) continue;
              if (adjacentRoads(state.map, [...rectSquares(house), ...rectSquares(garden)]).length) out.push({ type: 'placeHouse', number, house, garden, card });
            }
          }
        }
      }
      break;
    }

    case 'restaurants':
      for (const manager of unused(p, (t) => t === 'local-manager' || t === 'regional-manager')) {
        const regional = typeOf(p, manager) === 'regional-manager';
        if (p.restaurantsLeft > 0) {
          for (const [x, y, entrance] of restaurantSpots(state, p, regional ? 'regional' : 'local')) out.push({ type: 'placeRestaurant', x, y, entrance, manager });
        }
        if (regional) {
          for (const r of state.restaurants.filter((x) => x.owner === p.id)) {
            const without = { ...state, restaurants: state.restaurants.filter((x) => x !== r) };
            for (const [x, y, entrance] of restaurantSpots(without, p, 'regional')) out.push({ type: 'moveRestaurant', restaurant: r.id, x, y, entrance, manager });
          }
        }
      }
      break;
  }
  return out;
}

function gardenRects(h: { x: number; y: number }): Rect[] {
  return [
    { x: h.x, y: h.y - 1, w: 2, h: 1 },
    { x: h.x, y: h.y + 2, w: 2, h: 1 },
    { x: h.x - 1, y: h.y, w: 1, h: 2 },
    { x: h.x + 2, y: h.y, w: 1, h: 2 },
  ];
}
