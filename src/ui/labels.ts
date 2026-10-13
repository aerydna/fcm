import { EMPLOYEES, MILESTONES, RESERVE_CARDS } from '../engine/data';
import { maskToSources } from '../engine/geometry';
import { typeOf } from '../engine/rules';
import type { Action, GameEvent, GameState } from '../engine/types';
import { GOOD_ICON } from './icons';
import { CHAINS } from './chains';

export const chainName = (state: GameState, id: number) => CHAINS.find((c) => c.id === state.players[id].chain)?.name ?? `P${id + 1}`;
export const empName = (type: string) => EMPLOYEES[type]?.name ?? type;

export const PHASE_LABEL: Record<string, string> = {
  'setup-restaurant': 'Setup: restaurants',
  'setup-reserve': 'Setup: bank reserve',
  restructuring: 'Restructuring',
  'order-of-business': 'Order of Business',
  working: 'Working 9-5',
  dinnertime: 'Dinnertime',
  payday: 'Payday',
  'marketing-campaigns': 'Marketing',
  'clean-up': 'Clean-up',
  'game-over': 'Game over',
};

export const STEP_LABEL = ['Recruit', 'Train', 'Marketing', 'Food & drinks', 'Houses & gardens', 'Restaurants'];

export const STEP_HELP = [
  'Recruit: hire entry-level staff (CEO gives 1 hire, recruiters more). New hires go to the beach.',
  'Train: promote a beach card one step along its career using trainers/coaches/gurus.',
  'Marketing: marketeers place campaigns that create demand on houses at the end of the turn.',
  'Food & drinks: kitchen staff cook, buyers collect drinks. Unsold stock is thrown away at clean-up.',
  'Houses & gardens: a new business developer places a house or a garden (gardens double the price paid).',
  'Restaurants: local/regional managers open or move restaurants.',
];

export const PHASE_HELP: Record<string, string> = {
  restructuring: 'Restructuring: everyone secretly chooses who works this turn and builds the company pyramid.',
  'order-of-business': 'Order of business: the player with most open slots picks turn order first.',
  working: 'Working 9-5: in turn order each chain recruits, trains, markets, cooks, builds.',
  dinnertime: 'Dinnertime: each house with demand buys from the chain with the lowest price + distance that has ALL the items in stock.',
  payday: 'Payday: pay $5 per salaried employee (also those on the beach). Fire people to save money.',
  'marketing-campaigns': 'Marketing: every campaign puts demand tokens on the houses it reaches (lowest number first).',
  'clean-up': 'Clean-up: unsold food and drinks are thrown away; coming-soon restaurants open.',
};

export const CAMPAIGN_HELP: Record<string, string> = {
  billboard: 'Billboard: demand on the houses directly next to it (up/down/left/right).',
  mailbox: 'Mailbox: demand on every house in its block (the area enclosed by roads).',
  airplane: 'Airplane: demand on every house in the rows or columns it flies over (1, 3 or 5 wide).',
  radio: 'Radio: demand on every house on its tile and on the 8 surrounding tiles.',
};

export const MILESTONE_LABEL = (id: string) => MILESTONES[id]?.name ?? id;
export const MILESTONES_EFFECT = (id: string) => MILESTONES[id]?.effect ?? '';

/** Badge text: the practical bonus of each milestone. */
export const MILESTONE_SHORT: Record<string, string> = {
  'first-billboard-placed': 'Eternal ads',
  'first-to-train-someone': 'Salaries -$15',
  'first-to-hire-3-in-turn': '+2 trainees',
  'first-burger-marketed': '🍔 +$5',
  'first-pizza-marketed': '🍕 +$5',
  'first-drink-marketed': 'Drinks +$5',
  'first-errand-boy-played': '+1 drink/source',
  'first-to-have-20': 'Sees reserves',
  'first-burger-produced': 'Free burger cook',
  'first-pizza-produced': 'Free pizza cook',
  'first-waitress-played': 'Waitress $5',
  'first-cart-operator-played': 'Buyers +1 range',
  'first-airplane-campaign': '+2 order slots',
  'first-to-lower-prices': 'Price -$1',
  'first-to-have-100': 'CEO is CFO',
  'first-radio-campaign': 'Radio ×2',
  'first-to-throw-away-food-drink': 'Freezer 10',
  'first-to-pay-20-salaries': 'Multi-train',
};

const milestoneImages = import.meta.glob('../../assets/milestones/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const milestoneImage = (id: string) => milestoneImages[`../../assets/milestones/${id}.png`];

export function actionLabel(state: GameState, player: number, a: Action): string {
  const p = state.players[player];
  switch (a.type) {
    case 'placeRestaurant':
      return `Places a restaurant at ${a.x},${a.y}`;
    case 'moveRestaurant':
      return `Moves a restaurant to ${a.x},${a.y}`;
    case 'pass':
      return 'Passes';
    case 'chooseReserve':
      return 'Chooses a reserve card';
    case 'restructure':
      return `Puts ${a.atWork.length} employees to work`;
    case 'chooseOrder':
      return `Takes position ${a.position + 1}`;
    case 'recruit':
      return `Hires ${empName(a.employee)}`;
    case 'train':
      return `Trains ${empName(typeOf(p, a.card)) || 'an employee'} \u2192 ${empName(a.to)}`;
    case 'campaign':
      return `Campaign #${a.tile} for ${GOOD_ICON[a.good]} (${a.duration} turns)`;
    case 'produce':
      return `Kitchen: ${a.good ? GOOD_ICON[a.good] : 'produces'}`;
    case 'buyDrinks':
      return a.drink
        ? `Errand boy: ${GOOD_ICON[a.drink]}`
        : `Buyer: ${maskToSources(state.map, a.route.reduce((m, i) => m | (1 << i), 0)).map((s) => GOOD_ICON[s.drink]).join(' ') || 'nothing'}`;
    case 'placeHouse':
      return `New house #${a.number}`;
    case 'placeGarden':
      return `Garden for house #${a.house}`;
    case 'endStep':
      return 'Done';
    case 'fire':
      return `Fires ${empName(typeOf(p, a.card))}`;
    case 'endPayday':
      return 'Pays salaries';
  }
}

export function eventLabel(state: GameState, e: GameEvent): string | null {
  switch (e.type) {
    case 'served':
      return `${chainName(state, e.player)} serves house #${e.house} ${e.goods.map((g) => GOOD_ICON[g]).join('')} +$${e.income}`;
    case 'milestone':
      return `\u2605 ${chainName(state, e.player)}: ${MILESTONE_LABEL(e.milestone)}`;
    case 'bankBroken':
      return e.times === 1 ? `Bank broken! +$${e.added} from reserves` : 'Bank broken again: last Dinnertime';
    case 'salaries':
      return e.amount ? `${chainName(state, e.player)} pays $${e.amount} salaries` : null;
    case 'income':
      return e.reason === 'dinner' ? null : `${chainName(state, e.player)} +$${e.amount} (${e.reason})`;
    case 'gameOver':
      return `Game over: ${chainName(state, e.winner)} wins`;
    default:
      return null;
  }
}

export const reserveLabel = (i: number) => `+$${RESERVE_CARDS[i].money} \u00b7 CEO ${RESERVE_CARDS[i].ceoSlots} slots`;
