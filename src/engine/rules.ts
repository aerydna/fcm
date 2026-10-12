import { CONFIG, EMPLOYEES, isManager, isMarketeer } from './data';
import type { Card, GameEvent, GameState, Player } from './types';

export const card = (p: Player, uid: number): Card | undefined => p.cards.find((c) => c.uid === uid);
export const typeOf = (p: Player, uid: number) => card(p, uid)?.type ?? '';
export const workTypes = (p: Player) => p.atWork.map((uid) => typeOf(p, uid));
export const isAtWork = (p: Player, uid: number) => p.atWork.includes(uid);
export const has = (p: Player, milestone: string) => p.milestones.includes(milestone);

/** Milestone effect active (some apply only from the turn after claiming). */
export const hasActive = (state: GameState, p: Player, milestone: string) =>
  has(p, milestone) && (milestone !== 'first-to-have-100' || p.milestoneRound[milestone] < state.round);

export const ceoUid = (p: Player) => p.cards.find((c) => c.type === 'ceo')!.uid;

/** Cards on the beach: owned, not at work, not busy. */
export const beach = (p: Player) => p.cards.filter((c) => !c.busyWith && !p.atWork.includes(c.uid));

export function unitPrice(state: GameState, p: Player): number {
  let price = CONFIG.unitPriceBase;
  for (const t of workTypes(p)) price += EMPLOYEES[t].priceModifier ?? 0;
  if (hasActive(state, p, 'first-to-lower-prices')) price += CONFIG.unitPriceModifiers.firstToLowerPricesMilestone;
  return Math.max(0, price);
}

export const waitresses = (p: Player) => workTypes(p).filter((t) => t === 'waitress').length;

export const hasCfo = (state: GameState, p: Player) =>
  workTypes(p).includes('cfo') || hasActive(state, p, 'first-to-have-100');

/** Validates a structure: managers under the CEO, staff under CEO or managers. */
export function structureFits(state: GameState, p: Player, uids: readonly number[]): boolean {
  const types = uids.map((u) => typeOf(p, u)).filter((t) => t && t !== 'ceo');
  const managers = types.filter(isManager);
  const staff = types.length - managers.length;
  if (managers.length > state.ceoSlots) return false;
  const capacity = state.ceoSlots - managers.length + managers.reduce((s, t) => s + (EMPLOYEES[t].slots ?? 0), 0);
  return staff <= capacity;
}

export function openSlots(state: GameState, p: Player): number {
  const types = workTypes(p).filter((t) => t !== 'ceo');
  const managers = types.filter(isManager);
  const capacity = state.ceoSlots + managers.reduce((s, t) => s + (EMPLOYEES[t].slots ?? 0), 0);
  const bonus = has(p, 'first-airplane-campaign') ? 2 : 0;
  return capacity - types.length + bonus;
}

export const recruitActions = (p: Player) =>
  workTypes(p).reduce((s, t) => s + (EMPLOYEES[t].recruitActions ?? 0), 0);

/** Recruit actions from recruiting managers / HR directors (unused ones become salary discounts). */
const discountableRecruits = (p: Player) =>
  workTypes(p).reduce((s, t) => s + (t === 'recruiting-manager' || t === 'hr-director' ? EMPLOYEES[t].recruitActions! : 0), 0);

export function salaryDue(p: Player): number {
  const eternalMarketing = has(p, 'first-billboard-placed');
  const salaried = p.cards.filter((c) => EMPLOYEES[c.type].salary && !(eternalMarketing && isMarketeer(c.type))).length;
  const unused = Math.min(discountableRecruits(p), recruitActions(p) - p.turn.recruitsUsed);
  let discount = Math.max(0, unused) * CONFIG.salaryPerCard;
  if (has(p, 'first-to-train-someone')) discount += 15;
  return Math.max(0, salaried * CONFIG.salaryPerCard - discount);
}

export function claimMilestone(state: GameState, p: Player, id: string, events: GameEvent[]): boolean {
  if (!state.milestoneAvailable[id] || has(p, id)) return false;
  p.milestones.push(id);
  p.milestoneRound[id] = state.round;
  if (!state.milestonesThisTurn.includes(id)) state.milestonesThisTurn.push(id);
  events.push({ type: 'milestone', player: p.id, milestone: id });
  return true;
}

export function giveCard(state: GameState, p: Player, type: string): Card | undefined {
  if ((state.supply[type] ?? 0) <= 0) return undefined;
  state.supply[type]--;
  const c = { uid: state.nextUid++, type };
  p.cards.push(c);
  return c;
}

export const ownsType = (p: Player, type: string) => p.cards.some((c) => c.type === type);

/** Pays from the bank during Dinnertime, breaking it when empty. */
export function payFromBank(state: GameState, p: Player, amount: number, reason: string, events: GameEvent[]): void {
  if (amount <= 0) return;
  if (state.bank < amount && state.bankBreaks === 0) breakBank(state, events);
  if (state.bank < amount && state.bankBreaks === 1) {
    state.bankBreaks = 2;
    events.push({ type: 'bankBroken', times: 2, added: 0 });
  }
  state.bank -= amount;
  p.cash += amount;
  events.push({ type: 'income', player: p.id, amount, reason });
}

function breakBank(state: GameState, events: GameEvent[]): void {
  const cards = state.players.map((p) => CONFIG.bankReserveCards.cards[p.reserve ?? 0]);
  const added = cards.reduce((s, c) => s + c.money, 0);
  const counts = new Map<number, number>();
  cards.forEach((c) => counts.set(c.ceoSlots, (counts.get(c.ceoSlots) ?? 0) + 1));
  let slots = 0;
  let best = -1;
  for (const [s, n] of counts) if (n > best || (n === best && s > slots)) [slots, best] = [s, n];
  state.bank += added;
  state.bankBreaks = 1;
  state.ceoSlotsNext = slots;
  state.revealedReserves = state.players.map((p) => p.reserve ?? 0);
  events.push({ type: 'bankBroken', times: 1, added });
}
