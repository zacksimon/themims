import type { NeedDelta, Need } from '../sim/needs';
import type { ObjInst } from '../sim/objects';
import type { Mim } from '../sim/mim';
import type { World } from '../sim/world';
import type { Painter } from '../world/render/painter';

export type Category = 'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'fun' | 'decor';

export interface SlotDef {
  /** Local tiles a Mim may walk to in order to use this slot (any reachable one works). */
  routes: [number, number][];
  pose: 'stand' | 'sit' | 'lie';
  /** Where the Mim is placed while using, in local coordinates. Defaults to the route tile they arrived on. */
  at?: [number, number];
  z?: number;
  /** Local point the Mim faces while using. */
  face?: [number, number];
  /** For lying: local head and feet points. */
  head?: [number, number];
  feet?: [number, number];
}

export interface InteractionDef {
  id: string;
  label: string;
  icon: string;
  /** Allowed slot indices (default: all). */
  slots?: number[];
  /** Prefer a nearby seat in the same room (TV, reading) over this object's own slots. */
  seat?: boolean;
  /** Fixed duration in game minutes. */
  minutes?: number;
  /** End when this need is full (capped by maxMinutes). */
  untilFull?: Need;
  maxMinutes?: number;
  /** Need change per game hour while using. */
  rates?: NeedDelta;
  /** Advertised total gain for free will (defaults to rates over the expected duration). */
  adv?: NeedDelta;
  /** Can Mims choose this on their own? (default true) */
  auto?: boolean;
  /** Hidden from the pie menu (internal chain steps). */
  hidden?: boolean;
  /** Counts as sleeping for need decay. */
  sleep?: boolean;
  cost?: number;
  carry?: string;
  /** Free will only considers this when the need is below the threshold (night time raises sleep's threshold). */
  want?: { need: Need; below: number };
  available?: (w: World, m: Mim, o: ObjInst) => boolean;
  /** Called when the interaction finishes normally. */
  done?: (w: World, m: Mim, o: ObjInst) => void;
}

export interface ObjectDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  category: Category;
  /** Footprint in local tiles [w, h]; the front faces +y. */
  size: [number, number];
  /** Height in world units, for picking. */
  height: number;
  /** Does the footprint block walking? (default true) */
  blocks?: boolean;
  /** Contribution to the Room need of the room it sits in. */
  room?: number;
  /** Seats add comfort while sitting and can host seat-preferring interactions. */
  seatComfort?: number;
  slots: SlotDef[];
  interactions: InteractionDef[];
  draw(p: Painter, o: ObjInst | null, t: number): void;
}

const FRONT: [number, number][] = [[0, 1]];
const SIDES: [number, number][] = [[0, 1], [-1, 0], [1, 0]];

function chairDraw(seat: string, wood: string) {
  return (p: Painter) => {
    for (const [x, y] of [[0.22, 0.25], [0.7, 0.25], [0.22, 0.72], [0.7, 0.72]]) p.box(x, y, x + 0.08, y + 0.08, 0, 0.42, wood);
    p.box(0.18, 0.2, 0.82, 0.82, 0.42, 0.5, seat);
    p.box(0.18, 0.16, 0.82, 0.24, 0.5, 1.25, wood, -0.05);
  };
}

const def = (d: ObjectDef) => d;

