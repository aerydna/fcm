import { EMPLOYEES } from '../engine/data';
import { buyerRange } from '../engine/game';
import { recruitActions, typeOf } from '../engine/rules';
import type { Player } from '../engine/types';

export interface Capability {
  icon: string;
  text: string;
  tip: string;
}

/** What a chain can still do this round, from its revealed structure. */
export function capabilities(p: Player, mine = false): Capability[] {
  if (!p.atWork.length && mine) return [{ icon: '🗂️', text: 'choosing', tip: 'Pick who works this turn in the Restructuring panel.' }];
  if (!p.atWork.length) {
    return [{ icon: '❔', text: 'hidden', tip: `Structure not revealed yet. Owns ${p.cards.length} card(s): ${[...new Set(p.cards.map((c) => EMPLOYEES[c.type].name))].join(', ')}.` }];
  }
  const free = p.atWork.filter((u) => !p.turn.used.includes(u));
  const types = free.map((u) => typeOf(p, u));
  const all = p.atWork.map((u) => typeOf(p, u));
  const out: Capability[] = [];

  const hires = recruitActions(p) - p.turn.recruitsUsed;
  if (hires > 0) out.push({ icon: '👤', text: `×${hires}`, tip: `Can hire ${hires} more employee(s) this turn.` });

  const training = all.reduce((s, t, i) => s + Math.max(0, (EMPLOYEES[t].trainingSlots ?? 0) - (p.turn.trainerUse[p.atWork[i]] ?? 0)), 0);
  if (training > 0) out.push({ icon: '🎓', text: `×${training}`, tip: `Can train ${training} step(s) this turn.` });

  const marketeers = types.filter((t) => EMPLOYEES[t].category === 'marketeer');
  if (marketeers.length) {
    const kinds = [...new Set(marketeers.flatMap((t) => EMPLOYEES[t].campaignTypes ?? []))];
    const short: Record<string, string> = { billboard: '🪧', mailbox: '📫', airplane: '✈️', radio: '📻' };
    out.push({ icon: '📣', text: kinds.map((k) => short[k]).join(''), tip: `${marketeers.length} marketeer(s) can start: ${kinds.join(', ')}.` });
  }

  let burger = 0;
  let pizza = 0;
  let either = 0;
  for (const t of types) {
    const prod = EMPLOYEES[t].produces;
    if (!prod) continue;
    if (prod.chooseOne) either++;
    else {
      burger += prod.burger ?? 0;
      pizza += prod.pizza ?? 0;
    }
  }
  if (burger || pizza || either) {
    const parts = [burger && `🍔${burger}`, pizza && `🍕${pizza}`, either && `🍔/🍕${either}`].filter(Boolean).join(' ');
    out.push({ icon: '🍳', text: parts, tip: `Kitchen can still produce: ${parts}.` });
  }

  const buyers = types.filter((t) => EMPLOYEES[t].category === 'buyer');
  if (buyers.length) {
    const range = Math.max(...buyers.map((t) => buyerRange(p, t)));
    out.push({ icon: '🚚', text: `×${buyers.length}`, tip: `${buyers.length} drink buyer(s), best range ${range}.` });
  }
  if (types.includes('new-business-developer')) out.push({ icon: '🏡', text: '', tip: 'Can place a new house or a garden.' });
  if (types.includes('regional-manager')) out.push({ icon: '🏪', text: 'any', tip: 'Regional manager: place or move a restaurant anywhere.' });
  else if (types.includes('local-manager') && p.restaurantsLeft > 0) out.push({ icon: '🏪', text: '≤3', tip: 'Local manager: new restaurant within 3 tiles.' });

  if (!out.length) out.push({ icon: '💤', text: 'done', tip: 'Nothing left to do this turn.' });
  return out;
}
