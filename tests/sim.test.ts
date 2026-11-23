import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { randomLook } from '../src/content/looks';
import { buildStarterHouse } from '../src/content/starter';
import { moodOf, fullNeeds } from '../src/sim/needs';
import { chooseAutonomous } from '../src/sim/freewill';
import { objTiles, footprintTiles } from '../src/sim/objects';
import { OBJECTS } from '../src/content/objects';

function house(seed = 7) {
  const w = new World(24, seed);
  buildStarterHouse(w);
  const m = w.addMim('Bartley', randomLook(w.rng), 9, 12);
  return { w, m };
}

function run(w: World, minutes: number, dt = 0.25) {
  for (let t = 0; t < minutes; t += dt) w.step(dt);
}

describe('needs', () => {
  it('decay over time while idle', () => {
    const { w, m } = house();
    w.freeWill = false;
    run(w, 120);
    expect(m.needs.hunger).toBeCloseTo(80 - 5.5 * 2, 0);
    expect(m.needs.bladder).toBeCloseTo(80 - 8.5 * 2, 0);
  });

  it('mood weighs low needs heavily', () => {
    const ok = fullNeeds(70);
    const bad = { ...fullNeeds(70), bladder: 3 };
    expect(moodOf(ok)).toBeGreaterThan(20);
    expect(moodOf(bad)).toBeLessThan(moodOf(ok) - 25);
  });

  it('room need drifts toward the room score (nicer rooms score higher)', () => {
    const { w, m } = house();
    w.freeWill = false;
    const living = w.roomScoreAt(9, 12);
    const spare = w.roomScoreAt(15, 7);
    expect(living).toBeGreaterThan(spare);
    run(w, 90);
    expect(Math.abs(m.needs.room - living)).toBeLessThan(1);
  });
});

describe('objects', () => {
  it('footprints rotate with facing', () => {
    expect(footprintTiles(OBJECTS.sofa, 3, 3, 0)).toEqual([[3, 3], [4, 3]]);
    expect(footprintTiles(OBJECTS.sofa, 3, 3, 1)).toEqual([[3, 3], [3, 4]]);
    expect(footprintTiles(OBJECTS.bed_single, 3, 3, 3)).toEqual([[3, 3], [4, 3]]);
  });

  it('a queued interaction walks over, uses the object and raises the need', () => {
    const { w, m } = house();
    w.freeWill = false;
    m.needs.bladder = 20;
    const toilet = w.objects.find((o) => o.def === 'toilet')!;
    w.queueInteraction(m, toilet, 'use');
    run(w, 30);
    expect(m.needs.bladder).toBeGreaterThan(90);
    expect(m.queue).toHaveLength(0);
    expect(toilet.reserved[0]).toBe(0);
    expect(m.pose).toBe('stand');
    // standing back on a walkable tile, not inside the toilet
    expect(objTiles(toilet).some(([x, y]) => x === Math.floor(m.x) && y === Math.floor(m.y))).toBe(false);
  });

  it('sleeping in bed restores energy and lies the Mim down', () => {
    const { w, m } = house();
    w.freeWill = false;
    m.needs.energy = 10;
    const bed = w.objects.find((o) => o.def === 'bed_single')!;
    w.queueInteraction(m, bed, 'sleep');
    run(w, 30);
    expect(m.pose).toBe('lie');
    expect(m.lie).toBeDefined();
    for (let t = 0; t < 12 * 60 && m.queue.length; t += 0.25) w.step(0.25);
    expect(m.needs.energy).toBeGreaterThan(98);
    expect(m.pose).toBe('stand');
  });

  it('watching TV prefers a seat in the same room', () => {
    const { w, m } = house();
    w.freeWill = false;
    m.needs.fun = 10;
    const tv = w.objects.find((o) => o.def === 'tv')!;
    w.queueInteraction(m, tv, 'watch');
    run(w, 10);
    expect(m.pose).toBe('sit');
    expect(tv.state.on).toBe(true);
    const sofa = w.objects.find((o) => o.def === 'sofa')!;
    expect(sofa.reserved).toContain(m.id);
  });

  it('two Mims never share one slot', () => {
    const { w, m } = house();
    w.freeWill = false;
    const m2 = w.addMim('Dotty', randomLook(w.rng), 10, 12);
    const toilet = w.objects.find((o) => o.def === 'toilet')!;
    w.queueInteraction(m, toilet, 'use');
    w.queueInteraction(m2, toilet, 'use');
    run(w, 1);
    // the second Mim found no free slot and gave up rather than double-booking
    expect(toilet.reserved.filter((r) => r !== 0)).toHaveLength(1);
  });

  it('cooking chains fridge -> stove -> eating at a seat', () => {
    const { w, m } = house();
    w.freeWill = false;
    m.needs.hunger = 15;
    const fridge = w.objects.find((o) => o.def === 'fridge_basic')!;
    w.queueInteraction(m, fridge, 'cook');
    const seen = new Set<string>();
    for (let t = 0; t < 60; t += 0.25) {
      w.step(0.25);
      if (m.queue[0]) seen.add(`${m.queue[0].kind}:${m.queue[0].label}:${m.queue[0].phase}`);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['interact:Cook:use', 'eat:Eat:use']));
    expect(m.needs.hunger).toBeGreaterThan(70);
    expect(m.carry).toBeUndefined();
  });

  it('unreachable objects fail gracefully with a notice', () => {
    const w = new World(16);
    w.freeWill = false;
    w.lot.addRoom(2, 2, 6, 6, 0);
    const toilet = w.addObject('toilet', 3, 3, 0);
    const m = w.addMim('Gus', randomLook(w.rng), 10, 10);
    w.queueInteraction(m, toilet, 'use');
    run(w, 1);
    expect(m.queue).toHaveLength(0);
    expect(w.outbox.some((n) => n.text.includes("can't reach"))).toBe(true);
  });

  it('player actions bump autonomous ones', () => {
    const { w, m } = house();
    const shelf = w.objects.find((o) => o.def === 'bookshelf')!;
    const toilet = w.objects.find((o) => o.def === 'toilet')!;
    w.queueInteraction(m, shelf, 'read', true);
    w.queueInteraction(m, toilet, 'use', true);
    w.queueInteraction(m, toilet, 'use', false);
    expect(m.queue[0].cancel).toBe(true);
    expect(m.queue.filter((a) => a.auto)).toHaveLength(1);
  });
});

