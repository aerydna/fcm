import { EMPLOYEES } from '../engine/data';
import { beach, ceoUid } from '../engine/rules';
import type { Card, GameState, Player } from '../engine/types';
import { EmployeeCard } from './EmployeeCard';
import { pyramidOf } from './pyramid';

interface Props {
  view: GameState;
  player: Player;
  /** Override at-work cards (restructuring preview). */
  atWork?: readonly number[];
  showBench?: boolean;
  compact?: boolean;
  onCardClick?: (card: Card) => void;
}

export function CompanyView({ view, player, atWork, showBench = true, compact, onCardClick }: Props) {
  const ids = atWork ?? (player.atWork.length ? player.atWork : [ceoUid(player)]);
  const pyr = pyramidOf(view, player, ids);
  const used = new Set(player.turn.used);
  const card = (c: Card, extra?: string) => (
    <EmployeeCard
      key={c.uid}
      type={c.type}
      mini
      dim={used.has(c.uid)}
      badge={extra ?? (used.has(c.uid) ? 'used' : undefined)}
      onClick={onCardClick && c.type !== 'ceo' ? () => onCardClick(c) : undefined}
    />
  );
  const empty = (k: string) => <div key={k} className="slot-empty" data-tip="Open slot: room for one more employee." />;
  const bench = beach({ ...player, atWork: [...ids] }).filter((c) => c.type !== 'ceo');
  const busy = player.cards.filter((c) => c.busyWith);
  const salaried = player.cards.filter((c) => EMPLOYEES[c.type].salary).length;

  return (
    <div className={`company ${compact ? 'compact' : ''}`}>
      <div className="pyr">
        <div className="pyr-ceo">
          {card(pyr.ceo, `${view.ceoSlots} slots`)}
        </div>
        <div className="pyr-row">
          {pyr.top.map((node, i) =>
            node ? (
              <div key={node.card.uid} className="pyr-branch">
                {card(node.card)}
                {node.slots.length > 0 && <div className="pyr-sub">{node.slots.map((s, k) => (s ? card(s) : empty(`${i}-${k}`)))}</div>}
              </div>
            ) : (
              <div key={`e${i}`} className="pyr-branch">
                {empty(`top-${i}`)}
              </div>
            ),
          )}
        </div>
        {pyr.overflow.length > 0 && (
          <div className="pyr-overflow">
            <span>Doesn't fit:</span>
            {pyr.overflow.map((c) => card(c))}
          </div>
        )}
      </div>
      {showBench && (
        <div className="bench">
          <div>
            <h4>On the beach ({bench.length})</h4>
            <div className="bench-cards">{bench.length ? bench.map((c) => card(c)) : <em>nobody</em>}</div>
          </div>
          {busy.length > 0 && (
            <div>
              <h4>Busy marketing ({busy.length})</h4>
              <div className="bench-cards">
                {busy.map((c) => {
                  const camp = view.campaigns.find((x) => x.number === c.busyWith);
                  return card(c, camp ? `#${camp.number} \u00b7 ${camp.remaining}t` : 'busy');
                })}
              </div>
            </div>
          )}
          <p className="salary-note">
            Salaried cards: <b>{salaried}</b> ({'$'}
            {salaried * 5} before discounts)
          </p>
        </div>
      )}
    </div>
  );
}
