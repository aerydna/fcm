import { EMPLOYEES } from '../engine/data';
import type { GameState } from '../engine/types';
import { CATEGORY_COLOR, imageOf } from './EmployeeCard';

const GROUPS: { title: string; roots: string[] }[] = [
  { title: 'Management', roots: ['management-trainee'] },
  { title: 'Kitchen', roots: ['kitchen-trainee'] },
  { title: 'Drinks', roots: ['errand-boy'] },
  { title: 'Marketing', roots: ['marketing-trainee'] },
  { title: 'Hiring, training, service', roots: ['recruiting-girl', 'trainer', 'waitress', 'pricing-manager'] },
];

function GuideCard({ type, view }: { type: string; view: GameState }) {
  const def = EMPLOYEES[type];
  const left = view.supply[type];
  return (
    <div className="guide-card" style={{ '--cat': CATEGORY_COLOR[def.category] ?? '#555' } as React.CSSProperties}>
      {imageOf(type) ? <img src={imageOf(type)} alt="" /> : <span className="emp-ph">{type === 'ceo' ? '👑' : ''}</span>}
      <div>
        <b>{def.name}</b>
        <div className="guide-tags">
          {def.entry && <span className="tag hire">hire</span>}
          {def.salary ? <span className="tag salary">$5</span> : <span className="tag free">no salary</span>}
          {def.topPosition && <span className="tag top" title="Only one per player">1×</span>}
          {def.slots && <span className="tag">{def.slots} slots</span>}
          <span className={`tag ${left ? '' : 'out'}`}>{left} left</span>
        </div>
        <p>{def.ability}</p>
      </div>
    </div>
  );
}

function Node({ type, view }: { type: string; view: GameState }) {
  const kids = EMPLOYEES[type].trainsInto;
  return (
    <div className="tree-node">
      <GuideCard type={type} view={view} />
      {kids.length > 0 && (
        <div className="tree-children">
          {kids.map((k) => (
            <Node key={k} type={k} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StaffGuide({ view }: { view: GameState }) {
  return (
    <div className="guide">
      <p className="hint">
        Hire only cards marked <span className="tag hire">hire</span>. Everything else is reached by training one step to the right (one step per trainer slot).
        Black managers report only to the CEO; everyone else can report to the CEO or to a manager.
      </p>
      <div className="guide-ceo">
        <GuideCard type="ceo" view={view} />
      </div>
      {GROUPS.map((g) => (
        <section key={g.title} className="guide-group">
          <h3>{g.title}</h3>
          {g.roots.map((r) => (
            <Node key={r} type={r} view={view} />
          ))}
        </section>
      ))}
    </div>
  );
}
