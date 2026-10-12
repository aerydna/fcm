import { CONFIG } from './data';
import { blockOf, houseSquares, rectSquares, tileIndex, type Pt } from './geometry';
import { TILE_SIZE } from './map';
import { has } from './rules';
import type { Campaign, GameEvent, GameState, HouseState } from './types';

const DIRS: readonly Pt[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Houses reached by a campaign, in house-number order. */
export function reachedHouses(state: GameState, c: Campaign): HouseState[] {
  const { map } = state;
  const key = ([x, y]: Pt) => y * map.width + x;
  let hit: (h: HouseState) => boolean;

  if (c.band) {
    const { axis, start, size } = c.band;
    hit = (h) => houseSquares(h).some(([x, y]) => {
      const v = axis === 'row' ? y : x;
      return v >= start && v < start + size;
    });
  } else if (c.type === 'billboard') {
    const own = new Set(rectSquares(c.rect!).map(key));
    const around = new Set<number>();
    for (const [x, y] of rectSquares(c.rect!)) {
      for (const [dx, dy] of DIRS) {
        const n: Pt = [x + dx, y + dy];
        if (n[0] >= 0 && n[1] >= 0 && n[0] < map.width && n[1] < map.height && !own.has(key(n))) around.add(key(n));
      }
    }
    hit = (h) => houseSquares(h).some((s) => around.has(key(s)));
  } else if (c.type === 'mailbox') {
    const block = blockOf(map, rectSquares(c.rect!));
    hit = (h) => houseSquares(h).some((s) => block.has(key(s)));
  } else {
    const tiles = new Set<number>();
    for (const [x, y] of rectSquares(c.rect!)) {
      const tc = Math.floor(x / TILE_SIZE);
      const tr = Math.floor(y / TILE_SIZE);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (tc + dx >= 0 && tr + dy >= 0 && tc + dx < map.cols && tr + dy < map.rows) tiles.add((tr + dy) * map.cols + tc + dx);
        }
      }
    }
    hit = (h) => houseSquares(h).some(([x, y]) => tiles.has(tileIndex(map, x, y)));
  }
  return state.houses.filter(hit).sort((a, b) => a.number - b.number);
}

export function resolveMarketing(state: GameState, events: GameEvent[]): void {
  for (const c of [...state.campaigns].sort((a, b) => a.number - b.number)) {
    const owner = state.players[c.owner];
    const per = c.type === 'radio' && has(owner, 'first-radio-campaign') ? 2 : 1;
    for (const h of reachedHouses(state, c)) {
      const cap = h.garden ? CONFIG.houseDemandCapWithGarden : CONFIG.houseDemandCap;
      for (let k = 0; k < per && h.demand.length < cap; k++) {
        h.demand.push(c.good);
        events.push({ type: 'demand', house: h.number, good: c.good, campaign: c.number });
      }
    }
    if (c.eternal) continue;
    c.remaining--;
    if (c.remaining > 0) continue;
    state.campaigns = state.campaigns.filter((x) => x !== c);
    state.campaignTiles.push(c.number);
    state.campaignTiles.sort((a, b) => a - b);
    const marketeer = owner.cards.find((x) => x.uid === c.marketeer);
    if (marketeer) delete marketeer.busyWith;
  }
}
