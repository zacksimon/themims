/** Lot tiles, floors and wall segments on tile edges. */
export type WallKind = 'wall' | 'door' | 'window';
export interface Wall {
  kind: WallKind;
  style: number;
}
/** 'h' edges run along x at a fixed y; 'v' edges run along y at a fixed x. */
export type EdgeAxis = 'h' | 'v';

export function edgeKey(axis: EdgeAxis, x: number, y: number): string {
  return `${axis}:${x}:${y}`;
}
export function parseEdge(k: string): { axis: EdgeAxis; x: number; y: number } {
  const [a, x, y] = k.split(':');
  return { axis: a as EdgeAxis, x: +x, y: +y };
}
/** World endpoints of an edge. */
export function edgePoints(axis: EdgeAxis, x: number, y: number): [[number, number], [number, number]] {
  return axis === 'h' ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
}

export class Lot {
  readonly n: number;
  /** Floor style per tile, -1 means bare ground. */
  floors: number[];
  walls = new Map<string, Wall>();
  /** Bumped on any structural change so caches (rooms, paths) can invalidate. */
  version = 0;

  constructor(n: number) {
    this.n = n;
    this.floors = new Array(n * n).fill(-1);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.n && y < this.n;
  }

  floor(x: number, y: number): number {
    return this.inBounds(x, y) ? this.floors[y * this.n + x] : -1;
  }

  setFloor(x: number, y: number, style: number): void {
    if (!this.inBounds(x, y)) return;
    this.floors[y * this.n + x] = style;
    this.version++;
  }

  /** Key of the edge between orthogonally adjacent tiles. */
  edgeBetween(x: number, y: number, nx: number, ny: number): string {
    if (nx === x) return edgeKey('h', x, Math.max(y, ny));
    return edgeKey('v', Math.max(x, nx), y);
  }

  wallAt(k: string): Wall | undefined {
    return this.walls.get(k);
  }

  /** True when a wall (not a door) blocks walking between orthogonal neighbors. */
  blocked(x: number, y: number, nx: number, ny: number): boolean {
    const w = this.walls.get(this.edgeBetween(x, y, nx, ny));
    return !!w && w.kind !== 'door';
  }

  /** True when any wall piece, including doors, separates the tiles (used for rooms). */
  separated(x: number, y: number, nx: number, ny: number): boolean {
    return this.walls.has(this.edgeBetween(x, y, nx, ny));
  }

  setWall(k: string, w: Wall | null): void {
    if (w) this.walls.set(k, w);
    else this.walls.delete(k);
    this.version++;
  }

  /** Add walls along a straight run of grid points (axis-aligned). Returns edge keys. */
  static runEdges(x0: number, y0: number, x1: number, y1: number): string[] {
    const keys: string[] = [];
    if (y0 === y1) {
      for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) keys.push(edgeKey('h', x, y0));
    } else if (x0 === x1) {
      for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) keys.push(edgeKey('v', x0, y));
    }
    return keys;
  }

  addRun(x0: number, y0: number, x1: number, y1: number, style = 0): void {
    for (const k of Lot.runEdges(x0, y0, x1, y1)) this.setWall(k, { kind: 'wall', style });
  }

  /** Outline a rectangle of walls and fill it with floor. */
  addRoom(x0: number, y0: number, x1: number, y1: number, floorStyle: number, wallStyle = 0): void {
    this.addRun(x0, y0, x1, y0, wallStyle);
    this.addRun(x0, y1, x1, y1, wallStyle);
    this.addRun(x0, y0, x0, y1, wallStyle);
    this.addRun(x1, y0, x1, y1, wallStyle);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.setFloor(x, y, floorStyle);
  }

  toJSON() {
    return { n: this.n, floors: this.floors, walls: [...this.walls.entries()] };
  }

  static fromJSON(d: { n: number; floors: number[]; walls: [string, Wall][] }): Lot {
    const lot = new Lot(d.n);
    lot.floors = d.floors.slice();
    lot.walls = new Map(d.walls);
    return lot;
  }
}
