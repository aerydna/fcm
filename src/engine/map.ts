import tilesData from '../../data/tiles.json';
import { seededRandom, shuffle } from './rng';

export const TILE_SIZE = 5;
const MID = 2;

export type Drink = 'softdrink' | 'beer' | 'lemonade';
export type Rotation = 0 | 90 | 180 | 270;

export type Square =
  | { kind: 'empty' }
  | { kind: 'road' }
  | { kind: 'house'; house: number }
  | { kind: 'drink'; drink: Drink };

export interface PlacedTile {
  id: string;
  rotation: Rotation;
  col: number;
  row: number;
}

export interface House {
  number: number;
  x: number;
  y: number;
  garden: boolean;
}

export interface GameMap {
  cols: number;
  rows: number;
  width: number;
  height: number;
  tiles: PlacedTile[];
  squares: Square[];
  houses: House[];
}

interface TileDef {
  id: string;
  rows: string[];
  houses: { number: number; x: number; y: number }[];
}

const TILE_DEFS: readonly TileDef[] = tilesData.tiles;
export const TILE_IDS = TILE_DEFS.map((t) => t.id);
const DRINKS: Record<string, Drink> = { s: 'softdrink', b: 'beer', l: 'lemonade' };

/** Rotates a square grid clockwise by `rotation` degrees. */
export function rotateRows(rows: readonly string[], rotation: Rotation): string[] {
  let grid = rows.map((r) => r.split(''));
  for (let k = 0; k < rotation / 90; k++) {
    const n = grid.length;
    grid = grid.map((_, y) => grid.map((__, x) => grid[n - 1 - x][y]));
  }
  return grid.map((r) => r.join(''));
}

export function buildMap(tiles: readonly PlacedTile[], cols: number, rows: number): GameMap {
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const squares: Square[] = new Array(width * height).fill(null).map(() => ({ kind: 'empty' }));
  const houses: House[] = [];

  for (const placed of tiles) {
    const def = TILE_DEFS.find((t) => t.id === placed.id);
    if (!def) throw new Error(`Unknown tile ${placed.id}`);
    const grid = rotateRows(def.rows, placed.rotation);
    const houseNumber = def.houses[0]?.number;
    let hx = Infinity;
    let hy = Infinity;
    grid.forEach((line, ly) =>
      [...line].forEach((ch, lx) => {
        const x = placed.col * TILE_SIZE + lx;
        const y = placed.row * TILE_SIZE + ly;
        const i = y * width + x;
        if (ch === '#') squares[i] = { kind: 'road' };
        else if (ch === 'H') {
          squares[i] = { kind: 'house', house: houseNumber };
          hx = Math.min(hx, x);
          hy = Math.min(hy, y);
        } else if (DRINKS[ch]) squares[i] = { kind: 'drink', drink: DRINKS[ch] };
      }),
    );
    if (houseNumber !== undefined) houses.push({ number: houseNumber, x: hx, y: hy, garden: false });
  }

  houses.sort((a, b) => a.number - b.number);
  return { cols, rows, width, height, tiles: [...tiles], squares, houses };
}

/** Random tile draw + rotation, as at game setup. Deterministic for a given seed. */
export function randomMap(seed: number, cols: number, rows: number): GameMap {
  const rnd = seededRandom(seed);
  const ids = shuffle(TILE_IDS, rnd).slice(0, cols * rows);
  const rotations: Rotation[] = [0, 90, 180, 270];
  const tiles = ids.map((id, i) => ({
    id,
    rotation: rotations[Math.floor(rnd() * 4)],
    col: i % cols,
    row: Math.floor(i / cols),
  }));
  return buildMap(tiles, cols, rows);
}

export function squareAt(map: GameMap, x: number, y: number): Square | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.squares[y * map.width + x];
}

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** Road squares reachable in one step. Across tile borders roads only join at edge midpoints. */
export function roadLinks(map: GameMap, x: number, y: number): [number, number][] {
  if (squareAt(map, x, y)?.kind !== 'road') return [];
  const out: [number, number][] = [];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (squareAt(map, nx, ny)?.kind !== 'road') continue;
    const crossesTile =
      Math.floor(x / TILE_SIZE) !== Math.floor(nx / TILE_SIZE) ||
      Math.floor(y / TILE_SIZE) !== Math.floor(ny / TILE_SIZE);
    if (crossesTile && (dx !== 0 ? y % TILE_SIZE !== MID : x % TILE_SIZE !== MID)) continue;
    out.push([nx, ny]);
  }
  return out;
}
