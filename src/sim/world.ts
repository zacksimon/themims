import { Lot } from '../world/lot';
import { Rng } from '../engine/rng';
import { Action, MAX_QUEUE, Mim, createMim, faceToward, mimTile, stepWalk } from './mim';
import { Look } from '../content/looks';
import { Tile, findPath } from '../world/pathfinding';
import { InteractionDef, OBJECTS } from '../content/objects';
import { Dir, ObjInst, createObj, defOf, footprintTiles, localTile, objCenter, objLocalToWorld, objTiles } from './objects';
import { DECAY, NEEDS, NEED_INFO, Need, addNeeds, clampNeed, worstNeed } from './needs';
import { RoomInfo, computeRooms } from './rooms';
import { chooseAutonomous, findIx } from './freewill';

export interface Notice {
  text: string;
  kind?: 'info' | 'good' | 'bad';
}

interface SlotRef {
  obj: ObjInst;
  slot: number;
  route: Tile;
}

/** All simulation state. Rendering and UI read from it; nothing in here touches the DOM. */
export class World {
  lot: Lot;
  /** Game minutes since day 1, 00:00. */
  time = 8 * 60;
  funds = 20000;
  rng: Rng;
  mims: Mim[] = [];
  objects: ObjInst[] = [];
  freeWill = true;
  nextId = 1;
  /** Bumped when objects are added, moved or removed. */
  objVersion = 0;
  /** Notifications for the UI to show; drained by the game each frame. */
  outbox: Notice[] = [];
  private occCache: { key: string; set: Set<number> } | null = null;
  private roomCache: { key: string; info: RoomInfo } | null = null;

  constructor(n = 24, seed = 1234) {
    this.lot = new Lot(n);
    this.rng = new Rng(seed);
  }

  // ---------- setup ----------

  addMim(name: string, look: Look, tx: number, ty: number): Mim {
    const m = createMim(this.nextId++, name, look, tx, ty);
    this.mims.push(m);
    return m;
  }

  mim(id: number): Mim | undefined {
    return this.mims.find((m) => m.id === id);
  }

  obj(id: number): ObjInst | undefined {
    return this.objects.find((o) => o.id === id);
  }

  addObject(def: string, x: number, y: number, dir: Dir = 0): ObjInst {
    const o = createObj(this.nextId++, def, x, y, dir, this.time);
    this.objects.push(o);
    this.objVersion++;
    return o;
  }

  notify(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.outbox.push({ text, kind });
  }

  // ---------- spatial queries ----------

  private occupancy(): Set<number> {
    const key = `${this.objVersion}`;
    if (this.occCache?.key === key) return this.occCache.set;
    const set = new Set<number>();
    const W = this.lot.n + 1;
    for (const o of this.objects) {
      if (defOf(o).blocks === false) continue;
      for (const [x, y] of objTiles(o)) set.add(y * W + x);
    }
    this.occCache = { key, set };
    return set;
  }

  isBlocked = (x: number, y: number): boolean => this.occupancy().has(y * (this.lot.n + 1) + x);

  objectAtTile(x: number, y: number): ObjInst | undefined {
    for (const o of this.objects) for (const [tx, ty] of objTiles(o)) if (tx === x && ty === y) return o;
    return undefined;
  }

  /** Is a footprint free of walls cutting through it, other objects and the lot edge? */
  canPlace(def: string, x: number, y: number, dir: Dir, ignoreId = -1): boolean {
    const d = OBJECTS[def];
    const tiles = footprintTiles(d, x, y, dir);
    for (const [tx, ty] of tiles) {
      if (!this.lot.inBounds(tx, ty)) return false;
      const other = this.objectAtTile(tx, ty);
      if (other && other.id !== ignoreId) return false;
      for (const m of this.mims) if (m.id && Math.floor(m.x) === tx && Math.floor(m.y) === ty && m.pose !== 'walk') return false;
    }
    const set = new Set(tiles.map(([a, b]) => `${a},${b}`));
    for (const [tx, ty] of tiles) {
      for (const [nx, ny] of [[tx + 1, ty], [tx, ty + 1]]) {
        if (set.has(`${nx},${ny}`) && this.lot.separated(tx, ty, nx, ny)) return false;
      }
    }
    return true;
  }

