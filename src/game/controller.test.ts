import { expect, it } from 'vitest';
import { chooseEasy } from '../ai/easy';
import { visibleState } from '../engine/game';
import { GameController, type Note } from './controller';

it('production notes report what was collected', async () => {
  const c = new GameController(11, ['golden-duck-diner', 'santa-maria-pizza', 'xango-blues-bar'], 'easy');
  const notes: Note[] = [];
  c.subscribe((_e, _s, n) => notes.push(...n));
  const internal = c as unknown as { state: import('../engine/types').GameState; commit: (p: number, a: unknown) => void };
  for (let i = 0; i < 3000 && internal.state.round < 6; i++) {
    const me = internal.state.active!;
    internal.commit(me, chooseEasy(visibleState(internal.state, me), me));
  }
  const prod = notes.filter((n) => n.kind === 'production');
  console.log(prod.slice(0, 12));
  expect(prod.some((n) => n.title === 'nothing collected')).toBe(false);
});

it('undo restores the state before your last actions, but not past a structure reveal', () => {
  const c = new GameController(5, ['golden-duck-diner', 'santa-maria-pizza', 'xango-blues-bar'], 'easy');
  const internal = c as unknown as { state: import('../engine/types').GameState; commit: (p: number, a: unknown) => void; runCpus: () => Promise<void> };
  internal.runCpus = async () => {};
  const step = () => {
    const me = internal.state.active!;
    if (me === c.human) c.act(chooseEasy(visibleState(internal.state, me), me));
    else internal.commit(me, chooseEasy(visibleState(internal.state, me), me));
  };
  while (!(internal.state.phase === 'working' && internal.state.round === 2 && internal.state.active === c.human)) step();
  const before = internal.state;
  step();
  step();
  expect(c.current.undo).not.toBeNull();
  expect(c.undo()).toBe(true);
  expect(c.undo()).toBe(true);
  expect(internal.state).toEqual(before);

  while (c.undo());
  expect(c.current.undo).toBeNull();
  expect(internal.state.round).toBe(2);
  expect(internal.state.phase).not.toBe('restructuring');
});
