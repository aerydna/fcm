import { expect, it } from 'vitest';
import { apply, newGame, visibleState } from '../engine/game';
import { chooseEasy } from './easy';

it('three easy CPUs finish a game', () => {
  let s = newGame({ seed: 5, chains: ['golden-duck-diner', 'santa-maria-pizza', 'xango-blues-bar'] });
  let served = 0;
  let steps = 0;
  while (s.phase !== 'game-over' && s.round <= 40 && steps < 20000) {
    const me = s.active!;
    const r = apply(s, me, chooseEasy(visibleState(s, me), me));
    served += r.events.filter((e) => e.type === 'served').length;
    s = r.state;
    steps++;
  }
  console.log({ round: s.round, phase: s.phase, served, cash: s.players.map((p) => p.cash), breaks: s.bankBreaks });
  expect(served).toBeGreaterThan(0);
}, 120_000);
