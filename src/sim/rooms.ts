import { Lot, parseEdge } from '../world/lot';
import type { ObjInst } from './objects';
import { defOf, objCenter } from './objects';

export interface RoomInfo {
  /** Room id per lot tile; 0 = outdoors. */
  ids: Int32Array;
  score: number[];
  area: number[];
}

/**
 * Rooms are regions of tiles enclosed by wall pieces (doors and windows count as walls).
 * Regions that reach the lot edge count as outdoors. Each room gets a score from its size, floor,
 * windows and decor, and the Room need of a Mim drifts toward the score of the room they stand in.
 */
export function computeRooms(lot: Lot, objects: ObjInst[]): RoomInfo {
  const n = lot.n;
  const ids = new Int32Array(n * n).fill(-1);
  const area: number[] = [0];
  const tilesOf: number[][] = [[]];
  let next = 1;
  for (let i = 0; i < n * n; i++) {
    if (ids[i] !== -1) continue;
    const stack = [i];
    const region: number[] = [];
    let outside = false;
    ids[i] = -2;
    while (stack.length) {
      const k = stack.pop()!;
      region.push(k);
      const x = k % n, y = Math.floor(k / n);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) {
          outside = true;
          continue;
        }
        if (lot.separated(x, y, nx, ny)) continue;
        const nk = ny * n + nx;
        if (ids[nk] !== -1) continue;
        ids[nk] = -2;
        stack.push(nk);
      }
    }
    const id = outside ? 0 : next++;
    for (const k of region) ids[k] = id;
    if (outside) {
      area[0] += region.length;
      tilesOf[0].push(...region);
    } else {
      area[id] = region.length;
      tilesOf[id] = region;
    }
  }
  const score: number[] = [];
  const windows = new Array(next).fill(0);
  for (const [k, w] of lot.walls) {
    if (w.kind !== 'window') continue;
    const { axis, x, y } = parseEdge(k);
    const sides = axis === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]];
    for (const [sx, sy] of sides) if (sx >= 0 && sy >= 0 && sx < n && sy < n) windows[ids[sy * n + sx]]++;
  }
  const decor = new Array(next).fill(0);
  for (const o of objects) {
    const [cx, cy] = objCenter(o);
    const tx = Math.min(n - 1, Math.floor(cx)), ty = Math.min(n - 1, Math.floor(cy));
    if (tx < 0 || ty < 0) continue;
    decor[ids[ty * n + tx]] += defOf(o).room ?? 0;
    if (o.state.dirty) decor[ids[ty * n + tx]] -= 15;
  }
  score[0] = Math.max(0, Math.min(100, 50 + decor[0] * 0.5));
  for (let id = 1; id < next; id++) {
    const tiles = tilesOf[id];
    const floored = tiles.filter((k) => lot.floors[k] >= 0).length / tiles.length;
    let s = 30 + floored * 12 + Math.min(16, windows[id] * 4) + Math.min(35, decor[id]);
    if (area[id] < 6) s -= 12;
    else if (area[id] >= 14) s += 8;
    score[id] = Math.max(0, Math.min(100, s));
  }
  return { ids, score, area };
}
