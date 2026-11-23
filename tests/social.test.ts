import { describe, expect, it } from 'vitest';
import { World, HOUSEHOLD_MAX } from '../src/sim/world';
import { randomLook } from '../src/content/looks';
import { addFumblewicks, buildStarterHouse } from '../src/content/starter';
import { NEEDS, moodOf } from '../src/sim/needs';

function pair(seed = 11) {
  const w = new World(24, seed);
  w.freeWill = false;
  buildStarterHouse(w);
  const a = w.addMim('Ada', randomLook(w.rng), 7, 12);
  const b = w.addMim('Bo', randomLook(w.rng), 10, 13);
  return { w, a, b };
}
const run = (w: World, mins: number) => { for (let t = 0; t < mins; t += 0.25) w.step(0.25); };

describe('social interactions', () => {
  it('household members start friendly and the relationship is symmetric', () => {
    const { w, a, b } = pair();
    expect(w.rel(a.id, b.id)).toBe(w.rel(b.id, a.id));
    expect(w.rel(a.id, b.id).daily).toBe(30);
  });

  it('a chat walks over, holds the other Mim in place and raises Social and the relationship', () => {
    const { w, a, b } = pair();
    a.needs.social = 20;
    b.needs.social = 20;
    w.rng.next = () => 0.01; // always accepted
    w.queueSocial(a, b, 'weather');
    let engaged = false;
    for (let t = 0; t < 20; t += 0.25) {
      w.step(0.25);
      if (b.engaged) engaged = true;
    }
    expect(engaged).toBe(true);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1.6);
    expect(a.needs.social).toBeGreaterThan(25);
    expect(b.needs.social).toBeGreaterThan(25);
    expect(w.rel(a.id, b.id).daily).toBeGreaterThan(30);
    expect(a.queue).toHaveLength(0);
    expect(b.engaged).toBeUndefined();
    expect(w.speechOut.length).toBeGreaterThan(2);
  });

  it('a rejected joke hurts a little and tells the player why', () => {
    const { w, a, b } = pair();
    w.rng.next = () => 0.99; // always rejected (joke acceptance is capped below this)
    w.queueSocial(a, b, 'joke');
    run(w, 15);
    expect(w.rel(a.id, b.id).daily).toBeLessThan(30);
    expect(w.outbox.some((n) => n.text.includes('explains the joke back'))).toBe(true);
  });

  it('relationship gates what is on offer', () => {
    const { w, a, b } = pair();
    const opts = () => Object.fromEntries(w.socialOptions(a, b).map((o) => [o.def.id, o.ok]));
    expect(opts().hug).toBe(false); // needs 40+
    expect(opts().slap).toBe(false);
    w.rel(a.id, b.id).daily = 60;
    expect(opts().hug).toBe(true);
    expect(opts().backrub).toBe(true);
    w.rel(a.id, b.id).daily = -50;
    expect(opts().slap).toBe(true);
    expect(opts().dance).toBe(false); // relationship and no music
  });

  it('sleeping Mims are not available to chat', () => {
    const { w, a, b } = pair();
    b.needs.energy = 5;
    w.queueInteraction(b, w.objects.find((o) => o.def === 'bed_single')!, 'sleep');
    run(w, 20);
    expect(b.pose).toBe('lie');
    expect(w.available(b)).toBe(false);
    w.queueSocial(a, b, 'chat');
    run(w, 1);
    expect(a.queue).toHaveLength(0);
  });

  it('a player-queued Mim waits for an occupied toilet, then uses it', () => {
    const { w, a, b } = pair();
    const toilet = w.objects.find((o) => o.def === 'toilet')!;
    a.needs.bladder = 10;
    b.needs.bladder = 30;
    w.queueInteraction(a, toilet, 'use');
    run(w, 6);
    expect(toilet.reserved[0]).toBe(a.id);
    w.queueInteraction(b, toilet, 'use');
    run(w, 1);
    expect(b.queue).toHaveLength(1); // waiting, not given up
    run(w, 30);
    expect(b.needs.bladder).toBeGreaterThan(90);
  });

  it('eating together is a little social', () => {
    const { w, a, b } = pair();
    a.needs.social = b.needs.social = 30;
    w.queueEat(a, 40, false);
    w.queueEat(b, 40, false);
    run(w, 10);
    expect(a.queue[0]?.kind).toBe('eat');
    const before = w.rel(a.id, b.id).daily;
    run(w, 5);
    expect(a.needs.social).toBeGreaterThan(30);
    expect(w.rel(a.id, b.id).daily).toBeGreaterThan(before);
  });

  it('daily scores drift back toward lifetime scores', () => {
    const { w, a, b } = pair();
    w.rel(a.id, b.id).daily = 90;
    run(w, 3 * 1440);
    const r = w.rel(a.id, b.id);
    expect(r.daily).toBeLessThan(90);
    expect(r.life).toBeGreaterThan(30);
  });

  it('a household holds at most 8 Mims', () => {
    const w = new World(24, 1);
    for (let i = 0; i < HOUSEHOLD_MAX; i++) w.addMim(`M${i}`, randomLook(w.rng), i, 20);
    expect(() => w.addMim('One Too Many', randomLook(w.rng), 9, 20)).toThrow();
  });

  it('each Mim has a stable voice of its own', () => {
    const w = new World(24, 1);
    addFumblewicks(w);
    const pitches = new Set(w.mims.map((m) => Math.round(m.voice.pitch)));
    expect(pitches.size).toBe(4);
  });
});

describe('the Fumblewicks, 3 days of free will', () => {
  it('stay fed, rested and social, and their relationships move', () => {
    const w = new World(24, 21);
    buildStarterHouse(w);
    addFumblewicks(w);
    const lows: Record<string, number> = {};
    let socialSum = 0, moodSum = 0, n = 0, socials = 0;
    const seen = new Set<number>();
    for (let t = 0; t < 3 * 1440; t += 0.25) {
      w.step(0.25);
      for (const m of w.mims) {
        const a = m.queue[0];
        if (a?.kind === 'social' && !seen.has(a.uid)) {
          seen.add(a.uid);
          socials++;
        }
        if (t > 120) for (const k of NEEDS) lows[k] = Math.min(lows[k] ?? 100, m.needs[k]);
      }
      if (t > 240 && t % 30 === 0) {
        for (const m of w.mims) {
          socialSum += m.needs.social;
          moodSum += moodOf(m.needs);
          n++;
        }
      }
    }
    expect(lows.hunger).toBeGreaterThan(5);
    expect(lows.bladder).toBeGreaterThan(5);
    expect(lows.energy).toBeGreaterThan(5);
    expect(socials).toBeGreaterThan(10);
    expect(socialSum / n).toBeGreaterThan(40);
    expect(moodSum / n).toBeGreaterThan(10);
    const dailies = Object.values(w.rels).map((r) => r.daily);
    expect(dailies.some((d) => Math.abs(d - 30) > 5)).toBe(true);
  });
});
