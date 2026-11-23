import type { ObjectDef } from '../../content/objects';
import type { Dir } from '../../sim/objects';
import { localToWorld } from '../../sim/objects';
import { View, projectRotated, rotatePoint } from '../iso';
import { boxDepth, drawBox, poly } from './draw';
import type { Drawable } from './renderer';

/**
 * Collects an object's parts as individually depth-sorted drawables.
 * Draw code works in the object's local space (front faces +y), so one description renders correctly at any facing
 * and from any camera rotation.
 */
export class Painter {
  readonly out: Drawable[] = [];
  alpha = 1;
  tint: string | null = null;

  constructor(readonly v: View, readonly def: ObjectDef, readonly ox: number, readonly oy: number, readonly dir: Dir) {}

  private world(lx: number, ly: number): [number, number] {
    return localToWorld(this.def, this.ox, this.oy, this.dir, lx, ly);
  }

  box(lx0: number, ly0: number, lx1: number, ly1: number, z0: number, z1: number, color: string, depthBias = 0): void {
    const [ax, ay] = this.world(lx0, ly0);
    const [bx, by] = this.world(lx1, ly1);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const v = this.v;
    const alpha = this.alpha;
    const col = this.tint ?? color;
    this.out.push({
      depth: boxDepth(v, x0, y0, x1, y1) + depthBias,
      draw: (ctx) => {
        if (alpha < 1) ctx.globalAlpha = alpha;
        drawBox(ctx, v, x0, y0, x1, y1, z0, z1, col);
        if (alpha < 1) ctx.globalAlpha = 1;
      },
    });
  }

  /** A flat shape lying on a surface at height z (rugs, screens on top faces). */
  flat(lx0: number, ly0: number, lx1: number, ly1: number, z: number, color: string, depthBias = -0.3): void {
    const pts = [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]].map(([x, y]) => this.world(x, y));
    const v = this.v;
    const [cx, cy] = this.world((lx0 + lx1) / 2, (ly0 + ly1) / 2);
    const [rcx, rcy] = rotatePoint(cx, cy, v.rot, v.n);
    const alpha = this.alpha;
    const col = this.tint ?? color;
    this.out.push({
      depth: rcx + rcy + depthBias,
      draw: (ctx) => {
        if (alpha < 1) ctx.globalAlpha = alpha;
        poly(ctx, pts.map(([x, y]) => {
          const [rx, ry] = rotatePoint(x, y, v.rot, v.n);
          return projectRotated(v, rx, ry, z);
        }), col, 'rgba(0,0,0,0.15)');
        if (alpha < 1) ctx.globalAlpha = 1;
      },
    });
  }

  /** A small sphere-ish blob (plant leaves, lamp bulbs). */
  blob(lx: number, ly: number, z: number, r: number, color: string, depthBias = 0.01): void {
    const [x, y] = this.world(lx, ly);
    const v = this.v;
    const [rx, ry] = rotatePoint(x, y, v.rot, v.n);
    const alpha = this.alpha;
    const col = this.tint ?? color;
    this.out.push({
      depth: rx + ry + depthBias,
      draw: (ctx) => {
        const [sx, sy] = projectRotated(v, rx, ry, z);
        if (alpha < 1) ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 32 * v.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (alpha < 1) ctx.globalAlpha = 1;
      },
    });
  }
}