export const OBJECTS: Record<string, ObjectDef> = {
  fridge_basic: def({
    id: 'fridge_basic', name: 'Chillmaster Basic Fridge', desc: 'Keeps food cold and secrets colder.',
    price: 600, category: 'kitchen', size: [1, 1], height: 2.1,
    slots: [{ routes: FRONT, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [
      { id: 'snack', label: 'Grab a Snack', icon: '🥨', minutes: 4, want: { need: 'hunger', below: 60 }, rates: { hunger: 300 }, adv: { hunger: 20 }, carry: 'snack' },
      {
        id: 'cook', label: 'Cook a Meal', icon: '🍳', minutes: 3, adv: { hunger: 60 }, want: { need: 'hunger', below: 65 }, carry: 'groceries',
        done: (w, m) => w.chainCook(m),
      },
    ],
    draw: (p) => {
      p.box(0.1, 0.12, 0.9, 0.9, 0, 2.05, '#eef1f4');
      p.box(0.1, 0.9, 0.9, 0.92, 1.35, 1.38, '#b8c0c8');
      p.box(0.72, 0.92, 0.78, 0.95, 1.45, 1.85, '#8a96a3');
      p.box(0.72, 0.92, 0.78, 0.95, 0.6, 1.2, '#8a96a3');
    },
  }),
  stove: def({
    id: 'stove', name: 'Hot Box Stove', desc: 'Four burners, one of which works reliably.',
    price: 400, category: 'kitchen', size: [1, 1], height: 1.1,
    slots: [{ routes: FRONT, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [
      { id: 'cookfood', label: 'Cook', icon: '🍳', minutes: 10, hidden: true, auto: false, carry: 'pan', done: (w, m) => w.queueEat(m, 70, m.queue[0]?.auto ?? true) },
    ],
    draw: (p, o) => {
      p.box(0.06, 0.1, 0.94, 0.94, 0, 1.0, '#d9d4cc');
      p.box(0.2, 0.94, 0.8, 0.96, 0.15, 0.75, '#2f2f3a');
      const on = o?.state.on;
      for (const [x, y] of [[0.22, 0.25], [0.58, 0.25], [0.22, 0.6], [0.58, 0.6]]) p.flat(x, y, x + 0.2, y + 0.2, 1.01, on && x < 0.3 && y < 0.3 ? '#ff6a3a' : '#3a3a44', 0.02);
    },
  }),
  counter: def({
    id: 'counter', name: 'Countertop of Destiny', desc: "A flat surface. That's the whole pitch.",
    price: 250, category: 'kitchen', size: [1, 1], height: 1.05, slots: [], interactions: [],
    draw: (p) => {
      p.box(0.02, 0.1, 0.98, 0.95, 0, 0.9, '#c9a77c');
      p.box(0, 0.05, 1, 1, 0.9, 1.02, '#ece6dc');
    },
  }),
  sink: def({
    id: 'sink', name: 'Mostly Clean Sink', desc: 'Pre-stained for your convenience.',
    price: 300, category: 'kitchen', size: [1, 1], height: 1.1,
    slots: [{ routes: FRONT, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [{ id: 'wash', label: 'Wash Hands', icon: '🫧', minutes: 3, rates: { hygiene: 80 }, adv: { hygiene: 4 }, want: { need: 'hygiene', below: 85 } }],
    draw: (p) => {
      p.box(0.05, 0.1, 0.95, 0.95, 0, 0.9, '#9fb7c9');
      p.box(0, 0.05, 1, 1, 0.9, 1.02, '#ece6dc');
      p.flat(0.25, 0.3, 0.75, 0.75, 1.03, '#7aa0bd', 0.02);
      p.box(0.46, 0.12, 0.54, 0.22, 1.02, 1.3, '#b8c0c8');
    },
  }),
  table: def({
    id: 'table', name: 'Wobblewood Table', desc: 'Three legs are perfectly level.',
    price: 200, category: 'kitchen', size: [1, 1], height: 1.0, slots: [], interactions: [], room: 2,
    draw: (p) => {
      for (const [x, y] of [[0.1, 0.1], [0.82, 0.1], [0.1, 0.82], [0.82, 0.82]]) p.box(x, y, x + 0.08, y + 0.08, 0, 0.78, '#8a5a35');
      p.box(0.04, 0.04, 0.96, 0.96, 0.78, 0.88, '#b07a4a');
    },
  }),
  chair_dining: def({
    id: 'chair_dining', name: 'Dining Chair, Respectable', desc: 'For when the in-laws visit.',
    price: 350, category: 'kitchen', size: [1, 1], height: 1.3, seatComfort: 25,
    slots: [{ routes: SIDES, pose: 'sit', at: [0.5, 0.52], z: 0.42, face: [0.5, 2] }],
    interactions: [{ id: 'sit', label: 'Sit', icon: '🪑', want: { need: 'comfort', below: 60 }, untilFull: 'comfort', maxMinutes: 45, adv: { comfort: 25 } }],
    draw: chairDraw('#c95c5c', '#7a4a2a'),
  }),
  bed_single: def({
    id: 'bed_single', name: 'Lumpy Single Bed', desc: 'Each lump has a name.',
    price: 300, category: 'bedroom', size: [1, 2], height: 0.9, seatComfort: 5, room: 1,
    slots: [{
      routes: [[-1, 0], [-1, 1], [1, 0], [1, 1], [0, 2]], pose: 'lie', at: [0.5, 1.0], z: 0.5,
      head: [0.5, 0.35], feet: [0.5, 1.75],
    }],
    interactions: [
      { id: 'sleep', label: 'Sleep', icon: '😴', want: { need: 'energy', below: 40 }, untilFull: 'energy', maxMinutes: 12 * 60, rates: { energy: 12, comfort: 10 }, adv: { energy: 70, comfort: 10 }, sleep: true },
      { id: 'nap', label: 'Nap', icon: '💤', minutes: 60, rates: { energy: 10, comfort: 10 }, adv: { energy: 10, comfort: 10 }, sleep: true, auto: false },
    ],
    draw: (p) => {
      p.box(0.05, 0, 0.95, 2, 0, 0.32, '#8a5a35');
      p.box(0.05, 0, 0.95, 0.14, 0.32, 0.9, '#7a4a2a', -0.2);
      p.box(0.1, 0.12, 0.9, 1.95, 0.32, 0.48, '#f2efe6');
      p.box(0.18, 0.18, 0.82, 0.55, 0.48, 0.58, '#ffffff', -0.1);
      p.flat(0.1, 0.7, 0.9, 1.95, 0.5, '#5d78b3', -0.6);
    },
  }),
  toilet: def({
    id: 'toilet', name: 'Porcelain Throne, Economy', desc: 'Clogs on a schedule only it understands.',
    price: 300, category: 'bathroom', size: [1, 1], height: 1.2,
    slots: [{ routes: SIDES, pose: 'sit', at: [0.5, 0.55], z: 0.4, face: [0.5, 2] }],
    interactions: [{ id: 'use', label: 'Use', icon: '🚽', want: { need: 'bladder', below: 55 }, untilFull: 'bladder', maxMinutes: 12, rates: { bladder: 700 }, adv: { bladder: 90 } }],
    draw: (p) => {
      p.box(0.3, 0.35, 0.7, 0.8, 0, 0.35, '#f4f4f6');
      p.box(0.24, 0.32, 0.76, 0.88, 0.35, 0.42, '#ffffff');
      p.box(0.22, 0.08, 0.78, 0.3, 0.3, 1.15, '#f4f4f6', -0.05);
    },
  }),
  shower: def({
    id: 'shower', name: 'Drizzle Shower', desc: 'Water pressure: emotional.',
    price: 650, category: 'bathroom', size: [1, 1], height: 2.3, blocks: true,
    slots: [{ routes: FRONT, pose: 'stand', at: [0.5, 0.55], face: [0.5, 2] }],
    interactions: [{ id: 'shower', label: 'Take a Shower', icon: '🚿', want: { need: 'hygiene', below: 60 }, untilFull: 'hygiene', maxMinutes: 40, rates: { hygiene: 160 }, adv: { hygiene: 70 } }],
    draw: (p, o) => {
      p.box(0, 0, 1, 1, 0, 0.1, '#dfe8ee', -0.5);
      p.box(0, 0, 0.06, 1, 0.1, 2.2, '#bcd4e0', -0.2);
      p.box(0, 0, 1, 0.06, 0.1, 2.2, '#bcd4e0', -0.2);
      p.box(0.42, 0.06, 0.58, 0.2, 1.95, 2.05, '#9aa4ad', -0.1);
      if (o?.state.on) p.flat(0.15, 0.2, 0.85, 0.85, 0.11, 'rgba(140,200,240,0.7)', -0.1);
    },
  }),
  sofa: def({
    id: 'sofa', name: 'Sofa of Questionable Origin', desc: 'Found on a curb. Cleaned once.',
    price: 450, category: 'living', size: [2, 1], height: 1.2, seatComfort: 30, room: 2,
    slots: [
      { routes: [[0, 1], [-1, 0]], pose: 'sit', at: [0.55, 0.55], z: 0.45, face: [0.55, 3] },
      { routes: [[1, 1], [2, 0]], pose: 'sit', at: [1.45, 0.55], z: 0.45, face: [1.45, 3] },
    ],
    interactions: [
      { id: 'sit', label: 'Sit', icon: '🛋️', want: { need: 'comfort', below: 60 }, untilFull: 'comfort', maxMinutes: 60, adv: { comfort: 30 } },
      { id: 'nap', label: 'Nap', icon: '💤', want: { need: 'energy', below: 50 }, minutes: 45, rates: { energy: 6 }, adv: { energy: 5, comfort: 20 }, sleep: true },
    ],
    // Built from one-tile pieces so seated Mims sort correctly against each half.
    draw: (p) => {
      for (const x0 of [0.02, 1]) {
        p.box(x0, 0.15, x0 + 0.98, 0.95, 0, 0.45, '#6b8f5a', -0.05);
        p.box(x0, 0.05, x0 + 0.98, 0.32, 0.45, 1.15, '#5f8250', -0.05);
      }
      p.box(0.02, 0.15, 0.22, 0.95, 0.45, 0.8, '#5f8250', 0.05);
      p.box(1.78, 0.15, 1.98, 0.95, 0.45, 0.8, '#5f8250', 0.05);
    },
  }),
  tv: def({
    id: 'tv', name: 'Gloworama TV', desc: 'Shows 11 channels, 9 of which are infomercials.',
    price: 500, category: 'fun', size: [1, 1], height: 1.5,
    slots: [{ routes: [[0, 2], [0, 3], [-1, 2], [1, 2]], pose: 'stand', face: [0.5, 0.5] }],
    interactions: [
      { id: 'watch', label: 'Watch TV', icon: '📺', seat: true, untilFull: 'fun', maxMinutes: 90, rates: { fun: 30 }, adv: { fun: 35 } },
    ],
    draw: (p, o, t) => {
      p.box(0.15, 0.3, 0.85, 0.7, 0, 0.55, '#5a4632');
      p.box(0.12, 0.35, 0.88, 0.6, 0.55, 1.45, '#2a2a33');
      const on = o?.state.on;
      const flick = on ? ['#7fd3ff', '#a0f0c0', '#ffd27f', '#ff9fd0'][Math.floor(t / 700) % 4] : '#3c4250';
      p.box(0.17, 0.6, 0.83, 0.62, 0.62, 1.38, flick, 0.01);
    },
  }),
  bookshelf: def({
    id: 'bookshelf', name: 'Bookshelf of Unread Classics', desc: 'Makes the room look smarter.',
    price: 400, category: 'fun', size: [1, 1], height: 2.1, room: 3,
    slots: [{ routes: FRONT, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [{ id: 'read', label: 'Read a Book', icon: '📖', seat: true, minutes: 50, rates: { fun: 14 }, adv: { fun: 12 }, carry: 'book' }],
    draw: (p) => {
      p.box(0.05, 0.1, 0.95, 0.55, 0, 2.0, '#7a4a2a');
      const cols = ['#c95c5c', '#4f7fd9', '#f2c14e', '#5cc8a8', '#c95ca8'];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) p.box(0.12 + i * 0.2, 0.5, 0.28 + i * 0.2, 0.56, 0.15 + r * 0.48, 0.5 + r * 0.48, cols[(r + i) % 5], 0.01);
    },
  }),
  boombox: def({
    id: 'boombox', name: 'Boombox Supreme', desc: 'Plays every genre loudly.',
    price: 350, category: 'fun', size: [1, 1], height: 0.8,
    slots: [
      { routes: [[0, 1]], pose: 'stand', face: [0.5, 0.5] },
      { routes: [[-1, 1]], pose: 'stand', face: [0.5, 0.5] },
      { routes: [[1, 1]], pose: 'stand', face: [0.5, 0.5] },
    ],
    interactions: [
      { id: 'dance', label: 'Dance', icon: '💃', minutes: 30, rates: { fun: 40, energy: -6, social: 6 }, adv: { fun: 20 } },
    ],
    draw: (p, o) => {
      p.box(0.2, 0.35, 0.8, 0.65, 0, 0.18, '#4a4a52');
      p.box(0.15, 0.3, 0.85, 0.7, 0.18, 0.62, o?.state.on ? '#ff7a59' : '#c95c5c');
      p.box(0.2, 0.7, 0.42, 0.72, 0.25, 0.55, '#2a2a33', 0.01);
      p.box(0.58, 0.7, 0.8, 0.72, 0.25, 0.55, '#2a2a33', 0.01);
    },
  }),
  fern: def({
    id: 'fern', name: 'Potted Fern Named Steve', desc: 'Steve needs you. Steve will remember this.',
    price: 90, category: 'decor', size: [1, 1], height: 1.2, room: 8,
    slots: [{ routes: SIDES, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [{ id: 'water', label: 'Water Steve', icon: '💧', minutes: 3, auto: false, done: (w, m) => w.notify(`${m.name} watered Steve. Steve seems grateful, in a fern way.`) }],
    draw: (p) => {
      p.box(0.3, 0.3, 0.7, 0.7, 0, 0.4, '#b5654a');
      p.blob(0.5, 0.5, 0.7, 0.28, '#4f9a45');
      p.blob(0.35, 0.45, 0.9, 0.2, '#5cb050');
      p.blob(0.62, 0.55, 1.0, 0.18, '#62bb56');
    },
  }),
  lava_lamp: def({
    id: 'lava_lamp', name: 'Lava Lamp of Ambiance', desc: 'Blobs. Endless blobs.',
    price: 140, category: 'decor', size: [1, 1], height: 1.3, room: 6,
    slots: [{ routes: SIDES, pose: 'stand', face: [0.5, 0.5] }],
    interactions: [{ id: 'stare', label: 'Stare At', icon: '🫠', minutes: 20, rates: { fun: 15 }, adv: { fun: 4 } }],
    draw: (p, _o, t) => {
      p.box(0.35, 0.35, 0.65, 0.65, 0, 0.75, '#3a3a4a');
      p.box(0.4, 0.4, 0.6, 0.6, 0.75, 1.2, '#c95ca8');
      p.blob(0.5, 0.5, 0.85 + Math.sin(t / 900) * 0.15, 0.06, '#ffb347', 0.2);
    },
  }),
};

export const CATALOG_ORDER = Object.keys(OBJECTS);
