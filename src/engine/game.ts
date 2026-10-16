import { CAMPAIGN_TILES, CONFIG, EMPLOYEE_COPIES, EMPLOYEES, GOODS, type Good, isMarketeer, MILESTONE_IDS, RESERVE_CARDS, RESTAURANTS_PER_PLAYER } from './data';
import { dinnertime } from './dinnertime';
import {
  adjacentRoads,
  chainEntrances,
  entranceSquares,
  isRectFree,
  maskToSources,
  occupancy,
  rangeTo,
  rectSquares,
  roadCosts,
  roadRouteOptions,
  tileIndex,
  zeppelinOptions,
} from './geometry';
import { randomMap } from './map';
import { resolveMarketing } from './marketing';
import { seededRandom, shuffle } from './rng';
import {
  beach,
  card,
  ceoUid,
  claimMilestone,
  giveCard,
  has,
  hasActive,
  openSlots,
  ownsType,
  recruitActions,
  salaryDue,
  structureFits,
  typeOf,
  workTypes,
} from './rules';
import type { Action, GameEvent, GameState, Goods, Player, PlayerId, Rect, TurnScratch } from './types';
import { WORK_STEPS } from './types';

export class IllegalAction extends Error {}

const fail = (msg: string): never => {
  throw new IllegalAction(msg);
};

const emptyGoods = (): Goods => Object.fromEntries(GOODS.map((g) => [g, 0])) as Goods;
const freshTurn = (): TurnScratch => ({ hired: 0, recruitsUsed: 0, trainerUse: {}, trainedBy: {}, used: [], salaryPaid: 0 });

export interface NewGameOptions {
  seed: number;
  chains: string[];
}

export function newGame({ seed, chains }: NewGameOptions): GameState {
  const n = chains.length;
  const per = CONFIG.perPlayerCount[String(n) as keyof typeof CONFIG.perPlayerCount];
  const [a, b] = per.mapSize.split('x').map(Number);
  const rnd = seededRandom(seed);
  const map = randomMap(Math.floor(rnd() * 2 ** 31), Math.max(a, b), Math.min(a, b));

  const supply: Record<string, number> = {};
  for (const e of Object.values(EMPLOYEES)) {
    supply[e.id] = e.id === 'ceo' ? 0 : e.topPosition ? per.employeeCopiesUsed : e.entry ? EMPLOYEE_COPIES.entry : EMPLOYEE_COPIES.nonEntry;
  }

  let uid = 1;
  const players: Player[] = chains.map((chain, id) => ({
    id,
    chain,
    cash: 0,
    cards: [{ uid: uid++, type: 'ceo' }],
    atWork: [],
    reserve: null,
    restaurantsLeft: RESTAURANTS_PER_PLAYER,
    milestones: [],
    milestoneRound: {},
    stock: emptyGoods(),
    turn: freshTurn(),
  }));

  const turnOrder = shuffle(players.map((p) => p.id), rnd);
  const state: GameState = {
    rng: Math.floor(rnd() * 2 ** 31),
    round: 1,
    phase: 'setup-restaurant',
    active: null,
    queue: [...turnOrder].reverse(),
    passed: [],
    setupRound: 1,
    workStep: 0,
    turnOrder,
    orderPicks: [],
    players,
    map,
    houses: map.houses.map((h) => ({ number: h.number, x: h.x, y: h.y, printed: true, demand: [] })),
    restaurants: [],
    campaigns: [],
    bank: CONFIG.bank.perPlayer * n,
    bankBreaks: 0,
    ceoSlots: CONFIG.ceoSlots.default,
    ceoSlotsNext: CONFIG.ceoSlots.default,
    revealedReserves: null,
    supply,
    campaignTiles: CAMPAIGN_TILES.map((t) => t.number).filter((num) => !(per.billboardsRemoved as number[]).includes(num)),
    houseNumbers: [...CONFIG.newHouseNumbers.numbers],
    gardensLeft: 8,
    milestoneAvailable: Object.fromEntries(MILESTONE_IDS.map((m) => [m, true])),
    milestonesThisTurn: [],
    nextUid: uid,
    nextRestaurantId: 1,
    winner: null,
  };
  advance(state, []);
  return state;
}

