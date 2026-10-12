import type { Drink } from './data';
import { type GameMap, roadLinks, squareAt, TILE_SIZE } from './map';
import type { GameState, HouseState, Rect, Restaurant } from './types';

export type Pt = readonly [number, number];

const DIRS: readonly Pt[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const tileIndex = (map: GameMap, x: number, y: number) =>
  Math.floor(y / TILE_SIZE) * map.cols + Math.floor(x / TILE_SIZE);

const crosses = (map: GameMap, a: Pt, b: Pt) => (tileIndex(map, a[0], a[1]) !== tileIndex(map, b[0], b[1]) ? 1 : 0);

export function rectSquares(r: Rect): Pt[] {
  const out: Pt[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push([x, y]);
  return out;
}

export const restaurantRect = (r: { x: number; y: number }): Rect => ({ x: r.x, y: r.y, w: 2, h: 2 });

const CORNERS: readonly Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export function entranceSquares(r: Pick<Restaurant, 'x' | 'y' | 'entrance'>, driveIn: boolean): Pt[] {
  const corners = driveIn ? [0, 1, 2, 3] : [r.entrance];
  return corners.map((c) => [r.x + CORNERS[c][0], r.y + CORNERS[c][1]] as const);
}

export function houseSquares(h: HouseState): Pt[] {
  const sq = rectSquares({ x: h.x, y: h.y, w: 2, h: 2 });
  return h.garden ? sq.concat(rectSquares(h.garden)) : sq;
}

export function adjacentRoads(map: GameMap, squares: readonly Pt[]): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (const s of squares) {
    for (const [dx, dy] of DIRS) {
      const n: Pt = [s[0] + dx, s[1] + dy];
      if (squareAt(map, n[0], n[1])?.kind === 'road') out.push([s, n]);
    }
  }
  return out;
}

/** Occupancy of non-printed objects. 0 = free. */
export function occupancy(state: GameState): Uint8Array {
  const { map } = state;
  const occ = new Uint8Array(map.width * map.height);
  const mark = (r: Rect, v: number) => rectSquares(r).forEach(([x, y]) => (occ[y * map.width + x] = v));
  for (const h of state.houses) {
    mark({ x: h.x, y: h.y, w: 2, h: 2 }, 1);
    if (h.garden) mark(h.garden, 2);
  }
  for (const r of state.restaurants) mark(restaurantRect(r), 3);
  for (const c of state.campaigns) if (c.rect) mark(c.rect, 4);
  return occ;
}

export function isRectFree(state: GameState, occ: Uint8Array, r: Rect): boolean {
  const { map } = state;
  if (r.x < 0 || r.y < 0 || r.x + r.w > map.width || r.y + r.h > map.height) return false;
  return rectSquares(r).every(([x, y]) => squareAt(map, x, y)?.kind === 'empty' && occ[y * map.width + x] === 0);
}

/**
 * 0-1 BFS over road squares; cost = tile borders crossed. Starts from the roads adjacent to
 * `from` squares (stepping onto a road on another tile counts as a crossing).
 */
export function roadCosts(map: GameMap, from: readonly Pt[]): Int16Array {
  const cost = new Int16Array(map.width * map.height).fill(-1);
  const deque: number[] = [];
  const best = new Int16Array(map.width * map.height).fill(32767);
  for (const [s, r] of adjacentRoads(map, from)) {
    const c = crosses(map, s, r);
    const i = r[1] * map.width + r[0];
    if (c < best[i]) {
      best[i] = c;
      if (c === 0) deque.unshift(i);
      else deque.push(i);
    }
  }
  while (deque.length) {
    const i = deque.shift()!;
    if (cost[i] >= 0) continue;
    cost[i] = best[i];
    const x = i % map.width;
    const y = (i - x) / map.width;
    for (const [nx, ny] of roadLinks(map, x, y)) {
      const j = ny * map.width + nx;
      if (cost[j] >= 0) continue;
      const c = best[i] + crosses(map, [x, y], [nx, ny]);
      if (c < best[j]) {
        best[j] = c;
        if (c === best[i]) deque.unshift(j);
        else deque.push(j);
      }
    }
  }
  return cost;
}

/** Range from precomputed road costs to a set of target squares (via an adjacent road). */
export function rangeTo(map: GameMap, cost: Int16Array, targets: readonly Pt[]): number {
  let best = Infinity;
  for (const [t, r] of adjacentRoads(map, targets)) {
    const c = cost[r[1] * map.width + r[0]];
    if (c >= 0) best = Math.min(best, c + crosses(map, r, t));
  }
  return best;
}

export function hasDriveIn(state: GameState, owner: number): boolean {
  const p = state.players[owner];
  return p.atWork.some((uid) => {
    const t = p.cards.find((c) => c.uid === uid)?.type;
    return t === 'local-manager' || t === 'regional-manager';
  });
}

export function chainEntrances(state: GameState, owner: number, includeComingSoon: boolean): Pt[] {
  const driveIn = hasDriveIn(state, owner);
  return state.restaurants
    .filter((r) => r.owner === owner && (includeComingSoon || !r.comingSoon))
    .flatMap((r) => entranceSquares(r, driveIn));
}

/** Squares connected to `start` without crossing a road (mailbox block). */
export function blockOf(map: GameMap, start: readonly Pt[]): Set<number> {
  const seen = new Set<number>();
  const stack = start.map(([x, y]) => y * map.width + x);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    const x = i % map.width;
    const y = (i - x) / map.width;
    if (squareAt(map, x, y)?.kind === 'road') continue;
    seen.add(i);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height) stack.push(ny * map.width + nx);
    }
  }
  return seen;
}

