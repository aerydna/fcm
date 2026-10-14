import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CAMPAIGN_TILES, CONFIG, EMPLOYEES } from '../engine/data';
import { apply } from '../engine/game';
import { typeOf } from '../engine/rules';
import type { Action, GameState, HouseState, PlayerId } from '../engine/types';
import { EmployeeCard } from './EmployeeCard';
import { GOOD_ICON, GOOD_NAME } from './icons';
import { CAMPAIGN_HELP, empName, MILESTONE_LABEL, MILESTONES_EFFECT } from './labels';

type Campaign = Extract<Action, { type: 'campaign' }>;

const ICON: Record<string, string> = { billboard: '🪧', mailbox: '📫', radio: '📻', airplane: '✈️' };

/** Summary of the campaign about to start; nothing happens until "Start campaign". */
export function CampaignConfirm({ view, me, c, houses, onCancel, onConfirm: confirmOnce }: { view: GameState; me: PlayerId; c: Campaign; houses: HouseState[]; onCancel: () => void; onConfirm: () => void }) {
  const fired = useRef(false);
  const onConfirm = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    confirmOnce();
  }, [confirmOnce]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCancel, onConfirm]);

  const p = view.players[me];
  const tile = CAMPAIGN_TILES.find((t) => t.number === c.tile)!;
  const marketeer = typeOf(p, c.marketeer);
  let preview: ReturnType<typeof apply> | null = null;
  try {
    preview = apply(view, me, c);
  } catch {
    preview = null;
  }
  const placed = preview?.state.campaigns.find((x) => x.number === c.tile);
  const milestones = preview?.events.filter((e): e is Extract<typeof e, { type: 'milestone' }> => e.type === 'milestone' && e.player === me) ?? [];
  const cap = (h: HouseState) => (h.garden ? CONFIG.houseDemandCapWithGarden : CONFIG.houseDemandCap);
  const open = houses.filter((h) => h.demand.length < cap(h));
  const food = c.good === 'burger' || c.good === 'pizza';
  const canSupply = p.stock[c.good] > 0 || p.cards.some((k) => {
    const d = EMPLOYEES[k.type];
    return food ? !!(d.produces?.chooseOne || d.produces?.[c.good as 'burger' | 'pizza']) : d.category === 'buyer';
  });

  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm" onClick={(e) => e.stopPropagation()}>
        <h2>Start this campaign?</h2>
        <div className="confirm-head">
          <span className="confirm-icon">{ICON[tile.type]}</span>
          <div>
            <b>
              {tile.type[0].toUpperCase() + tile.type.slice(1)} #{c.tile} for {GOOD_ICON[c.good]} {GOOD_NAME[c.good]}
            </b>
            <span>{CAMPAIGN_HELP[tile.type]}</span>
          </div>
        </div>
        <table className="confirm-facts">
          <tbody>
            <tr>
              <td>Marketeer</td>
              <td className="with-card">
                <EmployeeCard type={marketeer} mini /> {empName(marketeer)}
              </td>
            </tr>
            <tr>
              <td>Duration</td>
              <td>{placed?.eternal ? <b>Eternal (the marketeer leaves your company)</b> : <>{c.duration} turn{c.duration === 1 ? '' : 's'}: the marketeer is busy until it ends{EMPLOYEES[marketeer].salary ? ' and still costs $5 per payday' : ''}</>}</td>
            </tr>
            <tr>
              <td>When</td>
              <td>Demand appears in the Marketing phase, after Dinnertime and Payday. Lower numbers go first (#{c.tile}).</td>
            </tr>
            <tr>
              <td>Houses</td>
              <td>
                {houses.length ? (
                  <div className="confirm-houses">
                    {houses.map((h) => (
                      <span key={h.number} className={h.demand.length >= cap(h) ? 'full' : ''} data-tip={h.demand.length >= cap(h) ? 'Full: no room for more demand.' : `${cap(h) - h.demand.length} free demand slot(s).`}>
                        🏠#{h.number} {h.demand.map((g) => GOOD_ICON[g]).join('')}
                        {h.demand.length >= cap(h) && ' FULL'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="warn">No house reached at this spot.</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {houses.length > 0 && !open.length && <p className="warn">Every house reached is full: this campaign adds no demand for now.</p>}
        {!canSupply && <p className="warn">Nobody in your company can {food ? 'cook' : 'buy'} {GOOD_ICON[c.good]} yet: you could not serve this demand.</p>}
        {milestones.length > 0 && (
          <ul className="confirm-ms">
            {milestones.map((m) => (
              <li key={m.milestone}>
                ★ You claim <b>{MILESTONE_LABEL(m.milestone)}</b>: {MILESTONES_EFFECT(m.milestone)}
              </li>
            ))}
          </ul>
        )}
        <div className="confirm-actions">
          <button className="ghost" onClick={onCancel} data-tip="Back to the map to choose another spot (Esc).">
            ← Change
          </button>
          <button className="cta small" onClick={onConfirm} data-tip="Place the campaign (Enter).">
            Start campaign ✓
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('ui')!,
  );
}