export function apply(prev: GameState, player: PlayerId, action: Action): { state: GameState; events: GameEvent[] } {
  if (prev.active !== player) fail('Not your turn');
  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  handle(state, state.players[player], action, events);
  // A step you just used up is finished, not "skipped".
  if (prev.phase === 'working' && action.type !== 'endStep' && state.workStep === prev.workStep && !stepAvailable(state, state.players[player], state.workStep)) state.workStep++;
  advance(state, events);
  return { state, events };
}

export function isLegal(state: GameState, player: PlayerId, action: Action): boolean {
  try {
    apply(state, player, action);
    return true;
  } catch (e) {
    if (e instanceof IllegalAction) return false;
    throw e;
  }
}

/** State as seen by `viewer`: hides other players' reserve cards and pending restructuring. */
export function visibleState(state: GameState, viewer: PlayerId): GameState {
  const v = structuredClone(state);
  const peek = has(v.players[viewer], 'first-to-have-20');
  for (const p of v.players) {
    if (p.id === viewer) continue;
    if (!v.revealedReserves && !peek) p.reserve = null;
    delete p.pendingAtWork;
  }
  return v;
}

// ---------------------------------------------------------------- placement rules

export type RestaurantMode = 'setup' | 'local' | 'regional';

export function restaurantSpotOk(
  state: GameState,
  occ: Uint8Array,
  owner: PlayerId,
  x: number,
  y: number,
  entrance: number,
  mode: RestaurantMode,
  localCost?: Int16Array,
): boolean {
  const { map } = state;
  if (!Number.isInteger(entrance) || entrance < 0 || entrance > 3) return false;
  if (!isRectFree(state, occ, { x, y, w: 2, h: 2 })) return false;
  const [ent] = entranceSquares({ x, y, entrance }, false);
  if (!adjacentRoads(map, [ent]).length) return false;
  if (mode === 'setup') {
    const t = tileIndex(map, ent[0], ent[1]);
    if (state.restaurants.some((r) => entranceSquares(r, false).some(([ex, ey]) => tileIndex(map, ex, ey) === t))) return false;
  }
  if (mode === 'local') {
    const cost = localCost ?? roadCosts(map, chainEntrances(state, owner, true));
    if (rangeTo(map, cost, rectSquares({ x, y, w: 2, h: 2 })) > EMPLOYEES['local-manager'].range!) return false;
  }
  return true;
}

export function campaignRectOk(state: GameState, occ: Uint8Array, rect: Rect, range: number | null, cost?: Int16Array): boolean {
  if (!isRectFree(state, occ, rect)) return false;
  const squares = rectSquares(rect);
  if (!adjacentRoads(state.map, squares).length) return false;
  if (range === null) return true;
  return rangeTo(state.map, cost!, squares) <= range;
}

export function gardenFits(house: { x: number; y: number }, g: Rect): boolean {
  if (g.w === 2 && g.h === 1) return g.x === house.x && (g.y === house.y - 1 || g.y === house.y + 2);
  if (g.w === 1 && g.h === 2) return g.y === house.y && (g.x === house.x - 1 || g.x === house.x + 2);
  return false;
}

export function buyerRange(p: Player, type: string): number {
  return (EMPLOYEES[type].range ?? 0) + (has(p, 'first-cart-operator-played') ? 1 : 0);
}

