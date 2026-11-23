import { describe, expect, it } from 'vitest';
import { Lot } from '../src/world/lot';
import { findPath } from '../src/world/pathfinding';

function room(): Lot {
  const lot = new Lot(12);
  lot.addRoom(2, 2, 8, 8, 0);
  return lot;
}

describe('pathfinding', () => {
  it('finds a straight path in the open', () => {
    const p = findPath(new Lot(10), [0, 0], [[5, 0]])!;
    expect(p[0]).toEqual([0, 0]);
    expect(p.at(-1)).toEqual([5, 0]);
    expect(p).toHaveLength(6);
  });

  it('prefers diagonals in the open', () => {
    const p = findPath(new Lot(10), [0, 0], [[4, 4]])!;
    expect(p).toHaveLength(5);
  });

  it('walls block a sealed room', () => {
    expect(findPath(room(), [4, 4], [[10, 10]])).toBeNull();
  });

  it('doors let Mims through, entering straight rather than diagonally', () => {
    const lot = room();
    lot.setWall('h:4:8', { kind: 'door', style: 0 }); // door on the bottom wall below tile (4,7)
    const p = findPath(lot, [4, 4], [[4, 10]])!;
    expect(p).not.toBeNull();
    const i = p.findIndex(([x, y]) => x === 4 && y === 7);
    expect(p[i + 1]).toEqual([4, 8]);
  });

  it('windows block walking like walls', () => {
    const lot = room();
    lot.setWall('h:4:8', { kind: 'window', style: 0 });
    expect(findPath(lot, [4, 4], [[4, 10]])).toBeNull();
  });

  it('never cuts diagonally past a wall end', () => {
    const lot = new Lot(10);
    lot.addRun(3, 0, 3, 3); // vertical wall x=3 from y=0..3
    const p = findPath(lot, [2, 2], [[3, 3]])!;
    // must go down to (2,3) first, then right; a direct diagonal would clip the wall end
    expect(p).toEqual([[2, 2], [2, 3], [3, 3]]);
  });

  it('routes around blocked tiles but may end on a blocked goal', () => {
    const lot = new Lot(10);
    const blocked = (x: number, y: number) => x === 3 && y <= 5;
    const p = findPath(lot, [0, 0], [[3, 0]], { blocked })!;
    expect(p.at(-1)).toEqual([3, 0]);
    expect(p.slice(1, -1).some(([x, y]) => blocked(x, y))).toBe(false);
  });

  it('can reach the sidewalk row beyond the lot edge', () => {
    const lot = new Lot(10);
    expect(findPath(lot, [5, 5], [[5, 10]])).not.toBeNull();
    expect(findPath(lot, [5, 5], [[5, 11]])).toBeNull();
  });
});
