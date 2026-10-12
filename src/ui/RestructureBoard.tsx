import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMPLOYEES, isManager } from '../engine/data';
import { structureCandidates } from '../engine/legal';
import { ceoUid, typeOf } from '../engine/rules';
import type { Action, GameState, Player } from '../engine/types';
import { EmployeeCard } from './EmployeeCard';
import { pyramidOf } from './pyramid';

interface Layout {
  ceo: (number | null)[];
  under: Record<number, (number | null)[]>;
}

type Target = { kind: 'ceo'; i: number } | { kind: 'sub'; m: number; i: number } | { kind: 'beach' };

function initialLayout(view: GameState, p: Player): Layout {
  const pyr = pyramidOf(view, p, structureCandidates(view, p)[1] ?? [ceoUid(p)]);
  const layout: Layout = { ceo: pyr.top.map((n) => n?.card.uid ?? null), under: {} };
  for (const n of pyr.top) if (n && isManager(n.card.type)) layout.under[n.card.uid] = n.slots.map((s) => s?.uid ?? null);
  return layout;
}

const placedUids = (l: Layout) => [...l.ceo, ...Object.values(l.under).flat()].filter((u): u is number => u !== null);

interface Props {
  view: GameState;
  p: Player;
  onReveal: (a: Action) => void;
  onHide: () => void;
}

