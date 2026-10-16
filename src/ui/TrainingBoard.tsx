import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMPLOYEES } from '../engine/data';
import { apply, IllegalAction, trainerSlotsLeft } from '../engine/game';
import { beach, hasActive, typeOf } from '../engine/rules';
import type { Action, Card, GameState, Player } from '../engine/types';
import { EmployeeCard, imageOf, CATEGORY_COLOR } from './EmployeeCard';

type Train = Extract<Action, { type: 'train' }>;

/** Training steps a card can still receive from one trainer this turn, and why not. */
interface Route {
  path: string[];
  actions: Train[];
  /** null = can be done now. */
  blocked: string | null;
  later: boolean;
}

const name = (t: string) => EMPLOYEES[t].name;

/** Simulates the training steps one by one with the real rules. */
function routeTo(view: GameState, p: Player, trainer: number, card: Card, path: string[], stepsLeft: number): Route {
  const actions = path.map((to): Train => ({ type: 'train', trainer, card: card.uid, to }));
  if (path.length > stepsLeft) return { path, actions, blocked: null, later: true };
  let s = view;
  for (const a of actions) {
    try {
      s = apply(s, p.id, a).state;
    } catch (e) {
      if (!(e instanceof IllegalAction)) throw e;
      return { path, actions, blocked: e.message, later: false };
    }
  }
  return { path, actions, blocked: null, later: false };
}

export const trainersOf = (p: Player) => p.atWork.filter((u) => (EMPLOYEES[typeOf(p, u)].trainingSlots ?? 0) > 0);

/** Pips showing used / free training slots for each trainer at work. */
export function TrainerPips({ p, selected, onSelect }: { p: Player; selected?: number; onSelect?: (uid: number) => void }) {
  return (
    <div className="tr-trainers">
      {trainersOf(p).map((u) => {
        const total = EMPLOYEES[typeOf(p, u)].trainingSlots ?? 0;
        const left = trainerSlotsLeft(p, u);
        return (
          <button
            key={u}
            className={`tr-trainer ${u === selected ? 'on' : ''} ${left ? '' : 'spent'}`}
            onClick={onSelect && left ? () => onSelect(u) : undefined}
            disabled={!onSelect || !left}
            data-tip={`${name(typeOf(p, u))}: ${total} training step(s) per turn, ${left} left.${total > 1 ? '\nCan spend several steps on the same employee.' : ''}`}
          >
            <span className="tr-name">{name(typeOf(p, u))}</span>
            <span className="tr-pips">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`pip ${i < total - left ? 'used' : ''}`} />
              ))}
            </span>
            <b>{left} left</b>
          </button>
        );
      })}
    </div>
  );
}

function Branch({ type, routeFor, onTrain }: { type: string; routeFor: (path: string[]) => Route; onTrain: (r: Route) => void }) {
  return (
    <div className="tt-kids">
      {EMPLOYEES[type].trainsInto.map((k) => (
        <TreeNode key={k} type={k} prefix={[]} routeFor={routeFor} onTrain={onTrain} />
      ))}
    </div>
  );
}

