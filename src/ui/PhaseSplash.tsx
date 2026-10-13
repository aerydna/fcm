import { useEffect, useState } from 'react';
import { GOODS } from '../engine/data';
import { stepBlocker } from '../engine/game';
import { salaryDue } from '../engine/rules';
import type { GameEvent, GameState, PlayerId } from '../engine/types';
import { GOOD_ICON } from './icons';
import { chainName, STEP_LABEL } from './labels';

export interface SplashRow {
  icon?: string;
  label: string;
  value?: string;
  tone?: 'me' | 'good' | 'bad' | 'muted' | 'head';
}

export interface Splash {
  id: number;
  kicker?: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: 'day' | 'dusk' | 'night' | 'round' | 'skipped';
  /** Reason shown with a no-entry sign when the phase did not happen for you. */
  skipped?: string;
  rows?: SplashRow[];
}

export type SequenceStep = { kind: 'splash'; splash: Splash; phase?: string } | { kind: 'dinner' } | { kind: 'demand' };

export const SPLASH_MS = 3200;
let seq = 0;
const ordinal = (i: number) => `${i + 1}${['st', 'nd', 'rd'][i] ?? 'th'}`;
const goods = (list: readonly string[]) => list.map((g) => GOOD_ICON[g as keyof typeof GOOD_ICON]).join('');

