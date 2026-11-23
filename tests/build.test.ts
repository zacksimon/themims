import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { Builder, edgeRun, nearestEdge, rectTiles } from '../src/sim/build';
import { randomLook } from '../src/content/looks';
import { buildStarterHouse } from '../src/content/starter';
import { WALLS, FLOORS, DOOR_PRICE } from '../src/content/styles';
import { OBJECTS } from '../src/content/objects';

function setup() {
  const w = new World(16, 3);
  w.freeWill = false;
  const b = new Builder(w);
  return { w, b };
}

describe('builder: walls and floors', () => {
  it('builds a wall run and charges per new segment', () => {
    const { w, b } = setup();
    const { keys } = edgeRun(2, 2, 6, 3);
    expect(keys).toHaveLength(4);
    expect(b.buildWalls(keys, 0)).toBeNull();
    expect(w.funds).toBe(20000 - 4 * WALLS[0].price);
    // building again over existing walls costs nothing and reports it
    expect(b.buildWalls(keys, 0)).toMatch(/already/);
  });

  it('refuses walls that would trap a Mim', () => {
    const { w, b } = setup();
    w.addMim('Gus', randomLook(w.rng), 3, 3);
    expect(b.buildWalls(edgeRun(2, 2, 6, 2).keys, 0)).toBeNull();
    expect(b.buildWalls(edgeRun(2, 2, 2, 6).keys, 0)).toBeNull();
    expect(b.buildWalls(edgeRun(6, 2, 6, 6).keys, 0)).toBeNull();
    const funds = w.funds;
    expect(b.buildWalls(edgeRun(2, 6, 6, 6).keys, 0)).toMatch(/trap Gus/);
    expect(w.funds).toBe(funds);
    expect(w.lot.walls.has('h:3:6')).toBe(false);
    // leave a gap, put a door in, then closing the gap is fine
    expect(b.buildWalls(edgeRun(2, 6, 5, 6).keys, 0)).toBeNull();
    expect(b.setOpening('h:3:6', 'door')).toBeNull();
    expect(b.buildWalls(['h:5:6'], 0)).toBeNull();
  });

  it('doors and windows go on existing walls and cost money', () => {
    const { w, b } = setup();
    expect(b.setOpening('h:3:6', 'door')).toMatch(/Build a wall first/);
    b.buildWalls(edgeRun(2, 6, 6, 6).keys, 0);
    const f = w.funds;
    expect(b.setOpening('h:3:6', 'door')).toBeNull();
    expect(w.funds).toBe(f - DOOR_PRICE);
    expect(w.lot.walls.get('h:3:6')!.kind).toBe('door');
  });

  it('erasing walls refunds half', () => {
    const { w, b } = setup();
    b.buildWalls(edgeRun(2, 6, 6, 6).keys, 2);
    const f = w.funds;
    expect(b.eraseWalls(edgeRun(2, 6, 4, 6).keys)).toBeNull();
    expect(w.funds).toBe(f + 2 * Math.round(WALLS[2].price / 2));
    expect(w.lot.walls.size).toBe(2);
  });

  it('paints walls and lays floors with costs', () => {
    const { w, b } = setup();
    b.buildWalls(edgeRun(2, 6, 6, 6).keys, 0);
    let f = w.funds;
    expect(b.paintWalls(edgeRun(2, 6, 6, 6).keys, 1)).toBeNull();
    expect(w.funds).toBe(f - 4 * WALLS[1].price);
    f = w.funds;
    const tiles = rectTiles(1, 1, 3, 2);
    expect(b.setFloors(tiles, 1)).toBeNull();
    expect(w.funds).toBe(f - 6 * FLOORS[1].price);
    expect(w.lot.floor(2, 2)).toBe(1);
    expect(b.setFloors(tiles, -1)).toBeNull();
    expect(w.lot.floor(2, 2)).toBe(-1);
  });

  it('nearestEdge snaps to the closest grid line', () => {
    expect(nearestEdge(3.05, 4.5)).toBe('v:3:4');
    expect(nearestEdge(3.5, 4.93)).toBe('h:3:5');
  });

  it('undo restores walls, floors and funds', () => {
    const { w, b } = setup();
    b.buildWalls(edgeRun(2, 6, 6, 6).keys, 0);
    b.setFloors(rectTiles(1, 1, 2, 2), 0);
    expect(b.undo()).toBe(true);
    expect(w.lot.floor(1, 1)).toBe(-1);
    expect(w.lot.walls.size).toBe(4);
    expect(b.undo()).toBe(true);
    expect(w.lot.walls.size).toBe(0);
    expect(w.funds).toBe(20000);
    expect(b.undo()).toBe(false);
  });
});