/** Goods a produce/buyDrinks action yields (before any later phase consumes them). */
export function actionYield(state: GameState, player: PlayerId, a: Action): Partial<Goods> {
  const p = state.players[player];
  const type = 'card' in a ? typeOf(p, a.card) : '';
  const out: Partial<Goods> = {};
  const add = (g: Good, n: number) => (out[g] = (out[g] ?? 0) + n);
  if (a.type === 'produce') {
    const prod = EMPLOYEES[type]?.produces;
    if (prod?.chooseOne) add(a.good!, 1);
    else for (const [g, n] of Object.entries(prod ?? {}) as [Good, number][]) if (typeof n === 'number') add(g, n);
  }
  if (a.type === 'buyDrinks') {
    const bonus = has(p, 'first-errand-boy-played') ? 1 : 0;
    if (a.drink) add(a.drink, 1 + bonus);
    const mask = a.route.reduce((m, i) => m | (1 << i), 0);
    for (const s of maskToSources(state.map, mask)) add(s.drink, (EMPLOYEES[type]?.drinksPerSource ?? 0) + bonus);
  }
  return out;
}

/** Maximal drink-source sets a buyer can collect (bitmasks over drinkSources order). */
export function buyerOptions(state: GameState, p: Player, type: string): number[] {
  const entrances = chainEntrances(state, p.id, true);
  if (!entrances.length) return [];
  const range = buyerRange(p, type);
  return EMPLOYEES[type].ignoreRoads ? zeppelinOptions(state.map, entrances, range) : roadRouteOptions(state.map, entrances, range);
}

// ---------------------------------------------------------------- capabilities

const unusedAtWork = (p: Player, pred: (type: string) => boolean) =>
  p.atWork.filter((uid) => !p.turn.used.includes(uid) && pred(typeOf(p, uid)));

export function trainerSlotsLeft(p: Player, uid: number): number {
  return (EMPLOYEES[typeOf(p, uid)].trainingSlots ?? 0) - (p.turn.trainerUse[uid] ?? 0);
}

export function stepAvailable(state: GameState, p: Player, step: number): boolean {
  return stepBlocker(state, p, step) === null;
}

/** Why a Working 9-5 step cannot be done right now, or null if it can. */
export function stepBlocker(state: GameState, p: Player, step: number): string | null {
  switch (WORK_STEPS[step]) {
    case 'recruit':
      if (recruitActions(p) <= p.turn.recruitsUsed) return 'No hires left this turn.';
      return Object.values(EMPLOYEES).some((e) => e.entry && state.supply[e.id] > 0) ? null : 'No entry-level cards left in the supply.';
    case 'train':
      if (!p.atWork.some((u) => trainerSlotsLeft(p, u) > 0)) return 'No trainer, coach or guru at work.';
      return beach(p).some((c) => EMPLOYEES[c.type].trainsInto.length > 0) ? null : 'Nobody on the beach can be trained.';
    case 'marketing':
      if (!unusedAtWork(p, isMarketeer).length) return 'No free marketeer at work.';
      return state.campaignTiles.length ? null : 'All campaign tiles are in use.';
    case 'food':
      return unusedAtWork(p, (t) => ['kitchen', 'buyer'].includes(EMPLOYEES[t].category)).length ? null : 'No kitchen staff or drink buyer at work.';
    case 'houses':
      return unusedAtWork(p, (t) => t === 'new-business-developer').length ? null : 'No new business developer at work.';
    case 'restaurants':
      if (unusedAtWork(p, (t) => t === 'regional-manager').length) return null;
      if (!unusedAtWork(p, (t) => t === 'local-manager').length) return 'No local or regional manager at work.';
      return p.restaurantsLeft > 0 ? null : 'No restaurants left to place.';
    default:
      return 'Unknown step.';
  }
}

// ---------------------------------------------------------------- phase machine

