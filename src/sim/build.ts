import { DOOR_PRICE, FLOORS, WALLS, WINDOW_PRICE } from '../content/styles';
import { OBJECTS } from '../content/objects';
import { Lot, Wall, edgeKey, parseEdge } from '../world/lot';
import { Tile, findPath } from '../world/pathfinding';
import { DAY_MIN } from '../engine/clock';
import { Dir, ObjInst, createObj, defOf, footprintTiles } from './objects';
import { mimTile } from './mim';
import type { World } from './world';

/** Result of a build or buy operation: null on success, otherwise a player-facing reason. */
export type BuildResult = string | null;

interface Snapshot {
  walls: [string, Wall][];
  floors: number[];
  objects: ObjInst[];
  /** What the step cost (negative for refunds), so undo hands back exactly that amount. */
  cost: number;
}

/** Build/buy operations with costs, validation and an undo stack. */
export class Builder {
  private undoStack: Snapshot[] = [];

  constructor(private w: World) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Called when leaving build/buy: undo only covers the current (paused) build session. */
  clearUndo(): void {
    this.undoStack = [];
  }

  private snapshot(): Snapshot {
    const w = this.w;
    return {
      walls: [...w.lot.walls.entries()].map(([k, v]) => [k, { ...v }]),
      floors: w.lot.floors.slice(),
      objects: w.objects.map((o) => ({ ...o, reserved: o.reserved.slice(), state: { ...o.state } })),
      cost: 0,
    };
  }

  private push(s: Snapshot): void {
    this.undoStack.push(s);
    if (this.undoStack.length > 60) this.undoStack.shift();
  }

  undo(): boolean {
    const s = this.undoStack.pop();
    if (!s) return false;
    const w = this.w;
    this.restore(s);
    w.funds += s.cost;
    w.revalidateActions();
    w.structureChanged();
    return true;
  }

  /**
   * Run a change tentatively. The trap check only looks at walls and occupancy; Mims are not touched until the
   * change is accepted, so a refused change leaves everyone exactly as they were. `accepted` runs after success.
   */
  private attempt(change: () => BuildResult, cost: number, accepted?: () => void): BuildResult {
    const w = this.w;
    if (cost > w.funds) return `That costs ₥${cost.toLocaleString('en-US')}. You have ₥${Math.floor(w.funds).toLocaleString('en-US')}.`;
    const before = this.snapshot();
    const err = change();
    if (err) {
      this.restore(before);
      return err;
    }
    w.objVersion++; // refresh the occupancy cache for the check below
    const trapped = this.trappedMim();
    if (trapped) {
      this.restore(before);
      return `That would trap ${trapped} with no way out.`;
    }
    w.funds -= cost;
    before.cost = cost;
    this.push(before);
    accepted?.();
    w.structureChanged();
    return null;
  }

  /** Put walls, floors and objects back. Objects are updated in place so references held elsewhere stay valid. */
  private restore(s: Snapshot): void {
    const w = this.w;
    w.lot.walls = new Map(s.walls);
    w.lot.floors = s.floors.slice();
    w.lot.version++;
    const live = new Map(w.objects.map((o) => [o.id, o]));
    w.objects = s.objects.map((saved) => {
      const cur = live.get(saved.id);
      if (!cur) return { ...saved, reserved: saved.reserved.slice(), state: { ...saved.state } };
      Object.assign(cur, saved, { reserved: saved.reserved.slice(), state: { ...saved.state } });
      return cur;
    });
    w.objVersion++;
  }

  /** Name of a Mim who can no longer reach the street, if any. */
  trappedMim(): string | null {
    const w = this.w;
    const n = w.lot.n;
    const exits: Tile[] = [];
    for (let x = 0; x < n; x++) exits.push([x, n]);
    for (const m of w.mims) {
      const a = m.queue[0];
      const start = a?.route && (m.pose === 'sit' || m.pose === 'lie') ? a.route : mimTile(m);
      if (w.isBlocked(start[0], start[1]) && !(a?.route)) return m.name;
      if (!findPath(w.lot, start, exits, { blocked: w.isBlocked, maxNodes: 20000 })) return m.name;
    }
    return null;
  }

