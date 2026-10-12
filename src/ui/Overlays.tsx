import { useEffect } from 'react';
import { CONFIG, EMPLOYEES, GOODS, MILESTONE_IDS } from '../engine/data';
import { hasActive, hasCfo, salaryDue, unitPrice, waitresses, workTypes } from '../engine/rules';
import type { GameState, PlayerId } from '../engine/types';
import type { DinnerReport, Note, TurnStats } from '../game/controller';
import { CHAINS } from './chains';
import { CompanyView } from './CompanyView';
import { StaffGuide } from './StaffGuide';
import { GOOD_ICON } from './icons';
import { chainName, MILESTONE_LABEL, MILESTONES_EFFECT, milestoneImage, MILESTONE_SHORT, reserveLabel } from './labels';

const chainOf = (view: GameState, id: PlayerId) => CHAINS.find((c) => c.id === view.players[id].chain)!;

function Modal({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose}>
            Close ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PlayerDrawer({ view, id, me, stats, onClose }: { view: GameState; id: PlayerId; me: PlayerId; stats?: TurnStats; onClose: () => void }) {
  const p = view.players[id];
  const chain = chainOf(view, id);
  const mods = workTypes(p).filter((t) => EMPLOYEES[t].priceModifier);
  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="drawer-title" style={{ '--chain': chain.color } as React.CSSProperties}>
          <img src={chain.logo} alt="" /> {chain.name} {id === me && <small>(you)</small>}
        </span>
      }
    >
      <div className="drawer-grid">
        <section>
          <h3>Company structure</h3>
          <CompanyView view={view} player={p} />
        </section>
        <section className="facts">
          <h3>Money</h3>
          <table>
            <tbody>
              <tr><td>Cash</td><td><b>${p.cash}</b></td></tr>
              {stats && <tr><td>This round</td><td>{p.cash - stats.cashStart >= 0 ? '+' : ''}{p.cash - stats.cashStart}</td></tr>}
              <tr><td>Salaries due</td><td>${salaryDue(p)}</td></tr>
              {id === me && p.reserve !== null && <tr><td>Your reserve</td><td>{reserveLabel(p.reserve)}</td></tr>}
            </tbody>
          </table>

          <h3>Unit price ${unitPrice(view, p)}</h3>
          <table>
            <tbody>
              <tr><td>Base</td><td>${CONFIG.unitPriceBase}</td></tr>
              {mods.map((t, i) => (
                <tr key={i}><td>{EMPLOYEES[t].name}</td><td>{EMPLOYEES[t].priceModifier! > 0 ? '+' : ''}{EMPLOYEES[t].priceModifier}</td></tr>
              ))}
              {hasActive(view, p, 'first-to-lower-prices') && <tr><td>First to lower prices</td><td>-1</td></tr>}
            </tbody>
          </table>
          <p className="hint">Customers pick the lowest price + distance. Waitresses: {waitresses(p)} (tie-break, ${p.milestones.includes('first-waitress-played') ? 5 : 3} each). {hasCfo(view, p) ? 'CFO active: +50% cash.' : ''}</p>

          <h3>Stock</h3>
          <div className="stock big">
            {GOODS.map((g) => (
              <span key={g} className={`good ${p.stock[g] ? '' : 'zero'}`}>
                {GOOD_ICON[g]} <b>{p.stock[g]}</b>
                {(stats?.produced[g] ?? 0) > 0 && <sup>+{stats!.produced[g]}</sup>}
              </span>
            ))}
          </div>
          <p className="hint">Unsold food and drinks are thrown away at clean-up{p.milestones.includes('first-to-throw-away-food-drink') ? ' (freezer keeps up to 10)' : ''}.</p>

          <h3>Milestones ({p.milestones.length})</h3>
          {p.milestones.length ? (
            <ul className="ms-list">
              {p.milestones.map((m) => (
                <li key={m}>
                  <img src={milestoneImage(m)} alt="" />
                  <div>
                    <b>{MILESTONE_LABEL(m)}</b>
                    <span>{MILESTONES_EFFECT(m)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">None yet.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

export function StaffModal({ view, onClose }: { view: GameState; onClose: () => void }) {
  return (
    <Modal wide title="Staff & careers" onClose={onClose}>
      <StaffGuide view={view} />
    </Modal>
  );
}

export function MilestoneBoard({ view, onClose }: { view: GameState; onClose: () => void }) {
  return (
    <Modal wide title="Milestones" onClose={onClose}>
      <p className="hint">The first chain(s) to do something get a permanent bonus. Everyone who achieves it in the same turn gets it; then it is gone.</p>
      <div className="ms-grid">
        {MILESTONE_IDS.map((m) => {
          const owners = view.players.filter((p) => p.milestones.includes(m));
          const status = owners.length ? 'claimed' : view.milestoneAvailable[m] ? 'open' : 'gone';
          return (
            <div key={m} className={`ms-card ${status}`}>
              <img src={milestoneImage(m)} alt="" />
              <div className="ms-info">
                <b>{MILESTONE_LABEL(m)}</b>
                <span className="ms-effect">{MILESTONE_SHORT[m]}</span>
                <span className="ms-status">
                  {owners.length
                    ? owners.map((p) => (
                        <img key={p.id} className="owner" src={chainOf(view, p.id).logo} title={chainName(view, p.id)} alt="" />
                      ))
                    : status === 'open'
                      ? 'Available'
                      : 'Gone'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function DinnerReportModal({ view, report, me, onClose }: { view: GameState; report: DinnerReport; me: PlayerId; onClose: () => void }) {
  const ids = view.turnOrder;
  return (
    <Modal wide title={`Dinnertime · round ${report.round}`} onClose={onClose}>
      {report.served.length ? (
        <table className="report">
          <thead>
            <tr><th>House</th><th>Ordered</th><th>Served by</th><th>Income</th></tr>
          </thead>
          <tbody>
            {report.served.map((s) => (
              <tr key={s.house} className={s.player === me ? 'mine' : ''}>
                <td>#{s.house}</td>
                <td>{s.goods.map((g) => GOOD_ICON[g]).join(' ')}</td>
                <td>
                  <span className="dot" style={{ background: chainOf(view, s.player).color }} /> {chainName(view, s.player)}
                </td>
                <td>${s.income}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="hint">No house was served this evening.</p>
      )}
      {report.unserved.length > 0 && (
        <p className="hint">
          Nobody could serve:{' '}
          {report.unserved.map((u) => (
            <span key={u.house} className="unserved">
              #{u.house} {u.goods.map((g) => GOOD_ICON[g]).join('')}
            </span>
          ))}
          <br />A chain needs the <b>whole</b> order in stock and a restaurant connected by road.
        </p>
      )}
      <table className="report totals">
        <thead>
          <tr><th>Chain</th><th>Sales</th><th>Waitresses</th><th>CFO</th><th>Total</th><th>Salaries</th><th>Cash now</th></tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const total = report.dinner[id] + report.waitresses[id] + report.cfo[id];
            return (
              <tr key={id} className={id === me ? 'mine' : ''}>
                <td>
                  <span className="dot" style={{ background: chainOf(view, id).color }} /> {chainName(view, id)}
                </td>
                <td>${report.dinner[id]}</td>
                <td>${report.waitresses[id]}</td>
                <td>${report.cfo[id]}</td>
                <td><b>${total}</b></td>
                <td>{report.salaries[id] === null ? '…' : report.salaries[id] ? `-$${report.salaries[id]}` : '$0'}</td>
                <td>${view.players[id].cash}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {report.bankBroken > 0 && <p className="error">{report.bankBroken === 1 ? 'The bank broke: reserve cards were revealed.' : 'The bank broke again: game over.'}</p>}
      <button className="cta small" onClick={onClose}>
        Continue &rarr;
      </button>
    </Modal>
  );
}

export interface Toast extends Note {
  id: number;
}

export function Toasts({ view, toasts, me }: { view: GameState; toasts: Toast[]; me: PlayerId }) {
  return (
    <div className="toasts">
      {toasts.map((t) => {
        const chain = chainOf(view, t.player);
        if (t.kind === 'milestone') {
          return (
            <div key={t.id} className="toast milestone" style={{ '--chain': chain.color } as React.CSSProperties}>
              <img className="ms-img" src={milestoneImage(t.title)} alt="" />
              <div>
                <small>
                  <img src={chain.logo} alt="" /> {t.player === me ? 'You' : chain.name} claimed
                </small>
                <b>★ {MILESTONE_LABEL(t.title)}</b>
                <span>{MILESTONES_EFFECT(t.title)}</span>
              </div>
            </div>
          );
        }
        return (
          <div key={t.id} className={`toast ${t.kind}`} style={{ '--chain': chain.color } as React.CSSProperties}>
            <div>
              <small>{t.kind === 'production' ? (t.player === me ? 'You collected' : `${chain.name} collected`) : t.kind === 'staff' ? 'Staff' : 'Bank'}</small>
              <b>{t.title}</b>
              {t.detail && <span>{t.detail}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
