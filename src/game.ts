import { SPEEDS } from './engine/clock';
import { Loop } from './engine/loop';
import { Gesture, GestureRecognizer } from './engine/input';
import { World } from './sim/world';
import { Camera } from './world/camera';
import { Drawable, Renderer, SceneSource, WallMode } from './world/render/renderer';
import { Hud } from './ui/hud';
import { View, depthOf, screenToTile, worldToScreen } from './world/iso';
import { drawMim, drawSelection } from './world/render/mimDraw';
import { tilePoly, poly } from './world/render/draw';
import type { Mim } from './sim/mim';

/** Wires simulation, rendering, input and UI together. */
export class Game implements SceneSource {
  readonly camera: Camera;
  readonly renderer: Renderer;
  readonly loop: Loop;
  readonly hud: Hud;
  readonly gestures: GestureRecognizer;
  speedIndex = 1;
  selectedId: number | null = null;
  /** Brief marker where the player sent a Mim. */
  private marker: { x: number; y: number; until: number; ok: boolean } | null = null;
  private now = 0;
  private keys = new Set<string>();
  private lastFrame = 0;
  private wheelAcc = 0;
  private wheelSnapTimer = 0;

  constructor(public world: World, canvas: HTMLCanvasElement, private uiRoot: HTMLElement) {
    this.camera = new Camera(world.lot.n);
    this.renderer = new Renderer(canvas);
    this.renderer.resize(this.camera);
    if (this.camera.w < 600) this.camera.zoom = 0.5;
    else if (this.camera.w < 1000) this.camera.zoom = 0.75;
    this.loop = new Loop((dt) => this.world.step(dt), (now) => this.render(now));
    this.hud = new Hud(this);
    this.uiRoot.append(this.hud.root);
    this.gestures = new GestureRecognizer((g) => this.onGesture(g));
    this.bindInput(canvas);
    window.addEventListener('resize', () => this.renderer.resize(this.camera));
  }

  get lot() {
    return this.world.lot;
  }

  start(): void {
    this.loop.start();
  }

  setSpeed(i: number): void {
    this.speedIndex = i;
    this.loop.speed = SPEEDS[i];
  }

  setWallMode(m: WallMode): void {
    this.renderer.wallMode = m;
  }

  get selected(): Mim | undefined {
    return this.selectedId === null ? undefined : this.world.mim(this.selectedId);
  }

  select(id: number | null): void {
    this.selectedId = id;
  }

  drawables(v: View): Drawable[] {
    return this.world.mims.map((m) => ({
      depth: depthOf(v, m.x, m.y) + 0.01,
      draw: (ctx: CanvasRenderingContext2D) => drawMim(ctx, v, m),
    }));
  }

  groundOverlay(ctx: CanvasRenderingContext2D, v: View): void {
    const mk = this.marker;
    if (mk && this.now < mk.until) {
      const a = (mk.until - this.now) / 700;
      poly(ctx, tilePoly(v, mk.x, mk.y), mk.ok ? `rgba(255,226,122,${0.55 * a})` : `rgba(217,75,59,${0.55 * a})`);
    }
  }

  overlay(ctx: CanvasRenderingContext2D, v: View): void {
    const m = this.selected;
    if (m) drawSelection(ctx, v, m.x, m.y, this.now);
  }

  /** Screen position of a world point (used by tests and UI anchoring). */
  screenOf(x: number, y: number, z = 0): [number, number] {
    return worldToScreen(this.camera, x, y, z);
  }

  /** Find the Mim drawn under a screen point (front-most wins). */
  mimAt(sx: number, sy: number): Mim | undefined {
    const v = this.camera;
    let best: Mim | undefined;
    let bestDepth = -Infinity;
    for (const m of this.world.mims) {
      const [px, py] = worldToScreen(v, m.x, m.y, 0);
      const w = 16 * v.zoom, top = 62 * v.zoom;
      if (sx >= px - w && sx <= px + w && sy <= py + 6 * v.zoom && sy >= py - top) {
        const d = depthOf(v, m.x, m.y);
        if (d > bestDepth) {
          best = m;
          bestDepth = d;
        }
      }
    }
    return best;
  }