function TreeNode({ type, prefix, routeFor, onTrain }: { type: string; prefix: string[]; routeFor: (path: string[]) => Route; onTrain: (r: Route) => void }) {
  const path = [...prefix, type];
  const r = routeFor(path);
  const def = EMPLOYEES[type];
  const ok = !r.later && !r.blocked;
  const steps = `${path.length} step${path.length === 1 ? '' : 's'}`;
  const tip = ok
    ? `Train now: ${path.map(name).join(' → ')} (${steps}).\n${def.ability}${def.salary ? '\nCosts $5 salary every payday.' : ''}`
    : r.later
      ? `Needs ${steps}: not enough training left this turn with this trainer.\n${def.ability}`
      : `Not possible now: ${r.blocked}\n${def.ability}`;
  const kids = def.trainsInto;
  return (
    <div className="tt-node">
      <button className={`tt-pill ${ok ? 'ok' : r.later ? 'later' : 'blocked'}`} style={{ '--cat': CATEGORY_COLOR[def.category] ?? '#555' } as React.CSSProperties} onClick={ok ? () => onTrain(r) : undefined} disabled={!ok} data-tip={tip}>
        {imageOf(type) ? <img src={imageOf(type)} alt="" /> : <span className="tt-ph">{def.name.slice(0, 2)}</span>}
        <span className="tt-name">{def.name}</span>
        {def.salary && <span className="tt-salary">$5</span>}
        <span className="tt-badge">{ok ? (path.length > 1 ? `${path.length}×` : '✓') : r.later ? `${path.length}` : '✕'}</span>
      </button>
      {kids.length > 0 && (
        <div className="tt-kids">
          {kids.map((k) => (
            <TreeNode key={k} type={k} prefix={path} routeFor={routeFor} onTrain={onTrain} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  view: GameState;
  p: Player;
  runMany: (actions: Action[]) => void;
  onDone: () => void;
  onHide: () => void;
}

/** Career trees of every beach card, with the routes the chosen trainer can still pay for. */
export function TrainingBoard({ view, p, runMany, onDone, onHide }: Props) {
  const trainers = trainersOf(p).filter((u) => trainerSlotsLeft(p, u) > 0);
  const [picked, setPicked] = useState<number | undefined>(trainers[0]);
  const trainer = picked !== undefined && trainers.includes(picked) ? picked : trainers[0];
  const left = trainer !== undefined ? trainerSlotsLeft(p, trainer) : 0;
  const total = trainersOf(p).reduce((s, u) => s + trainerSlotsLeft(p, u), 0);
  const cards = beach(p).filter((c) => EMPLOYEES[c.type].trainsInto.length > 0);
  const cache = useMemo(() => new Map<string, Route>(), [view, trainer]);
  const routeFor = (c: Card) => (path: string[]) => {
    const key = `${c.uid}:${path.join('>')}`;
    let r = cache.get(key);
    if (!r) cache.set(key, (r = routeTo(view, p, trainer!, c, path, left)));
    return r;
  };
  const trainedNow = Object.entries(p.turn.trainedBy).filter(([, by]) => by.length);

  return createPortal(
    <div className="rs-backdrop">
      <div className="rs-board tr-board">
        <header>
          <div>
            <h2>Training</h2>
            <p className="hint">
              Pick a trainer, then click a job in a career tree. Each step uses 1 training slot. A coach or guru may spend several steps on the same employee
              (click a job further right to train straight to it); two different trainers cannot train the same employee in one turn
              {hasActive(view, p, 'first-to-pay-20-salaries') ? ' (you can: "First to pay $20 in salaries")' : ''}. Trained employees stay on the beach until next turn.
            </p>
          </div>
          <div className="rs-stats">
            <span className="kpi" data-tip="Training steps left this turn, all trainers together.">
              Steps left <b>{total}</b>
            </span>
          </div>
        </header>

        <TrainerPips p={p} selected={trainer} onSelect={setPicked} />

        {trainedNow.length > 0 && (
          <p className="tr-done">
            Trained this turn:{' '}
            {trainedNow.map(([uid, by]) => (
              <span key={uid} className="tag">
                {name(typeOf(p, Number(uid)))} ({by.length} step{by.length === 1 ? '' : 's'})
              </span>
            ))}
          </p>
        )}

        <div className="tr-legend">
          <span className="tt-pill ok"><span className="tt-badge">✓</span> trainable now</span>
          <span className="tt-pill ok"><span className="tt-badge">2×</span> several steps now (same trainer)</span>
          <span className="tt-pill later"><span className="tt-badge">3</span> steps needed: a later turn</span>
          <span className="tt-pill blocked"><span className="tt-badge">✕</span> blocked (hover for why)</span>
        </div>

        <div className="tr-rows">
          {cards.length ? (
            cards.map((c) => (
              <div key={c.uid} className="tr-row">
                <EmployeeCard type={c.type} badge={p.turn.trainedBy[c.uid]?.length ? `trained ×${p.turn.trainedBy[c.uid].length}` : undefined} />
                {trainer !== undefined ? <Branch type={c.type} routeFor={routeFor(c)} onTrain={(r) => runMany(r.actions)} /> : null}
              </div>
            ))
          ) : (
            <em>Nobody on the beach can be trained.</em>
          )}
        </div>

        <footer>
          <button className="ghost" onClick={onHide} data-tip="Hide this board to look at the map. Reopen it from the panel on the right.">
            Look at the map
          </button>
          <button className="cta small" onClick={onDone} data-tip="Finish training and move to the next step.">
            Done training &rarr;
          </button>
        </footer>
      </div>
    </div>,
    document.getElementById('ui')!,
  );
}
