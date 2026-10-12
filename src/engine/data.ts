import configJson from '../../data/config.json';
import employeesJson from '../../data/employees.json';
import marketingJson from '../../data/marketing.json';
import milestonesJson from '../../data/milestones.json';
import restaurantsJson from '../../data/restaurants.json';

export type Food = 'burger' | 'pizza';
export type Drink = 'softdrink' | 'beer' | 'lemonade';
export type Good = Food | Drink;
export const GOODS: readonly Good[] = ['burger', 'pizza', 'softdrink', 'beer', 'lemonade'];
export const DRINKS: readonly Drink[] = ['softdrink', 'beer', 'lemonade'];

export type CampaignType = 'billboard' | 'mailbox' | 'airplane' | 'radio';

export interface EmployeeDef {
  id: string;
  name: string;
  category: string;
  entry: boolean;
  salary: boolean;
  slots?: number;
  topPosition?: boolean;
  recruitActions?: number;
  trainingSlots?: number;
  priceModifier?: number;
  produces?: { burger?: number; pizza?: number; chooseOne?: boolean };
  range?: number;
  rangeUnlimited?: boolean;
  drinksPerSource?: number;
  ignoreRoads?: boolean;
  campaignTypes?: CampaignType[];
  maxDuration?: number;
  trainsInto: string[];
  ability: string;
}

export const CONFIG = configJson;
export const EMPLOYEES: Record<string, EmployeeDef> = Object.fromEntries(
  (employeesJson.employees as EmployeeDef[]).map((e) => [e.id, e]),
);
export const EMPLOYEE_COPIES = employeesJson.copies;
export const MILESTONE_IDS: readonly string[] = milestonesJson.milestones.map((m) => m.id);
export const MILESTONES: Record<string, { id: string; name: string; trigger: string; effect: string }> = Object.fromEntries(
  milestonesJson.milestones.map((m) => [m.id, { id: m.id, name: m.name, trigger: m.trigger, effect: m.effect }]),
);

export const isManager = (type: string) => EMPLOYEES[type].category === 'manager' && type !== 'ceo';
export const isMarketeer = (type: string) => EMPLOYEES[type].category === 'marketeer';

export interface CampaignTileDef {
  number: number;
  type: CampaignType;
  w: number;
  h: number;
  /** Airplane fly-over width in rows/columns. */
  size?: number;
}

// Airplane sizes per tile number are not stated in the rulebook text (toVerify).
const AIRPLANE_SIZES = [1, 3, 5];

export const CAMPAIGN_TILES: CampaignTileDef[] = (Object.entries(marketingJson.campaignTypes) as [CampaignType, { numbers: number[]; footprint?: { w: number; h: number } }][])
  .flatMap(([type, def]) =>
    def.numbers.map((number, i) => ({
      number,
      type,
      w: def.footprint?.w ?? 1,
      h: def.footprint?.h ?? 1,
      size: type === 'airplane' ? AIRPLANE_SIZES[i] : undefined,
    })),
  )
  .sort((a, b) => a.number - b.number);

export const RESERVE_CARDS = CONFIG.bankReserveCards.cards;
export const RESTAURANTS_PER_PLAYER = restaurantsJson.restaurantsPerPlayer;