export interface DrinkSource {
  x: number;
  y: number;
  drink: Drink;
}

export function drinkSources(map: GameMap): DrinkSource[] {
  const out: DrinkSource[] = [];
  map.squares.forEach((s, i) => {
    if (s.kind === 'drink') out.push({ x: i % map.width, y: Math.floor(i / map.width), drink: s.drink });
  });
  return out;
}

const popcount = (n: number) => {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
};

/** Keeps only masks that are not a strict subset of another mask. */
function maximal(masks: Set<number>): number[] {
  const list = [...masks].sort((a, b) => popcount(b) - popcount(a));
  const out: number[] = [];
  for (const m of list) if (m && !out.some((o) => (o & m) === m)) out.push(m);
  return out;
}

/**
 * Cart operator / truck driver routes: walk roads (no U-turns) with at most `range` tile
 * crossings, collecting sources orthogonally adjacent to traversed road squares.
 * Returns maximal sets of source indices as bitmasks.
 */
export function roadRouteOptions(map: GameMap, entrances: readonly Pt[], range: number): number[] {
  const sources = drinkSources(map);
  const sourceAt = new Map(sources.map((s, i) => [s.y * map.width + s.x, i]));
  const adjMask = (x: number, y: number) => {
    let m = 0;
    for (const [dx, dy] of DIRS) {
      const k = sourceAt.get((y + dy) * map.width + (x + dx));
      if (k !== undefined && x + dx >= 0 && x + dx < map.width) m |= 1 << k;
    }
    return m;
  };
  const results = new Set<number>();
  const seen = new Set<string>();
  const stack: [number, number, number, number, number][] = [];
  for (const [e, r] of adjacentRoads(map, entrances)) {
    const c = crosses(map, e, r);
    if (c <= range) stack.push([r[0], r[1], -1, c, 0]);
  }
  while (stack.length) {
    const [x, y, prev, c, mask0] = stack.pop()!;
    const mask = mask0 | adjMask(x, y);
    const key = `${x},${y},${prev},${c},${mask}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.add(mask);
    const here = y * map.width + x;
    for (const [nx, ny] of roadLinks(map, x, y)) {
      const j = ny * map.width + nx;
      if (j === prev) continue;
      const nc = c + crosses(map, [x, y], [nx, ny]);
      if (nc <= range) stack.push([nx, ny, here, nc, mask]);
    }
  }
  return maximal(results);
}

/** Zeppelin: simple paths over orthogonally adjacent tiles, `range` crossings max. */
export function zeppelinOptions(map: GameMap, entrances: readonly Pt[], range: number): number[] {
  const sources = drinkSources(map);
  const tileMask = new Array(map.cols * map.rows).fill(0);
  sources.forEach((s, i) => (tileMask[tileIndex(map, s.x, s.y)] |= 1 << i));
  const results = new Set<number>();
  const walk = (t: number, visited: number, left: number, mask: number) => {
    mask |= tileMask[t];
    results.add(mask);
    if (!left) return;
    const tc = t % map.cols;
    const tr = (t - tc) / map.cols;
    for (const [dx, dy] of DIRS) {
      const nc = tc + dx;
      const nr = tr + dy;
      if (nc < 0 || nr < 0 || nc >= map.cols || nr >= map.rows) continue;
      const n = nr * map.cols + nc;
      if (!(visited & (1 << n))) walk(n, visited | (1 << n), left - 1, mask);
    }
  };
  for (const t of new Set(entrances.map(([x, y]) => tileIndex(map, x, y)))) walk(t, 1 << t, range, 0);
  return maximal(results);
}

export function maskToSources(map: GameMap, mask: number): DrinkSource[] {
  return drinkSources(map).filter((_, i) => mask & (1 << i));
}
