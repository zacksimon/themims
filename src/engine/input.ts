/** Turns raw pointer events into gestures. Pure logic (no DOM) so it can be unit tested. */
export type Gesture =
  | { type: 'tap'; x: number; y: number; pointer: string; button: number }
  | { type: 'longpress'; x: number; y: number }
  | { type: 'hover'; x: number; y: number }
  | { type: 'dragstart'; x: number; y: number; button: number; pointer: string }
  | { type: 'dragmove'; x: number; y: number; px: number; py: number; button: number; pointer: string }
  | { type: 'dragend'; x: number; y: number; button: number; pointer: string }
  | { type: 'pan2'; px: number; py: number; x: number; y: number }
  | { type: 'pinch'; scale: number; x: number; y: number }
  | { type: 'pinchend'; x: number; y: number }
  | { type: 'twist'; dir: 1 | -1 };

export interface PointerIn {
  id: number;
  x: number;
  y: number;
  t: number;
  kind: 'down' | 'move' | 'up' | 'cancel';
  pointer: string; // 'touch' | 'mouse' | 'pen'
  button?: number;
}

const TAP_SLOP = 10;
const LONG_PRESS_MS = 500;
const TWIST_RAD = 0.6; // about 35 degrees

interface Track { id: number; sx: number; sy: number; x: number; y: number; t0: number; button: number; pointer: string }

export class GestureRecognizer {
  private tracks = new Map<number, Track>();
  private dragging = false;
  private multi = false;
  private longFired = false;
  private pinchDist = 0;
  private twistAngle = 0;
  private twistAcc = 0;
  private cx = 0;
  private cy = 0;

  constructor(private emit: (g: Gesture) => void) {}

  /** Call periodically (or on timers) so long-press can fire without movement. */
  tick(now: number): void {
    if (this.tracks.size !== 1 || this.dragging || this.multi || this.longFired) return;
    const tr = [...this.tracks.values()][0];
    if (now - tr.t0 >= LONG_PRESS_MS) {
      this.longFired = true;
      this.emit({ type: 'longpress', x: tr.x, y: tr.y });
    }
  }

  handle(e: PointerIn): void {
    if (e.kind === 'down') return this.down(e);
    if (e.kind === 'move') return this.move(e);
    return this.up(e);
  }

  private down(e: PointerIn) {
    if (this.tracks.size === 0) {
      this.dragging = false;
      this.multi = false;
      this.longFired = false;
    }
    this.tracks.set(e.id, { id: e.id, sx: e.x, sy: e.y, x: e.x, y: e.y, t0: e.t, button: e.button ?? 0, pointer: e.pointer });
    if (this.tracks.size === 2) {
      if (this.dragging) {
        const first = [...this.tracks.values()][0];
        this.emit({ type: 'dragend', x: first.x, y: first.y, button: first.button, pointer: first.pointer });
        this.dragging = false;
      }
      this.multi = true;
      this.startMulti();
    }
  }

  private startMulti() {
    const [a, b] = [...this.tracks.values()];
    this.pinchDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    this.twistAngle = Math.atan2(b.y - a.y, b.x - a.x);
    this.twistAcc = 0;
    this.cx = (a.x + b.x) / 2;
    this.cy = (a.y + b.y) / 2;
  }

  private move(e: PointerIn) {
    const tr = this.tracks.get(e.id);
    if (!tr) {
      if (e.pointer === 'mouse') this.emit({ type: 'hover', x: e.x, y: e.y });
      return;
    }
    const px = tr.x;
    const py = tr.y;
    tr.x = e.x;
    tr.y = e.y;
    if (this.multi) {
      if (this.tracks.size < 2) return;
      const [a, b] = [...this.tracks.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const ncx = (a.x + b.x) / 2;
      const ncy = (a.y + b.y) / 2;
      this.emit({ type: 'pan2', px: this.cx, py: this.cy, x: ncx, y: ncy });
      this.cx = ncx;
      this.cy = ncy;
      if (Math.abs(dist / this.pinchDist - 1) > 0.01) {
        this.emit({ type: 'pinch', scale: dist / this.pinchDist, x: ncx, y: ncy });
        this.pinchDist = dist;
      }
      let d = ang - this.twistAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.twistAngle = ang;
      this.twistAcc += d;
      if (Math.abs(this.twistAcc) >= TWIST_RAD) {
        this.emit({ type: 'twist', dir: this.twistAcc > 0 ? 1 : -1 });
        this.twistAcc = 0;
      }
      return;
    }
    if (this.longFired) return;
    if (!this.dragging && Math.hypot(tr.x - tr.sx, tr.y - tr.sy) > TAP_SLOP) {
      this.dragging = true;
      this.emit({ type: 'dragstart', x: tr.sx, y: tr.sy, button: tr.button, pointer: tr.pointer });
      this.emit({ type: 'dragmove', x: tr.x, y: tr.y, px: tr.sx, py: tr.sy, button: tr.button, pointer: tr.pointer });
      return;
    }
    if (this.dragging) this.emit({ type: 'dragmove', x: tr.x, y: tr.y, px, py, button: tr.button, pointer: tr.pointer });
  }

  private up(e: PointerIn) {
    const tr = this.tracks.get(e.id);
    if (!tr) return;
    this.tracks.delete(e.id);
    if (this.multi) {
      if (this.tracks.size === 0) this.emit({ type: 'pinchend', x: this.cx, y: this.cy });
      return;
    }
    if (e.kind === 'cancel') {
      if (this.dragging) this.emit({ type: 'dragend', x: tr.x, y: tr.y, button: tr.button, pointer: tr.pointer });
      return;
    }
    if (this.dragging) {
      this.emit({ type: 'dragend', x: tr.x, y: tr.y, button: tr.button, pointer: tr.pointer });
    } else if (!this.longFired) {
      this.emit({ type: 'tap', x: tr.x, y: tr.y, pointer: tr.pointer, button: tr.button });
    }
  }
}
