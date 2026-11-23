import { describe, expect, it } from 'vitest';
import { Gesture, GestureRecognizer, PointerIn } from '../src/engine/input';

function run(events: Omit<PointerIn, 'pointer'>[], pointer = 'touch'): Gesture[] {
  const out: Gesture[] = [];
  const g = new GestureRecognizer((x) => out.push(x));
  for (const e of events) {
    g.tick(e.t);
    g.handle({ ...e, pointer });
  }
  return out;
}

describe('gesture recognizer', () => {
  it('a quick press and release is a tap', () => {
    const g = run([
      { id: 1, x: 100, y: 100, t: 0, kind: 'down' },
      { id: 1, x: 103, y: 101, t: 60, kind: 'move' },
      { id: 1, x: 103, y: 101, t: 120, kind: 'up' },
    ]);
    expect(g.map((x) => x.type)).toEqual(['tap']);
  });

  it('a slow drag is a pan, not a tap', () => {
    const g = run([
      { id: 1, x: 100, y: 100, t: 0, kind: 'down' },
      { id: 1, x: 110, y: 104, t: 200, kind: 'move' },
      { id: 1, x: 150, y: 120, t: 400, kind: 'move' },
      { id: 1, x: 150, y: 120, t: 450, kind: 'up' },
    ]);
    expect(g.map((x) => x.type)).toEqual(['dragstart', 'dragmove', 'dragmove', 'dragend']);
  });

  it('holding still fires a long-press and no tap', () => {
    const g = run([
      { id: 1, x: 100, y: 100, t: 0, kind: 'down' },
      { id: 1, x: 101, y: 100, t: 600, kind: 'move' },
      { id: 1, x: 101, y: 100, t: 700, kind: 'up' },
    ]);
    expect(g.map((x) => x.type)).toEqual(['longpress']);
  });

  it('two fingers spreading apart pinch-zoom', () => {
    const g = run([
      { id: 1, x: 100, y: 100, t: 0, kind: 'down' },
      { id: 2, x: 200, y: 100, t: 10, kind: 'down' },
      { id: 2, x: 250, y: 100, t: 50, kind: 'move' },
      { id: 1, x: 100, y: 100, t: 80, kind: 'up' },
      { id: 2, x: 250, y: 100, t: 90, kind: 'up' },
    ]);
    const pinch = g.find((x) => x.type === 'pinch');
    expect(pinch && pinch.type === 'pinch' && pinch.scale).toBeCloseTo(1.5);
    expect(g.at(-1)!.type).toBe('pinchend');
    expect(g.some((x) => x.type === 'tap')).toBe(false);
  });

  it('a two-finger twist rotates one stop in the twist direction', () => {
    const events: Omit<PointerIn, 'pointer'>[] = [
      { id: 1, x: 100, y: 100, t: 0, kind: 'down' },
      { id: 2, x: 200, y: 100, t: 5, kind: 'down' },
    ];
    // rotate finger 2 around finger 1 clockwise (screen y down) by about 50 degrees
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * 0.9;
      events.push({ id: 2, x: 100 + 100 * Math.cos(a), y: 100 + 100 * Math.sin(a), t: 5 + i * 10, kind: 'move' });
    }
    const g = run(events);
    const twists = g.filter((x) => x.type === 'twist');
    expect(twists).toHaveLength(1);
    expect(twists[0].type === 'twist' && twists[0].dir).toBe(1);
  });

  it('mouse movement without buttons is hover', () => {
    const g = run([{ id: 1, x: 5, y: 5, t: 0, kind: 'move' }], 'mouse');
    expect(g[0].type).toBe('hover');
  });
});
