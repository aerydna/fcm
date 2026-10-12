import { EMPLOYEES, isManager } from '../engine/data';
import type { Card, GameState, Player } from '../engine/types';

export interface PyramidNode {
  card: Card;
  slots: (Card | null)[];
}

export interface Pyramid {
  ceo: Card;
  /** CEO slots: managers (with their own slots) or staff, null = open. */
  top: (PyramidNode | null)[];
  /** Selected cards that do not fit. */
  overflow: Card[];
}

/** Derives a company pyramid: managers under the CEO, staff filling CEO slots first, then managers. */
export function pyramidOf(state: GameState, p: Player, atWork: readonly number[] = p.atWork): Pyramid {
  const ceo = p.cards.find((c) => c.type === 'ceo')!;
  const cards = atWork.map((u) => p.cards.find((c) => c.uid === u)).filter((c): c is Card => !!c && c.type !== 'ceo');
  const managers = cards.filter((c) => isManager(c.type)).sort((a, b) => (EMPLOYEES[b.type].slots ?? 0) - (EMPLOYEES[a.type].slots ?? 0));
  const staff = cards.filter((c) => !isManager(c.type));
  const top: (PyramidNode | null)[] = managers.slice(0, state.ceoSlots).map((m) => ({ card: m, slots: new Array(EMPLOYEES[m.type].slots ?? 0).fill(null) }));
  let i = 0;
  while (top.length < state.ceoSlots && i < staff.length) top.push({ card: staff[i++], slots: [] });
  for (const m of top) {
    if (!m) continue;
    for (let k = 0; k < m.slots.length && i < staff.length; k++) m.slots[k] = staff[i++];
  }
  while (top.length < state.ceoSlots) top.push(null);
  return { ceo, top, overflow: [...managers.slice(state.ceoSlots), ...staff.slice(i)] };
}