  // ---------- objects ----------

  /** Why an object can't go here, or null if it can. */
  placementError(def: string, x: number, y: number, dir: Dir, ignoreId = -1): BuildResult {
    const w = this.w;
    const d = OBJECTS[def];
    if (!w.canPlace(def, x, y, dir, ignoreId)) return "It doesn't fit there.";
    if (d.blocks !== false) {
      for (const [tx, ty] of footprintTiles(d, x, y, dir)) {
        for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]]) {
          const wall = w.lot.walls.get(w.lot.edgeBetween(tx, ty, nx, ny));
          if (wall?.kind === 'door') return "That would block a door. Mims aren't great at climbing.";
        }
      }
    }
    return null;
  }

  buy(def: string, x: number, y: number, dir: Dir): BuildResult {
    const w = this.w;
    const d = OBJECTS[def];
    const err = this.placementError(def, x, y, dir);
    if (err) return err;
    return this.attempt(() => {
      w.objects.push(createObj(w.nextId++, def, x, y, dir, w.time));
      return null;
    }, d.price);
  }

  move(o: ObjInst, x: number, y: number, dir: Dir): BuildResult {
    const err = this.placementError(o.def, x, y, dir, o.id);
    if (err) return err;
    return this.attempt(
      () => {
        const cur = this.w.obj(o.id)!;
        cur.x = x;
        cur.y = y;
        cur.dir = dir;
        return null;
      },
      0,
      () => this.w.abortActionsFor(o.id),
    );
  }

  /** Refund: full value within the first game hour, then 80% dropping 5% a day to a floor of 40%. */
  refundFor(o: ObjInst): number {
    const age = this.w.time - o.boughtAt;
    if (age < 60) return o.paid;
    const days = age / DAY_MIN;
    return Math.round(o.paid * Math.max(0.4, 0.8 - 0.05 * days));
  }

  sell(o: ObjInst): BuildResult {
    const w = this.w;
    const refund = this.refundFor(o);
    return this.attempt(
      () => {
        w.objects = w.objects.filter((x) => x.id !== o.id);
        return null;
      },
      -refund,
      () => w.abortActionsFor(o.id),
    );
  }

  // ---------- walls ----------

  /** An object that a wall on this edge would cut through. */
  private edgeCutsObject(key: string): boolean {
    const w = this.w;
    const { axis, x, y } = parseEdge(key);
    const [a, b]: Tile[] = axis === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
    const oa = w.objectAtTile(a[0], a[1]);
    return !!oa && oa === w.objectAtTile(b[0], b[1]);
  }

  private inLot(key: string): boolean {
    const n = this.w.lot.n;
    const { axis, x, y } = parseEdge(key);
    return axis === 'h' ? x >= 0 && x < n && y >= 0 && y <= n : x >= 0 && x <= n && y >= 0 && y < n;
  }

  wallCost(keys: string[], style: number): number {
    return keys.filter((k) => !this.w.lot.walls.has(k)).length * WALLS[style].price;
  }

  buildWalls(keys: string[], style: number): BuildResult {
    const w = this.w;
    const fresh = keys.filter((k) => !w.lot.walls.has(k) && this.inLot(k));
    if (!fresh.length) return 'There is already a wall there.';
    if (fresh.some((k) => this.edgeCutsObject(k))) return "A wall can't go through furniture.";
    return this.attempt(() => {
      for (const k of fresh) w.lot.setWall(k, { kind: 'wall', style });
      return null;
    }, this.wallCost(fresh, style));
  }

  /** Remove wall pieces along a run. Walls refund half their style price. */
  eraseWalls(keys: string[]): BuildResult {
    const w = this.w;
    const have = keys.filter((k) => w.lot.walls.has(k));
    if (!have.length) return 'There is no wall there.';
    const refund = have.reduce((sum, k) => {
      const piece = w.lot.walls.get(k)!;
      const extra = piece.kind === 'door' ? DOOR_PRICE : piece.kind === 'window' ? WINDOW_PRICE : 0;
      return sum + Math.round((WALLS[piece.style].price + extra) / 2);
    }, 0);
    return this.attempt(() => {
      for (const k of have) w.lot.setWall(k, null);
      return null;
    }, -refund);
  }

  /** Turn a wall piece into a door or window (or back into plain wall). */
  setOpening(key: string, kind: 'door' | 'window'): BuildResult {
    const w = this.w;
    const piece = w.lot.walls.get(key);
    if (!piece) return `${kind === 'door' ? 'Doors' : 'Windows'} go on walls. Build a wall first.`;
    if (piece.kind === kind) return `There is already a ${kind} there.`;
    if (kind === 'door') {
      const { axis, x, y } = parseEdge(key);
      const sides: Tile[] = axis === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
      if (sides.some(([sx, sy]) => w.isBlocked(sx, sy))) return 'Something is in the way of that door.';
    }
    return this.attempt(() => {
      w.lot.setWall(key, { kind, style: piece.style });
      return null;
    }, kind === 'door' ? DOOR_PRICE : WINDOW_PRICE);
  }

  paintCost(keys: string[], style: number): number {
    return keys.filter((k) => {
      const p = this.w.lot.walls.get(k);
      return p && p.style !== style;
    }).length * WALLS[style].price;
  }

  paintWalls(keys: string[], style: number): BuildResult {
    const w = this.w;
    const targets = keys.filter((k) => {
      const p = w.lot.walls.get(k);
      return p && p.style !== style;
    });
    if (!targets.length) return 'Nothing to paint there.';
    return this.attempt(() => {
      for (const k of targets) {
        const p = w.lot.walls.get(k)!;
        w.lot.setWall(k, { ...p, style });
      }
      return null;
    }, this.paintCost(targets, style));
  }

  // ---------- floors ----------

  floorCost(tiles: Tile[], style: number): number {
    if (style < 0) return 0;
    return tiles.filter(([x, y]) => this.w.lot.inBounds(x, y) && this.w.lot.floor(x, y) !== style).length * FLOORS[style].price;
  }

  setFloors(tiles: Tile[], style: number): BuildResult {
    const w = this.w;
    const targets = tiles.filter(([x, y]) => w.lot.inBounds(x, y) && w.lot.floor(x, y) !== style);
    if (!targets.length) return style < 0 ? 'No floor to remove there.' : 'That floor is already down.';
    return this.attempt(() => {
      for (const [x, y] of targets) w.lot.setFloor(x, y, style);
      return null;
    }, this.floorCost(targets, style));
  }
}

/** Snap a world point to the nearest wall edge. */
export function nearestEdge(wx: number, wy: number): string {
  const fx = wx - Math.floor(wx), fy = wy - Math.floor(wy);
  const dv = Math.min(fx, 1 - fx), dh = Math.min(fy, 1 - fy);
  return dv < dh ? edgeKey('v', Math.round(wx), Math.floor(wy)) : edgeKey('h', Math.floor(wx), Math.round(wy));
}

/** Edges along an axis-aligned run between two grid points, following whichever axis moved more. */
export function edgeRun(x0: number, y0: number, x1: number, y1: number): { keys: string[]; end: [number, number] } {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const end: [number, number] = horizontal ? [x1, y0] : [x0, y1];
  return { keys: Lot.runEdges(x0, y0, end[0], end[1]), end };
}

export function rectTiles(x0: number, y0: number, x1: number, y1: number): Tile[] {
  const out: Tile[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
  return out;
}

export { defOf };
