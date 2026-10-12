import { describe, expect, it } from 'vitest';
import { buildMap, randomMap, roadLinks, rotateRows, squareAt } from './map';

describe('rotateRows', () => {
  it('rotates tile A clockwise', () => {
    const a = ['..#..', '..#..', '#####', 'HH#..', 'HH#..'];
    expect(rotateRows(a, 90)).toEqual(['HH#..', 'HH#..', '#####', '..#..', '..#..']);
    expect(rotateRows(a, 360 as never)).toEqual(a);
  });
});

describe('buildMap', () => {
  it('places houses at their rotated top-left square', () => {
    const map = buildMap([{ id: 'A', rotation: 90, col: 0, row: 0 }], 1, 1);
    expect(map.houses).toEqual([{ number: 2, x: 0, y: 0, garden: false }]);
  });

  it('is deterministic per seed', () => {
    expect(randomMap(42, 4, 3)).toEqual(randomMap(42, 4, 3));
    expect(randomMap(42, 4, 3).tiles.length).toBe(12);
  });
});

describe('roadLinks', () => {
  // C (ring road) left of K (ring road): their edge columns touch along the full height.
  const map = buildMap(
    [
      { id: 'C', rotation: 0, col: 0, row: 0 },
      { id: 'K', rotation: 0, col: 1, row: 0 },
    ],
    2,
    1,
  );

  it('joins tiles at the edge midpoint', () => {
    expect(roadLinks(map, 4, 2)).toContainEqual([5, 2]);
  });

  it('does not join parallel border roads elsewhere', () => {
    expect(squareAt(map, 4, 0)?.kind).toBe('road');
    expect(squareAt(map, 5, 0)?.kind).toBe('road');
    expect(roadLinks(map, 4, 0)).not.toContainEqual([5, 0]);
  });
});