describe('free will', () => {
  it('a desperate bladder wins', () => {
    const { w, m } = house();
    m.needs.bladder = 5;
    const c = chooseAutonomous(w, m)!;
    expect(c.obj?.def).toBe('toilet');
  });

  it('a tired Mim heads to bed', () => {
    const { w, m } = house();
    m.needs = { ...fullNeeds(85), energy: 8 };
    const c = chooseAutonomous(w, m)!;
    expect(c.obj?.def).toBe('bed_single');
  });

  it('a lone Mim with free will looks after itself for 3 days', () => {
    const { w, m } = house(42);
    let low = 100;
    let moodSum = 0;
    let samples = 0;
    for (let t = 0; t < 3 * 24 * 60; t += 0.25) {
      w.step(0.25);
      if (t > 60 && Math.floor(t) % 30 === 0 && t % 1 === 0) {
        moodSum += moodOf(m.needs);
        samples++;
        low = Math.min(low, m.needs.hunger, m.needs.energy, m.needs.bladder, m.needs.hygiene);
      }
    }
    expect(low).toBeGreaterThan(5);
    expect(moodSum / samples).toBeGreaterThan(0);
  });
});

describe('regressions', () => {
  it('a starving Mim with free will eats within 2 hours instead of looping on cooking', () => {
    const { w, m } = house(3);
    m.needs.hunger = 8;
    let ate = false;
    for (let t = 0; t < 120; t += 0.25) {
      w.step(0.25);
      if (m.queue[0]?.kind === 'eat' && m.queue[0].phase === 'use') ate = true;
    }
    expect(ate).toBe(true);
    expect(m.needs.hunger).toBeGreaterThan(40);
  });

  it('hunger dropping below the urgent line mid-cook does not cancel the chore', () => {
    const { w, m } = house(5);
    w.freeWill = false;
    m.needs.hunger = 13;
    const fridge = w.objects.find((o) => o.def === 'fridge_basic')!;
    w.queueInteraction(m, fridge, 'cook', true);
    w.freeWill = true;
    for (let t = 0; t < 90; t += 0.25) w.step(0.25);
    expect(m.needs.hunger).toBeGreaterThan(50);
  });
});
