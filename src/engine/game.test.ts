import { describe, expect, it } from 'vitest';
import { dinnertime } from './dinnertime';
import { apply, newGame } from './game';
import { roadRouteOptions } from './geometry';
import { legalActions } from './legal';
import { buildMap } from './map';
import { resolveMarketing } from './marketing';
import { seededRandom } from './rng';
import { payFromBank, structureFits } from './rules';
import type { Action, GameEvent, GameState } from './types';

const CHAINS = ['golden-duck-diner', 'santa-maria-pizza', 'xango-blues-bar'];

/** A 3-player game on a fixed 1x2 map: tile A (house #2 bottom-left) above tile L (lemonade). */
function fixture(): GameState {
  const s = newGame({ seed: 7, chains: CHAINS });
  s.map = buildMap(
    [
      { id: 'A', rotation: 0, col: 0, row: 0 },
      { id: 'L', rotation: 0, col: 0, row: 1 },
    ],
    1,
    2,
  );
  s.houses = [{ number: 2, x: 0, y: 3, printed: true, demand: [] }];
  s.restaurants = [];
  s.turnOrder = [0, 1, 2];
  return s;
}

const addCard = (s: GameState, player: number, type: string, atWork = true) => {
  const uid = s.nextUid++;
  s.players[player].cards.push({ uid, type });
  if (atWork) s.players[player].atWork.push(uid);
  return uid;
};

describe('dinnertime', () => {
  it('reproduces the rulebook worked example ($125)', () => {
    const s = fixture();
    s.houses[0].garden = { x: 0, y: 5, w: 2, h: 1 };
    s.houses[0].demand = ['burger', 'beer', 'beer'];
    s.restaurants.push({ id: 1, owner: 0, x: 3, y: 0, entrance: 3, comingSoon: false });
    const p = s.players[0];
    p.atWork = [p.cards[0].uid];
    addCard(s, 0, 'luxuries-manager');
    p.milestones.push('first-burger-marketed');
    p.stock.burger = 1;
    p.stock.beer = 2;
    dinnertime(s, []);
    expect(p.cash).toBe(125);
    expect(s.houses[0].demand).toEqual([]);
  });

  it('picks the lowest price + distance, waitresses break ties', () => {
    const s = fixture();
    s.houses[0].demand = ['burger'];
    s.restaurants.push({ id: 1, owner: 0, x: 3, y: 0, entrance: 3, comingSoon: false });
    s.restaurants.push({ id: 2, owner: 1, x: 3, y: 5, entrance: 0, comingSoon: false });
    for (const p of s.players) {
      p.atWork = [p.cards[0].uid];
      p.stock.burger = 1;
    }
    addCard(s, 1, 'waitress');
    dinnertime(s, []);
    // Same price; player 0 is at distance 0, player 1 one tile away.
    expect(s.players[0].cash).toBe(10);

    s.houses[0].demand = ['burger'];
    s.players[0].stock.burger = 1;
    addCard(s, 1, 'pricing-manager');
    dinnertime(s, []);
    // 9 + 1 ties 10 + 0; player 1 has more waitresses. Plus $3 tips per dinner.
    expect(s.players[0].cash).toBe(10);
    expect(s.players[1].cash).toBe(3 + 9 + 3);
  });

  it('breaks the bank once and sets CEO slots by majority (ties -> higher)', () => {
    const s = fixture();
    s.players[0].reserve = 0;
    s.players[1].reserve = 2;
    s.players[2].reserve = 1;
    s.bank = 5;
    const events: GameEvent[] = [];
    payFromBank(s, s.players[0], 10, 'test', events);
    expect(s.bankBreaks).toBe(1);
    expect(s.bank).toBe(5 + 600 - 10);
    expect(s.ceoSlotsNext).toBe(4);
  });
});

describe('marketing', () => {
  it('billboard adjacent to a house adds demand up to the cap', () => {
    const s = fixture();
    s.campaigns.push({ number: 11, type: 'billboard', owner: 0, marketeer: 999, good: 'pizza', remaining: 5, eternal: false, rect: { x: 0, y: 1, w: 2, h: 1 } });
    // Row 1 is not adjacent to house rows 3-4 (row 2 is road): no demand.
    resolveMarketing(s, []);
    expect(s.houses[0].demand).toEqual([]);
    s.campaigns = [{ number: 12, type: 'mailbox', owner: 0, marketeer: 999, good: 'pizza', remaining: 5, eternal: false, rect: { x: 0, y: 5, w: 2, h: 2 } }];
    for (let i = 0; i < 4; i++) resolveMarketing(s, []);
    expect(s.houses[0].demand).toEqual(['pizza', 'pizza', 'pizza']);
  });
});

describe('structure', () => {
  it('CEO with 2 management trainees fits 5 staff', () => {
    const s = fixture();
    const p = s.players[0];
    const ids = [p.cards[0].uid, addCard(s, 0, 'management-trainee', false), addCard(s, 0, 'management-trainee', false)];
    for (let i = 0; i < 5; i++) ids.push(addCard(s, 0, 'waitress', false));
    expect(structureFits(s, p, ids)).toBe(true);
    ids.push(addCard(s, 0, 'waitress', false));
    expect(structureFits(s, p, ids)).toBe(false);
  });
});

describe('drink routes', () => {
  it('cart operator collects the lemonade next to the road', () => {
    const s = fixture();
    const options = roadRouteOptions(s.map, [[3, 1]], 2);
    expect(options).toEqual([1]);
  });
});

describe('random playout', () => {
  it('plays many rounds with legal moves only', () => {
    const rnd = seededRandom(123);
    let s = newGame({ seed: 99, chains: CHAINS });
    let steps = 0;
    while (s.phase !== 'game-over' && s.round <= 12 && steps < 5000) {
      const actions = legalActions(s);
      expect(actions.length).toBeGreaterThan(0);
      const nonEnd = actions.filter((a) => a.type !== 'endStep' && a.type !== 'pass');
      const pool: Action[] = nonEnd.length && rnd() < 0.8 ? nonEnd : actions;
      s = apply(s, s.active!, pool[Math.floor(rnd() * pool.length)]).state;
      steps++;
    }
    expect(s.round).toBeGreaterThan(3);
    for (const p of s.players) expect(p.cash).toBeGreaterThanOrEqual(0);
  }, 60_000);
});
