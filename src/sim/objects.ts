import type { ObjectDef } from '../content/objects';
import { OBJECTS } from '../content/objects';
import { Tile } from '../world/pathfinding';

export type Dir = 0 | 1 | 2 | 3; // facing: 0 = +y, 1 = -x, 2 = -y, 3 = +x

export interface ObjInst {
  id: number;
  def: string;
  /** Min corner of the footprint in world tiles. */
  x: number;
  y: number;
  dir: Dir;
  /** Mim id holding each slot, or 0. */
  reserved: number[];
  /** Free-form per-object state (TV on, toilet clogged...). */
  state: Record<string, number | string | boolean>;
  /** Purchase price paid, for depreciation on sale. */
  paid: number;
  boughtAt: number;
}

export function defOf(o: ObjInst): ObjectDef {
  return OBJECTS[o.def];
}

function rot90(x: number, y: number, r: number): [number, number] {
  let a = x, b = y;
  for (let i = 0; i < r; i++) [a, b] = [-b, a];
  return [a, b];
}

/** Footprint size in world tiles for a def at a facing. */
export function worldSize(def: ObjectDef, dir: Dir): [number, number] {
  const [w, h] = def.size;
  return dir % 2 === 0 ? [w, h] : [h, w];
}

/** Transform a local point (in the def's unrotated footprint space, front facing +y) to world space. */
export function localToWorld(def: ObjectDef, ox: number, oy: number, dir: Dir, lx: number, ly: number): [number, number] {
  const [w, h] = def.size;
  const corners = [rot90(0, 0, dir), rot90(w, 0, dir), rot90(0, h, dir), rot90(w, h, dir)];
  const mx = Math.min(...corners.map((c) => c[0]));
  const my = Math.min(...corners.map((c) => c[1]));
  const [rx, ry] = rot90(lx, ly, dir);
  return [ox + rx - mx, oy + ry - my];
}

export function objLocalToWorld(o: ObjInst, lx: number, ly: number): [number, number] {
  return localToWorld(defOf(o), o.x, o.y, o.dir, lx, ly);
}

/** World tile for a local tile index (uses the tile center so rotation maps cleanly). */
export function localTile(o: ObjInst, lx: number, ly: number): Tile {
  const [x, y] = objLocalToWorld(o, lx + 0.5, ly + 0.5);
  return [Math.floor(x), Math.floor(y)];
}

export function footprintTiles(def: ObjectDef, x: number, y: number, dir: Dir): Tile[] {
  const [w, h] = worldSize(def, dir);
  const out: Tile[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]);
  return out;
}

export function objTiles(o: ObjInst): Tile[] {
  return footprintTiles(defOf(o), o.x, o.y, o.dir);
}

export function objCenter(o: ObjInst): [number, number] {
  const [w, h] = worldSize(defOf(o), o.dir);
  return [o.x + w / 2, o.y + h / 2];
}

export function createObj(id: number, def: string, x: number, y: number, dir: Dir, time: number): ObjInst {
  const d = OBJECTS[def];
  if (!d) throw new Error(`unknown object ${def}`);
  return { id, def, x, y, dir, reserved: d.slots.map(() => 0), state: {}, paid: d.price, boughtAt: time };
}
