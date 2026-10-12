import { EMPLOYEES } from '../engine/data';

const images = import.meta.glob('../../assets/employees/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const imageOf = (type: string) => images[`../../assets/employees/${type}.png`];

export const CATEGORY_COLOR: Record<string, string> = {
  manager: '#2b2b2b',
  service: '#e85d3f',
  expansion: '#8b2f5e',
  pricing: '#c9a227',
  recruiter: '#3a86ff',
  trainer: '#6a4c93',
  buyer: '#1f5a4e',
  marketeer: '#d1495b',
  kitchen: '#f08a24',
  restaurant: '#2a9d8f',
  finance: '#2a7a3b',
};

interface Props {
  type: string;
  selected?: boolean;
  dim?: boolean;
  mini?: boolean;
  badge?: string;
  onClick?: () => void;
  title?: string;
}

export function EmployeeCard({ type, selected, dim, mini, badge, onClick, title }: Props) {
  const def = EMPLOYEES[type];
  return (
    <button
      className={`emp ${mini ? 'mini' : ''} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`}
      style={{ '--cat': CATEGORY_COLOR[def.category] ?? '#555' } as React.CSSProperties}
      onClick={onClick}
      disabled={!onClick}
      title={title ?? `${def.name}: ${def.ability}`}
    >
      {imageOf(type) ? <img src={imageOf(type)} alt="" /> : <span className="emp-ph">{type === 'ceo' ? '👑' : def.name.slice(0, 3)}</span>}
      <span className="emp-name">{def.name}</span>
      {def.salary && <span className="emp-salary">$5</span>}
      {badge && <span className="emp-badge">{badge}</span>}
    </button>
  );
}