function advance(state: GameState, events: GameEvent[]): void {
  for (;;) {
    switch (state.phase) {
      case 'setup-restaurant': {
        if (state.queue.length) {
          state.active = state.queue[0];
          return;
        }
        if (state.setupRound === 1 && state.passed.length) {
          state.queue = state.turnOrder.filter((id) => state.passed.includes(id));
          state.setupRound = 2;
          state.passed = [];
          continue;
        }
        state.phase = 'setup-reserve';
        state.queue = [...state.turnOrder];
        continue;
      }
      case 'setup-reserve':
        if (state.queue.length) {
          state.active = state.queue[0];
          return;
        }
        startRound(state, events);
        continue;
      case 'restructuring': {
        if (!state.queue.length) {
          reveal(state, events);
          startOrder(state, events);
          continue;
        }
        const p = state.players[state.queue[0]];
        if (state.round === 1 || !p.cards.some((c) => c.type !== 'ceo' && !c.busyWith)) {
          p.pendingAtWork = [ceoUid(p)];
          state.queue.shift();
          events.push({ type: 'skipped', player: p.id, phase: 'restructuring', reason: state.round === 1 ? 'First round: only the CEO works.' : 'Only your CEO is available: nobody else to put to work.' });
          continue;
        }
        state.active = p.id;
        return;
      }
      case 'order-of-business': {
        if (!state.queue.length) {
          state.turnOrder = state.orderPicks as PlayerId[];
          state.phase = 'working';
          state.queue = [...state.turnOrder];
          state.workStep = 0;
          events.push({ type: 'turnOrder', order: [...state.turnOrder] });
          events.push({ type: 'phase', phase: 'working', round: state.round });
          continue;
        }
        const free = state.orderPicks.flatMap((v, i) => (v === null ? [i] : []));
        if (free.length === 1) {
          const last = state.queue.shift()!;
          state.orderPicks[free[0]] = last;
          events.push({ type: 'skipped', player: last, phase: 'order-of-business', reason: `Only position ${free[0] + 1} was left for you.` });
          continue;
        }
        state.active = state.queue[0];
        return;
      }
      case 'working': {
        if (!state.queue.length) {
          events.push({ type: 'phase', phase: 'dinnertime', round: state.round });
          dinnertime(state, events);
          if (state.bankBreaks >= 2) {
            endGame(state, events);
            continue;
          }
          state.phase = 'payday';
          state.queue = [...state.turnOrder];
          events.push({ type: 'phase', phase: 'payday', round: state.round });
          continue;
        }
        const p = state.players[state.queue[0]];
        if (state.workStep >= WORK_STEPS.length) {
          state.queue.shift();
          state.workStep = 0;
          continue;
        }
        if (!stepAvailable(state, p, state.workStep)) {
          events.push({ type: 'skipped', player: p.id, phase: 'working', step: state.workStep, reason: stepBlocker(state, p, state.workStep)! });
          state.workStep++;
          continue;
        }
        state.active = p.id;
        return;
      }
      case 'payday': {
        if (!state.queue.length) {
          events.push({ type: 'phase', phase: 'marketing-campaigns', round: state.round });
          resolveMarketing(state, events);
          events.push({ type: 'phase', phase: 'clean-up', round: state.round });
          cleanup(state);
          startRound(state, events);
          continue;
        }
        const p = state.players[state.queue[0]];
        if (salaryDue(p) === 0) {
          events.push({ type: 'skipped', player: p.id, phase: 'payday', reason: 'No salaries to pay this turn.' });
          finishPayday(state, p, events);
          state.queue.shift();
          continue;
        }
        state.active = p.id;
        return;
      }
      case 'game-over':
        state.active = null;
        return;
    }
  }
}

function startRound(state: GameState, events: GameEvent[]): void {
  state.phase = 'restructuring';
  state.queue = [...state.turnOrder];
  for (const p of state.players) {
    p.turn = freshTurn();
    p.atWork = [];
    delete p.pendingAtWork;
  }
  events.push({ type: 'phase', phase: 'restructuring', round: state.round });
}

function reveal(state: GameState, events: GameEvent[]): void {
  for (const p of state.players) {
    p.atWork = p.pendingAtWork ?? [ceoUid(p)];
    delete p.pendingAtWork;
    const types = workTypes(p);
    if (types.includes('waitress')) claimMilestone(state, p, 'first-waitress-played', events);
    if (types.includes('errand-boy')) claimMilestone(state, p, 'first-errand-boy-played', events);
    if (types.includes('cart-operator')) claimMilestone(state, p, 'first-cart-operator-played', events);
    if (types.includes('pricing-manager') || types.includes('discount-manager')) {
      claimMilestone(state, p, 'first-to-lower-prices', events);
    }
  }
}

