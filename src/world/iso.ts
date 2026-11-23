/** Isometric projection with camera rotation in 4 stops. The sim only ever sees world coordinates. */
export type Rot = 0 | 1 | 2 | 3;
export const TILE_W = 64;
export const TILE_H = 32;
/** Pixels per world unit of height at zoom 1. */
export const Z_PX = 32;

/** Rotate a point in lot space (square lot of side n) by r quarter turns. */
export function rotatePoint(x: number, y: number, r: Rot, n: number): [number, number] {
  switch (r) {
    case 0: return [x, y];
    case 1: return [n - y, x];
    case 2: return [n - x, n - y];
    case 3: return [y, n - x];
  }
}

export function unrotatePoint(x: number, y: number, r: Rot, n: number): [number, number] {
  return rotatePoint(x, y, ((4 - r) % 4) as Rot, n);
}

/** Rotate a direction vector (no translation). */
export function rotateDir(dx: number, dy: number, r: Rot): [number, number] {
  switch (r) {
    case 0: return [dx, dy];
    case 1: return [-dy, dx];
    case 2: return [-dx, -dy];
    case 3: return [dy, -dx];
  }
}

export interface View {
  /** Camera center in world coordinates. */
  cx: number;
  cy: number;
  zoom: number;
  rot: Rot;
  /** Viewport size in CSS pixels. */
  w: number;
  h: number;
  /** Lot side length, used as the rotation pivot frame. */
  n: number;
}

/** Project a point given in rotated space. */
export function projectRotated(v: View, rx: number, ry: number, z = 0): [number, number] {
  const [ccx, ccy] = rotatePoint(v.cx, v.cy, v.rot, v.n);
  const sx = ((rx - ry) - (ccx - ccy)) * (TILE_W / 2) * v.zoom + v.w / 2;
  const sy = ((rx + ry) - (ccx + ccy)) * (TILE_H / 2) * v.zoom - z * Z_PX * v.zoom + v.h / 2;
  return [sx, sy];
}

export function worldToScreen(v: View, x: number, y: number, z = 0): [number, number] {
  const [rx, ry] = rotatePoint(x, y, v.rot, v.n);
  return projectRotated(v, rx, ry, z);
}

/** Inverse projection onto the ground plane (z = 0). */
export function screenToWorld(v: View, sx: number, sy: number): [number, number] {
  const [ccx, ccy] = rotatePoint(v.cx, v.cy, v.rot, v.n);
  const a = (sx - v.w / 2) / ((TILE_W / 2) * v.zoom) + (ccx - ccy);
  const b = (sy - v.h / 2) / ((TILE_H / 2) * v.zoom) + (ccx + ccy);
  const rx = (a + b) / 2;
  const ry = (b - a) / 2;
  return unrotatePoint(rx, ry, v.rot, v.n);
}

export function screenToTile(v: View, sx: number, sy: number): [number, number] {
  const [x, y] = screenToWorld(v, sx, sy);
  return [Math.floor(x), Math.floor(y)];
}

/** Painter's depth of a world point for the current rotation (bigger = closer to the camera). */
export function depthOf(v: View, x: number, y: number): number {
  const [rx, ry] = rotatePoint(x, y, v.rot, v.n);
  return rx + ry;
}
