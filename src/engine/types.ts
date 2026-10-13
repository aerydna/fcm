import type { CampaignType, Good } from './data';
import type { GameMap } from './map';

export type PlayerId = number;
export type Goods = Record<Good, number>;

export interface Card {
  uid: number;
  type: string;
  /** Campaign tile number while the marketeer is busy. */
  busyWith?: number;
}

export interface TurnScratch {
  hired: number;
  recruitsUsed: number;
  /** trainer uid -> training slots used */
  trainerUse: Record<number, number>;
  /** trained card uid -> trainer uids that trained it this turn */
  trainedBy: Record<number, number[]>;
  /** uids of cards whose action was used this turn (marketeers, kitchen, buyers, NBD, restaurant managers) */
  used: number[];
  salaryPaid: number;
}

export interface Player {
  id: PlayerId;
  chain: string;
  cash: number;
  cards: Card[];
  /** uids in the company structure this turn (always includes the CEO). */
  atWork: number[];
  /** Hidden restructuring choice before the simultaneous reveal. */
  pendingAtWork?: number[];
  /** Hidden index into RESERVE_CARDS. */
  reserve: number | null;
  restaurantsLeft: number;
  milestones: string[];
  /** Round in which each milestone was claimed. */
  milestoneRound: Record<string, number>;
  stock: Goods;
  turn: TurnScratch;
}

export interface Restaurant {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  /** Printed entrance corner: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left. */
  entrance: number;
  comingSoon: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HouseState {
  number: number;
  x: number;
  y: number;
  garden?: Rect;
  printed: boolean;
  demand: Good[];
}

export interface Campaign {
  number: number;
  type: CampaignType;
  owner: PlayerId;
  marketeer: number;
  good: Good;
  remaining: number;
  eternal: boolean;
  /** Board squares for billboard/mailbox/radio. */
  rect?: Rect;
  /** Airplane fly-over band. */
  band?: { axis: 'row' | 'col'; start: number; size: number };
}

export type Phase =
  | 'setup-restaurant'
  | 'setup-reserve'
  | 'restructuring'
  | 'order-of-business'
  | 'working'
  | 'payday'
  | 'game-over';

export const WORK_STEPS = ['recruit', 'train', 'marketing', 'food', 'houses', 'restaurants'] as const;
export type WorkStep = (typeof WORK_STEPS)[number];

export interface GameState {
  rng: number;
  round: number;
  phase: Phase;
  active: PlayerId | null;
  /** Players still to act in the current phase, in order. */
  queue: PlayerId[];
  /** Setup: players who passed in the first placement round. */
  passed: PlayerId[];
  setupRound: number;
  workStep: number;
  turnOrder: PlayerId[];
  /** Order-of-business: positions already taken (index = position). */
  orderPicks: (PlayerId | null)[];
  players: Player[];
  map: GameMap;
  houses: HouseState[];
  restaurants: Restaurant[];
  campaigns: Campaign[];
  bank: number;
  bankBreaks: number;
  ceoSlots: number;
  ceoSlotsNext: number;
  revealedReserves: number[] | null;
  supply: Record<string, number>;
  campaignTiles: number[];
  houseNumbers: number[];
  gardensLeft: number;
  milestoneAvailable: Record<string, boolean>;
  milestonesThisTurn: string[];
  nextUid: number;
  nextRestaurantId: number;
  winner: PlayerId | null;
}

export type Action =
  | { type: 'placeRestaurant'; x: number; y: number; entrance: number; manager?: number }
  | { type: 'moveRestaurant'; restaurant: number; x: number; y: number; entrance: number; manager: number }
  | { type: 'pass' }
  | { type: 'chooseReserve'; index: number }
  | { type: 'restructure'; atWork: number[] }
  | { type: 'chooseOrder'; position: number }
  | { type: 'recruit'; employee: string }
  | { type: 'train'; trainer: number; card: number; to: string }
  | {
      type: 'campaign';
      marketeer: number;
      tile: number;
      good: Good;
      duration: number;
      rect?: Rect;
      band?: { axis: 'row' | 'col'; start: number };
    }
  | { type: 'produce'; card: number; good?: Good }
  | { type: 'buyDrinks'; card: number; route: number[]; drink?: Good }
  | { type: 'placeHouse'; number: number; house: Rect; garden: Rect; card: number }
  | { type: 'placeGarden'; house: number; garden: Rect; card: number }
  | { type: 'endStep' }
  | { type: 'fire'; card: number }
  | { type: 'endPayday' };

export type GameEvent =
  | { type: 'phase'; phase: string; round: number }
  | { type: 'served'; house: number; player: PlayerId; goods: Good[]; income: number }
  | { type: 'income'; player: PlayerId; amount: number; reason: string }
  | { type: 'demand'; house: number; good: Good; campaign: number }
  | { type: 'milestone'; player: PlayerId; milestone: string }
  | { type: 'bankBroken'; times: number; added: number }
  | { type: 'salaries'; player: PlayerId; amount: number }
  | { type: 'skipped'; player: PlayerId; phase: string; step?: number; reason: string }
  | { type: 'pickOrder'; queue: { player: PlayerId; openSlots: number }[] }
  | { type: 'turnOrder'; order: PlayerId[] }
  | { type: 'gameOver'; winner: PlayerId };
