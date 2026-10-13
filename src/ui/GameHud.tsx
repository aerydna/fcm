import { GOODS } from '../engine/data';
import { beach, hasCfo, openSlots, unitPrice, waitresses } from '../engine/rules';
import type { GameState, Player, PlayerId } from '../engine/types';
import type { LogEntry, TurnStats } from '../game/controller';
import { CHAINS, DIFFICULTIES, type Difficulty } from './chains';
import { CompanyView } from './CompanyView';
import { capabilities } from './capabilities';
import { GOOD_ICON, GOOD_NAME } from './icons';
import { MILESTONE_LABEL, MILESTONE_SHORT, MILESTONES_EFFECT, PHASE_HELP, PHASE_LABEL, STEP_HELP, STEP_LABEL } from './labels';

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
  speed: number;
  onSpeed: () => void;
}

export function GameHud({ view, me, difficulty, stats, onQuit, onOpenPlayer, onOpenMilestones, onOpenStaff, speed, onSpeed }: Props) {
  const setup = view.phase.startsWith('setup');
  return (
    <>
      <header className="phase-bar">
        <div className="round" data-tip="A round is one full cycle of the 7 phases.">
          Round <b>{view.round}</b>
        </div>
        {setup ? (
          <span className="setup-label">{PHASE_LABEL[view.phase]}</span>
        ) : (
          <ol className="phases">
            {PHASES.map((ph) => (
              <li key={ph} className={ph === view.phase ? 'active' : ''} data-tip={ph === 'working' && view.phase === 'working' ? `${PHASE_HELP[ph]}\nNow: ${STEP_HELP[view.workStep]}` : PHASE_HELP[ph]}>
                {PHASE_LABEL[ph]}
                {ph === 'working' && view.phase === 'working' && <em> · {STEP_LABEL[view.workStep]}</em>}
              </li>
            ))}
          </ol>
        )}
        <div className="bank" data-tip={`Money left in the bank. When it runs out the secret reserve cards refill it; the second time it runs out the game ends.${view.bankBreaks ? `\nBroken ${view.bankBreaks} time(s).` : ''}`}>
          🏦 ${view.bank}
          {view.bankBreaks > 0 && <small> broken ×{view.bankBreaks}</small>}
        </div>
        <button className="ghost" onClick={onSpeed} data-tip="CPU speed: how long rival actions stay highlighted. Click to cycle 1× / 2× / 4×.">
          ⏩ CPU {speed}×
        </button>
        <button className="ghost" onClick={onOpenStaff} data-tip="All employees, what they do and how they are trained.">
          👥 Staff
        </button>
        <button className="ghost" onClick={onOpenMilestones} data-tip="The 18 milestones: permanent bonuses for the first chain to achieve them.">
          ★ Milestones
        </button>
        <button className="ghost" onClick={onQuit} data-tip="Leave the game and go back to the main menu.">
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
    <button className={`player ${view.active === p.id ? 'active' : ''}`} style={{ '--chain': chain.color } as React.CSSProperties} onClick={onOpen} data-tip="Click to see the full company: pyramid, beach, stock, price, milestones.">
      <div className="player-top">
        <span className="pos" data-tip="Position in turn order this round.">{pos + 1}</span>
        <img src={chain.logo} alt="" />
        <div className="who">
          <span className="name">{chain.name}</span>
          <span className="tag">{p.id === me ? 'You' : `CPU · ${DIFFICULTIES.find((d) => d.id === difficulty)!.title}`}</span>
        </div>
        <div className="cash" data-tip={`Cash. Change this round: ${delta >= 0 ? '+' : ''}${delta}. The richest chain wins when the bank breaks twice.`}>
          ${p.cash}
          {delta !== 0 && <small className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? `+${delta}` : delta}</small>}
        </div>
      </div>
      <div className="player-kpis">
        <span className="kpi" data-tip="Unit price per item. Houses pick the lowest price + distance, so a lower price steals customers.">
          💲<b>{price}</b>
        </span>
        <span className="kpi" data-tip="Employees at work (incl. CEO) / employees owned.">
          👥 <b>{p.atWork.length}</b>/{p.cards.length}
        </span>
        {!view.phase.startsWith('setup') && (
          <span className="kpi" data-tip="Open slots in the pyramid. Most open slots chooses turn order first.">
            ▢ <b>{openSlots(view, p)}</b>
          </span>
        )}
        <span className="kpi" data-tip="Restaurants on the map / still in hand.">
          🏠 <b>{view.restaurants.filter((r) => r.owner === p.id).length}</b>/{p.restaurantsLeft}
        </span>
        {waitresses(p) > 0 && <span className="kpi" data-tip="Waitresses at work: cash at Dinnertime and tie-breaks.">💁 {waitresses(p)}</span>}
        {hasCfo(view, p) && <span className="kpi gold" data-tip="CFO: +50% on all cash earned at Dinnertime.">CFO</span>}
        {busy > 0 && <span className="kpi" data-tip="Marketeers busy running campaigns (not available, still paid).">📣 {busy}</span>}
      </div>
      <div className="stock">
        {GOODS.map((g) => {
          const made = stats?.produced[g] ?? 0;
          return (
            <span key={g} className={`good ${p.stock[g] ? '' : 'zero'}`} data-tip={`${GOOD_NAME[g]}: ${p.stock[g]} in stock${made ? `, +${made} produced this turn` : ''}. Shared by all restaurants; thrown away at clean-up.`}>
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
            <span key={m} className="badge" data-tip={`${MILESTONE_LABEL(m)}: ${MILESTONES_EFFECT(m)}`}>
              ★ {MILESTONE_SHORT[m]}
            </span>
          ))}
        </div>
      )}
      {!view.phase.startsWith('setup') && (
        <div className="chip-row">
          <span className="row-tag" data-tip="What this chain can still do this turn (from the employees at work).">Can</span>
          {capabilities(p).map((c, i) => (
            <span key={i} className="cap" data-tip={c.tip}>
              {c.icon}
              {c.text}
            </span>
          ))}
        </div>
      )}
      {stats && stats.did.length > 0 && (
        <div className="chip-row">
          <span className="row-tag" data-tip="What this chain did this turn.">Today</span>
          {stats.did.map((d, i) => (
            <span key={i} className={`did ${i === stats.did.length - 1 ? 'latest' : ''}`} data-tip={d.title}>
              {d.chip}
            </span>
          ))}
        </div>
      )}
      {stats && stats.did.length > 0 && <span key={stats.did.length} className="player-ping" />}
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
        <button className="ghost small" onClick={onOpen} data-tip="Open your company sheet: pyramid, beach, money, price, milestones.">
          Details
        </button>
      </header>
      <CompanyView view={view} player={p} compact />
    </section>
  );
}