  rooms(): RoomInfo {
    const key = `${this.lot.version}:${this.objVersion}`;
    if (this.roomCache?.key !== key) this.roomCache = { key, info: computeRooms(this.lot, this.objects) };
    return this.roomCache.info;
  }

  roomIdAt(x: number, y: number): number {
    const n = this.lot.n;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= n || ty >= n) return 0;
    return this.rooms().ids[ty * n + tx];
  }

  roomScoreAt(x: number, y: number): number {
    return this.rooms().score[this.roomIdAt(x, y)] ?? 50;
  }

  hasFreeSlot(o: ObjInst, ix: InteractionDef, m: Mim): boolean {
    const allowed = ix.slots ?? defOf(o).slots.map((_, i) => i);
    return allowed.some((i) => o.reserved[i] === 0 || o.reserved[i] === m.id);
  }

  // ---------- commands ----------

  /** Send a Mim walking to a tile. Returns false (and leaves the Mim alone) when the tile can't be reached. */
  walkTo(m: Mim, target: Tile): boolean {
    const path = findPath(this.lot, mimTile(m), [target], { blocked: this.isBlocked });
    if (!path) return false;
    m.path = path.slice(1);
    if (!m.path.length) m.path = [target];
    return true;
  }

  private nextUid = 1;

  /** Queue a player-chosen (or free will) interaction. Player choices bump autonomous ones out of the queue. */
  queueInteraction(m: Mim, o: ObjInst, ixId: string, auto = false): Action | null {
    const ix = findIx(o.def, ixId);
    if (!ix) return null;
    if (!auto) this.dropAutonomous(m);
    if (m.queue.length >= MAX_QUEUE) return null;
    const a: Action = { uid: this.nextUid++, kind: 'interact', objId: o.id, ix: ixId, auto, phase: 'pending', t: 0, label: ix.label, icon: ix.icon };
    m.queue.push(a);
    return a;
  }

  queueGoto(m: Mim, tile: Tile): Action | null {
    this.dropAutonomous(m);
    if (m.queue.length >= MAX_QUEUE) return null;
    const a: Action = { uid: this.nextUid++, kind: 'goto', tile, auto: false, phase: 'pending', t: 0, label: 'Go Here', icon: '👣' };
    m.queue.push(a);
    return a;
  }

  /** Insert an action right after the current one (used for multi-step chores like cooking). */
  insertNext(m: Mim, a: Omit<Action, 'uid' | 'phase' | 't'>): void {
    const full: Action = { ...a, uid: this.nextUid++, phase: 'pending', t: 0, chained: true };
    m.queue.splice(Math.min(1, m.queue.length), 0, full);
  }

  /** The current autonomous action is asked to wrap up; queued autonomous ones are dropped. */
  private dropAutonomous(m: Mim): void {
    if (m.queue[0]?.auto) m.queue[0].cancel = true;
    m.queue = m.queue.filter((a, i) => i === 0 || !a.auto);
  }

  cancelAction(m: Mim, uid: number): void {
    const i = m.queue.findIndex((a) => a.uid === uid);
    if (i < 0) return;
    if (i === 0) m.queue[0].cancel = true;
    else m.queue.splice(i, 1);
  }

  /** Cooking step 2: after getting groceries, go cook at the nearest stove (or make a sad sandwich). */
  chainCook(m: Mim): void {
    const stove = this.nearest(m, (o) => o.def === 'stove');
    const auto = m.queue[0]?.auto ?? true;
    if (stove) {
      m.carry = 'groceries';
      this.insertNext(m, { kind: 'interact', objId: stove.id, ix: 'cookfood', auto, label: 'Cook', icon: '🍳' });
    } else {
      this.notify(`${m.name} made a sad cold sandwich. A stove would help.`);
      this.queueEat(m, 35, auto);
    }
  }

  queueEat(m: Mim, food: number, auto = true): void {
    m.carry = 'plate';
    this.insertNext(m, { kind: 'eat', auto, label: 'Eat', icon: '🍽️', food });
  }

  nearest(m: Mim, pred: (o: ObjInst) => boolean): ObjInst | undefined {
    let best: ObjInst | undefined;
    let bd = Infinity;
    for (const o of this.objects) {
      if (!pred(o)) continue;
      const [cx, cy] = objCenter(o);
      const d = Math.hypot(cx - m.x, cy - m.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // ---------- simulation ----------

  step(dtMin: number): void {
    this.time += dtMin;
    for (const m of this.mims) this.stepMim(m, dtMin);
  }

  private stepMim(m: Mim, dt: number): void {
    this.decayNeeds(m, dt);
    const a = m.queue[0];
    if (!a) {
      if (m.path.length) stepWalk(m, dt);
      else if (this.freeWill) {
        m.fwTimer -= dt;
        if (m.fwTimer <= 0) this.freeWillTick(m);
      }
    } else {
      this.runAction(m, a, dt);
    }
    this.updateThought(m);
  }

  private decayNeeds(m: Mim, dt: number): void {
    const a = m.queue[0];
    const ix = a?.kind === 'interact' && a.phase === 'use' ? findIx(this.obj(a.objId!)?.def ?? '', a.ix!) : undefined;
    const sleeping = !!ix?.sleep;
    const resting = m.pose === 'sit' || m.pose === 'lie';
    const h = dt / 60;
    for (const k of NEEDS) {
      let r = DECAY[k];
      if (sleeping) r *= ({ hunger: 0.5, bladder: 0.6, hygiene: 0.5, fun: 0, social: 0.3, comfort: 0, energy: 0 } as Record<Need, number>)[k] ?? 1;
      else if (resting) r *= k === 'comfort' ? 0 : k === 'energy' ? 0.7 : 1;
      else if (m.pose === 'walk' && k === 'energy') r *= 1.2;
      m.needs[k] = clampNeed(m.needs[k] - r * h);
    }
    const target = this.roomScoreAt(m.x, m.y);
    m.needs.room = clampNeed(m.needs.room + (target - m.needs.room) * Math.min(1, dt / 15));
  }

  private freeWillTick(m: Mim): void {
    m.fwTimer = this.rng.range(2, 5);
    const c = chooseAutonomous(this, m);
    if (c) {
      this.queueInteraction(m, c.obj, c.ix.id, true);
      return;
    }
    // Nothing worth doing: maybe wander a little.
    if (this.rng.chance(0.35)) {
      const [tx, ty] = mimTile(m);
      const t: Tile = [tx + this.rng.int(-3, 3), ty + this.rng.int(-3, 3)];
      if (this.lot.inBounds(t[0], t[1]) && this.roomIdAt(t[0], t[1]) === this.roomIdAt(m.x, m.y) && !this.isBlocked(t[0], t[1])) this.walkTo(m, t);
    }
  }

  private updateThought(m: Mim): void {
    if (m.thought && m.thought.until > this.time) return;
    m.thought = undefined;
    const [need, v] = worstNeed(m.needs);
    if (v < 30 && this.rng.chance(0.004)) m.thought = { icon: NEED_INFO[need].icon, until: this.time + 4 };
  }

  private think(m: Mim, icon: string, minutes = 5): void {
    m.thought = { icon, until: this.time + minutes };
  }

  /** Candidate slots for an interaction: nearby seats first when the interaction prefers sitting, then the object's own slots. */
  private slotCandidates(m: Mim, o: ObjInst, ix: InteractionDef | null): SlotRef[][] {
    const groups: SlotRef[][] = [];
    const free = (obj: ObjInst, i: number) => obj.reserved[i] === 0 || obj.reserved[i] === m.id;
    const routesOf = (obj: ObjInst, i: number): SlotRef[] =>
      defOf(obj).slots[i].routes.map(([lx, ly]) => ({ obj, slot: i, route: localTile(obj, lx, ly) }));
    if (!ix || ix.seat) {
      const room = this.roomIdAt(...objCenter(o));
      const seats: SlotRef[] = [];
      for (const s of this.objects) {
        const d = defOf(s);
        if (!d.seatComfort || s.id === o.id) continue;
        const [sx, sy] = objCenter(s);
        if (Math.hypot(sx - objCenter(o)[0], sy - objCenter(o)[1]) > (ix ? 7 : 40)) continue;
        if (ix && this.roomIdAt(sx, sy) !== room) continue;
        d.slots.forEach((sl, i) => {
          if (sl.pose === 'sit' && free(s, i)) seats.push(...routesOf(s, i));
        });
      }
      if (seats.length) groups.push(seats);
    }
    if (ix) {
      const own = (ix.slots ?? defOf(o).slots.map((_, i) => i)).filter((i) => free(o, i)).flatMap((i) => routesOf(o, i));
      if (own.length) groups.push(own);
    }
    return groups;
  }

  /** Path to the nearest reachable slot among the candidate groups (earlier groups preferred). */
  private routeToSlot(m: Mim, groups: SlotRef[][]): { ref: SlotRef; path: Tile[] } | null {
    for (const g of groups) {
      const goals = g.filter((r) => !this.isBlocked(r.route[0], r.route[1])).map((r) => r.route);
      const path = findPath(this.lot, mimTile(m), goals, { blocked: this.isBlocked });
      if (!path) continue;
      const [ex, ey] = path[path.length - 1];
      const ref = g.find((r) => r.route[0] === ex && r.route[1] === ey)!;
      return { ref, path };
    }
    return null;
  }

  private runAction(m: Mim, a: Action, dt: number): void {
    if (a.cancel && a.phase !== 'use' && a.phase !== 'exit') return this.finish(m, a, false);
    switch (a.phase) {
      case 'pending':
        return this.begin(m, a);
      case 'walk': {
        if (a.slotObj !== undefined) {
          const so = this.obj(a.slotObj);
          if (!so || so.reserved[a.slot!] !== m.id) return this.finish(m, a, false);
        }
        if (stepWalk(m, dt)) this.arrive(m, a);
        return;
      }
      case 'use':
        return this.use(m, a, dt);
      case 'exit':
        return this.finish(m, a, !a.cancel);
    }
  }

  private begin(m: Mim, a: Action): void {
    if (a.kind === 'goto') {
      if (!this.walkTo(m, a.tile!)) {
        this.think(m, '❓');
        if (!a.auto) this.notify(`${m.name} can't get there. They checked twice.`, 'bad');
        return this.finish(m, a, false);
      }
      a.phase = 'walk';
      return;
    }
    const o = a.kind === 'interact' ? this.obj(a.objId!) : undefined;
    const ix = o ? findIx(o.def, a.ix!) : undefined;
    if (a.kind === 'interact' && (!o || !ix)) return this.finish(m, a, false);
    if (ix?.cost && this.funds < ix.cost) {
      this.notify(`${m.name} can't afford that. ₥${ix.cost} is a lot of Mints.`, 'bad');
      return this.finish(m, a, false);
    }
    // Eating looks for any seat in the house; otherwise eat right here.
    const target = o ?? ({ id: -1, def: 'table', x: Math.floor(m.x), y: Math.floor(m.y), dir: 0, reserved: [], state: {}, paid: 0, boughtAt: 0 } as ObjInst);
    const groups = this.slotCandidates(m, target, a.kind === 'eat' ? null : ix!);
    const r = this.routeToSlot(m, groups);
    if (!r) {
      if (a.kind === 'eat') {
        a.phase = 'use';
        return;
      }
      this.think(m, '❓');
      m.unreachable[o!.id] = this.time + 60;
      if (!a.auto) this.notify(`${m.name} can't reach the ${defOf(o!).name}.`, 'bad');
      return this.finish(m, a, false);
    }
    r.ref.obj.reserved[r.ref.slot] = m.id;
    a.slotObj = r.ref.obj.id;
    a.slot = r.ref.slot;
    a.route = r.ref.route;
    m.path = r.path.slice(1);
    a.phase = 'walk';
    if (!m.path.length) this.arrive(m, a);
  }

  private arrive(m: Mim, a: Action): void {
    if (a.kind === 'goto') return this.finish(m, a, true);
    const so = a.slotObj !== undefined ? this.obj(a.slotObj) : undefined;
    if (so) {
      const sd = defOf(so).slots[a.slot!];
      if (sd.at) [m.x, m.y] = objLocalToWorld(so, sd.at[0], sd.at[1]);
      m.z = sd.z ?? 0;
      m.pose = sd.pose === 'stand' ? 'stand' : sd.pose;
      if (sd.face) faceToward(m, ...objLocalToWorld(so, sd.face[0], sd.face[1]));
      if (sd.pose === 'lie' && sd.head && sd.feet) {
        const [hx, hy] = objLocalToWorld(so, ...sd.head);
        const [fx, fy] = objLocalToWorld(so, ...sd.feet);
        m.lie = [hx, hy, fx, fy];
      }
      // Seat-preferring interactions face the thing they're using (the TV), not the seat's default direction.
      const target = a.objId !== undefined ? this.obj(a.objId) : undefined;
      if (target && target.id !== so.id) faceToward(m, ...objCenter(target));
    }
    const target = a.objId !== undefined ? this.obj(a.objId) : undefined;
    if (target) {
      target.state.on = true;
      const ix = findIx(target.def, a.ix!);
      if (ix?.cost) this.funds -= ix.cost;
      if (ix?.carry) m.carry = ix.carry;
    }
    a.phase = 'use';
    a.t = 0;
  }

  private use(m: Mim, a: Action, dt: number): void {
    a.t += dt;
    const h = dt / 60;
    const so = a.slotObj !== undefined ? this.obj(a.slotObj) : undefined;
    const seat = so ? defOf(so).seatComfort : 0;
    if (seat && (m.pose === 'sit' || m.pose === 'lie')) m.needs.comfort = clampNeed(m.needs.comfort + seat * 2 * h);
    if (a.kind === 'eat') {
      const food = a.food ?? 40;
      m.needs.hunger = clampNeed(m.needs.hunger + (food / 12) * dt);
      if (a.t >= 12 || a.cancel) return this.finish(m, a, !a.cancel);
      return;
    }
    const o = this.obj(a.objId!);
    const ix = o ? findIx(o.def, a.ix!) : undefined;
    if (!o || !ix) return this.finish(m, a, false);
    if (ix.rates) addNeeds(m.needs, ix.rates, h);
    let done = false;
    if (ix.minutes !== undefined && a.t >= ix.minutes) done = true;
    if (ix.untilFull && (m.needs[ix.untilFull] >= 99.5 || a.t >= (ix.maxMinutes ?? 120))) done = true;
    // Desperate needs interrupt autonomous activities that don't help them.
    if (a.auto && !done && a.t > 3) {
      // Only urgent bodily needs interrupt; a lonely Mim still finishes their nap.
      const urgent = (['bladder', 'hunger', 'energy'] as Need[]).filter((k) => m.needs[k] < 12 && !(ix.sleep && k === 'energy'));
      const need = urgent.sort((p, q) => m.needs[p] - m.needs[q])[0];
      if (need && !(ix.rates?.[need] && ix.rates[need]! > 0) && ix.untilFull !== need) {
        this.think(m, NEED_INFO[need].icon);
        a.cancel = true;
      }
    }
    if (a.cancel) return this.finish(m, a, false);
    if (done) {
      ix.done?.(this, m, o);
      this.finish(m, a, true);
    }
  }

  /** Leave the slot, release reservations and drop the action. */
  private finish(m: Mim, a: Action, completed: boolean): void {
    const so = a.slotObj !== undefined ? this.obj(a.slotObj) : undefined;
    if (so && a.slot !== undefined && so.reserved[a.slot] === m.id) so.reserved[a.slot] = 0;
    if (a.phase === 'use' && a.route) {
      m.x = a.route[0] + 0.5;
      m.y = a.route[1] + 0.5;
    }
    if (a.phase !== 'pending' || !completed) {
      m.z = 0;
      m.lie = undefined;
      if (m.pose !== 'walk') m.pose = 'stand';
    }
    if (a.phase === 'walk') m.path = [];
    const target = a.objId !== undefined ? this.obj(a.objId) : undefined;
    if (target && a.phase === 'use' && !this.mims.some((x) => x !== m && x.queue[0]?.objId === target.id && x.queue[0]?.phase === 'use')) target.state.on = false;
    const i = m.queue.indexOf(a);
    if (i >= 0) m.queue.splice(i, 1);
    // Carried items (groceries, a plate) persist only into a chained follow-up step.
    const next = m.queue[0];
    if (!(completed && next?.chained)) {
      m.carry = undefined;
      // a cancelled chain abandons its remaining steps
      if (!completed) m.queue = m.queue.filter((x) => !x.chained || x.phase !== 'pending');
    }
    m.fwTimer = Math.min(m.fwTimer, this.rng.range(0.5, 2));
  }
}
