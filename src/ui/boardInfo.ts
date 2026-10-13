import { GOODS } from '../engine/data';
import { rankChains } from '../engine/dinnertime';
import { chainEntrances, hasDriveIn, houseSquares, rangeTo, roadCosts } from '../engine/geometry';
import { squareAt } from '../engine/map';
import { reachedHouses } from '../engine/marketing';
import type { GameState, HouseState } from '../engine/types';
import { GOOD_ICON, GOOD_NAME } from './icons';
import { CAMPAIGN_HELP, chainName } from './labels';
import { unitPrice } from '../engine/rules';

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function houseInfo(view: GameState, h: HouseState): string {
  const cap = h.garden ? 5 : 3;
  const lines = [`House #${h.number}${h.garden ? ' with garden (pays double)' : ''}`];
  if (!h.demand.length) {
    lines.push('No demand: nobody goes out. Market here to create demand.');
  } else {
    lines.push(`Wants: ${h.demand.map((g) => GOOD_ICON[g]).join(' ')}  (${h.demand.length}/${cap})`);
    lines.push('Buys only from a chain with ALL of it in stock and a road connection:');
    const costs = view.players.map((p) => {
      const e = chainEntrances(view, p.id, false);
      return e.length ? roadCosts(view.map, e) : null;
    });
    const ranked = rankChains(view, h, costs);
    for (const p of view.players) {
      const r = ranked.find((x) => x.player === p.id);
      if (r) {
        lines.push(`${ranked[0] === r ? '\u2192 ' : '   '}${chainName(view, p.id)}: $${r.price} + distance ${r.distance} = ${r.price + r.distance}${ranked[0] === r ? '  (wins)' : ''}`);
        continue;
      }
      const missing = GOODS.filter((g) => p.stock[g] < h.demand.filter((d) => d === g).length);
      const road = costs[p.id] ? rangeTo(view.map, costs[p.id]!, houseSquares(h)) !== Infinity : false;
      const why = [!road && 'no road connection', missing.length && `missing ${missing.map((g) => GOOD_ICON[g]).join('')}`].filter(Boolean).join(', ');
      lines.push(`   ${chainName(view, p.id)}: \u2717 ${why}`);
    }
    lines.push('(Stock changes before Dinnertime: cooks and buyers act during Working 9-5.)');
  }
  return lines.join('\n');
}

/** Tooltip text for a board square, or null if nothing interesting is there. */
export function describeSquare(view: GameState, x: number, y: number): string | null {
  const house = view.houses.find((h) => houseSquares(h).some(([hx, hy]) => hx === x && hy === y));
  if (house) {
    const onGarden = house.garden && inRect(x, y, house.garden);
    return (onGarden ? 'Garden: doubles the price this house pays.\n\n' : '') + houseInfo(view, house);
  }
  const rest = view.restaurants.find((r) => inRect(x, y, { x: r.x, y: r.y, w: 2, h: 2 }));
  if (rest) {
    const driveIn = hasDriveIn(view, rest.owner);
    const p = view.players[rest.owner];
    return [
      `${chainName(view, rest.owner)} restaurant${rest.comingSoon ? ' (COMING SOON: opens next turn)' : ''}`,
      `Unit price $${unitPrice(view, p)} \u00b7 stock ${GOODS.filter((g) => p.stock[g]).map((g) => `${GOOD_ICON[g]}${p.stock[g]}`).join(' ') || 'empty'}`,
      driveIn ? 'Drive-in: entrances on every corner (local/regional manager at work).' : 'White dot = entrance. Distance to houses is measured from it, along roads.',
    ].join('\n');
  }
  const camp = view.campaigns.find((c) => c.rect && inRect(x, y, c.rect)) ?? view.campaigns.find((c) => c.band && (c.band.axis === 'row' ? y >= c.band.start && y < c.band.start + c.band.size : x >= c.band.start && x < c.band.start + c.band.size));
  if (camp) {
    const reached = reachedHouses(view, camp);
    return [
      `${camp.type[0].toUpperCase()}${camp.type.slice(1)} #${camp.number} \u00b7 ${chainName(view, camp.owner)} \u00b7 advertises ${GOOD_ICON[camp.good]} ${GOOD_NAME[camp.good]}`,
      camp.eternal ? 'Eternal: never ends.' : `${camp.remaining} more turn(s).`,
      CAMPAIGN_HELP[camp.type],
      reached.length ? `Reaches houses ${reached.map((h) => `#${h.number}`).join(', ')} (+1 ${GOOD_ICON[camp.good]} each per turn, up to 3 or 5 with garden).` : 'Reaches no house right now.',
    ].join('\n');
  }
  const sq = squareAt(view.map, x, y);
  if (sq?.kind === 'drink') return `${GOOD_ICON[sq.drink]} ${GOOD_NAME[sq.drink]} source\nCart operators / truck drivers collect drinks when their route passes the road next to it; zeppelins when flying over the tile.`;
  return null;
}
