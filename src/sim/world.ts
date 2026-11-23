import { Lot } from '../world/lot';
import { Rng } from '../engine/rng';
import { Action, MAX_QUEUE, Mim, createMim, faceToward, mimTile, stepWalk } from './mim';
import { Look } from '../content/looks';
import { Tile, findPath } from '../world/pathfinding';
import { InteractionDef, OBJECTS } from '../content/objects';
import { Dir, ObjInst, createObj, defOf, footprintTiles, localTile, objCenter, objLocalToWorld, objTiles } from './objects';
import { DECAY, NEEDS, NEED_INFO, Need, addNeeds, clampNeed, worstNeed } from './needs';
import { RoomInfo, computeRooms } from './rooms';
import { advertised, chooseAutonomous, findIx } from './freewill';
import { Emotion, SOCIAL_BY_ID, SocialDef } from '../content/social';
import { moodOf } from './needs';

export const HOUSEHOLD_MAX = 8;

export interface Relationship {
  daily: number;
  life: number;
}

/** A line of Mimlish to be voiced by the audio layer. */
export interface SpeechEvent {
  mimId: number;
  emotion: Emotion;
  syllables: number;
}

export function relKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

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
  /** Speech for the audio layer; drained by the game each frame (ignored headless). */
  speechOut: SpeechEvent[] = [];
  rels: Record<string, Relationship> = {};
  private occCache: { key: string; set: Set<number> } | null = null;
  private roomCache: { key: string; info: RoomInfo } | null = null;

  constructor(n = 24, seed = 1234) {
    this.lot = new Lot(n);
    this.rng = new Rng(seed);
  }

  // ---------- setup ----------

  addMim(name: string, look: Look, tx: number, ty: number): Mim {
    if (this.mims.length >= HOUSEHOLD_MAX) throw new Error(`A household holds at most ${HOUSEHOLD_MAX} Mims.`);
    const m = createMim(this.nextId++, name, look, tx, ty);
    // household members start out friendly with each other
    for (const o of this.mims) this.rels[relKey(m.id, o.id)] = { daily: 30, life: 30 };
    this.mims.push(m);
    return m;
  }

  rel(a: number, b: number): Relationship {
    return (this.rels[relKey(a, b)] ??= { daily: 0, life: 0 });
  }

  changeRel(a: number, b: number, d: number): void {
    const r = this.rel(a, b);
    r.daily = Math.max(-100, Math.min(100, r.daily + d));
  }

  /** Can this Mim be approached for a chat right now? Sleeping Mims can't; one already hailed by `by` can. */
  available(t: Mim, by?: Mim): boolean {
    if (this.sleeping(t)) return false;
    if (t.engaged && t.engaged.until > this.time && t.engaged.with !== by?.id) return false;
    const a = t.queue[0];
    if (a?.kind === 'social' && a.phase !== 'pending') return false;
    return true;
  }

  sleeping(t: Mim): boolean {
    const a = t.queue[0];
    if (t.pose !== 'lie' || !a || a.phase !== 'use' || a.kind !== 'interact') return false;
    const o = this.obj(a.objId!);
    return !!(o && findIx(o.def, a.ix!)?.sleep);
  }

  /** Queue a social interaction with another Mim. */
  queueSocial(m: Mim, target: Mim, socialId: string, auto = false): Action | null {
    const def = SOCIAL_BY_ID[socialId];
    if (!def || target === m) return null;
    if (!auto) this.dropAutonomous(m);
    if (m.queue.length >= MAX_QUEUE) return null;
    const a: Action = { uid: this.nextUid++, kind: 'social', targetMim: target.id, social: socialId, auto, phase: 'pending', t: 0, label: `${def.label}: ${target.name.split(' ')[0]}`, icon: def.icon };
    m.queue.push(a);
    return a;
  }

  /** Which social interactions are allowed between two Mims (relationship gates, music). */
  socialOptions(m: Mim, t: Mim): { def: SocialDef; ok: boolean; why?: string }[] {
    const r = this.rel(m.id, t.id);
    const music = this.objects.some((o) => o.def === 'boombox' && o.state.on);
    return Object.values(SOCIAL_BY_ID).map((def) => {
      if (def.minRel !== undefined && r.daily < def.minRel) return { def, ok: false, why: `Needs a better relationship (${def.minRel}+)` };
      if (def.maxRel !== undefined && r.daily > def.maxRel) return { def, ok: false, why: 'They get along too well for that' };
      if (def.needsMusic && !music) return { def, ok: false, why: 'Needs music playing' };
      return { def, ok: true };
    });
  }

  private speak(m: Mim, icon: string, emotion: Emotion, minutes = 1.4): void {
    m.speech = { icon, until: this.time + minutes, emotion };
    this.speechOut.push({ mimId: m.id, emotion, syllables: 2 + Math.floor(this.rng.next() * 4) });
    if (this.speechOut.length > 32) this.speechOut.shift();
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

  /** Stop every action that targets or sits on an object (it is being moved, sold or undone away). */
  abortActionsFor(objId: number): void {
    for (const m of this.mims) {
      for (const a of [...m.queue]) {
        if (a.objId !== objId && a.slotObj !== objId) continue;
        if (a === m.queue[0]) this.finish(m, a, false);
        else m.queue.splice(m.queue.indexOf(a), 1);
      }
    }
  }

  /** Drop actions whose objects no longer exist and clear stale reservations (after undo). */
  revalidateActions(): void {
    for (const m of this.mims) {
      for (const a of [...m.queue]) {
        const gone = (a.objId !== undefined && !this.obj(a.objId)) || (a.slotObj !== undefined && !this.obj(a.slotObj));
        if (!gone) continue;
        if (a === m.queue[0]) {
          a.slotObj = undefined;
          this.finish(m, a, false);
        } else m.queue.splice(m.queue.indexOf(a), 1);
      }
    }
    for (const o of this.objects) {
      o.reserved = o.reserved.map((id) => (this.mims.some((m) => m.id === id && m.queue[0]?.slotObj === o.id) ? id : 0));
    }
  }

  /** Walls or objects changed: re-route anyone mid-walk, and cancel what can no longer be reached. */
  structureChanged(): void {
    this.objVersion++;
    for (const m of this.mims) {
      if (!m.path.length) continue;
      const goal = m.path[m.path.length - 1];
      const path = findPath(this.lot, mimTile(m), [goal], { blocked: this.isBlocked });
      if (path) m.path = path.slice(1);
      else {
        m.path = [];
        const a = m.queue[0];
        if (a) this.finish(m, a, false);
      }
    }
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
    this.driftRelationships(dtMin);
  }

  /** Daily scores drift toward lifetime ones, and lifetime slowly follows daily. */
  private driftRelationships(dt: number): void {
    const f = dt / 1440;
    for (const r of Object.values(this.rels)) {
      const d = r.daily, l = r.life;
      r.daily += (l - d) * 0.35 * f;
      r.life += (d - l) * 0.12 * f;
    }
  }

  private stepMim(m: Mim, dt: number): void {
    this.decayNeeds(m, dt);
    const a = m.queue[0];
    // Someone is talking to this Mim: stand still and face them, unless busy using something.
    if (m.engaged && m.engaged.until > this.time) {
      const partner = this.mim(m.engaged.with);
      if (partner && !(a && a.phase === 'use')) {
        if (m.pose === 'walk') m.pose = 'stand';
        faceToward(m, partner.x, partner.y);
        this.updateThought(m);
        return;
      }
    } else if (m.engaged) m.engaged = undefined;
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
      if (c.mim && c.social) this.queueSocial(m, c.mim, c.social.id, true);
      else if (c.obj && c.ix) this.queueInteraction(m, c.obj, c.ix.id, true);
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
    if (a.cancel && a.phase !== 'use') return this.finish(m, a, false);
    switch (a.phase) {
      case 'pending':
        return this.begin(m, a, dt);
      case 'walk': {
        if (a.kind === 'social') {
          const t = this.mim(a.targetMim!);
          if (!t || !this.available(t, m)) return this.giveUpSocial(m, a);
          a.waited = (a.waited ?? 0) + dt;
          // Player-queued: call out when close, so the target stops and turns around.
          if (!a.auto && Math.hypot(t.x - m.x, t.y - m.y) <= 3 && !(t.engaged && t.engaged.until > this.time)) {
            t.engaged = { with: m.id, until: this.time + 4 };
            this.speak(m, '👋', 'question');
          }
          if (a.route && Math.hypot(t.x - (a.route[0] + 0.5), t.y - (a.route[1] + 0.5)) > 1.6) {
            if (t.path.length || t.pose === 'walk') {
              // a moving target: quietly re-path every half minute, for up to 10 minutes
              if (a.waited > 10) return this.giveUpSocial(m, a);
              if (a.waited - (a.repathAt ?? 0) >= 0.5) {
                a.repathAt = a.waited;
                a.phase = 'pending';
                return;
              }
            } else {
              a.tries = (a.tries ?? 0) + 1;
              if (a.tries > 4) return this.giveUpSocial(m, a);
              a.phase = 'pending';
              return;
            }
          }
        }
        if (a.slotObj !== undefined) {
          const so = this.obj(a.slotObj);
          if (!so || so.reserved[a.slot!] !== m.id) return this.finish(m, a, false);
        }
        if (stepWalk(m, dt)) this.arrive(m, a);
        return;
      }
      case 'use':
        return this.use(m, a, dt);
    }
  }

  private begin(m: Mim, a: Action, dt = 0): void {
    if (a.kind === 'social') return this.beginSocial(m, a);
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
      // Occupied rather than unreachable: player-queued actions wait their turn (with a little embarrassment).
      if (o && ix && !this.hasFreeSlot(o, ix, m) && (!a.auto || a.chained)) {
        if (!a.waited) this.think(m, defOf(o).category === 'bathroom' ? '😳' : '⏳', 4);
        a.waited = (a.waited ?? 0) + Math.max(dt, 0.01);
        if (a.waited < 45) return;
        this.notify(`${m.name} gave up waiting for the ${defOf(o).name}.`, 'bad');
        return this.finish(m, a, false);
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
    if (a.kind === 'social') return this.arriveSocial(m, a);
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
    if (a.kind === 'social') return this.useSocial(m, a, dt);
    a.t += dt;
    const h = dt / 60;
    this.companyBonus(m, a, h);
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
    // Desperate needs interrupt autonomous activities that don't help them. Chained chore steps (cooking) are
    // already serving a need, so they always finish.
    if (a.auto && !a.chained && !done && a.t > 3) {
      // Only urgent bodily needs interrupt; a lonely Mim still finishes their nap.
      const urgent = (['bladder', 'hunger', 'energy'] as Need[]).filter((k) => m.needs[k] < 12 && !(ix.sleep && k === 'energy'));
      const need = urgent.sort((p, q) => m.needs[p] - m.needs[q])[0];
      const helps = (ix.rates?.[need] ?? 0) > 0 || (advertised(ix)[need] ?? 0) > 0 || ix.untilFull === need;
      if (need && !helps) {
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

  // ---------- social ----------

  /** A social action that couldn't happen: say so when the player asked for it. */
  private giveUpSocial(m: Mim, a: Action): void {
    const t = this.mim(a.targetMim!);
    if (!a.auto && t) {
      this.notify(`${t.name.split(' ')[0]} didn't hear ${m.name.split(' ')[0]}.`);
      this.think(m, '😕', 3);
    }
    this.finish(m, a, false);
  }

  private beginSocial(m: Mim, a: Action): void {
    const t = this.mim(a.targetMim!);
    if (!t || !this.available(t, m)) {
      this.think(m, '❓');
      if (!a.auto && t) this.notify(`${t.name} is busy right now.`);
      return this.finish(m, a, false);
    }
    const [tx, ty] = mimTile(t);
    const goals: Tile[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const gx = tx + dx, gy = ty + dy;
      if (!this.lot.inBounds(gx, gy) && gy !== this.lot.n) continue;
      if (this.isBlocked(gx, gy)) continue;
      // no talking through walls
      if (dx && dy) {
        if (this.lot.separated(tx, ty, gx, ty) || this.lot.separated(tx, ty, tx, gy) || this.lot.separated(gx, ty, gx, gy) || this.lot.separated(tx, gy, gx, gy)) continue;
      } else if (this.lot.separated(tx, ty, gx, gy)) continue;
      goals.push([gx, gy]);
    }
    const [mx, my] = mimTile(m);
    if (goals.some(([gx, gy]) => gx === mx && gy === my)) {
      a.route = [mx, my];
      m.path = [];
      return this.arriveSocial(m, a);
    }
    const path = findPath(this.lot, [mx, my], goals, { blocked: this.isBlocked });
    if (!path) {
      this.think(m, '❓');
      if (!a.auto) this.notify(`${m.name} can't reach ${t.name}.`, 'bad');
      return this.finish(m, a, false);
    }
    a.route = path[path.length - 1];
    m.path = path.slice(1);
    a.phase = 'walk';
    if (!m.path.length) this.arriveSocial(m, a);
  }

  private arriveSocial(m: Mim, a: Action): void {
    const t = this.mim(a.targetMim!);
    const def = SOCIAL_BY_ID[a.social!];
    if (!t || !def || !this.available(t, m)) return this.giveUpSocial(m, a);
    faceToward(m, t.x, t.y);
    faceToward(t, m.x, m.y);
    const r = this.rel(m.id, t.id);
    let p = def.accept;
    if (def.accept < 1) p = Math.max(0.05, Math.min(0.97, def.accept + r.daily / 200 + moodOf(t.needs) / 400 + moodOf(m.needs) / 800));
    a.accepted = this.rng.next() < p;
    const minutes = a.accepted ? def.minutes : 2.5;
    t.engaged = { with: m.id, until: this.time + minutes };
    a.phase = 'use';
    a.t = 0;
    a.route = undefined; // stand where we are when done
    this.speak(m, def.icon, def.emotion);
  }

  private useSocial(m: Mim, a: Action, dt: number): void {
    const t = this.mim(a.targetMim!);
    const def = SOCIAL_BY_ID[a.social!];
    if (!t || !def) return this.finish(m, a, false);
    const before = a.t;
    a.t += dt;
    const h = dt / 60;
    faceToward(m, t.x, t.y);
    if (a.accepted) {
      addNeeds(m.needs, def.rates, h);
      addNeeds(t.needs, def.rates, h);
      // take turns talking
      if (Math.floor(before / 1.5) !== Math.floor(a.t / 1.5)) {
        const turn = Math.floor(a.t / 1.5) % 2;
        if (turn === 0) this.speak(m, def.bubbles[0], def.emotion);
        else this.speak(t, def.bubbles[1], def.emotion);
      }
      if (a.t >= def.minutes || a.cancel) {
        const share = Math.min(1, a.t / def.minutes);
        this.changeRel(m.id, t.id, def.good * share);
        if (def.id === 'gossip') {
          // the gossip is about whoever the gossiper likes least
          const others = this.mims.filter((x) => x !== m && x !== t);
          const third = others.sort((p, q) => this.rel(m.id, p.id).daily - this.rel(m.id, q.id).daily)[0];
          if (third) this.changeRel(t.id, third.id, -3);
        }
        if (def.mean && !a.auto) this.notify(`${m.name} and ${t.name} are not on speaking terms after that.`, 'bad');
        if (t.engaged?.with === m.id) t.engaged = undefined;
        return this.finish(m, a, !a.cancel);
      }
      return;
    }
    // rejected
    if (before === 0) {
      this.speak(t, '🙄', 'shy', 2);
      m.thought = { icon: '😳', until: this.time + 3 };
    }
    if (a.t >= 2.5) {
      this.changeRel(m.id, t.id, def.bad);
      m.needs.social = clampNeed(m.needs.social - 4);
      if (!a.auto && def.reject) this.notify(def.reject.replace('{target}', t.name.split(' ')[0]).replace('{actor}', m.name.split(' ')[0]), 'bad');
      if (t.engaged?.with === m.id) t.engaged = undefined;
      this.finish(m, a, true);
    }
  }

  /** Eating at the same table or watching TV side by side is a little social. */
  private companyBonus(m: Mim, a: Action, h: number): void {
    const kind = a.kind === 'eat' ? 'eat' : a.ix === 'watch' ? 'watch' : null;
    if (!kind || a.phase !== 'use') return;
    for (const o of this.mims) {
      if (o === m) continue;
      const b = o.queue[0];
      if (!b || b.phase !== 'use') continue;
      const okind = b.kind === 'eat' ? 'eat' : b.ix === 'watch' ? 'watch' : null;
      if (okind !== kind || Math.hypot(o.x - m.x, o.y - m.y) > 2.6) continue;
      m.needs.social = clampNeed(m.needs.social + 10 * h);
      this.changeRel(m.id, o.id, 1.5 * h);
      if (this.rng.chance(0.02)) this.speak(m, kind === 'eat' ? '🍽️' : '📺', 'happy');
    }
  }


  /** Leave the slot, release reservations and drop the action. */
  private finish(m: Mim, a: Action, completed: boolean): void {
    if (a.kind === 'social') {
      const t = this.mim(a.targetMim!);
      if (t?.engaged?.with === m.id) t.engaged = undefined;
    }
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