describe('builder: buy mode', () => {
  it('buys, moves and sells objects', () => {
    const { w, b } = setup();
    expect(b.buy('sofa', 4, 4, 0)).toBeNull();
    expect(w.funds).toBe(20000 - OBJECTS.sofa.price);
    const sofa = w.objects[0];
    expect(b.move(sofa, 8, 8, 1)).toBeNull();
    expect([sofa.x, sofa.y, sofa.dir]).toEqual([8, 8, 1]);
    // full refund within the first hour
    expect(b.sell(sofa)).toBeNull();
    expect(w.funds).toBe(20000);
    expect(w.objects).toHaveLength(0);
  });

  it('depreciates after the first hour', () => {
    const { w, b } = setup();
    b.buy('tv', 4, 4, 0);
    w.time += 2 * 24 * 60;
    expect(b.refundFor(w.objects[0])).toBe(Math.round(OBJECTS.tv.price * 0.7));
  });

  it('refuses overlapping, door-blocking, unaffordable and out-of-lot placements', () => {
    const { w, b } = setup();
    b.buy('sofa', 4, 4, 0);
    expect(b.placementError('tv', 5, 4, 0)).toMatch(/fit/);
    expect(b.placementError('tv', 15, 4, 3)).toBeNull();
    expect(b.placementError('sofa', 15, 4, 0)).toMatch(/fit/);
    b.buildWalls(edgeRun(2, 10, 6, 10).keys, 0);
    b.setOpening('h:3:10', 'door');
    expect(b.placementError('tv', 3, 10, 0)).toMatch(/block a door/);
    w.funds = 10;
    expect(b.buy('tv', 10, 10, 0)).toMatch(/costs/);
  });

  it('refuses a wall through furniture', () => {
    const { b } = setup();
    b.buy('sofa', 4, 4, 0); // tiles (4,4),(5,4)
    expect(b.buildWalls(['v:5:4'], 0)).toMatch(/furniture/);
  });

  it('selling an object in use stops the Mim cleanly', () => {
    const w = new World(24, 3);
    w.freeWill = false;
    buildStarterHouse(w);
    const b = new Builder(w);
    const m = w.addMim('Dotty', randomLook(w.rng), 9, 12);
    const toilet = w.objects.find((o) => o.def === 'toilet')!;
    m.needs.bladder = 10;
    w.queueInteraction(m, toilet, 'use');
    for (let t = 0; t < 8; t += 0.25) w.step(0.25);
    expect(m.queue[0]?.phase).toBe('use');
    expect(b.sell(toilet)).toBeNull();
    expect(m.queue).toHaveLength(0);
    expect(m.pose).toBe('stand');
  });

  it('room scores improve with decor (for the "nicer room" reaction)', () => {
    const w = new World(24, 3);
    buildStarterHouse(w);
    const b = new Builder(w);
    const before = w.roomScoreAt(15, 7);
    b.buy('fern', 15, 6, 0);
    b.buy('lava_lamp', 16, 6, 0);
    expect(w.roomScoreAt(15, 7)).toBeGreaterThan(before + 10);
  });
});