/** Turns one batch of engine events into splash screens and animation steps, in order. */
export function buildSequence(events: GameEvent[], before: GameState | undefined, after: GameState, me: PlayerId): SequenceStep[] {
  const out: SequenceStep[] = [];
  const name = (id: PlayerId) => (id === me ? 'You' : chainName(after, id));
  const mySkip = (phase: string) => events.find((e): e is Extract<GameEvent, { type: 'skipped' }> => e.type === 'skipped' && e.player === me && e.phase === phase && e.step === undefined);
  const push = (s: Omit<Splash, 'id'>, phase?: string) => out.push({ kind: 'splash', splash: { id: ++seq, ...s }, phase });
  const pickOrder = events.find((e): e is Extract<GameEvent, { type: 'pickOrder' }> => e.type === 'pickOrder');
  const turnOrder = events.find((e): e is Extract<GameEvent, { type: 'turnOrder' }> => e.type === 'turnOrder');
  const hasWorking = events.some((e) => e.type === 'phase' && e.phase === 'working');
  const served = events.filter((e) => e.type === 'served').length;
  const demand = events.filter((e): e is Extract<GameEvent, { type: 'demand' }> => e.type === 'demand');
  const p = after.players[me];

  for (const e of events) {
    if (e.type === 'gameOver') {
      const ranking = [...after.players].sort((a, b) => b.cash - a.cash);
      push({ kicker: 'Game over', title: `${chainName(after, e.winner)} wins`, subtitle: 'The bank broke for the second time.', icon: '🏆', tone: 'round', rows: ranking.map((pl, i) => ({ icon: ['🥇', '🥈', '🥉'][i], label: chainName(after, pl.id), value: `$${pl.cash}`, tone: pl.id === me ? 'me' : undefined })) });
      continue;
    }
    if (e.type === 'skipped' && e.player === me && e.phase === 'working' && !hasWorking) {
      const steps = events.filter((x): x is Extract<GameEvent, { type: 'skipped' }> => x.type === 'skipped' && x.player === me && x.phase === 'working');
      if (steps[0] !== e) continue;
      const next = after.phase === 'working' && after.active === me ? `Next: ${STEP_LABEL[after.workStep]}` : 'Your Working 9-5 is over.';
      push({ kicker: 'Working 9-5', title: steps.length > 1 ? 'Steps skipped' : `${STEP_LABEL[e.step!]} skipped`, subtitle: next, icon: '🚫', tone: 'skipped', skipped: steps.length === 1 ? e.reason : undefined, rows: steps.length > 1 ? steps.map((s) => ({ icon: '🚫', label: STEP_LABEL[s.step!], value: s.reason, tone: 'bad' })) : undefined });
      continue;
    }
    if (e.type !== 'phase') continue;

    switch (e.phase) {
      case 'restructuring': {
        push({ kicker: 'Round', title: String(e.round), subtitle: 'A new day in the fast-food business', icon: '☀️', tone: 'round', rows: [
          { icon: '🏦', label: 'Bank', value: `$${after.bank}${after.bankBreaks ? ` (broken ×${after.bankBreaks})` : ''}` },
          { icon: '👑', label: 'CEO slots', value: String(after.ceoSlots) },
          ...after.turnOrder.map((id) => ({ icon: '💰', label: name(id), value: `$${after.players[id].cash}`, tone: id === me ? ('me' as const) : undefined })),
        ] });
        const skip = mySkip('restructuring');
        push({ title: 'Restructuring', subtitle: skip ? 'Nothing to decide this time' : 'Choose who works this turn (secretly)', icon: '🗂️', tone: skip ? 'skipped' : 'day', skipped: skip?.reason }, 'restructuring');
        break;
      }
      case 'order-of-business': {
        const skip = mySkip('order-of-business');
        const tie = pickOrder && new Set(pickOrder.queue.map((q) => q.openSlots)).size < pickOrder.queue.length;
        push({ title: 'Order of Business', subtitle: skip ? 'Your position was assigned' : 'Most open slots picks the turn order first', icon: '🔢', tone: skip ? 'skipped' : 'day', skipped: skip?.reason, rows: [
          ...(pickOrder?.queue.map((q, i) => ({ icon: ordinal(i), label: `${name(q.player)} ${q.player === me ? 'pick' : 'picks'}`, value: `${q.openSlots} open slot${q.openSlots === 1 ? '' : 's'}`, tone: q.player === me ? ('me' as const) : undefined })) ?? []),
          ...(tie ? [{ icon: '⚖️', label: 'Ties', value: 'broken by last round\'s turn order', tone: 'muted' as const }] : []),
        ] }, 'order-of-business');
        break;
      }
      case 'working': {
        const order = (turnOrder?.order ?? after.turnOrder).map((id, i) => ({ icon: ordinal(i), label: name(id), value: id === me ? 'you play here' : '', tone: id === me ? ('me' as const) : undefined }));
        const steps = STEP_LABEL.map((label, i) => {
          const why = stepBlocker(after, p, i);
          return { icon: why ? '🚫' : '✅', label, value: why ?? 'available', tone: why ? ('bad' as const) : ('good' as const) };
        });
        push({ title: 'Working 9-5', subtitle: 'Turn order this round, and what you can do', icon: '🏭', tone: 'day', rows: [{ label: 'Turn order', tone: 'head' }, ...order, { label: 'Your steps', tone: 'head' }, ...steps] }, 'working');
        break;
      }
      case 'dinnertime': {
        const hungry = (before ?? after).houses.filter((h) => h.demand.length);
        const rows = hungry.slice(0, 7).map((h) => ({ icon: '🏠', label: `House #${h.number}`, value: `wants ${goods(h.demand)}` }));
        if (!served) {
          push({ title: 'Dinnertime', subtitle: 'Nobody went out to eat', icon: '🍽️', tone: 'skipped', skipped: hungry.length ? 'No chain had the whole order in stock with a road to the house. Hover a house to see why.' : 'No house has demand yet: run marketing campaigns first.', rows }, 'dinnertime');
        } else {
          push({ title: 'Dinnertime', subtitle: `${hungry.length} house${hungry.length === 1 ? '' : 's'} go${hungry.length === 1 ? 'es' : ''} out to eat: watch the cars`, icon: '🍽️', tone: 'dusk', rows }, 'dinnertime');
          out.push({ kind: 'dinner' });
        }
        break;
      }
      case 'payday': {
        const skip = mySkip('payday');
        const paid = events.filter((x): x is Extract<GameEvent, { type: 'salaries' }> => x.type === 'salaries');
        const rows: SplashRow[] = paid.map((x) => ({ icon: '💵', label: name(x.player), value: `paid $${x.amount}`, tone: x.player === me ? 'me' : undefined }));
        if (!skip && after.phase === 'payday') rows.push({ icon: '👉', label: 'You', value: `owe $${salaryDue(p)}: fire people or pay`, tone: 'me' });
        push({ title: 'Payday', subtitle: '$5 for every salaried employee', icon: '💵', tone: skip ? 'skipped' : 'dusk', skipped: skip?.reason, rows }, 'payday');
        break;
      }
      case 'marketing-campaigns': {
        const active = (before ?? after).campaigns.length;
        if (!demand.length) {
          push({ title: 'Marketing', subtitle: 'No new demand', icon: '📣', tone: 'skipped', skipped: active ? 'Campaigns reached only full houses or no houses.' : 'No campaign is running on the map.' }, 'marketing-campaigns');
        } else {
          const byHouse = new Map<number, string[]>();
          for (const d of demand) byHouse.set(d.house, [...(byHouse.get(d.house) ?? []), d.good]);
          push({ title: 'Marketing', subtitle: `${demand.length} new demand token${demand.length === 1 ? '' : 's'} on the houses`, icon: '📣', tone: 'night', rows: [...byHouse].slice(0, 7).map(([h, g]) => ({ icon: '🏠', label: `House #${h}`, value: `+${goods(g)}` })) }, 'marketing-campaigns');
          out.push({ kind: 'demand' });
        }
        break;
      }
      case 'clean-up': {
        const lost = before ? GOODS.filter((g) => before.players[me].stock[g] > after.players[me].stock[g]) : [];
        push({ title: 'Clean-up', subtitle: 'Leftovers out, coming-soon restaurants open', icon: '🧹', tone: 'night', rows: [
          lost.length ? { icon: '🗑️', label: 'You threw away', value: lost.map((g) => `${GOOD_ICON[g]}×${before!.players[me].stock[g] - after.players[me].stock[g]}`).join(' '), tone: 'bad' } : { icon: '✨', label: 'You threw away', value: 'nothing', tone: 'muted' },
        ] }, 'clean-up');
        break;
      }
    }
  }
  return out;
}

