import restaurants from '../../data/restaurants.json';

const logos = import.meta.glob('../../assets/components/chain-logo-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const COLORS: Record<string, string> = {
  'fried-geese-donkey': '#e85d3f',
  'golden-duck-diner': '#f2b705',
  'santa-maria-pizza': '#2aa876',
  'xango-blues-bar': '#3a86ff',
  'gluttony-burgers': '#b5179e',
};

export interface Chain {
  id: string;
  name: string;
  color: string;
  logo: string;
}

export const CHAINS: Chain[] = restaurants.chains.map((c) => ({
  id: c.id,
  name: c.name,
  color: COLORS[c.id],
  logo: logos[`../../assets/components/chain-logo-${c.id}.png`],
}));

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: { id: Difficulty; title: string; blurb: string }[] = [
  { id: 'easy', title: 'Trainee', blurb: 'Greedy rivals. They make mistakes.' },
  { id: 'medium', title: 'Manager', blurb: 'Plans a turn ahead, simulates Dinnertime.' },
  { id: 'hard', title: 'CEO', blurb: 'Searches several turns, reads your reserve.' },
];
