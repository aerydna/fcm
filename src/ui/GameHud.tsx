import { GOODS } from '../engine/data';
import { beach, hasCfo, openSlots, unitPrice, waitresses } from '../engine/rules';
import type { GameState, Player, PlayerId } from '../engine/types';
import type { LogEntry, TurnStats } from '../game/controller';
import { CHAINS, DIFFICULTIES, type Difficulty } from './chains';
import { CompanyView } from './CompanyView';
import { GOOD_ICON } from './icons';
import { MILESTONE_LABEL, MILESTONE_SHORT, MILESTONES_EFFECT, PHASE_LABEL, STEP_LABEL } from './labels';

const PHASES = ['restructuring', 'order-of-business', 'working', 'dinnertime', 'payday', 'marketing-campaigns', 'clean-up'];

interface Props {
  view: GameState;
  me: PlayerId;
  difficulty: Difficulty;
  stats: TurnStats[];
  onQuit: () => void;
  onOpenPlayer: (id: PlayerId) => void;
  onOpenMilestones: () => void;
  onOpenStaff: () => void;
}

export function GameHud({ view, me, difficulty, stats, onQuit, onOpenPlayer, onOpenMilestones, onOpenStaff }: Props) {
  const setup = view.phase.startsWith('setup');
  return (
    <>
      <header className="phase-bar">
        <div className="round">
          Round <b>{view.round}</b>
        </div>
        {setup ? (
          <span className="setup-label">{PHASE_LABEL[view.phase]}</span>
        ) : (
          <ol className="phases">
            {PHASES.map((ph) => (
              <li key={ph} className={ph === view.phase ? 'active' : ''}>
                {PHASE_LABEL[ph]}
                {ph === 'working' && view.phase === 'working' && <em> · {STEP_LABEL[view.workStep]}</em>}
              </li>
            ))}
          </ol>
        )}
        <div className="bank" title="Money left in the bank. When it runs out the reserve cards refill it; the second time the game ends.">
          🏦 ${view.bank}
          {view.bankBreaks > 0 && <small> broken ×{view.bankBreaks}</small>}
        </div>
        <button className="ghost" onClick={onOpenStaff}>
          👥 Staff
        </button>
        <button className="ghost" onClick={onOpenMilestones}>
          ★ Milestones
        </button>
        <button className="ghost" onClick={onQuit}>
          Menu
        </button>
      </header>

      <aside className="players">
        {view.turnOrder.map((id, pos) => (
          <PlayerCard
            key={id}
            view={view}
            p={view.players[id]}
            pos={pos}
            me={me}
            difficulty={difficulty}
            stats={stats[id]}
            onOpen={() => onOpenPlayer(id)}
          />
        ))}
      </aside>

      {!setup && <CompanyDock view={view} p={view.players[me]} onOpen={() => onOpenPlayer(me)} />}
    </>
  );
}

export function LogPanel({ view, log }: { view: GameState; log: LogEntry[] }) {
  return (
    <section className="log">
      {log.slice(-8).map((e, i) => (
        <div key={log.length - 8 + i} className={`log-row ${e.important ? 'important' : ''}`}>
          {e.player !== null && <span className="dot" style={{ background: CHAINS.find((c) => c.id === view.players[e.player!].chain)?.color }} />}
          {e.text}
        </div>
      ))}
    </section>
  );
}

function PlayerCard({ view, p, pos, me, difficulty, stats, onOpen }: { view: GameState; p: Player; pos: number; me: PlayerId; difficulty: Difficulty; stats?: TurnStats; onOpen: () => void }) {
  const chain = CHAINS.find((c) => c.id === p.chain)!;
  const delta = stats ? p.cash - stats.cashStart : 0;
  const price = unitPrice(view, p);
  const busy = p.cards.filter((c) => c.busyWith).length;
  return (
    <button className={`player ${view.active === p.id ? 'active' : ''}`} style={{ '--chain': chain.color } as React.CSSProperties} onClick={onOpen} title="Open company">
      <div className="player-top">
        <span className="pos">{pos + 1}</span>
        <img src={chain.logo} alt="" />
        <div className="who">
          <span className="name">{chain.name}</span>
          <span className="tag">{p.id === me ? 'You' : `CPU · ${DIFFICULTIES.find((d) => d.id === difficulty)!.title}`}</span>
        </div>
        <div className="cash">
          ${p.cash}
          {delta !== 0 && <small className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? `+${delta}` : delta}</small>}
        </div>
      </div>
      <div className="player-kpis">
        <span className="kpi" title="Unit price per item (lower wins customers)">
          💲<b>{price}</b>
        </span>
        <span className="kpi" title="Employees at work / owned">
          👥 <b>{p.atWork.length}</b>/{p.cards.length}
        </span>
        {!view.phase.startsWith('setup') && (
          <span className="kpi" title="Open slots (turn order)">
            ▢ <b>{openSlots(view, p)}</b>
          </span>
        )}
        <span className="kpi" title="Restaurants on the map / left">
          🏠 <b>{view.restaurants.filter((r) => r.owner === p.id).length}</b>/{p.restaurantsLeft}
        </span>
        {waitresses(p) > 0 && <span className="kpi" title="Waitresses at work">💁 {waitresses(p)}</span>}
        {hasCfo(view, p) && <span className="kpi gold" title="+50% cash at Dinnertime">CFO</span>}
        {busy > 0 && <span className="kpi" title="Marketeers busy with campaigns">📣 {busy}</span>}
      </div>
      <div className="stock">
        {GOODS.map((g) => {
          const made = stats?.produced[g] ?? 0;
          return (
            <span key={g} className={`good ${p.stock[g] ? '' : 'zero'}`} title={`${g}: ${p.stock[g]} in stock${made ? `, +${made} this turn` : ''}`}>
              {GOOD_ICON[g]}
              <b>{p.stock[g]}</b>
              {made > 0 && <sup>+{made}</sup>}
            </span>
          );
        })}
      </div>
      {p.milestones.length > 0 && (
        <div className="badges">
          {p.milestones.map((m) => (
            <span key={m} className="badge" title={`${MILESTONE_LABEL(m)}: ${MILESTONES_EFFECT(m)}`}>
              ★ {MILESTONE_SHORT[m]}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function CompanyDock({ view, p, onOpen }: { view: GameState; p: Player; onOpen: () => void }) {
  const bench = beach(p).filter((c) => c.type !== 'ceo').length;
  const busy = p.cards.filter((c) => c.busyWith).length;
  return (
    <section className="dock">
      <header>
        <b>Your company</b>
        <span>
          {p.atWork.length ? `${p.atWork.length - 1} at work` : 'not revealed yet'} · {bench} on the beach{busy ? ` · ${busy} busy` : ''}
        </span>
        <button className="ghost small" onClick={onOpen}>
          Details
        </button>
      </header>
      <CompanyView view={view} player={p} compact />
    </section>
  );
}