const AUTO_KEY = 'fcm.autoSplash';

export function PhaseSplash({ splash, onDone }: { splash: Splash; onDone: () => void }) {
  const [auto, setAuto] = useState(() => localStorage.getItem(AUTO_KEY) === '1');

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', key);
    const t = auto ? setTimeout(onDone, SPLASH_MS + (splash.rows?.length ?? 0) * 250) : undefined;
    return () => {
      window.removeEventListener('keydown', key);
      if (t) clearTimeout(t);
    };
  }, [splash.id, onDone, auto]);

  const toggle = () => {
    localStorage.setItem(AUTO_KEY, auto ? '0' : '1');
    setAuto(!auto);
  };

  return (
    <div key={splash.id} className={`splash ${splash.tone} ${splash.tone === 'round' ? 'big' : 'calm'}`}>
      {splash.tone === 'round' && <div className="splash-rays" />}
      <div className="splash-card">
        <span className="splash-icon">{splash.icon}</span>
        {splash.kicker && <span className="splash-kicker">{splash.kicker}</span>}
        <h1 className={splash.skipped ? 'struck' : ''}>{splash.title}</h1>
        {splash.skipped && (
          <div className="skip-badge">
            <span className="no-entry" />
            <div>
              <b>Skipped</b>
              <span>{splash.skipped}</span>
            </div>
          </div>
        )}
        <p>{splash.subtitle}</p>
        {splash.rows && splash.rows.length > 0 && (
          <ul className="splash-rows">
            {splash.rows.map((r, i) => (
              <li key={i} className={r.tone ?? ''} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
                {r.icon && <span className="row-icon">{r.icon}</span>}
                <span className="row-label">{r.label}</span>
                {r.value && <span className="row-value">{r.value}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="splash-actions">
          <button className="cta small" onClick={onDone} data-tip="Continue (Enter or Space)">
            Continue &rarr;
          </button>
          <label className="auto-toggle" data-tip="Close splash screens automatically after a few seconds">
            <input type="checkbox" checked={auto} onChange={toggle} /> auto-advance
          </label>
        </div>
      </div>
    </div>
  );
}