function startOrder(state: GameState, events: GameEvent[]): void {
  state.phase = 'order-of-business';
  const prev = state.turnOrder;
  state.queue = [...prev].sort(
    (a, b) => openSlots(state, state.players[b]) - openSlots(state, state.players[a]) || prev.indexOf(a) - prev.indexOf(b),
  );
  state.orderPicks = prev.map(() => null);
  events.push({ type: 'pickOrder', queue: state.queue.map((id) => ({ player: id, openSlots: openSlots(state, state.players[id]) })) });
  events.push({ type: 'phase', phase: 'order-of-business', round: state.round });
}

function finishPayday(state: GameState, p: Player, events: GameEvent[]): void {
  if (p.milestoneRound['first-to-have-100'] === state.round) {
    for (const c of p.cards.filter((x) => x.type === 'cfo')) fire(state, p, c.uid);
  }
  const due = salaryDue(p);
  if (p.cash < due) fail('Cannot pay salaries: fire employees first');
  p.cash -= due;
  state.bank += due;
  p.turn.salaryPaid = due;
  events.push({ type: 'salaries', player: p.id, amount: due });
  if (due >= 20) claimMilestone(state, p, 'first-to-pay-20-salaries', events);
}

function fire(state: GameState, p: Player, uid: number): void {
  const c = card(p, uid)!;
  p.cards = p.cards.filter((x) => x.uid !== uid);
  p.atWork = p.atWork.filter((u) => u !== uid);
  state.supply[c.type]++;
}

function cleanup(state: GameState): void {
  const events: GameEvent[] = [];
  for (const p of state.players) {
    const total = GOODS.reduce((s, g) => s + p.stock[g], 0);
    const freezer = has(p, 'first-to-throw-away-food-drink') && p.milestoneRound['first-to-throw-away-food-drink'] < state.round;
    if (freezer) {
      let excess = total - CONFIG.freezerCapacity;
      for (const g of [...GOODS].reverse()) {
        const drop = Math.min(excess, p.stock[g]);
        p.stock[g] -= drop;
        excess -= drop;
      }
    } else if (total > 0) {
      claimMilestone(state, p, 'first-to-throw-away-food-drink', events);
      p.stock = emptyGoods();
    }
    p.atWork = [];
  }
  for (const r of state.restaurants) r.comingSoon = false;
  for (const m of state.milestonesThisTurn) state.milestoneAvailable[m] = false;
  state.milestonesThisTurn = [];
  state.ceoSlots = state.ceoSlotsNext;
  state.round++;
}

function endGame(state: GameState, events: GameEvent[]): void {
  state.phase = 'game-over';
  const ranked = [...state.turnOrder].sort((a, b) => state.players[b].cash - state.players[a].cash || state.turnOrder.indexOf(a) - state.turnOrder.indexOf(b));
  state.winner = ranked[0];
  events.push({ type: 'gameOver', winner: ranked[0] });
}

// ---------------------------------------------------------------- actions

