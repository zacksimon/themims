import { SPEEDS } from './engine/clock';
import { Loop } from './engine/loop';
import { Gesture, GestureRecognizer } from './engine/input';
import { World } from './sim/world';
import { Camera } from './world/camera';
import { Drawable, Renderer, SceneSource, WallMode } from './world/render/renderer';
import { Hud } from './ui/hud';
import { View, depthOf, screenToTile, worldToScreen } from './world/iso';
import { drawBubble, drawMim, drawSelection } from './world/render/mimDraw';
import { tilePoly, poly } from './world/render/draw';
import type { Mim } from './sim/mim';
import { Painter } from './world/render/painter';
import { ObjInst, defOf, worldSize } from './sim/objects';
import { moodOf } from './sim/needs';
import { PieMenu, PieOption } from './ui/pieMenu';
import { MimPanel } from './ui/mimPanel';
import { h } from './ui/dom';

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
  readonly pie: PieMenu;
  readonly panel: MimPanel;
  private tooltip = h('div', { class: 'tooltip panel', style: 'display:none' });
  private tooltipUntil = 0;
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
    this.panel = new MimPanel(this);
    this.uiRoot.append(this.panel.root, this.tooltip);
    this.pie = new PieMenu(this.uiRoot);
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
    const out: Drawable[] = [];
    for (const o of this.world.objects) {
      const p = new Painter(v, defOf(o), o.x, o.y, o.dir);
      defOf(o).draw(p, o, this.now);
      out.push(...p.out);
    }
    for (const m of this.world.mims) {
      const a = m.queue[0];
      const act = a?.phase === 'use' && a.kind === 'interact' ? a.ix : undefined;
      // A lying Mim sorts by whichever end of its body is closest to the camera, so the mattress never covers it.
      const depth = m.lie ? Math.max(depthOf(v, m.lie[0], m.lie[1]), depthOf(v, m.lie[2], m.lie[3])) + 0.01 : depthOf(v, m.x, m.y) + 0.01;
      out.push({
        depth,
        draw: (ctx: CanvasRenderingContext2D) =>
          drawMim(ctx, v, { ...m, mood: moodOf(m.needs) / 100, act, t: this.now }),
      });
    }
    return out;
  }

  groundOverlay(ctx: CanvasRenderingContext2D, v: View): void {
    const mk = this.marker;
    if (mk && this.now < mk.until) {
      const a = (mk.until - this.now) / 700;
      poly(ctx, tilePoly(v, mk.x, mk.y), mk.ok ? `rgba(255,226,122,${0.55 * a})` : `rgba(217,75,59,${0.55 * a})`);
    }
  }

  overlay(ctx: CanvasRenderingContext2D, v: View): void {
    const sel = this.selected;
    if (sel) drawSelection(ctx, v, sel.x, sel.y, this.now, sel.pose === 'lie' ? 1.3 : sel.pose === 'sit' ? 2.0 : 2.1);
    for (const m of this.world.mims) {
      if (!m.thought) continue;
      const head = m.pose === 'lie' ? 1.1 : m.pose === 'sit' ? 1.8 : 2.0;
      drawBubble(ctx, v, m.x, m.y, head + m.z + (m === sel ? 0.7 : 0), m.thought.icon);
    }
  }

  /** Screen-space silhouette of an object (its footprint box extruded to its height). */
  private objHull(o: ObjInst): [number, number][] {
    const [w, hgt] = worldSize(defOf(o), o.dir);
    const pts: [number, number][] = [];
    for (const [x, y] of [[o.x, o.y], [o.x + w, o.y], [o.x + w, o.y + hgt], [o.x, o.y + hgt]])
      for (const z of [0, defOf(o).height]) pts.push(worldToScreen(this.camera, x, y, z));
    return convexHull(pts);
  }

  /** Front-most object whose silhouette contains the screen point. */
  objAt(sx: number, sy: number): ObjInst | undefined {
    let best: ObjInst | undefined;
    let bd = -Infinity;
    for (const o of this.world.objects) {
      if (!pointInPoly(sx, sy, this.objHull(o))) continue;
      const [w, hh] = worldSize(defOf(o), o.dir);
      const d = depthOf(this.camera, o.x + w / 2, o.y + hh / 2);
      if (d > bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** Pie menu of interactions for the selected Mim on an object. */
  openObjectMenu(o: ObjInst, sx: number, sy: number): void {
    const m = this.selected;
    const def = defOf(o);
    if (!m) {
      this.showTooltip(sx, sy, def.name, def.desc);
      return;
    }
    const opts: PieOption[] = def.interactions
      .filter((ix) => !ix.hidden && (!ix.available || ix.available(this.world, m, o)))
      .map((ix) => ({
        label: ix.label,
        icon: ix.icon,
        disabled: !!ix.cost && this.world.funds < ix.cost,
        onSelect: () => {
          if (!this.world.queueInteraction(m, o, ix.id)) this.hud.toast(`${m.name}'s to-do list is full.`, 'bad', 2500);
        },
      }));
    if (!opts.length) {
      this.showTooltip(sx, sy, def.name, def.desc);
      return;
    }
    this.hideTooltip();
    this.pie.show(sx, sy, def.name, opts);
  }

  showTooltip(sx: number, sy: number, title: string, body: string, ms = 2600): void {
    this.tooltip.replaceChildren(h('b', {}, title), body);
    this.tooltip.style.display = '';
    const w = 240;
    this.tooltip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, sx - w / 2))}px`;
    this.tooltip.style.top = `${Math.max(60, sy - 90)}px`;
    this.tooltipUntil = performance.now() + ms;
  }

  hideTooltip(): void {
    this.tooltip.style.display = 'none';
    this.tooltipUntil = 0;
  }

  private hover(sx: number, sy: number): void {
    if (this.pie.open) return;
    const o = this.objAt(sx, sy);
    const m = this.mimAt(sx, sy);
    if (m) {
      const a = m.queue[0];
      this.showTooltip(sx, sy, m.name, a ? `Busy: ${a.label}` : 'Idle', 1200);
    } else if (o) {
      const d = defOf(o);
      this.showTooltip(sx, sy, d.name, `₥${d.price} · ${d.desc}`, 1200);
    } else if (performance.now() < this.tooltipUntil) this.tooltipUntil = 0;
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

  /** Live-mode tap: select a Mim, open an object's pie menu, or send the selected Mim to a tile. */
  tap(sx: number, sy: number): void {
    const hit = this.mimAt(sx, sy);
    if (hit) {
      this.select(hit.id);
      return;
    }
    const o = this.objAt(sx, sy);
    if (o) {
      this.openObjectMenu(o, sx, sy);
      return;
    }
    const m = this.selected;
    if (!m) return;
    const [tx, ty] = screenToTile(this.camera, sx, sy);
    const ok = !!this.world.queueGoto(m, [tx, ty]);
    this.marker = { x: tx, y: ty, until: this.now + 700, ok };
  }

  private longPress(sx: number, sy: number): void {
    const m = this.mimAt(sx, sy);
    if (m) {
      const a = m.queue[0];
      this.showTooltip(sx, sy, m.name, a ? `Busy: ${a.label}` : 'Idle');
      return;
    }
    const o = this.objAt(sx, sy);
    if (o) {
      const d = defOf(o);
      const uses = d.interactions.filter((i) => !i.hidden).map((i) => i.label).join(', ');
      this.showTooltip(sx, sy, d.name, `₥${d.price} · ${d.desc}${uses ? ` Uses: ${uses}.` : ''}`);
    }
  }

  private render(now: number): void {
    this.now = now;
    for (const t of this.world.outbox.splice(0)) this.hud.toast(t.text, t.kind);
    if (this.tooltip.style.display !== 'none' && now > this.tooltipUntil) this.tooltip.style.display = 'none';
    this.gestures.tick(now);
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16.7;
    this.lastFrame = now;
    this.applyHeldKeys(dt);
    const fade = this.camera.update(now);
    this.renderer.frame(this.camera, this, fade);
    this.hud.update();
    this.panel.update();
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
      case 'longpress':
        this.longPress(g.x, g.y);
        break;
      case 'hover':
        this.hover(g.x, g.y);
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

function convexHull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
