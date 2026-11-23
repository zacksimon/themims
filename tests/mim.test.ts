import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { randomLook } from '../src/content/looks';

describe('Mim walking', () => {
  it('walks to a target through a doorway and stops there', () => {
    const w = new World(16);
    w.lot.addRoom(2, 2, 8, 8, 0);
    w.lot.setWall('v:8:4', { kind: 'door', style: 0 });
    const m = w.addMim('Test', randomLook(w.rng), 3, 3);
    expect(w.walkTo(m, [12, 4])).toBe(true);
    for (let i = 0; i < 2000 && m.path.length; i++) w.step(0.05);
    expect(m.x).toBeCloseTo(12.5);
    expect(m.y).toBeCloseTo(4.5);
    expect(m.pose).toBe('stand');
  });

  it('refuses unreachable targets without moving', () => {
    const w = new World(16);
    w.lot.addRoom(2, 2, 8, 8, 0);
    const m = w.addMim('Test', randomLook(w.rng), 3, 3);
    expect(w.walkTo(m, [12, 12])).toBe(false);
    w.step(1);
    expect(m.x).toBe(3.5);
  });

  it('takes about the expected time at walking speed', () => {
    const w = new World(16);
    const m = w.addMim('Test', randomLook(w.rng), 0, 0);
    w.walkTo(m, [12, 0]);
    let minutes = 0;
    while (m.path.length) {
      w.step(0.05);
      minutes += 0.05;
    }
    expect(minutes).toBeGreaterThan(4.5);
    expect(minutes).toBeLessThan(5.5);
  });
});