function handle(state: GameState, p: Player, a: Action, events: GameEvent[]): void {
  const phase = state.phase;
  const step = WORK_STEPS[state.workStep];
  const expect = (cond: boolean, msg: string) => cond || fail(msg);

  switch (a.type) {
    case 'pass':
      expect(phase === 'setup-restaurant' && state.setupRound === 1, 'Cannot pass now');
      state.passed.push(p.id);
      state.queue.shift();
      return;

    case 'placeRestaurant': {
      if (phase === 'setup-restaurant') {
        expect(restaurantSpotOk(state, occupancy(state), p.id, a.x, a.y, a.entrance, 'setup'), 'Invalid restaurant spot');
        addRestaurant(state, p, a.x, a.y, a.entrance, false);
        state.queue.shift();
        return;
      }
      expect(phase === 'working' && step === 'restaurants', 'Not the restaurant step');
      const type = useWorker(p, a.manager ?? -1, (t) => t === 'local-manager' || t === 'regional-manager');
      expect(p.restaurantsLeft > 0, 'No restaurants left');
      const mode = type === 'local-manager' ? 'local' : 'regional';
      expect(restaurantSpotOk(state, occupancy(state), p.id, a.x, a.y, a.entrance, mode), 'Invalid restaurant spot');
      addRestaurant(state, p, a.x, a.y, a.entrance, mode === 'local');
      return;
    }

    case 'moveRestaurant': {
      expect(phase === 'working' && step === 'restaurants', 'Not the restaurant step');
      const r = state.restaurants.find((x) => x.id === a.restaurant && x.owner === p.id) ?? fail('Not your restaurant');
      useWorker(p, a.manager, (t) => t === 'regional-manager');
      state.restaurants = state.restaurants.filter((x) => x !== r);
      expect(restaurantSpotOk(state, occupancy(state), p.id, a.x, a.y, a.entrance, 'regional'), 'Invalid restaurant spot');
      state.restaurants.push({ ...r, x: a.x, y: a.y, entrance: a.entrance, comingSoon: false });
      return;
    }

    case 'chooseReserve':
      expect(phase === 'setup-reserve', 'Not choosing reserve');
      expect(Number.isInteger(a.index) && a.index >= 0 && a.index < RESERVE_CARDS.length, 'Invalid reserve card');
      p.reserve = a.index;
      state.queue.shift();
      return;

    case 'restructure': {
      expect(phase === 'restructuring', 'Not restructuring');
      const uids = [...new Set([ceoUid(p), ...a.atWork])];
      expect(uids.every((u) => card(p, u) && !card(p, u)!.busyWith), 'Unknown or busy card');
      expect(structureFits(state, p, uids), 'Structure does not fit the pyramid');
      p.pendingAtWork = uids;
      state.queue.shift();
      return;
    }

    case 'chooseOrder':
      expect(phase === 'order-of-business', 'Not choosing order');
      expect(state.orderPicks[a.position] === null, 'Position taken');
      state.orderPicks[a.position] = p.id;
      state.queue.shift();
      return;

    case 'endStep':
      expect(phase === 'working', 'Not working');
      state.workStep++;
      return;

    case 'recruit': {
      expect(phase === 'working' && step === 'recruit', 'Not the recruit step');
      expect(recruitActions(p) > p.turn.recruitsUsed, 'No recruit actions left');
      expect(EMPLOYEES[a.employee]?.entry === true, 'Not an entry-level employee');
      expect(!!giveCard(state, p, a.employee), 'None left in stock');
      p.turn.recruitsUsed++;
      p.turn.hired++;
      if (p.turn.hired >= 3 && claimMilestone(state, p, 'first-to-hire-3-in-turn', events)) {
        giveCard(state, p, 'management-trainee');
        giveCard(state, p, 'management-trainee');
      }
      return;
    }

    case 'train': {
      expect(phase === 'working' && step === 'train', 'Not the train step');
      expect(p.atWork.includes(a.trainer) && trainerSlotsLeft(p, a.trainer) > 0, 'Trainer unavailable');
      const c = card(p, a.card) ?? fail('Unknown card');
      expect(!c.busyWith && !p.atWork.includes(c.uid), 'Only cards on the beach can be trained');
      expect(EMPLOYEES[c.type].trainsInto.includes(a.to), 'Invalid career step');
      expect(state.supply[a.to] > 0, 'None left in stock');
      expect(!(EMPLOYEES[a.to].topPosition && ownsType(p, a.to)), 'Only one copy of a top position');
      expect(!(a.to === 'cfo' && has(p, 'first-to-have-100')), 'Cannot train a CFO after "First to have $100"');
      const by = p.turn.trainedBy[c.uid] ?? [];
      const sameTrainer = by.every((t) => t === a.trainer) && (EMPLOYEES[typeOf(p, a.trainer)].trainingSlots ?? 0) > 1;
      expect(!by.length || sameTrainer || hasActive(state, p, 'first-to-pay-20-salaries'), 'Already trained this turn');
      state.supply[c.type]++;
      state.supply[a.to]--;
      c.type = a.to;
      p.turn.trainedBy[c.uid] = [...by, a.trainer];
      p.turn.trainerUse[a.trainer] = (p.turn.trainerUse[a.trainer] ?? 0) + 1;
      claimMilestone(state, p, 'first-to-train-someone', events);
      return;
    }

    case 'campaign': {
      expect(phase === 'working' && step === 'marketing', 'Not the marketing step');
      const type = useWorker(p, a.marketeer, isMarketeer);
      const def = EMPLOYEES[type];
      const tile = CAMPAIGN_TILES.find((t) => t.number === a.tile) ?? fail('Unknown campaign tile');
      expect(state.campaignTiles.includes(a.tile), 'Campaign tile in use');
      expect(def.campaignTypes!.includes(tile.type), 'Marketeer cannot place this campaign');
      expect(Number.isInteger(a.duration) && a.duration >= 1 && a.duration <= def.maxDuration!, 'Invalid duration');
      expect(GOODS.includes(a.good), 'Invalid good');
      const campaign = { number: a.tile, type: tile.type, owner: p.id, marketeer: a.marketeer, good: a.good, remaining: a.duration, eternal: false } as GameState['campaigns'][number];
      if (tile.type === 'airplane') {
        const band = a.band ?? fail('Airplane needs a band');
        const limit = band.axis === 'row' ? state.map.height : state.map.width;
        expect(band.start >= 0 && band.start + tile.size! <= limit, 'Airplane off the board');
        campaign.band = { axis: band.axis, start: band.start, size: tile.size! };
      } else {
        const r = a.rect ?? fail('Campaign needs a position');
        expect((r.w === tile.w && r.h === tile.h) || (r.w === tile.h && r.h === tile.w), 'Wrong campaign footprint');
        const range = def.rangeUnlimited ? null : def.range!;
        const cost = range === null ? undefined : roadCosts(state.map, chainEntrances(state, p.id, true));
        expect(campaignRectOk(state, occupancy(state), r, range, cost), 'Invalid campaign spot');
        campaign.rect = { x: r.x, y: r.y, w: r.w, h: r.h };
      }
      const typeMilestone = { billboard: 'first-billboard-placed', airplane: 'first-airplane-campaign', radio: 'first-radio-campaign', mailbox: '' }[tile.type];
      if (typeMilestone) claimMilestone(state, p, typeMilestone, events);
      const goodMilestone = a.good === 'burger' ? 'first-burger-marketed' : a.good === 'pizza' ? 'first-pizza-marketed' : 'first-drink-marketed';
      claimMilestone(state, p, goodMilestone, events);
      campaign.eternal = has(p, 'first-billboard-placed');
      state.campaigns.push(campaign);
      state.campaignTiles = state.campaignTiles.filter((n) => n !== a.tile);
      p.atWork = p.atWork.filter((u) => u !== a.marketeer);
      if (campaign.eternal) p.cards = p.cards.filter((c) => c.uid !== a.marketeer);
      else card(p, a.marketeer)!.busyWith = a.tile;
      return;
    }

    case 'produce': {
      expect(phase === 'working' && step === 'food', 'Not the food step');
      const type = useWorker(p, a.card, (t) => EMPLOYEES[t].category === 'kitchen');
      const prod = EMPLOYEES[type].produces!;
      let made: Partial<Record<Good, number>>;
      if (prod.chooseOne) {
        expect(a.good === 'burger' || a.good === 'pizza', 'Choose burger or pizza');
        made = { [a.good!]: 1 };
      } else made = prod;
      for (const [g, n] of Object.entries(made) as [Good, number][]) {
        p.stock[g] += n;
        if (n > 0 && g === 'burger' && claimMilestone(state, p, 'first-burger-produced', events)) giveCard(state, p, 'burger-cook');
        if (n > 0 && g === 'pizza' && claimMilestone(state, p, 'first-pizza-produced', events)) giveCard(state, p, 'pizza-cook');
      }
      return;
    }

    case 'buyDrinks': {
      expect(phase === 'working' && step === 'food', 'Not the food step');
      const type = useWorker(p, a.card, (t) => EMPLOYEES[t].category === 'buyer');
      const bonus = has(p, 'first-errand-boy-played') ? 1 : 0;
      if (type === 'errand-boy') {
        expect(a.drink === 'softdrink' || a.drink === 'beer' || a.drink === 'lemonade', 'Choose a drink');
        p.stock[a.drink!] += 1 + bonus;
        return;
      }
      const mask = a.route.reduce((m, i) => m | (1 << i), 0);
      expect(buyerOptions(state, p, type).some((o) => (o & mask) === mask), 'Route not reachable');
      for (const s of maskToSources(state.map, mask)) p.stock[s.drink] += EMPLOYEES[type].drinksPerSource! + bonus;
      return;
    }

    case 'placeHouse': {
      expect(phase === 'working' && step === 'houses', 'Not the houses step');
      useWorker(p, a.card, (t) => t === 'new-business-developer');
      expect(state.houseNumbers.includes(a.number) && state.gardensLeft > 0, 'House tile unavailable');
      const occ = occupancy(state);
      const h = a.house;
      expect(h.w === 2 && h.h === 2 && isRectFree(state, occ, h) && isRectFree(state, occ, a.garden) && gardenFits(h, a.garden), 'Invalid house spot');
      expect(adjacentRoads(state.map, [...rectSquares(h), ...rectSquares(a.garden)]).length > 0, 'House must touch a road');
      state.houses.push({ number: a.number, x: h.x, y: h.y, garden: { ...a.garden }, printed: false, demand: [] });
      state.houseNumbers = state.houseNumbers.filter((n) => n !== a.number);
      state.gardensLeft--;
      return;
    }

    case 'placeGarden': {
      expect(phase === 'working' && step === 'houses', 'Not the houses step');
      useWorker(p, a.card, (t) => t === 'new-business-developer');
      const h = state.houses.find((x) => x.number === a.house) ?? fail('Unknown house');
      expect(h.printed && !h.garden && state.gardensLeft > 0, 'House cannot get a garden');
      expect(gardenFits(h, a.garden) && isRectFree(state, occupancy(state), a.garden), 'Invalid garden spot');
      h.garden = { ...a.garden };
      state.gardensLeft--;
      return;
    }

    case 'fire': {
      expect(phase === 'payday', 'Not payday');
      const c = card(p, a.card) ?? fail('Unknown card');
      expect(c.type !== 'ceo', 'Cannot fire the CEO');
      if (c.busyWith) {
        const others = p.cards.some((x) => !x.busyWith && EMPLOYEES[x.type].salary);
        expect(p.cash < salaryDue(p) && !others, 'Busy marketeers can only be fired if salaries cannot be paid');
      }
      fire(state, p, c.uid);
      return;
    }

    case 'endPayday':
      expect(phase === 'payday', 'Not payday');
      finishPayday(state, p, events);
      state.queue.shift();
      return;
  }
}

/** Marks an at-work card's action as used and returns its type. */
function useWorker(p: Player, uid: number, pred: (type: string) => boolean): string {
  const type = typeOf(p, uid);
  if (!p.atWork.includes(uid) || !pred(type)) fail('That employee cannot do this');
  if (p.turn.used.includes(uid)) fail('Employee already used this turn');
  p.turn.used.push(uid);
  return type;
}

function addRestaurant(state: GameState, p: Player, x: number, y: number, entrance: number, comingSoon: boolean): void {
  if (p.restaurantsLeft <= 0) fail('No restaurants left');
  state.restaurants.push({ id: state.nextRestaurantId++, owner: p.id, x, y, entrance, comingSoon });
  p.restaurantsLeft--;
}
