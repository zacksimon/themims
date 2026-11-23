import { Lot } from './lot';

export type Tile = [number, number];

/** Tiles the Mims may stand on: the lot plus the sidewalk row just past its +y edge. */
export function inWalkArea(lot: Lot, x: number, y: number): boolean {
  return x >= 0 && x < lot.n && y >= 0 && y <= lot.n;
}

export interface PathOptions {
  /** Tiles occupied by objects (keyed y * stride + x), except where `allow` says otherwise. */
  blocked?: (x: number, y: number) => boolean;
  maxNodes?: number;
}

/** Can a Mim step orthogonally from (x,y) to (nx,ny)? */
export function canStep(lot: Lot, x: number, y: number, nx: number, ny: number, blocked?: (x: number, y: number) => boolean): boolean {
  if (!inWalkArea(lot, nx, ny)) return false;
  if (blocked?.(nx, ny)) return false;
  // walls only exist inside the lot; the sidewalk row has no edges stored
  return !lot.blocked(x, y, nx, ny);
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * A* over tiles with 8-way movement. Diagonal moves are allowed only when no wall piece (including doors)
 * touches the corner, so Mims walk straight through doorways and never clip wall ends.
 * `goals` may hold several acceptable end tiles (e.g. any free side of a table); returns tiles from start to goal (inclusive).
 */
export function findPath(lot: Lot, start: Tile, goals: Tile[], opts: PathOptions = {}): Tile[] | null {
  if (!goals.length) return null;
  const W = lot.n + 1;
  const key = (x: number, y: number) => y * W + x;
  const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
  const [sx, sy] = start;
  if (goalSet.has(key(sx, sy))) return [[sx, sy]];
  const h = (x: number, y: number) => {
    let best = Infinity;
    for (const [gx, gy] of goals) {
      const dx = Math.abs(gx - x), dy = Math.abs(gy - y);
      best = Math.min(best, Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
    }
    return best;
  };
  const g = new Map<number, number>([[key(sx, sy), 0]]);
  const came = new Map<number, number>();
  const open: { k: number; x: number; y: number; f: number }[] = [{ k: key(sx, sy), x: sx, y: sy, f: h(sx, sy) }];
  const closed = new Set<number>();
  const maxNodes = opts.maxNodes ?? 6000;
  let expanded = 0;
  while (open.length) {
    // small grids: linear scan for the lowest f is fast enough and keeps this dependency-free
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (closed.has(cur.k)) continue;
    if (goalSet.has(cur.k)) {
      const path: Tile[] = [];
      let k: number | undefined = cur.k;
      while (k !== undefined) {
        path.push([k % W, Math.floor(k / W)]);
        k = came.get(k);
      }
      return path.reverse();
    }
    closed.add(cur.k);
    if (++expanded > maxNodes) return null;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      // the goal tile may be "blocked" for normal walking (e.g. a chair the Mim will sit in) only if listed as a goal
      const blk = goalSet.has(nk) ? undefined : opts.blocked;
      if (dx && dy) {
        if (!canStep(lot, cur.x, cur.y, nx, cur.y, opts.blocked) || !canStep(lot, cur.x, cur.y, cur.x, ny, opts.blocked)) continue;
        if (!canStep(lot, nx, cur.y, nx, ny, blk) || !canStep(lot, cur.x, ny, nx, ny, blk)) continue;
        if (touchesWall(lot, cur.x, cur.y, dx, dy)) continue;
      } else if (!canStep(lot, cur.x, cur.y, nx, ny, blk)) continue;
      const ng = g.get(cur.k)! + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur.k);
        open.push({ k: nk, x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

/** True if any wall piece sits on the four edges around the corner a diagonal move passes through. */
function touchesWall(lot: Lot, x: number, y: number, dx: number, dy: number): boolean {
  const nx = x + dx, ny = y + dy;
  return (
    lot.separated(x, y, nx, y) || lot.separated(x, y, x, ny) ||
    lot.separated(nx, y, nx, ny) || lot.separated(x, ny, nx, ny)
  );
}
