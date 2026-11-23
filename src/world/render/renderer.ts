import { FLOORS, WALLS } from '../../content/styles';
import { View, projectRotated, rotatePoint, unrotatePoint } from '../iso';
import { Lot, edgePoints, parseEdge } from '../lot';
import { Pt, poly, shade, tilePoly } from './draw';

export type WallMode = 'up' | 'cutaway' | 'down';
export const WALL_H = 2.6;
const STUB_H = 0.3;

export interface Drawable {
  depth: number;
  draw(ctx: CanvasRenderingContext2D, v: View): void;
}

export interface SceneSource {
  lot: Lot;
  /** Objects, Mims, effects: anything that needs depth sorting against walls. */
  drawables(v: View): Drawable[];
  /** Drawn on top of the ground, below everything else (selection rings, previews). */
  groundOverlay?(ctx: CanvasRenderingContext2D, v: View): void;
  /** Drawn last (bubbles, placement ghosts). */
  overlay?(ctx: CanvasRenderingContext2D, v: View): void;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  wallMode: WallMode = 'cutaway';

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(v: View): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    v.w = w;
    v.h = h;
  }

  frame(v: View, scene: SceneSource, fade: number): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#3f6b3a';
    ctx.fillRect(0, 0, v.w, v.h);
    this.drawGround(v, scene.lot);
    scene.groundOverlay?.(ctx, v);
    const items: Drawable[] = [...this.wallDrawables(v, scene.lot), ...scene.drawables(v)];
    items.sort((a, b) => a.depth - b.depth);
    for (const d of items) d.draw(ctx, v);
    scene.overlay?.(ctx, v);
    if (fade > 0) {
      ctx.fillStyle = `rgba(20,16,40,${fade * 0.85})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }
  }

  private drawGround(v: View, lot: Lot): void {
    const ctx = this.ctx;
    const n = lot.n;
    // street along the far +y side of the lot, in world space
    const road: Pt[] = [[-6, n + 1], [n + 6, n + 1], [n + 6, n + 4], [-6, n + 4]];
    const walk: Pt[] = [[-6, n], [n + 6, n], [n + 6, n + 1], [-6, n + 1]];
    const proj = (pts: Pt[]) => pts.map(([x, y]) => {
      const [rx, ry] = rotatePoint(x, y, v.rot, n);
      return projectRotated(v, rx, ry, 0);
    });
    poly(ctx, proj(walk), '#b7b2a6');
    poly(ctx, proj(road), '#4a4a52');
    for (let x = -6; x < n + 6; x += 2) {
      poly(ctx, proj([[x, n + 2.45], [x + 1, n + 2.45], [x + 1, n + 2.55], [x, n + 2.55]]), '#e8d36a');
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const f = lot.floor(x, y);
        const pts = tilePoly(v, x, y);
        if (f < 0) {
          const g = (x * 7 + y * 13) % 5 === 0 ? '#66a456' : (x + y) % 2 ? '#6aab59' : '#64a253';
          poly(ctx, pts, g);
          continue;
        }
        const st = FLOORS[f] ?? FLOORS[0];
        const col = st.pattern === 'checker' && (x + y) % 2 ? st.b : st.a;
        poly(ctx, pts, col, 'rgba(0,0,0,0.12)');
        if (st.pattern === 'planks' && v.zoom >= 0.75) {
          ctx.strokeStyle = shade(st.a, 0.8);
          ctx.lineWidth = 1;
          for (const t of [0.33, 0.66]) {
            const a = this.groundPt(v, x + t, y);
            const b = this.groundPt(v, x + t, y + 1);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        }
      }
    }
    // lot border
    poly(ctx, proj([[0, 0], [n, 0], [n, n], [0, n]]), undefined, 'rgba(255,255,255,0.25)', 1.5);
  }

  private groundPt(v: View, x: number, y: number): Pt {
    const [rx, ry] = rotatePoint(x, y, v.rot, v.n);
    return projectRotated(v, rx, ry, 0);
  }

  /** In cutaway mode, a wall drops when the tile it would hide (the one behind it from the camera) is indoors. */
  wallHeight(v: View, lot: Lot, key: string): number {
    if (this.wallMode === 'down') return STUB_H;
    if (this.wallMode === 'up') return WALL_H;
    const { axis, x, y } = parseEdge(key);
    const [a, b] = edgePoints(axis, x, y);
    const [ax, ay] = rotatePoint(a[0], a[1], v.rot, v.n);
    const [bx, by] = rotatePoint(b[0], b[1], v.rot, v.n);
    // Tile just behind the wall in rotated space
    let bcx: number, bcy: number;
    if (Math.abs(ay - by) < 1e-6) {
      bcx = Math.min(ax, bx) + 0.5;
      bcy = ay - 0.5;
    } else {
      bcx = ax - 0.5;
      bcy = Math.min(ay, by) + 0.5;
    }
    const [wx, wy] = unrotatePoint(bcx, bcy, v.rot, v.n);
    const tx = Math.floor(wx), ty = Math.floor(wy);
    return lot.floor(tx, ty) >= 0 ? STUB_H : WALL_H;
  }

  private wallDrawables(v: View, lot: Lot): Drawable[] {
    const out: Drawable[] = [];
    for (const [key, wall] of lot.walls) {
      const { axis, x, y } = parseEdge(key);
      const [a, b] = edgePoints(axis, x, y);
      const [ax, ay] = rotatePoint(a[0], a[1], v.rot, v.n);
      const [bx, by] = rotatePoint(b[0], b[1], v.rot, v.n);
      const depth = (ax + bx) / 2 + (ay + by) / 2 - 0.02;
      const h = this.wallHeight(v, lot, key);
      out.push({
        depth,
        draw: (ctx) => {
          const st = WALLS[wall.style] ?? WALLS[0];
          const xRun = Math.abs(ay - by) < 1e-6;
          const base = shade(st.color, xRun ? 0.92 : 0.75);
          const P = (t: number, z: number) => projectRotated(v, ax + (bx - ax) * t, ay + (by - ay) * t, z);
          poly(ctx, [P(0, 0), P(1, 0), P(1, h), P(0, h)], base, 'rgba(0,0,0,0.2)');
          // top cap
          ctx.strokeStyle = shade(st.trim, 0.9);
          ctx.lineWidth = Math.max(1.5, 3 * v.zoom);
          const t0 = P(0, h), t1 = P(1, h);
          ctx.beginPath();
          ctx.moveTo(t0[0], t0[1]);
          ctx.lineTo(t1[0], t1[1]);
          ctx.stroke();
          if (wall.kind === 'door') {
            const dh = Math.min(h, 2.1);
            poly(ctx, [P(0.2, 0), P(0.8, 0), P(0.8, dh), P(0.2, dh)], h < 1 ? shade('#6b4a2f', 0.9) : '#6b4a2f', 'rgba(0,0,0,0.35)');
            if (h >= 1) {
              const k = P(0.7, 1.0);
              ctx.fillStyle = '#e8c860';
              ctx.beginPath();
              ctx.arc(k[0], k[1], 2 * v.zoom + 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (wall.kind === 'window' && h > 1.2) {
            poly(ctx, [P(0.18, 1.0), P(0.82, 1.0), P(0.82, 2.1), P(0.18, 2.1)], 'rgba(170,215,240,0.9)', shade(st.trim, 0.7), 2);
            const m0 = P(0.5, 1.0), m1 = P(0.5, 2.1);
            ctx.strokeStyle = shade(st.trim, 0.7);
            ctx.beginPath();
            ctx.moveTo(m0[0], m0[1]);
            ctx.lineTo(m1[0], m1[1]);
            ctx.stroke();
          } else if (wall.kind === 'window') {
            const m0 = P(0.18, h), m1 = P(0.82, h);
            ctx.strokeStyle = 'rgba(170,215,240,1)';
            ctx.lineWidth = Math.max(2, 3 * v.zoom);
            ctx.beginPath();
            ctx.moveTo(m0[0], m0[1]);
            ctx.lineTo(m1[0], m1[1]);
            ctx.stroke();
          }
        },
      });
    }
    return out;
  }
}