  /** Live-mode tap: select a Mim, or send the selected Mim to a tile. */
  tap(sx: number, sy: number): void {
    const hit = this.mimAt(sx, sy);
    if (hit) {
      this.select(hit.id);
      return;
    }
    const m = this.selected;
    if (!m) return;
    const [tx, ty] = screenToTile(this.camera, sx, sy);
    const ok = this.world.walkTo(m, [tx, ty]);
    this.marker = { x: tx, y: ty, until: this.now + 700, ok };
    if (!ok) this.hud.toast(`${m.name} can't get there. They checked twice.`, 'bad', 2500);
  }

  private render(now: number): void {
    this.now = now;
    for (const t of this.world.outbox.splice(0)) this.hud.toast(t.text, t.kind);
    this.gestures.tick(now);
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16.7;
    this.lastFrame = now;
    this.applyHeldKeys(dt);
    const fade = this.camera.update(now);
    this.renderer.frame(this.camera, this, fade);
    this.hud.update();
  }

  /** Keyboard panning, scaled by frame time so it moves at the same speed on 60 Hz and 120 Hz displays. */
  private applyHeldKeys(dtMs: number): void {
    const k = this.keys;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const f = (dtMs / 16.7) * 0.35;
    if (dx || dy) this.camera.panDir(dx * f, dy * f);
  }

  protected onGesture(g: Gesture): void {
    // During the rotation fade, ignore gestures that pick things or rotate again; camera moves still apply.
    if (this.camera.rotating && (g.type === 'tap' || g.type === 'longpress' || g.type === 'twist')) return;
    if (this.handleGesture(g)) return;
    switch (g.type) {
      case 'dragmove':
        this.camera.panScreen(g.px, g.py, g.x, g.y);
        break;
      case 'pan2':
        this.camera.panScreen(g.px, g.py, g.x, g.y);
        break;
      case 'pinch':
        this.camera.zoomAt(this.camera.zoom * g.scale, g.x, g.y);
        break;
      case 'pinchend':
        this.camera.snapZoom(g.x, g.y);
        break;
      case 'tap':
        this.tap(g.x, g.y);
        break;
      case 'twist':
        this.camera.rotate(g.dir);
        break;
      default:
        break;
    }
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    const send = (e: PointerEvent, kind: 'down' | 'move' | 'up' | 'cancel') => {
      this.gestures.handle({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind, pointer: e.pointerType, button: e.button });
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      send(e, 'down');
    });
    canvas.addEventListener('pointermove', (e) => send(e, 'move'));
    canvas.addEventListener('pointerup', (e) => send(e, 'up'));
    canvas.addEventListener('pointercancel', (e) => send(e, 'cancel'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.onWheel(e);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'q') this.camera.rotate(-1);
      else if (k === 'e') this.camera.rotate(1);
      else if (k === '+' || k === '=') this.camera.zoomStep(1);
      else if (k === '-' || k === '_') this.camera.zoomStep(-1);
      else if (k === ' ') {
        e.preventDefault();
        this.setSpeed(this.speedIndex === 0 ? 1 : 0);
      } else if (k >= '0' && k <= '3') this.setSpeed(+k);
      else this.keys.add(k);
      this.onKey(k, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /**
   * Mouse wheels step one zoom level per notch. Trackpads send many small deltas, so we accumulate them,
   * and trackpad pinches (ctrlKey) zoom continuously, then snap to a level once the gesture goes quiet.
   */
  private onWheel(e: WheelEvent): void {
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (e.ctrlKey) {
      this.camera.zoomAt(this.camera.zoom * Math.exp(-px * 0.01), e.clientX, e.clientY);
      clearTimeout(this.wheelSnapTimer);
      this.wheelSnapTimer = window.setTimeout(() => this.camera.snapZoom(e.clientX, e.clientY), 160);
      return;
    }
    this.wheelAcc += px;
    if (Math.abs(this.wheelAcc) >= 50) {
      this.camera.zoomStep(this.wheelAcc < 0 ? 1 : -1, e.clientX, e.clientY);
      this.wheelAcc = 0;
    }
    clearTimeout(this.wheelSnapTimer);
    this.wheelSnapTimer = window.setTimeout(() => (this.wheelAcc = 0), 200);
  }

  /** Mode-specific gesture handling; return true to consume the gesture. */
  protected handleGesture(_g: Gesture): boolean {
    return false;
  }

  protected onKey(_k: string, _e: KeyboardEvent): void {}
}
