import { useEffect } from 'react';
import { GOODS } from '../engine/data';
import type { GameState, PlayerId } from '../engine/types';
import type { TurnRecap } from '../game/controller';
import { capabilities } from './capabilities';
import { CHAINS } from './chains';
import { CompanyView } from './CompanyView';
import { EmployeeCard } from './EmployeeCard';
import { GOOD_ICON } from './icons';
import { MILESTONE_LABEL, MILESTONES_EFFECT, milestoneImage } from './labels';

const chainOf = (view: GameState, id: PlayerId) => CHAINS.find((c) => c.id === view.players[id].chain)!;
const PHASE: Record<string, string> = { 'setup-restaurant': 'Setup', working: 'Working 9-5', payday: 'Payday' };

function useContinueKeys(onDone: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onDone]);
}

function MilestoneLine({ id }: { id: string }) {
  return (
    <li className="moment-ms">
      <img src={milestoneImage(id)} alt="" />
      <div>
        <b>★ {MILESTONE_LABEL(id)}</b>
        <span>{MILESTONES_EFFECT(id)}</span>
      </div>
    </li>
  );
}

/** A CPU chain's whole turn, docked over the map until the player continues. */
export function TurnRecapCard({ view, recap, onDone }: { view: GameState; recap: TurnRecap; onDone: () => void }) {
  useContinueKeys(onDone);
  const chain = chainOf(view, recap.player);
  const stock = GOODS.filter((g) => recap.stock[g]);
  return (
    <div className="moment recap" style={{ '--chain': chain.color } as React.CSSProperties}>
      <header>
        <img src={chain.logo} alt="" />
        <div>
          <b>{chain.name}</b>
          <span>
            {recap.items.length ? `${PHASE[recap.phase] ?? 'Turn'} · round ${recap.round}` : `Round ${recap.round}`}
          </span>
        </div>
        <span className="recap-cash">${recap.cash}</span>
      </header>
      {recap.milestones.length > 0 && <ul className="moment-list ms">{recap.milestones.map((m) => <MilestoneLine key={m} id={m} />)}</ul>}
      {recap.items.length > 0 && (
        <ul className="moment-list">
          {recap.items.map((it, i) => {
            const [from, to] = it.cards ?? [];
            return (
              <li key={i} style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
                <span className="rival-icon">{it.icon}</span>
                <div className="rival-text">
                  <b>{it.title}</b>
                  {it.detail && <span>{it.detail}</span>}
                </div>
                {from && (
                  <div className="rival-cards">
                    <EmployeeCard type={from} mini />
                    {to && (
                      <>
                        <span className="arrow">→</span>
                        <EmployeeCard type={to} mini />
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <footer>
        <span className="recap-stock" data-tip="Food and drinks this chain has for Dinnertime.">
          In stock: {stock.length ? stock.map((g) => `${GOOD_ICON[g]}×${recap.stock[g]}`).join('  ') : 'nothing'}
        </span>
        <button className="cta small" onClick={onDone} data-tip="Continue (Enter or Space)">
          Got it &rarr;
        </button>
      </footer>
    </div>
  );
}

/** The rivals' companies, just revealed after Restructuring. */
export function CompanyReveal({ view, me, milestones, onDone }: { view: GameState; me: PlayerId; milestones: { player: PlayerId; milestone: string }[]; onDone: () => void }) {
  useContinueKeys(onDone);
  const rivals = view.turnOrder.filter((id) => id !== me).map((id) => view.players[id]);
  const mine = milestones.filter((m) => m.player === me);
  return (
    <div className="moment-stage">
      <div className="reveal">
        <h2 className="reveal-title">Companies revealed</h2>
        <p className="reveal-sub">Who your rivals put to work this turn, and who stays on the beach</p>
        {rivals.map((p, i) => {
          const chain = chainOf(view, p.id);
          const ms = milestones.filter((m) => m.player === p.id);
          return (
            <section key={p.id} className="reveal-row" style={{ '--chain': chain.color, animationDelay: `${0.15 + i * 0.6}s` } as React.CSSProperties}>
              <header>
                <img src={chain.logo} alt="" />
                <b>{chain.name}</b>
                <span>
                  {p.atWork.length - 1} at work · ${p.cash}
                </span>
                <div className="chip-row">
                  <span className="row-tag">Can</span>
                  {capabilities(p).map((c, k) => (
                    <span key={k} className="cap" data-tip={c.tip}>
                      {c.icon}
                      {c.text}
                    </span>
                  ))}
                </div>
              </header>
              <CompanyView view={view} player={p} compact />
              {ms.length > 0 && <ul className="moment-list ms">{ms.map((m) => <MilestoneLine key={m.milestone} id={m.milestone} />)}</ul>}
            </section>
          );
        })}
        {mine.length > 0 && (
          <section className="reveal-row mine" style={{ animationDelay: `${0.15 + rivals.length * 0.6}s` }}>
            <header>
              <b>You claimed</b>
            </header>
            <ul className="moment-list ms">{mine.map((m) => <MilestoneLine key={m.milestone} id={m.milestone} />)}</ul>
          </section>
        )}
        <button className="cta small" onClick={onDone} data-tip="Continue (Enter or Space)">
          Continue &rarr;
        </button>
      </div>
    </div>
  );
}
