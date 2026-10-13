import { CAMPAIGN_TILES, EMPLOYEES, GOODS } from '../engine/data';
import { actionYield } from '../engine/game';
import { reachedHouses } from '../engine/marketing';
import type { Action, GameState, PlayerId, Rect } from '../engine/types';
import { GOOD_ICON } from '../ui/icons';

/** A notable action, described for highlighting and for the per-turn summary. */
export interface Spotlight {
  icon: string;
  title: string;
  detail?: string;
  /** Employee types to show (e.g. [from, to] for training). */
  cards?: string[];
  /** Board area to flash. */
  rect?: Rect;
  /** Short chip text for the "Today" summary. */
  chip: string;
}

const CAMPAIGN_ICON: Record<string, string> = { billboard: '🪧', mailbox: '📫', radio: '📻', airplane: '✈️' };
const name = (t: string) => EMPLOYEES[t]?.name ?? t;

export function spotlightFor(before: GameState, after: GameState, player: PlayerId, a: Action): Spotlight | null {
  const p = before.players[player];
  const typeOf = (uid: number) => p.cards.find((c) => c.uid === uid)?.type ?? '';
  switch (a.type) {
    case 'recruit':
      return { icon: '👤', title: `Hired ${name(a.employee)}`, detail: EMPLOYEES[a.employee].ability, cards: [a.employee], chip: `👤 ${name(a.employee)}` };
    case 'train':
      return { icon: '🎓', title: `Trained ${name(typeOf(a.card))} → ${name(a.to)}`, detail: EMPLOYEES[a.to].ability, cards: [typeOf(a.card), a.to], chip: `🎓 ${name(a.to)}` };
    case 'campaign': {
      const tile = CAMPAIGN_TILES.find((t) => t.number === a.tile)!;
      const placed = after.campaigns.find((c) => c.number === a.tile);
      const reached = placed ? reachedHouses(after, placed).map((h) => `#${h.number}`) : [];
      const rect = a.rect ?? (a.band && (a.band.axis === 'row' ? { x: 0, y: a.band.start, w: before.map.width, h: tile.size! } : { x: a.band.start, y: 0, w: tile.size!, h: before.map.height }));
      return {
        icon: CAMPAIGN_ICON[tile.type],
        title: `${tile.type[0].toUpperCase()}${tile.type.slice(1)} #${a.tile} for ${GOOD_ICON[a.good]}`,
        detail: `${placed?.eternal ? 'Eternal' : `${a.duration} turn(s)`} · reaches ${reached.length ? reached.join(', ') : 'no house yet'}`,
        cards: [typeOf(a.marketeer)],
        rect,
        chip: `${CAMPAIGN_ICON[tile.type]}${GOOD_ICON[a.good]}`,
      };
    }
    case 'produce':
    case 'buyDrinks': {
      const got = actionYield(before, player, a);
      const text = GOODS.filter((g) => got[g]).map((g) => `${GOOD_ICON[g]}×${got[g]}`).join(' ') || 'nothing';
      return { icon: a.type === 'produce' ? '🍳' : '🚚', title: `${name(typeOf(a.card))}: ${text}`, cards: [typeOf(a.card)], chip: text };
    }
    case 'placeRestaurant':
      return { icon: '🏪', title: 'New restaurant', detail: a.manager !== undefined && typeOf(a.manager) === 'local-manager' ? 'Coming soon: opens next turn.' : 'Open now.', rect: { x: a.x, y: a.y, w: 2, h: 2 }, chip: '🏪 new' };
    case 'moveRestaurant':
      return { icon: '🏪', title: 'Moved a restaurant', detail: 'Regional manager: open immediately.', rect: { x: a.x, y: a.y, w: 2, h: 2 }, chip: '🏪 moved' };
    case 'placeHouse':
      return { icon: '🏡', title: `New house #${a.number} with garden`, rect: { x: Math.min(a.house.x, a.garden.x), y: Math.min(a.house.y, a.garden.y), w: a.house.w === a.garden.w ? 2 : 3, h: a.house.w === a.garden.w ? 3 : 2 }, chip: `🏡 #${a.number}` };
    case 'placeGarden':
      return { icon: '🌳', title: `Garden for house #${a.house}`, detail: 'That house now pays double.', rect: a.garden, chip: `🌳 #${a.house}` };
    case 'fire':
      return { icon: '✂️', title: `Fired ${name(typeOf(a.card))}`, chip: `✂️ ${name(typeOf(a.card))}` };
    default:
      return null;
  }
}
