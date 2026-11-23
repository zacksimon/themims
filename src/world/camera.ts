import { Rot, View, screenToWorld } from './iso';

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2];
const ROTATE_MS = 220;

/** Camera state plus a short fade when rotating between the 4 stops. */
export class Camera implements View {
  cx: number;
  cy: number;
  zoom = 1;
  rot: Rot = 0;
  w = 800;
  h = 600;
  n: number;
  private turnStart = -1;
  private pendingRot: Rot = 0;

  constructor(n: number) {
    this.n = n;
    this.cx = n / 2;
    this.cy = n / 2;
  }

  get rotating(): boolean {
    return this.turnStart >= 0;
  }

  /** Rotate by +1 (clockwise) or -1. The world point at screen center stays put because the center is stored in world space. */
  rotate(dir: 1 | -1, now = performance.now()): void {
    if (this.rotating) return;
    this.pendingRot = (((this.rot + dir) % 4) + 4) % 4 as Rot;
    this.turnStart = now;
  }

  /** Apply rotation immediately (tests, loading a save). */
  setRot(r: Rot): void {
    this.rot = r;
    this.turnStart = -1;
  }

  /** Returns overlay opacity (0..1) for the rotation fade. */
  update(now = performance.now()): number {
    if (!this.rotating) return 0;
    const t = (now - this.turnStart) / ROTATE_MS;
    if (t >= 0.5 && this.rot !== this.pendingRot) this.rot = this.pendingRot;
    if (t >= 1) {
      this.turnStart = -1;
      return 0;
    }
    return 1 - Math.abs(t - 0.5) * 2;
  }

  /** Pan so the world point under `from` ends up under `to`. */
  panScreen(fromX: number, fromY: number, toX: number, toY: number): void {
    const [ax, ay] = screenToWorld(this, fromX, fromY);
    const [bx, by] = screenToWorld(this, toX, toY);
    this.cx += ax - bx;
    this.cy += ay - by;
    this.clamp();
  }

  /** Pan by a screen-relative direction (keyboard): dx right, dy down, in tiles. */
  panDir(dx: number, dy: number): void {
    const [ax, ay] = screenToWorld(this, this.w / 2, this.h / 2);
    const [bx, by] = screenToWorld(this, this.w / 2 + dx * 32 * this.zoom, this.h / 2 + dy * 16 * this.zoom);
    this.cx += bx - ax;
    this.cy += by - ay;
    this.clamp();
  }

  /** Zoom keeping the world point under (sx, sy) fixed. */
  zoomAt(newZoom: number, sx = this.w / 2, sy = this.h / 2): void {
    const z = Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], Math.max(ZOOM_LEVELS[0], newZoom));
    const [ax, ay] = screenToWorld(this, sx, sy);
    this.zoom = z;
    const [bx, by] = screenToWorld(this, sx, sy);
    this.cx += ax - bx;
    this.cy += ay - by;
    this.clamp();
  }

  zoomStep(dir: 1 | -1, sx?: number, sy?: number): void {
    const i = this.nearestLevel();
    const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + dir))];
    this.zoomAt(next, sx, sy);
  }

  snapZoom(sx?: number, sy?: number): void {
    this.zoomAt(ZOOM_LEVELS[this.nearestLevel()], sx, sy);
  }

  private nearestLevel(): number {
    let best = 0;
    ZOOM_LEVELS.forEach((z, i) => {
      if (Math.abs(z - this.zoom) < Math.abs(ZOOM_LEVELS[best] - this.zoom)) best = i;
    });
    return best;
  }

  clamp(): void {
    this.cx = Math.min(this.n + 2, Math.max(-2, this.cx));
    this.cy = Math.min(this.n + 4, Math.max(-2, this.cy));
  }

  toJSON() {
    return { cx: this.cx, cy: this.cy, zoom: this.zoom, rot: this.rot };
  }

  load(d: { cx: number; cy: number; zoom: number; rot: Rot }): void {
    this.cx = d.cx;
    this.cy = d.cy;
    this.zoom = d.zoom;
    this.setRot(d.rot);
  }
}
