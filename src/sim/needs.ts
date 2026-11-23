export const NEEDS = ['hunger', 'energy', 'hygiene', 'bladder', 'fun', 'social', 'comfort', 'room'] as const;
export type Need = (typeof NEEDS)[number];
export type Needs = Record<Need, number>;
export type NeedDelta = Partial<Record<Need, number>>;

export const NEED_INFO: Record<Need, { label: string; icon: string }> = {
  hunger: { label: 'Hunger', icon: '🍗' },
  energy: { label: 'Energy', icon: '💤' },
  hygiene: { label: 'Hygiene', icon: '🧼' },
  bladder: { label: 'Bladder', icon: '🚽' },
  fun: { label: 'Fun', icon: '🎈' },
  social: { label: 'Social', icon: '💬' },
  comfort: { label: 'Comfort', icon: '🛋️' },
  room: { label: 'Room', icon: '🌼' },
};

/** Points lost per game hour while awake and standing around. Room is not decayed; it drifts toward the room score. */
export const DECAY: Record<Need, number> = {
  hunger: 5.5,
  energy: 4.2,
  hygiene: 3.5,
  bladder: 8.5,
  fun: 5,
  social: 3,
  comfort: 6,
  room: 0,
};

export function fullNeeds(v = 80): Needs {
  return { hunger: v, energy: v, hygiene: v, bladder: v, fun: v, social: v, comfort: v, room: 50 };
}

export function clampNeed(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function addNeeds(n: Needs, d: NeedDelta, scale = 1): void {
  for (const k in d) {
    const key = k as Need;
    n[key] = clampNeed(n[key] + (d[key] ?? 0) * scale);
  }
}

/** Low needs weigh more, so one desperate need drags mood down sharply. Returns -100..100. */
export function moodOf(n: Needs): number {
  let sum = 0;
  let wsum = 0;
  for (const k of NEEDS) {
    const v = n[k];
    const w = 1 + ((100 - v) / 25) ** 2 * 0.5;
    sum += w * (v - 50) * 2;
    wsum += w;
  }
  return Math.max(-100, Math.min(100, sum / wsum));
}

/** How much a Mim cares about gaining points in a need at its current level (free will weighting). */
export function urgency(v: number): number {
  const d = (100 - v) / 100;
  return d * d * 3 + 0.04;
}

/** The lowest need, used for thought bubbles and complaints. */
export function worstNeed(n: Needs): [Need, number] {
  let best: Need = 'hunger';
  for (const k of NEEDS) if (n[k] < n[best]) best = k;
  return [best, n[best]];
}
