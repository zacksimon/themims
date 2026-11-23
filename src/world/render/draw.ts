import { Rot, View, projectRotated, rotatePoint } from '../iso';

export type Pt = [number, number];

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const cache = new Map<string, [number, number, number]>();
export function rgb(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    const v = parseInt(h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h, 16);
    c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    cache.set(hex, c);
  }
  return c;
}

/** Multiply a color's brightness by f (f < 1 darkens, f > 1 lightens). */
export function shade(hex: string, f: number): string {
  const [r, g, b] = rgb(hex);
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/**
 * Draw an axis-aligned box given in world coordinates. Because rotation maps axis-aligned boxes to axis-aligned boxes,
 * we can work out the box in rotated space and always draw the top plus the two faces that face the camera.
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  v: View,
  x0: number, y0: number, x1: number, y1: number, z0: number, z1: number,
  color: string,
  outline = true,
): void {
  const [ax, ay] = rotatePoint(x0, y0, v.rot, v.n);
  const [bx, by] = rotatePoint(x1, y1, v.rot, v.n);
  const rx0 = Math.min(ax, bx), rx1 = Math.max(ax, bx), ry0 = Math.min(ay, by), ry1 = Math.max(ay, by);
  const p = (rx: number, ry: number, z: number) => projectRotated(v, rx, ry, z);
  const stroke = outline ? 'rgba(0,0,0,0.18)' : undefined;
  // left-front face (ry = max)
  poly(ctx, [p(rx0, ry1, z0), p(rx1, ry1, z0), p(rx1, ry1, z1), p(rx0, ry1, z1)], shade(color, 0.82), stroke);
  // right-front face (rx = max)
  poly(ctx, [p(rx1, ry0, z0), p(rx1, ry1, z0), p(rx1, ry1, z1), p(rx1, ry0, z1)], shade(color, 0.66), stroke);
  // top
  poly(ctx, [p(rx0, ry0, z1), p(rx1, ry0, z1), p(rx1, ry1, z1), p(rx0, ry1, z1)], color, stroke);
}

/** Rotated-space center depth of a world-space box, for sorting boxes within an object. */
export function boxDepth(v: View, x0: number, y0: number, x1: number, y1: number): number {
  const [ax, ay] = rotatePoint(x0, y0, v.rot, v.n);
  const [bx, by] = rotatePoint(x1, y1, v.rot, v.n);
  return (ax + bx) / 2 + (ay + by) / 2;
}

/** Ground-plane diamond for a world tile. */
export function tilePoly(v: View, x: number, y: number, rot: Rot = v.rot): Pt[] {
  const corners: Pt[] = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  return corners.map(([cx, cy]) => {
    const [rx, ry] = rotatePoint(cx, cy, rot, v.n);
    return projectRotated(v, rx, ry, 0);
  });
}