export function RestructureBoard({ view, p, onReveal, onHide }: Props) {
  const [layout, setLayout] = useState<Layout>(() => initialLayout(view, p));
  const [dragging, setDragging] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const type = (u: number) => typeOf(p, u);
  const placed = useMemo(() => new Set(placedUids(layout)), [layout]);
  const free = p.cards.filter((c) => c.type !== 'ceo' && !c.busyWith);
  const bench = free.filter((c) => !placed.has(c.uid));
  const busy = p.cards.filter((c) => c.busyWith);
  const openSlots = layout.ceo.filter((u) => u === null).length + Object.values(layout.under).flat().filter((u) => u === null).length;

  const remove = (l: Layout, uid: number): Layout => {
    const next: Layout = { ceo: l.ceo.map((u) => (u === uid ? null : u)), under: {} };
    for (const [m, subs] of Object.entries(l.under)) {
      if (Number(m) === uid) continue;
      next.under[Number(m)] = subs.map((u) => (u === uid ? null : u));
    }
    return next;
  };

  const accepts = (uid: number, t: Target): string | null => {
    if (t.kind === 'sub' && isManager(type(uid))) return 'Managers (black cards) can only report to the CEO, not to another manager.';
    if (t.kind === 'sub' && t.m === uid) return 'A manager cannot report to himself.';
    return null;
  };

  const drop = (uid: number, t: Target) => {
    const err = accepts(uid, t);
    if (err) {
      setMessage({ text: err, bad: true });
      return;
    }
    const keptSubs = layout.under[uid];
    let l = remove(layout, uid);
    const evict = (occupant: number | null) => {
      if (occupant !== null && occupant !== uid) l = remove(l, occupant);
    };
    if (t.kind === 'ceo') {
      evict(l.ceo[t.i]);
      l.ceo[t.i] = uid;
      if (isManager(type(uid))) l.under[uid] = keptSubs ?? new Array(EMPLOYEES[type(uid)].slots ?? 0).fill(null);
    } else if (t.kind === 'sub') {
      if (!l.under[t.m]) return;
      evict(l.under[t.m][t.i]);
      l.under[t.m][t.i] = uid;
    }
    setLayout(l);
    setMessage(t.kind === 'beach' ? { text: `${EMPLOYEES[type(uid)].name} goes to the beach.` } : null);
  };

  const autoPlace = (uid: number) => {
    const manager = isManager(type(uid));
    const ceoFree = layout.ceo.indexOf(null);
    if (manager) {
      if (ceoFree < 0) return setMessage({ text: `No free CEO slot: managers can only report to the CEO (${view.ceoSlots} slots). Remove someone from the CEO row first.`, bad: true });
      return drop(uid, { kind: 'ceo', i: ceoFree });
    }
    for (const [m, subs] of Object.entries(layout.under)) {
      const i = subs.indexOf(null);
      if (i >= 0) return drop(uid, { kind: 'sub', m: Number(m), i });
    }
    if (ceoFree >= 0) return drop(uid, { kind: 'ceo', i: ceoFree });
    setMessage({ text: 'No free slot left. Add a manager under the CEO or remove someone.', bad: true });
  };

  const zone = (t: Target, children: React.ReactNode, className: string) => {
    const verdict = dragging === null ? '' : accepts(dragging, t) ? 'reject' : 'accept';
    return (
      <div
        className={`${className} ${verdict}`}
        onDragOver={(e) => {
          if (dragging !== null) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const uid = Number(e.dataTransfer.getData('text/plain'));
          setDragging(null);
          drop(uid, t);
        }}
      >
        {children}
      </div>
    );
  };

  const card = (uid: number, onClick: () => void) => (
    <div
      key={uid}
      className="rs-drag"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(uid));
        e.dataTransfer.effectAllowed = 'move';
        setDragging(uid);
      }}
      onDragEnd={() => setDragging(null)}
    >
      <EmployeeCard type={type(uid)} onClick={onClick} />
    </div>
  );

  const emptySlot = (label: string) => <div className="rs-empty">{label}</div>;

  return createPortal(
    <div className="rs-backdrop">
      <div className="rs-board">
        <header>
          <div>
            <h2>Company structure</h2>
            <p className="hint">Drag cards into slots or click them. Black managers report only to the CEO; staff can report to the CEO or to a manager.</p>
          </div>
          <div className="rs-stats">
            <span className="kpi">CEO slots <b>{view.ceoSlots}</b></span>
            <span className="kpi">At work <b>{placed.size}</b></span>
            <span className="kpi" title="More open slots = earlier choice of turn order">Open slots <b>{openSlots}</b></span>
          </div>
        </header>

        <div className="rs-tree">
          <div className="rs-ceo">
            <EmployeeCard type="ceo" badge={`${view.ceoSlots} slots`} />
          </div>
          <div className="rs-row">
            {layout.ceo.map((u, i) => (
              <div key={i} className="rs-branch">
                {zone({ kind: 'ceo', i }, u === null ? emptySlot('Manager or staff') : card(u, () => drop(u, { kind: 'beach' })), 'rs-slot ceo-slot')}
                {u !== null && layout.under[u] && (
                  <div className="rs-sub">
                    {layout.under[u].map((s, k) => (
                      <div key={k}>{zone({ kind: 'sub', m: u, i: k }, s === null ? emptySlot('Staff') : card(s, () => drop(s, { kind: 'beach' })), 'rs-slot sub-slot')}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {message && <p className={`rs-message ${message.bad ? 'bad' : ''}`}>{message.text}</p>}

        {zone(
          { kind: 'beach' },
          <>
            <h4>On the beach ({bench.length}) · not working this turn, still paid if salaried</h4>
            <div className="rs-beach-cards">
              {bench.length ? bench.map((c) => card(c.uid, () => autoPlace(c.uid))) : <em>Everyone is at work.</em>}
              {busy.map((c) => (
                <EmployeeCard key={c.uid} type={c.type} dim badge={`busy #${c.busyWith}`} />
              ))}
            </div>
          </>,
          'rs-beach',
        )}

        <footer>
          <button className="ghost" onClick={onHide}>
            Look at the map
          </button>
          <button className="cta small" onClick={() => onReveal({ type: 'restructure', atWork: [ceoUid(p), ...placed] })}>
            Reveal &rarr;
          </button>
        </footer>
      </div>
    </div>,
    document.getElementById('ui')!,
  );
}
